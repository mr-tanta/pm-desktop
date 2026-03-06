use crate::models::{DailyProjectTime, TimeStreaks, WeeklySummary};
use crate::services::Database;
use tauri::State;

#[tauri::command]
pub fn get_daily_time_summary(
    db: State<'_, Database>,
    date: Option<String>,
) -> Result<Vec<DailyProjectTime>, String> {
    db.get_daily_time_summary(date.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_weekly_time_summary(
    db: State<'_, Database>,
    week_offset: Option<i32>,
) -> Result<WeeklySummary, String> {
    db.get_weekly_time_summary(week_offset.unwrap_or(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_time_streaks(db: State<'_, Database>) -> Result<TimeStreaks, String> {
    db.get_time_streaks().map_err(|e| e.to_string())
}
