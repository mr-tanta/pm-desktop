use crate::models::{Config, GitStatus, Project, ProjectDetail, ProjectLocation};
use crate::services::ConfigService;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, RwLock};
use std::time::{Duration, Instant};

// Git status cache with TTL
struct CachedGitStatus {
    status: Option<GitStatus>,
    cached_at: Instant,
}

static GIT_STATUS_CACHE: LazyLock<RwLock<HashMap<PathBuf, CachedGitStatus>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

const GIT_CACHE_TTL: Duration = Duration::from_secs(30);

fn detect_project_type(path: &Path) -> Option<String> {
    // Read package.json once and check all patterns
    if path.join("package.json").exists() {
        if let Ok(content) = fs::read_to_string(path.join("package.json")) {
            if content.contains("\"next\"") {
                return Some("Next.js".to_string());
            }
            if content.contains("\"react\"") && content.contains("\"vite\"") {
                return Some("React + Vite".to_string());
            }
            if content.contains("\"react\"") {
                return Some("React".to_string());
            }
            if content.contains("\"@nestjs/core\"") {
                return Some("NestJS".to_string());
            }
            if content.contains("\"express\"") {
                return Some("Express".to_string());
            }
            if content.contains("\"vue\"") {
                return Some("Vue.js".to_string());
            }
            if content.contains("\"svelte\"") {
                return Some("Svelte".to_string());
            }
            return Some("Node.js".to_string());
        }
    }

    if path.join("Cargo.toml").exists() {
        if let Ok(content) = fs::read_to_string(path.join("Cargo.toml")) {
            if content.contains("tauri") {
                return Some("Tauri".to_string());
            }
        }
        return Some("Rust".to_string());
    }

    if path.join("go.mod").exists() {
        return Some("Go".to_string());
    }

    if path.join("pyproject.toml").exists() || path.join("setup.py").exists() {
        return Some("Python".to_string());
    }

    None
}

fn get_git_status_uncached(path: &Path) -> Option<GitStatus> {
    let repo = git2::Repository::open(path).ok()?;

    let head = repo.head().ok();
    let branch = head
        .as_ref()
        .and_then(|h| h.shorthand())
        .map(|s| s.to_string());

    let statuses = repo.statuses(None).ok()?;

    let mut staged = 0;
    let mut modified = 0;
    let mut untracked = 0;

    for entry in statuses.iter() {
        let status = entry.status();
        if status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_index_renamed()
        {
            staged += 1;
        }
        if status.is_wt_modified() || status.is_wt_deleted() {
            modified += 1;
        }
        if status.is_wt_new() {
            untracked += 1;
        }
    }

    let is_dirty = staged > 0 || modified > 0;

    let (ahead, behind, has_remote) = if let Some(ref head) = head {
        if let Ok(local_oid) = head.peel_to_commit().map(|c| c.id()) {
            let upstream = head
                .resolve()
                .ok()
                .and_then(|r| repo.branch_upstream_name(r.name()?).ok())
                .and_then(|name| repo.find_reference(name.as_str()?).ok())
                .and_then(|r| r.peel_to_commit().ok());

            if let Some(upstream_commit) = upstream {
                let (a, b) = repo.graph_ahead_behind(local_oid, upstream_commit.id()).unwrap_or((0, 0));
                (a as u32, b as u32, true)
            } else {
                (0, 0, false)
            }
        } else {
            (0, 0, false)
        }
    } else {
        (0, 0, false)
    };

    Some(GitStatus {
        branch,
        is_dirty,
        ahead,
        behind,
        has_remote,
        staged_count: staged,
        modified_count: modified,
        untracked_count: untracked,
    })
}

fn get_git_status(path: &Path) -> Option<GitStatus> {
    let path_buf = path.to_path_buf();

    // Check cache first
    if let Ok(cache) = GIT_STATUS_CACHE.read() {
        if let Some(cached) = cache.get(&path_buf) {
            if cached.cached_at.elapsed() < GIT_CACHE_TTL {
                return cached.status.clone();
            }
        }
    }

    // Compute status
    let status = get_git_status_uncached(path);

    // Update cache
    if let Ok(mut cache) = GIT_STATUS_CACHE.write() {
        cache.insert(
            path_buf,
            CachedGitStatus {
                status: status.clone(),
                cached_at: Instant::now(),
            },
        );
    }

    status
}

fn scan_projects(dir: &Path, location: ProjectLocation) -> Vec<Project> {
    let mut projects = Vec::new();

    if !dir.exists() {
        return projects;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return projects,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        if name.starts_with('.') {
            continue;
        }

        let metadata = fs::metadata(&path).ok();
        let last_modified = metadata
            .as_ref()
            .and_then(|m| m.modified().ok())
            .map(|t| DateTime::<Utc>::from(t));

        let created_at = metadata
            .as_ref()
            .and_then(|m| m.created().ok())
            .map(|t| DateTime::<Utc>::from(t));

        let project_type = detect_project_type(&path);
        let git_status = get_git_status(&path);

        projects.push(Project {
            name,
            path: path.to_string_lossy().to_string(),
            location: location.clone(),
            project_type,
            created_at,
            last_modified,
            git_status,
        });
    }

    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    projects
}

#[tauri::command]
pub async fn list_projects(location: Option<ProjectLocation>) -> Result<Vec<Project>, String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let active_dir = config.active_dir.clone();
    let archive_dir = config.archive_dir.clone();

    // Run blocking file operations in a separate thread
    let projects = tokio::task::spawn_blocking(move || {
        let mut all_projects = Vec::new();

        match location {
            Some(ProjectLocation::Active) => {
                all_projects.extend(scan_projects(
                    Path::new(&active_dir),
                    ProjectLocation::Active,
                ));
            }
            Some(ProjectLocation::Archived) => {
                all_projects.extend(scan_projects(
                    Path::new(&archive_dir),
                    ProjectLocation::Archived,
                ));
            }
            None => {
                all_projects.extend(scan_projects(
                    Path::new(&active_dir),
                    ProjectLocation::Active,
                ));
                all_projects.extend(scan_projects(
                    Path::new(&archive_dir),
                    ProjectLocation::Archived,
                ));
            }
        }

        all_projects
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(projects)
}

#[tauri::command]
pub async fn get_project(name: String, include_size: Option<bool>) -> Result<ProjectDetail, String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let active_dir = config.active_dir.clone();
    let archive_dir = config.archive_dir.clone();
    let include_size = include_size.unwrap_or(false);

    // Run blocking file operations in a separate thread
    tokio::task::spawn_blocking(move || {
        let active_path = Path::new(&active_dir).join(&name);
        let archived_path = Path::new(&archive_dir).join(&name);

        let (path, location) = if active_path.exists() {
            (active_path, ProjectLocation::Active)
        } else if archived_path.exists() {
            (archived_path, ProjectLocation::Archived)
        } else {
            return Err(format!("Project '{}' not found", name));
        };

        let metadata = fs::metadata(&path).ok();
        let last_modified = metadata
            .as_ref()
            .and_then(|m| m.modified().ok())
            .map(|t| DateTime::<Utc>::from(t));
        let created_at = metadata
            .as_ref()
            .and_then(|m| m.created().ok())
            .map(|t| DateTime::<Utc>::from(t));

        let project_type = detect_project_type(&path);
        let git_status = get_git_status(&path);

        let has_package_json = path.join("package.json").exists();
        let has_cargo_toml = path.join("Cargo.toml").exists();
        let has_docker = path.join("Dockerfile").exists() || path.join("docker-compose.yml").exists();
        let has_env_file = path.join(".env").exists() || path.join(".env.local").exists();

        let readme_preview = path
            .join("README.md")
            .exists()
            .then(|| {
                fs::read_to_string(path.join("README.md"))
                    .ok()
                    .map(|content| content.chars().take(500).collect::<String>())
            })
            .flatten();

        // Only calculate disk size if explicitly requested
        let disk_size = if include_size {
            calculate_dir_size(&path).ok()
        } else {
            None
        };

        Ok(ProjectDetail {
            name,
            path: path.to_string_lossy().to_string(),
            location,
            project_type,
            created_at,
            last_modified,
            git_status,
            has_package_json,
            has_cargo_toml,
            has_docker,
            has_env_file,
            disk_size,
            readme_preview,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn calculate_dir_size(path: &Path) -> Result<u64, std::io::Error> {
    let mut size = 0;

    if path.is_file() {
        return Ok(fs::metadata(path)?.len());
    }

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if name == "node_modules" || name == ".git" || name == "target" {
            continue;
        }

        if path.is_dir() {
            size += calculate_dir_size(&path)?;
        } else {
            size += entry.metadata()?.len();
        }
    }

    Ok(size)
}

#[tauri::command]
pub fn get_config() -> Result<Config, String> {
    let config_service = ConfigService::new();
    config_service.load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_project(name: String) -> Result<(), String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let active_dir = config.active_dir.clone();
    let archive_dir = config.archive_dir.clone();

    tokio::task::spawn_blocking(move || {
        let source = Path::new(&active_dir).join(&name);
        let dest = Path::new(&archive_dir).join(&name);

        if !source.exists() {
            return Err(format!("Project '{}' not found in active projects", name));
        }

        if dest.exists() {
            return Err(format!(
                "A project named '{}' already exists in archived projects",
                name
            ));
        }

        // Ensure archive directory exists
        fs::create_dir_all(&archive_dir).map_err(|e| e.to_string())?;

        // Move the project
        fs::rename(&source, &dest).map_err(|e| e.to_string())?;

        // Clear git status cache for this project
        if let Ok(mut cache) = GIT_STATUS_CACHE.write() {
            cache.remove(&source);
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn restore_project(name: String) -> Result<(), String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let active_dir = config.active_dir.clone();
    let archive_dir = config.archive_dir.clone();

    tokio::task::spawn_blocking(move || {
        let source = Path::new(&archive_dir).join(&name);
        let dest = Path::new(&active_dir).join(&name);

        if !source.exists() {
            return Err(format!("Project '{}' not found in archived projects", name));
        }

        if dest.exists() {
            return Err(format!(
                "A project named '{}' already exists in active projects",
                name
            ));
        }

        // Ensure active directory exists
        fs::create_dir_all(&active_dir).map_err(|e| e.to_string())?;

        // Move the project
        fs::rename(&source, &dest).map_err(|e| e.to_string())?;

        // Clear git status cache for this project
        if let Ok(mut cache) = GIT_STATUS_CACHE.write() {
            cache.remove(&source);
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_project(name: String, location: ProjectLocation) -> Result<(), String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let base_dir = match location {
        ProjectLocation::Active => config.active_dir.clone(),
        ProjectLocation::Archived => config.archive_dir.clone(),
    };

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&base_dir).join(&name);

        if !path.exists() {
            return Err(format!("Project '{}' not found", name));
        }

        // Permanently delete the project directory
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;

        // Clear git status cache for this project
        if let Ok(mut cache) = GIT_STATUS_CACHE.write() {
            cache.remove(&path);
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_project_size(name: String) -> Result<Option<u64>, String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let active_dir = config.active_dir.clone();
    let archive_dir = config.archive_dir.clone();

    tokio::task::spawn_blocking(move || {
        let active_path = Path::new(&active_dir).join(&name);
        let archived_path = Path::new(&archive_dir).join(&name);

        let path = if active_path.exists() {
            active_path
        } else if archived_path.exists() {
            archived_path
        } else {
            return Err(format!("Project '{}' not found", name));
        };

        Ok(calculate_dir_size(&path).ok())
    })
    .await
    .map_err(|e| e.to_string())?
}
