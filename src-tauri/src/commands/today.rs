use crate::commands::projects::{self};
use crate::models::{AttentionItem, Project, ProjectLocation, TodaySummary};
use crate::services::{ConfigService, Database};
use chrono::{Local, Utc};
use std::path::Path;
use tauri::State;

fn get_greeting() -> String {
    let hour = Local::now().hour();
    match hour {
        5..=11 => "Good morning".to_string(),
        12..=17 => "Good afternoon".to_string(),
        _ => "Good evening".to_string(),
    }
}

use chrono::Timelike;

fn scan_attention_items(projects: &[Project]) -> Vec<AttentionItem> {
    let mut items = Vec::new();
    let now = Utc::now();

    for project in projects {
        if project.location != ProjectLocation::Active {
            continue;
        }

        // Uncommitted changes
        if let Some(ref git) = project.git_status {
            if git.is_dirty {
                let total_changes = git.staged_count + git.modified_count + git.untracked_count;
                items.push(AttentionItem {
                    kind: "uncommitted".to_string(),
                    project_name: project.name.clone(),
                    message: format!("{} uncommitted change{}", total_changes, if total_changes != 1 { "s" } else { "" }),
                    severity: "warning".to_string(),
                    action: "open_editor".to_string(),
                });
            }

            // Unpushed commits
            if git.ahead > 0 {
                items.push(AttentionItem {
                    kind: "unpushed".to_string(),
                    project_name: project.name.clone(),
                    message: format!("{} commit{} ahead of remote", git.ahead, if git.ahead != 1 { "s" } else { "" }),
                    severity: "info".to_string(),
                    action: "push".to_string(),
                });
            }
        }

        // Stale projects (not modified in 30+ days)
        if let Some(last_modified) = project.last_modified {
            let days_since = (now - last_modified).num_days();
            if days_since > 30 {
                items.push(AttentionItem {
                    kind: "stale".to_string(),
                    project_name: project.name.clone(),
                    message: format!("Not modified in {} days", days_since),
                    severity: "info".to_string(),
                    action: "archive".to_string(),
                });
            }
        }
    }

    items
}

#[tauri::command]
pub async fn get_today_summary(db: State<'_, Database>) -> Result<TodaySummary, String> {
    let config_service = ConfigService::new();
    let config = config_service.load().map_err(|e| e.to_string())?;

    let active_dir = config.active_dir.clone();
    let _archive_dir = config.archive_dir.clone();

    // Get projects in a blocking task
    let projects = tokio::task::spawn_blocking(move || {
        let mut all = Vec::new();
        all.extend(projects::scan_projects_public(
            Path::new(&active_dir),
            ProjectLocation::Active,
        ));
        all
    })
    .await
    .map_err(|e| e.to_string())?;

    let attention_items = scan_attention_items(&projects);

    // Recent projects (top 5 by last_modified)
    let mut recent = projects.clone();
    recent.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    recent.truncate(5);

    // Time stats from database
    let today_time = db.get_today_time_stats().map_err(|e| e.to_string())?;
    let weekly_overview = db.get_weekly_overview().map_err(|e| e.to_string())?;

    // Active dev ports count
    let active_ports_count = tokio::task::spawn_blocking(|| {
        count_active_dev_ports()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(TodaySummary {
        greeting: get_greeting(),
        attention_items,
        recent_projects: recent,
        pinned_projects: Vec::new(), // Populated after Phase 4
        today_time,
        weekly_overview,
        active_ports_count,
    })
}

fn count_active_dev_ports() -> u32 {
    // Quick count of listening dev ports using lsof
    let output = std::process::Command::new("lsof")
        .args(["-iTCP", "-sTCP:LISTEN", "-nP"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let dev_ports: u32 = stdout
                .lines()
                .filter(|line| {
                    // Count lines with common dev port ranges
                    if let Some(port_part) = line.split(':').last() {
                        if let Some(port_str) = port_part.split_whitespace().next() {
                            if let Ok(port) = port_str.parse::<u16>() {
                                return (3000..=3999).contains(&port)
                                    || (4000..=4999).contains(&port)
                                    || (5000..=5999).contains(&port)
                                    || (8000..=8999).contains(&port)
                                    || (9000..=9999).contains(&port);
                            }
                        }
                    }
                    false
                })
                .count() as u32;
            dev_ports
        }
        Err(_) => 0,
    }
}
