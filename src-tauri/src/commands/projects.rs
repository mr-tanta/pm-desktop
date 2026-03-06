use crate::models::{Config, GitStatus, Project, ProjectDetail, ProjectLocation};
use crate::services::{ConfigService, Database};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, RwLock};
use std::time::{Duration, Instant};
use tauri::State;

// Git status cache with TTL
struct CachedGitStatus {
    status: Option<GitStatus>,
    cached_at: Instant,
}

static GIT_STATUS_CACHE: LazyLock<RwLock<HashMap<PathBuf, CachedGitStatus>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

const GIT_CACHE_TTL: Duration = Duration::from_secs(30);

/// Strip HTML tags from a string for plain-text display
fn strip_html_tags(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    // Collapse multiple blank lines into one
    let mut cleaned = String::with_capacity(result.len());
    let mut prev_was_empty = false;
    for line in result.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !prev_was_empty && !cleaned.is_empty() {
                cleaned.push('\n');
            }
            prev_was_empty = true;
        } else {
            if prev_was_empty && !cleaned.is_empty() {
                cleaned.push('\n');
            }
            cleaned.push_str(trimmed);
            cleaned.push('\n');
            prev_was_empty = false;
        }
    }
    cleaned.trim().to_string()
}

pub(crate) fn detect_project_type(path: &Path) -> Option<String> {
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
                let (a, b) = repo
                    .graph_ahead_behind(local_oid, upstream_commit.id())
                    .unwrap_or((0, 0));
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

pub(crate) fn scan_projects_public(dir: &Path, location: ProjectLocation) -> Vec<Project> {
    scan_projects(dir, location)
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
            .map(DateTime::<Utc>::from);

        let created_at = metadata
            .as_ref()
            .and_then(|m| m.created().ok())
            .map(DateTime::<Utc>::from);

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
            is_pinned: None,
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
pub async fn get_project(
    name: String,
    include_size: Option<bool>,
) -> Result<ProjectDetail, String> {
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
            .map(DateTime::<Utc>::from);
        let created_at = metadata
            .as_ref()
            .and_then(|m| m.created().ok())
            .map(DateTime::<Utc>::from);

        let project_type = detect_project_type(&path);
        let git_status = get_git_status(&path);

        let has_package_json = path.join("package.json").exists();
        let has_cargo_toml = path.join("Cargo.toml").exists();
        let has_docker =
            path.join("Dockerfile").exists() || path.join("docker-compose.yml").exists();
        let has_env_file = path.join(".env").exists() || path.join(".env.local").exists();

        let readme_preview = path
            .join("README.md")
            .exists()
            .then(|| {
                fs::read_to_string(path.join("README.md"))
                    .ok()
                    .map(|content| strip_html_tags(&content))
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

/// Options for disk size calculation
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiskSizeOptions {
    /// Use actual disk usage (block-based) instead of logical file size
    /// This matches what `du` reports and is more accurate for disk space
    #[serde(default = "default_true")]
    pub use_disk_blocks: bool,
    /// Include node_modules directory in calculation
    #[serde(default)]
    pub include_node_modules: bool,
    /// Include .git directory in calculation
    #[serde(default)]
    pub include_git: bool,
    /// Include target directory (Rust/Cargo) in calculation
    #[serde(default)]
    pub include_target: bool,
    /// Include all hidden files/directories
    #[serde(default)]
    pub include_hidden: bool,
}

fn default_true() -> bool {
    true
}

/// Detailed disk size breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskSizeInfo {
    /// Total size in bytes
    pub total_bytes: u64,
    /// Size of source code (excluding heavy directories)
    pub source_bytes: u64,
    /// Size of node_modules directory
    pub node_modules_bytes: u64,
    /// Size of .git directory
    pub git_bytes: u64,
    /// Size of target directory (Rust)
    pub target_bytes: u64,
    /// Number of files counted
    pub file_count: u64,
    /// Number of directories counted
    pub dir_count: u64,
    /// Human-readable total size
    pub formatted: String,
}

/// Calculate disk size with options
/// Uses native macOS st_blocks for accurate disk usage
fn calculate_dir_size_native(path: &Path, options: &DiskSizeOptions) -> DiskSizeInfo {
    let mut info = DiskSizeInfo {
        total_bytes: 0,
        source_bytes: 0,
        node_modules_bytes: 0,
        git_bytes: 0,
        target_bytes: 0,
        file_count: 0,
        dir_count: 0,
        formatted: String::new(),
    };

    calculate_dir_size_recursive(path, options, &mut info, false, false, false);

    // Format the total size
    info.formatted = format_bytes(info.total_bytes);

    info
}

fn calculate_dir_size_recursive(
    path: &Path,
    options: &DiskSizeOptions,
    info: &mut DiskSizeInfo,
    in_node_modules: bool,
    in_git: bool,
    in_target: bool,
) {
    let entries = match fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        let name = entry_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip hidden files/dirs unless explicitly included
        if !options.include_hidden && name.starts_with('.') && name != ".git" {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_file() {
            // Use block-based size for accurate disk usage
            // st_blocks is in 512-byte units on Unix
            let size = if options.use_disk_blocks {
                metadata.blocks() * 512
            } else {
                metadata.len()
            };

            info.file_count += 1;

            // Categorize the size
            if in_node_modules {
                info.node_modules_bytes += size;
            } else if in_git {
                info.git_bytes += size;
            } else if in_target {
                info.target_bytes += size;
            } else {
                info.source_bytes += size;
            }
            info.total_bytes += size;
        } else if metadata.is_dir() {
            info.dir_count += 1;

            // Check if this is a special directory
            let is_node_modules = name == "node_modules";
            let is_git = name == ".git";
            let is_target = name == "target";

            // Decide whether to include this directory
            let should_include = if is_node_modules {
                options.include_node_modules
            } else if is_git {
                options.include_git
            } else if is_target {
                options.include_target
            } else {
                true
            };

            if should_include {
                calculate_dir_size_recursive(
                    &entry_path,
                    options,
                    info,
                    in_node_modules || is_node_modules,
                    in_git || is_git,
                    in_target || is_target,
                );
            }
        }
    }
}

/// Format bytes into human-readable string
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Legacy function for backward compatibility - calculates source size only
fn calculate_dir_size(path: &Path) -> Result<u64, std::io::Error> {
    let options = DiskSizeOptions {
        use_disk_blocks: true,
        include_node_modules: false,
        include_git: false,
        include_target: false,
        include_hidden: false,
    };
    let info = calculate_dir_size_native(path, &options);
    Ok(info.source_bytes)
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

/// Get simple project size (source code only, for backward compatibility)
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

/// Get detailed disk size breakdown with options
#[tauri::command]
pub async fn get_project_disk_info(
    name: String,
    options: Option<DiskSizeOptions>,
) -> Result<DiskSizeInfo, String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let active_dir = config.active_dir.clone();
    let archive_dir = config.archive_dir.clone();
    let options = options.unwrap_or_default();

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

        Ok(calculate_dir_size_native(&path, &options))
    })
    .await
    .map_err(|e| e.to_string())?
}

// ==================== Pin/Unpin Commands ====================

#[tauri::command]
pub fn pin_project(db: State<'_, Database>, project_name: String) -> Result<(), String> {
    db.pin_project(&project_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unpin_project(db: State<'_, Database>, project_name: String) -> Result<(), String> {
    db.unpin_project(&project_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_pinned_projects(db: State<'_, Database>) -> Result<Vec<String>, String> {
    db.get_pinned_project_names().map_err(|e| e.to_string())
}

/// Get scripts from package.json
#[tauri::command]
pub async fn get_project_scripts(project_path: String) -> Result<HashMap<String, String>, String> {
    tokio::task::spawn_blocking(move || {
        let pkg_path = Path::new(&project_path).join("package.json");
        if !pkg_path.exists() {
            return Ok(HashMap::new());
        }

        let content = fs::read_to_string(&pkg_path).map_err(|e| e.to_string())?;
        let parsed: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| e.to_string())?;

        let scripts = parsed
            .get("scripts")
            .and_then(|s| s.as_object())
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect::<HashMap<String, String>>()
            })
            .unwrap_or_default();

        Ok(scripts)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Calculate disk size for a given path (for archive page totals)
#[tauri::command]
pub async fn calculate_path_size(
    path: String,
    options: Option<DiskSizeOptions>,
) -> Result<DiskSizeInfo, String> {
    let options = options.unwrap_or_default();

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&path);

        if !path.exists() {
            return Err(format!("Path '{}' does not exist", path.display()));
        }

        Ok(calculate_dir_size_native(path, &options))
    })
    .await
    .map_err(|e| e.to_string())?
}
