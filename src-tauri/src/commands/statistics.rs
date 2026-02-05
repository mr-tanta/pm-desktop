use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::Path;
use std::process::Command;

use crate::commands::config::load_config;
use crate::commands::projects::detect_project_type;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTypeCount {
    pub project_type: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeTrackingStats {
    pub total_seconds: i64,
    pub top_projects: Vec<ProjectTimeEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTimeEntry {
    pub project_name: String,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitActivityStats {
    pub total_commits_7d: u32,
    pub projects_with_changes: u32,
    pub total_uncommitted_changes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statistics {
    pub total_projects: u32,
    pub active_projects: u32,
    pub archived_projects: u32,
    pub total_size_bytes: u64,
    pub active_size_bytes: u64,
    pub archived_size_bytes: u64,
    pub project_types: Vec<ProjectTypeCount>,
    pub time_tracking: Option<TimeTrackingStats>,
    pub git_activity: GitActivityStats,
}

fn count_projects(dir: &Path) -> u32 {
    if !dir.exists() {
        return 0;
    }
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .filter(|e| e.path().is_dir() && !e.file_name().to_string_lossy().starts_with('.'))
                .count() as u32
        })
        .unwrap_or(0)
}

/// Calculate directory size using native block-based allocation
/// This gives accurate disk usage matching `du` command
fn calculate_dir_size(dir: &Path) -> u64 {
    if !dir.exists() {
        return 0;
    }

    let mut size: u64 = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Skip heavy directories for statistics (source code size only)
            if name == "node_modules" || name == ".git" || name == "target" {
                continue;
            }

            if path.is_dir() {
                size += calculate_dir_size(&path);
            } else if let Ok(meta) = entry.metadata() {
                // Use st_blocks for actual disk usage (512-byte blocks on Unix)
                size += meta.blocks() * 512;
            }
        }
    }
    size
}

fn count_project_types(active_dir: &Path, archive_dir: &Path) -> Vec<ProjectTypeCount> {
    let mut type_counts: HashMap<String, u32> = HashMap::new();

    for dir in [active_dir, archive_dir] {
        if !dir.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if name.starts_with('.') {
                    continue;
                }

                if let Some(project_type) = detect_project_type(&path) {
                    *type_counts.entry(project_type).or_insert(0) += 1;
                }
            }
        }
    }

    let mut result: Vec<ProjectTypeCount> = type_counts
        .into_iter()
        .map(|(project_type, count)| ProjectTypeCount { project_type, count })
        .collect();

    result.sort_by(|a, b| b.count.cmp(&a.count));
    result
}

fn get_git_activity(active_dir: &Path) -> GitActivityStats {
    let mut total_commits = 0u32;
    let mut projects_with_changes = 0u32;
    let mut total_uncommitted = 0u32;

    if !active_dir.exists() {
        return GitActivityStats {
            total_commits_7d: 0,
            projects_with_changes: 0,
            total_uncommitted_changes: 0,
        };
    }

    if let Ok(entries) = fs::read_dir(active_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() || !path.join(".git").exists() {
                continue;
            }

            // Count commits in last 7 days
            if let Ok(output) = Command::new("git")
                .args(["log", "--since=7 days ago", "--oneline"])
                .current_dir(&path)
                .output()
            {
                if output.status.success() {
                    let commits = String::from_utf8_lossy(&output.stdout)
                        .lines()
                        .count() as u32;
                    total_commits += commits;
                }
            }

            // Count uncommitted changes
            if let Ok(output) = Command::new("git")
                .args(["status", "--porcelain"])
                .current_dir(&path)
                .output()
            {
                if output.status.success() {
                    let changes = String::from_utf8_lossy(&output.stdout)
                        .lines()
                        .count() as u32;
                    if changes > 0 {
                        projects_with_changes += 1;
                        total_uncommitted += changes;
                    }
                }
            }
        }
    }

    GitActivityStats {
        total_commits_7d: total_commits,
        projects_with_changes,
        total_uncommitted_changes: total_uncommitted,
    }
}

#[tauri::command]
pub async fn get_statistics() -> Result<Statistics, String> {
    let config = load_config()?;

    let active_dir = Path::new(&config.active_dir);
    let archive_dir = Path::new(&config.archive_dir);

    let active_projects = count_projects(active_dir);
    let archived_projects = count_projects(archive_dir);
    let total_projects = active_projects + archived_projects;

    // Calculate sizes (run in blocking task since it's I/O intensive)
    let active_dir_clone = active_dir.to_path_buf();
    let archive_dir_clone = archive_dir.to_path_buf();

    let (active_size_bytes, archived_size_bytes, project_types, git_activity) =
        tokio::task::spawn_blocking(move || {
            let active_size = calculate_dir_size(&active_dir_clone);
            let archived_size = calculate_dir_size(&archive_dir_clone);
            let types = count_project_types(&active_dir_clone, &archive_dir_clone);
            let git = get_git_activity(&active_dir_clone);
            (active_size, archived_size, types, git)
        })
        .await
        .map_err(|e| e.to_string())?;

    let total_size_bytes = active_size_bytes + archived_size_bytes;

    Ok(Statistics {
        total_projects,
        active_projects,
        archived_projects,
        total_size_bytes,
        active_size_bytes,
        archived_size_bytes,
        project_types,
        time_tracking: None, // TODO: integrate with timer module
        git_activity,
    })
}

#[tauri::command]
pub async fn run_dev_server(project_path: String) -> Result<(), String> {
    let path = Path::new(&project_path);

    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    // Check if package.json exists
    if !path.join("package.json").exists() {
        return Err("No package.json found".to_string());
    }

    // Run pnpm dev in background
    Command::new("pnpm")
        .args(["dev"])
        .current_dir(path)
        .spawn()
        .map_err(|e| format!("Failed to start dev server: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn kill_node_processes() -> Result<u32, String> {
    let output = Command::new("pkill")
        .args(["-f", "node"])
        .output()
        .map_err(|e| format!("Failed to kill processes: {}", e))?;

    // pkill returns 0 if processes were killed, 1 if none found
    if output.status.success() {
        Ok(1) // At least one process killed
    } else {
        Ok(0) // No processes found
    }
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(text.as_bytes())?;
            }
            child.wait()
        })
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn check_outdated_packages(project_path: String) -> Result<Vec<OutdatedPackage>, String> {
    let path = Path::new(&project_path);

    if !path.join("package.json").exists() {
        return Ok(vec![]);
    }

    let output = Command::new("pnpm")
        .args(["outdated", "--json"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to check outdated packages: {}", e))?;

    // pnpm outdated returns exit code 1 if there are outdated packages
    let stdout = String::from_utf8_lossy(&output.stdout);

    if stdout.trim().is_empty() {
        return Ok(vec![]);
    }

    // Parse JSON output
    let packages: Result<HashMap<String, serde_json::Value>, _> = serde_json::from_str(&stdout);

    match packages {
        Ok(pkg_map) => {
            let result: Vec<OutdatedPackage> = pkg_map
                .into_iter()
                .map(|(name, info)| OutdatedPackage {
                    name,
                    current: info.get("current").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    wanted: info.get("wanted").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    latest: info.get("latest").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                })
                .collect();
            Ok(result)
        }
        Err(_) => Ok(vec![]),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutdatedPackage {
    pub name: String,
    pub current: String,
    pub wanted: String,
    pub latest: String,
}
