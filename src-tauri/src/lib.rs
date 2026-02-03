mod commands;
mod models;
mod services;
mod tray;

use commands::{config, create, projects, statistics, system, timer};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Create system tray
            tray::create_tray(app.handle())?;

            // Handle window close -> hide to tray
            let window = app.get_webview_window("main").unwrap();
            window.on_window_event({
                let window = window.clone();
                move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Config commands
            config::load_config,
            config::save_config,
            // Project commands
            projects::list_projects,
            projects::get_project,
            projects::get_config,
            projects::archive_project,
            projects::restore_project,
            projects::delete_project,
            projects::get_project_size,
            projects::get_project_disk_info,
            projects::calculate_path_size,
            // System commands
            system::get_system_info,
            system::get_installed_editors,
            system::open_in_editor,
            system::open_in_terminal,
            system::open_in_finder,
            system::check_docker_running,
            // Timer commands
            timer::start_timer,
            timer::stop_timer,
            timer::get_active_timer,
            timer::get_time_entries,
            // Create commands
            create::list_templates,
            create::create_project,
            create::check_tool_installed,
            create::clone_repository,
            create::create_playground,
            // Statistics commands
            statistics::get_statistics,
            statistics::run_dev_server,
            statistics::kill_node_processes,
            statistics::copy_to_clipboard,
            statistics::check_outdated_packages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
