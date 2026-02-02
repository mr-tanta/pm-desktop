use crate::services::ConfigService;
use std::fs;
use std::path::Path;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_tray_menu(app)?;

    // Load icon from app resources
    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| Image::new_owned(vec![0; 32 * 32 * 4], 32, 32));

    let tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_window_visibility(app);
            }
        })
        .build(app)?;

    // Store tray in app state for updates
    app.manage(tray);

    Ok(())
}

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let config_service = ConfigService::new();
    let config = config_service.load().unwrap_or_default();

    // Get recent projects
    let active_dir = Path::new(&config.active_dir);
    let recent_projects = get_recent_projects(active_dir, 5);

    let menu = Menu::new(app)?;

    // Timer section
    let timer_item = MenuItem::with_id(app, "timer", "No active timer", false, None::<&str>)?;
    menu.append(&timer_item)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Recent projects submenu
    if !recent_projects.is_empty() {
        let projects_submenu = Submenu::new(app, "Recent Projects", true)?;
        for project in recent_projects {
            let item = MenuItem::with_id(
                app,
                format!("project:{}", project),
                &project,
                true,
                None::<&str>,
            )?;
            projects_submenu.append(&item)?;
        }
        menu.append(&projects_submenu)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }

    // Window controls
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    menu.append(&show_item)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Quit
    let quit_item = MenuItem::with_id(app, "quit", "Quit PM Desktop", true, None::<&str>)?;
    menu.append(&quit_item)?;

    Ok(menu)
}

fn get_recent_projects(dir: &Path, limit: usize) -> Vec<String> {
    if !dir.exists() {
        return Vec::new();
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut projects: Vec<(String, std::time::SystemTime)> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            let name = path.file_name()?.to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let modified = fs::metadata(&path).ok()?.modified().ok()?;
            Some((name, modified))
        })
        .collect();

    projects.sort_by(|a, b| b.1.cmp(&a.1));
    projects
        .into_iter()
        .take(limit)
        .map(|(name, _)| name)
        .collect()
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    match event_id {
        "show" => {
            toggle_window_visibility(app);
        }
        "quit" => {
            app.exit(0);
        }
        id if id.starts_with("project:") => {
            let project_name = id.strip_prefix("project:").unwrap();
            // Emit event to frontend to open project
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("open-project", project_name);
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

fn toggle_window_visibility<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[allow(dead_code)]
pub fn update_timer_status<R: Runtime>(app: &AppHandle<R>, _status: Option<(String, i64)>) {
    if let Some(tray) = app.try_state::<tauri::tray::TrayIcon<R>>() {
        if let Ok(menu) = build_tray_menu(app) {
            // Menu items are rebuilt on each menu open
            let _ = tray.set_menu(Some(menu));
        }
    }
}
