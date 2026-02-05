use crate::services::ConfigService;
use std::fs;
use std::path::Path;
use std::process::Command as StdCommand;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime, WebviewWindowBuilder,
};

const TRAY_POPUP_WIDTH: f64 = 320.0;
const TRAY_POPUP_HEIGHT: f64 = 480.0;
const TRAY_POPUP_Y_OFFSET: f64 = 4.0;

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Load icon from app resources
    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| Image::new_owned(vec![0; 32 * 32 * 4], 32, 32));

    // Pre-create the popup window (hidden) so it loads instantly when needed
    let _ = WebviewWindowBuilder::new(
        app,
        "tray-popup",
        tauri::WebviewUrl::App("index.html#tray".into()),
    )
    .title("")
    .inner_size(TRAY_POPUP_WIDTH, TRAY_POPUP_HEIGHT)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(false)
    .build();

    let tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("PM Desktop")
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                position,
                ..
            } = event
            {
                // Position popup below the click position
                toggle_tray_popup(app, position.x, position.y + 5.0);
            }
        })
        .build(app)?;

    // Store tray in app state for updates
    app.manage(tray);

    Ok(())
}

fn toggle_tray_popup<R: Runtime>(app: &AppHandle<R>, x: f64, y: f64) {
    if let Some(popup) = app.get_webview_window("tray-popup") {
        if popup.is_visible().unwrap_or(false) {
            let _ = popup.hide();
        } else {
            position_popup(&popup, x, y);
            let _ = popup.show();
            let _ = popup.set_focus();
        }
    }
}

fn position_popup<R: Runtime>(window: &tauri::WebviewWindow<R>, x: f64, y: f64) {
    let popup_x = x - (TRAY_POPUP_WIDTH / 2.0);
    let popup_y = y + TRAY_POPUP_Y_OFFSET;

    let _ = window.set_size(LogicalSize::new(TRAY_POPUP_WIDTH, TRAY_POPUP_HEIGHT));
    let _ = window.set_position(LogicalPosition::new(popup_x, popup_y));
}

// ==================== COMMANDS FOR TRAY POPUP ====================

/// Get list of recent project names
#[tauri::command]
pub fn get_recent_projects_list(limit: usize) -> Result<Vec<String>, String> {
    let config_service = ConfigService::new();
    let config = config_service.load().unwrap_or_default();
    let active_dir = Path::new(&config.active_dir);
    Ok(get_recent_projects(active_dir, limit))
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

/// Emit open-project event to main window
#[tauri::command]
pub fn emit_open_project<R: Runtime>(app: AppHandle<R>, project_name: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("open-project", &project_name);
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

/// Open project in editor
#[tauri::command]
pub fn open_in_editor_cmd(path: String, editor: String) -> Result<(), String> {
    let path_ref = Path::new(&path);
    open_in_editor(&editor, path_ref)
}

fn open_in_editor(editor: &str, path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();

    let (cmd, args): (&str, Vec<&str>) = match editor.to_lowercase().as_str() {
        "cursor" => ("cursor", vec![&path_str]),
        "code" | "vscode" => ("code", vec![&path_str]),
        "zed" => ("zed", vec![&path_str]),
        "sublime" | "subl" => ("subl", vec![&path_str]),
        "atom" => ("atom", vec![&path_str]),
        "vim" | "nvim" => {
            return open_in_terminal(editor, path);
        }
        _ => (editor, vec![&path_str]),
    };

    StdCommand::new(cmd)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to open {}: {}", editor, e))?;

    Ok(())
}

fn open_in_terminal(editor: &str, path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();

    let script = format!(
        r#"tell application "Terminal"
            do script "cd '{}' && {}"
            activate
        end tell"#,
        path_str, editor
    );

    StdCommand::new("osascript")
        .args(["-e", &script])
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;

    Ok(())
}

/// Show the main window
#[tauri::command]
pub fn show_main_window<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

/// Quit the application
#[tauri::command]
pub fn quit_app<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.exit(0);
    Ok(())
}
