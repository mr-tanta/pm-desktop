use crate::models::{ActiveTimer, TimeEntry};
use crate::services::Database;
use std::sync::OnceLock;

static DATABASE: OnceLock<Database> = OnceLock::new();

fn get_db() -> &'static Database {
    DATABASE.get_or_init(|| Database::new().expect("Failed to initialize database"))
}

#[tauri::command]
pub fn start_timer(project_name: String) -> Result<(), String> {
    get_db()
        .start_timer(&project_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_timer() -> Result<Option<TimeEntry>, String> {
    get_db().stop_timer().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_timer() -> Result<Option<ActiveTimer>, String> {
    get_db().get_active_timer().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_time_entries(project_name: Option<String>, limit: Option<i64>) -> Result<Vec<TimeEntry>, String> {
    get_db()
        .get_time_entries(project_name.as_deref(), limit)
        .map_err(|e| e.to_string())
}
