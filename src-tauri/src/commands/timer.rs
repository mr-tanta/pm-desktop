use crate::models::{ActiveTimer, TimeEntry};
use crate::services::Database;
use tauri::State;

#[tauri::command]
pub fn start_timer(db: State<'_, Database>, project_name: String) -> Result<(), String> {
    db.start_timer(&project_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_timer(db: State<'_, Database>) -> Result<Option<TimeEntry>, String> {
    db.stop_timer().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_timer(db: State<'_, Database>) -> Result<Option<ActiveTimer>, String> {
    db.get_active_timer().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_time_entries(
    db: State<'_, Database>,
    project_name: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<TimeEntry>, String> {
    db.get_time_entries(project_name.as_deref(), limit)
        .map_err(|e| e.to_string())
}
