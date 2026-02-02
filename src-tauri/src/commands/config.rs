use crate::models::Config;
use crate::services::ConfigService;

#[tauri::command]
pub fn load_config() -> Result<Config, String> {
    let service = ConfigService::new();
    service.load().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_config(config: Config) -> Result<(), String> {
    let service = ConfigService::new();
    service.save(&config).map_err(|e| e.to_string())
}
