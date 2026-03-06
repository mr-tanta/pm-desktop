mod commands;
mod models;
mod services;
mod tray;

use commands::{config, create, disk_manager, env_manager, permissions, port_manager, process_manager, projects, statistics, system, time, timer, today, workspaces};
use services::Database;
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Initialize database and manage as app state
            let db = Database::new().expect("Failed to initialize database");
            app.manage(db);

            // Initialize process manager
            app.manage(process_manager::ProcessManager::new());

            // Create system tray
            tray::create_tray(app.handle())?;

            // Register global shortcut (Cmd+Shift+P to toggle tray popup)
            tray::register_global_shortcut(app.handle())?;

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
            projects::pin_project,
            projects::unpin_project,
            projects::get_pinned_projects,
            projects::get_project_scripts,
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
            // Today commands
            today::get_today_summary,
            // Time insight commands
            time::get_daily_time_summary,
            time::get_weekly_time_summary,
            time::get_time_streaks,
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
            // Disk Manager commands
            disk_manager::scan_disk,
            disk_manager::cancel_disk_scan,
            disk_manager::scan_category,
            disk_manager::preview_cleanup,
            disk_manager::execute_cleanup,
            disk_manager::empty_trash,
            disk_manager::get_cleanup_history,
            disk_manager::get_trash_size,
            disk_manager::get_disk_trend,
            // Permissions commands
            permissions::get_permissions,
            permissions::trigger_files_permission,
            permissions::open_full_disk_access_settings,
            permissions::open_privacy_settings,
            permissions::request_full_disk_access_with_dialog,
            permissions::get_app_path,
            permissions::check_full_disk_access_status,
            // Port Manager commands
            port_manager::scan_ports,
            port_manager::scan_dev_ports,
            port_manager::cancel_port_scan,
            port_manager::check_port_available,
            port_manager::kill_process,
            port_manager::kill_port,
            port_manager::batch_kill_processes,
            port_manager::batch_kill_ports,
            port_manager::get_process_details,
            port_manager::get_process_tree,
            port_manager::get_network_connections,
            port_manager::add_port_watch,
            port_manager::remove_port_watch,
            port_manager::get_port_watches,
            port_manager::get_port_history,
            port_manager::get_common_dev_ports,
            // Process Manager commands
            process_manager::launch_project,
            process_manager::stop_project,
            process_manager::get_managed_processes,
            process_manager::get_process_logs,
            process_manager::clear_process_logs,
            process_manager::remove_managed_process,
            process_manager::detect_project_port,
            // Workspace commands
            workspaces::create_workspace,
            workspaces::delete_workspace,
            workspaces::list_workspaces,
            workspaces::update_workspace,
            workspaces::add_project_to_workspace,
            workspaces::remove_project_from_workspace,
            workspaces::start_workspace,
            workspaces::stop_workspace,
            // Env Manager commands
            env_manager::list_project_env_files,
            env_manager::read_env_file,
            env_manager::write_env_variable,
            env_manager::copy_env_variables,
            // Tray commands
            tray::get_tray_data,
            tray::resize_tray_popup,
            tray::start_working,
            tray::stop_tray_process,
            tray::emit_open_project,
            tray::show_main_window,
            tray::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
