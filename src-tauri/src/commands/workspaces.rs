use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::commands::process_manager::{self, LaunchOptions, ProcessManager};
use crate::services::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceProject {
    pub workspace_id: i64,
    pub project_name: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceWithProjects {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub projects: Vec<WorkspaceProject>,
}

#[tauri::command]
pub fn create_workspace(app: AppHandle, name: String) -> Result<Workspace, String> {
    let db = app.state::<Database>();
    db.create_workspace(&name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_workspace(app: AppHandle, id: i64) -> Result<(), String> {
    let db = app.state::<Database>();
    db.delete_workspace(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_workspaces(app: AppHandle) -> Result<Vec<WorkspaceWithProjects>, String> {
    let db = app.state::<Database>();
    db.list_workspaces().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_workspace(app: AppHandle, id: i64, name: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.update_workspace(id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_project_to_workspace(
    app: AppHandle,
    workspace_id: i64,
    project_name: String,
) -> Result<(), String> {
    let db = app.state::<Database>();
    db.add_project_to_workspace(workspace_id, &project_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_project_from_workspace(
    app: AppHandle,
    workspace_id: i64,
    project_name: String,
) -> Result<(), String> {
    let db = app.state::<Database>();
    db.remove_project_from_workspace(workspace_id, &project_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_workspace(app: AppHandle, workspace_id: i64) -> Result<Vec<String>, String> {
    let db = app.state::<Database>();
    let workspace = db
        .list_workspaces()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| "Workspace not found".to_string())?;

    // Load config to resolve project paths
    let config = crate::commands::config::load_config()?;
    let active_dir = std::path::Path::new(&config.active_dir);

    let mut launched = Vec::new();
    for wp in &workspace.projects {
        let project_path = active_dir.join(&wp.project_name);
        if !project_path.exists() {
            continue;
        }

        let options = LaunchOptions {
            project_path: project_path.to_string_lossy().to_string(),
            script: None,
            port: None,
        };

        match process_manager::launch_project(app.clone(), options).await {
            Ok(result) => launched.push(result.project_name),
            Err(_) => continue,
        }
    }

    Ok(launched)
}

#[tauri::command]
pub async fn stop_workspace(app: AppHandle, workspace_id: i64) -> Result<(), String> {
    let db = app.state::<Database>();
    let workspace = db
        .list_workspaces()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| "Workspace not found".to_string())?;

    let pm = app.state::<ProcessManager>();
    let procs = pm.get_processes();

    for wp in &workspace.projects {
        // Find running process for this project
        if let Some(proc) = procs.iter().find(|p| {
            p.project_name == wp.project_name
                && (p.status == process_manager::ProcessStatus::Running
                    || p.status == process_manager::ProcessStatus::Starting)
        }) {
            let _ = process_manager::stop_project(app.clone(), proc.pid).await;
        }
    }

    Ok(())
}
