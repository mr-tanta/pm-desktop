use crate::models::{ActiveTimer, TimeEntry};
use crate::services::Database;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn start_timer(app: AppHandle, db: State<'_, Database>, project_name: String) -> Result<(), String> {
    db.start_timer(&project_name).map_err(|e| e.to_string())?;
    crate::tray::update_tray_state(&app);
    let _ = app.emit("tray-state-changed", ());
    Ok(())
}

#[tauri::command]
pub fn stop_timer(app: AppHandle, db: State<'_, Database>) -> Result<Option<TimeEntry>, String> {
    let result = db.stop_timer().map_err(|e| e.to_string())?;
    crate::tray::update_tray_state(&app);
    let _ = app.emit("tray-state-changed", ());
    Ok(result)
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
