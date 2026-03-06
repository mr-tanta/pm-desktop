use crate::commands::process_manager::{ManagedProcess, ProcessManager, ProcessStatus};
use crate::commands::workspaces::WorkspaceWithProjects;
use crate::models::{ActiveTimer, Config};
use crate::services::{ConfigService, Database};
use serde::Serialize;
use std::path::Path;
use std::process::Command as StdCommand;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, WebviewWindowBuilder,
};

/// Debounce guard: tracks when popup was last hidden to prevent blur→click race
static LAST_POPUP_HIDE_MS: AtomicU64 = AtomicU64::new(0);
const TOGGLE_DEBOUNCE_MS: u64 = 300;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

const TRAY_POPUP_WIDTH: f64 = 320.0;
const TRAY_POPUP_INITIAL_HEIGHT: f64 = 400.0;
const TRAY_POPUP_MIN_HEIGHT: f64 = 200.0;
const TRAY_POPUP_MAX_HEIGHT: f64 = 600.0;
const TRAY_POPUP_Y_OFFSET: f64 = 4.0;

// ==================== TrayData — single IPC round-trip ====================

#[derive(Debug, Clone, Serialize)]
pub struct TrayData {
    pub processes: Vec<ManagedProcess>,
    pub timer: Option<ActiveTimer>,
    pub pinned_projects: Vec<String>,
    pub workspaces: Vec<WorkspaceWithProjects>,
    pub config: Config,
}

// ==================== Tray Creation ====================

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Load template icon — decode PNG to RGBA for macOS template tinting
    let icon = decode_png_icon(include_bytes!("../icons/tray-icon.png")).unwrap_or_else(|| {
        app.default_window_icon()
            .cloned()
            .unwrap_or_else(|| Image::new_owned(vec![0; 32 * 32 * 4], 32, 32))
    });

    // Pre-create the popup window (hidden) so it loads instantly
    if let Ok(popup) = WebviewWindowBuilder::new(
        app,
        "tray-popup",
        tauri::WebviewUrl::App("index.html#tray".into()),
    )
    .title("")
    .inner_size(TRAY_POPUP_WIDTH, TRAY_POPUP_INITIAL_HEIGHT)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(false)
    .build()
    {
        // Hide popup on blur and update debounce timestamp
        let popup_ref = popup.clone();
        popup.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(false) = event {
                LAST_POPUP_HIDE_MS.store(now_ms(), Ordering::Relaxed);
                let _ = popup_ref.hide();
            }
        });
    }

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .icon_as_template(true)
        .show_menu_on_left_click(false)
        .tooltip("PM Desktop")
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            match &event {
                TrayIconEvent::Click {
                    button,
                    button_state,
                    position,
                    ..
                } => {
                    if *button == MouseButton::Left && *button_state == MouseButtonState::Up {
                        toggle_tray_popup(app, position.x, position.y + 5.0);
                    } else if *button == MouseButton::Right && *button_state == MouseButtonState::Up {
                        show_right_click_menu(app);
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    // Start tray title updater thread (1-second loop)
    let app_handle = app.clone();
    std::thread::spawn(move || loop {
        update_tray_state(&app_handle);
        std::thread::sleep(std::time::Duration::from_secs(1));
    });

    Ok(())
}

// ==================== Global Shortcut ====================

pub fn register_global_shortcut(app: &AppHandle) -> tauri::Result<()> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    app.global_shortcut()
        .on_shortcut(
            "CmdOrCtrl+Shift+P",
            move |app: &AppHandle, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(popup) = app.get_webview_window("tray-popup") {
                        if popup.is_visible().unwrap_or(false) {
                            let _ = popup.hide();
                        } else {
                            // Position at center-top of primary monitor
                            if let Ok(Some(monitor)) = popup.primary_monitor() {
                                let size = monitor.size();
                                let scale = monitor.scale_factor();
                                let screen_width = size.width as f64 / scale;
                                let popup_x =
                                    (screen_width / 2.0) - (TRAY_POPUP_WIDTH / 2.0);
                                let popup_y = 30.0; // Below menu bar
                                let _ = popup.set_position(tauri::LogicalPosition::new(
                                    popup_x, popup_y,
                                ));
                            }
                            let _ = popup.show();
                            let _ = popup.set_focus();
                        }
                    }
                }
            },
        )
        .map_err(|e| tauri::Error::Anyhow(e.into()))?;

    Ok(())
}

// ==================== Tray State Updates ====================

pub fn update_tray_state<R: Runtime>(app: &AppHandle<R>) {
    let tray = match app.tray_by_id("main-tray") {
        Some(t) => t,
        None => return,
    };

    // Read process count from ProcessManager (in-memory, fast)
    let running_count = if let Some(pm) = app.try_state::<ProcessManager>() {
        pm.get_processes()
            .iter()
            .filter(|p| p.status == ProcessStatus::Running || p.status == ProcessStatus::Starting)
            .count()
    } else {
        0
    };

    // Read active timer from Database (single fast query)
    let timer = if let Some(db) = app.try_state::<Database>() {
        db.get_active_timer().ok().flatten()
    } else {
        None
    };

    // Build title text
    let title = if let Some(ref t) = timer {
        let secs = t.elapsed_seconds as u64;
        let h = secs / 3600;
        let m = (secs % 3600) / 60;
        let s = secs % 60;
        Some(format!("{}:{:02}:{:02}", h, m, s))
    } else if running_count > 0 {
        Some(format!("{} running", running_count))
    } else {
        None
    };

    let _ = tray.set_title(title.as_deref());

    // Build tooltip
    let tooltip = if let Some(ref t) = timer {
        format!("PM Desktop — Timing: {}", t.project_name)
    } else if running_count > 0 {
        format!(
            "PM Desktop — {} process{} running",
            running_count,
            if running_count == 1 { "" } else { "es" }
        )
    } else {
        "PM Desktop".to_string()
    };
    let _ = tray.set_tooltip(Some(&tooltip));
}

// ==================== Right-Click Native Context Menu ====================

fn show_right_click_menu<R: Runtime>(app: &AppHandle<R>) {
    // Get running processes
    let processes = if let Some(pm) = app.try_state::<ProcessManager>() {
        pm.get_processes()
            .into_iter()
            .filter(|p| p.status == ProcessStatus::Running || p.status == ProcessStatus::Starting)
            .collect::<Vec<_>>()
    } else {
        vec![]
    };

    let mut menu = MenuBuilder::new(app);

    // Add running process items
    if !processes.is_empty() {
        for proc in &processes {
            let label = if let Some(port) = proc.port {
                format!("{} :{}", proc.project_name, port)
            } else {
                proc.project_name.clone()
            };
            if let Ok(item) =
                MenuItemBuilder::with_id(format!("proc-{}", proc.pid), &label).build(app)
            {
                menu = menu.item(&item);
            }
        }
        menu = menu.separator();
    }

    // Show PM Desktop
    if let Ok(item) = MenuItemBuilder::with_id("show-app", "Show PM Desktop").build(app) {
        menu = menu.item(&item);
    }

    // Quit
    if let Ok(item) = MenuItemBuilder::with_id("quit-app", "Quit").build(app) {
        menu = menu.item(&item);
    }

    if let Ok(built_menu) = menu.build() {
        if let Some(tray) = app.tray_by_id("main-tray") {
            let app_for_clear = app.clone();
            tray.on_menu_event(move |app, event| {
                let id = event.id().0.as_str();
                if id == "show-app" {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                } else if id == "quit-app" {
                    app.exit(0);
                } else if id.starts_with("proc-") {
                    // Open project from process
                    if let Some(pid_str) = id.strip_prefix("proc-") {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            if let Some(pm) = app.try_state::<ProcessManager>() {
                                let procs = pm.get_processes();
                                if let Some(proc) = procs.iter().find(|p| p.pid == pid) {
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ =
                                            window.emit("open-project", &proc.project_name);
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        }
                    }
                }
            });

            let _ = tray.set_menu(Some(built_menu));
            // Clear the menu after a short delay so left-click popup isn't affected
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if let Some(tray) = app_for_clear.tray_by_id("main-tray") {
                    let _ = tray.set_menu(None::<tauri::menu::Menu<tauri::Wry>>);
                }
            });
        }
    }
}

// ==================== Popup Toggle + Position ====================

fn toggle_tray_popup<R: Runtime>(app: &AppHandle<R>, x: f64, y: f64) {
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let visible = popup.is_visible().unwrap_or(false);
        if visible {
            LAST_POPUP_HIDE_MS.store(now_ms(), Ordering::Relaxed);
            let _ = popup.hide();
        } else {
            // Debounce: if the popup was just hidden by blur, don't re-show
            let last_hide = LAST_POPUP_HIDE_MS.load(Ordering::Relaxed);
            if now_ms() - last_hide < TOGGLE_DEBOUNCE_MS {
                return;
            }
            let popup_x = x - (TRAY_POPUP_WIDTH / 2.0);
            let popup_y = y + TRAY_POPUP_Y_OFFSET;
            let _ = popup.set_position(tauri::LogicalPosition::new(popup_x, popup_y));
            let _ = popup.show();
            let _ = popup.set_focus();
        }
    }
}

// ==================== Commands ====================

/// Get all tray data in a single IPC call
#[tauri::command]
pub fn get_tray_data(app: AppHandle) -> Result<TrayData, String> {
    // Processes (in-memory, instant)
    let processes = if let Some(pm) = app.try_state::<ProcessManager>() {
        pm.get_processes()
    } else {
        vec![]
    };

    // Timer + pinned + workspaces (from DB)
    let db = app.state::<Database>();
    let timer = db.get_active_timer().map_err(|e| e.to_string())?;
    let pinned_projects = db.get_pinned_project_names().unwrap_or_default();
    let workspaces = db.list_workspaces().unwrap_or_default();

    // Config
    let config_service = ConfigService::new();
    let config = config_service.load().unwrap_or_default();

    Ok(TrayData {
        processes,
        timer,
        pinned_projects,
        workspaces,
        config,
    })
}

/// Resize the tray popup window (called by frontend after render)
#[tauri::command]
pub fn resize_tray_popup(app: AppHandle, height: f64) -> Result<(), String> {
    let clamped = height.max(TRAY_POPUP_MIN_HEIGHT).min(TRAY_POPUP_MAX_HEIGHT);
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let _ = popup.set_size(tauri::LogicalSize::new(TRAY_POPUP_WIDTH, clamped));
    }
    Ok(())
}

/// Compound "Start Working" action: opens editor + starts timer + launches dev server
#[tauri::command]
pub fn start_working(
    app: AppHandle,
    project_name: String,
    open_editor: bool,
    start_timer: bool,
    launch_dev: bool,
) -> Result<(), String> {
    let config_service = ConfigService::new();
    let config = config_service.load().unwrap_or_default();
    let project_path = Path::new(&config.active_dir).join(&project_name);

    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    // Open editor
    if open_editor {
        let path_str = project_path.to_string_lossy().to_string();
        let editor = config.default_editor.to_lowercase();
        let (cmd, args): (&str, Vec<String>) = match editor.as_str() {
            "cursor" => ("cursor", vec![path_str]),
            "code" | "vscode" => ("code", vec![path_str]),
            "zed" => ("zed", vec![path_str]),
            "sublime" | "subl" => ("subl", vec![path_str]),
            _ => (&config.default_editor, vec![path_str]),
        };
        let _ = StdCommand::new(cmd).args(&args).spawn();
    }

    // Start timer
    if start_timer {
        let db = app.state::<Database>();
        let _ = db.start_timer(&project_name);
    }

    // Launch dev server
    if launch_dev {
        let app_clone = app.clone();
        let project_path_str = project_path.to_string_lossy().to_string();
        tauri::async_runtime::spawn(async move {
            let options = crate::commands::process_manager::LaunchOptions {
                project_path: project_path_str,
                script: None,
                port: None,
            };
            let _ = crate::commands::process_manager::launch_project(app_clone, options).await;
        });
    }

    // Update tray state
    update_tray_state(&app);
    let _ = app.emit("tray-state-changed", ());

    // Hide popup
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let _ = popup.hide();
    }

    Ok(())
}

/// Stop a process from tray and update state
#[tauri::command]
pub async fn stop_tray_process(app: AppHandle, pid: u32) -> Result<(), String> {
    crate::commands::process_manager::stop_project(app.clone(), pid).await?;
    update_tray_state(&app);
    let _ = app.emit("tray-state-changed", ());
    Ok(())
}

/// Emit open-project event to main window
#[tauri::command]
pub fn emit_open_project<R: Runtime>(
    app: AppHandle<R>,
    project_name: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("open-project", &project_name);
        let _ = window.show();
        let _ = window.set_focus();
    }
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

// ==================== PNG Decoder Helper ====================

/// Minimal PNG to RGBA decoder for tray icon
fn decode_png_icon(png_data: &[u8]) -> Option<Image<'static>> {
    use std::io::Read;

    // Verify PNG signature
    if png_data.len() < 8 || &png_data[0..8] != b"\x89PNG\r\n\x1a\n" {
        return None;
    }

    let mut pos = 8;
    let mut width: u32 = 0;
    let mut height: u32 = 0;
    let mut bit_depth: u8 = 0;
    let mut color_type: u8 = 0;
    let mut compressed_data = Vec::new();

    while pos + 8 <= png_data.len() {
        let length = u32::from_be_bytes([
            png_data[pos],
            png_data[pos + 1],
            png_data[pos + 2],
            png_data[pos + 3],
        ]) as usize;
        let chunk_type = &png_data[pos + 4..pos + 8];

        if pos + 12 + length > png_data.len() {
            break;
        }

        let chunk_data = &png_data[pos + 8..pos + 8 + length];

        match chunk_type {
            b"IHDR" if length >= 13 => {
                width = u32::from_be_bytes([
                    chunk_data[0],
                    chunk_data[1],
                    chunk_data[2],
                    chunk_data[3],
                ]);
                height = u32::from_be_bytes([
                    chunk_data[4],
                    chunk_data[5],
                    chunk_data[6],
                    chunk_data[7],
                ]);
                bit_depth = chunk_data[8];
                color_type = chunk_data[9];
            }
            b"IDAT" => {
                compressed_data.extend_from_slice(chunk_data);
            }
            b"IEND" => break,
            _ => {}
        }

        pos += 12 + length;
    }

    if width == 0 || height == 0 || bit_depth != 8 || color_type != 6 {
        // Only support 8-bit RGBA PNG (color_type 6)
        return None;
    }

    // Decompress zlib data
    let mut decoder = flate2::read::ZlibDecoder::new(&compressed_data[..]);
    let mut raw = Vec::new();
    decoder.read_to_end(&mut raw).ok()?;

    // Unfilter: each row has a filter byte + width*4 bytes
    let stride = (width as usize) * 4;
    let mut rgba = Vec::with_capacity((width * height * 4) as usize);
    let mut prev_row = vec![0u8; stride];

    for y in 0..height as usize {
        let row_start = y * (stride + 1);
        if row_start >= raw.len() {
            break;
        }
        let filter = raw[row_start];
        let row_data = &raw[row_start + 1..row_start + 1 + stride.min(raw.len() - row_start - 1)];

        let mut current_row = vec![0u8; stride];
        for x in 0..row_data.len() {
            let a = if x >= 4 { current_row[x - 4] } else { 0 };
            let b = prev_row[x];
            let c = if x >= 4 { prev_row[x - 4] } else { 0 };

            current_row[x] = match filter {
                0 => row_data[x],
                1 => row_data[x].wrapping_add(a),
                2 => row_data[x].wrapping_add(b),
                3 => row_data[x].wrapping_add(((a as u16 + b as u16) / 2) as u8),
                4 => row_data[x].wrapping_add(paeth_predictor(a, b, c)),
                _ => row_data[x],
            };
        }
        rgba.extend_from_slice(&current_row);
        prev_row = current_row;
    }

    Some(Image::new_owned(rgba, width, height))
}

fn paeth_predictor(a: u8, b: u8, c: u8) -> u8 {
    let p = a as i32 + b as i32 - c as i32;
    let pa = (p - a as i32).abs();
    let pb = (p - b as i32).abs();
    let pc = (p - c as i32).abs();
    if pa <= pb && pa <= pc {
        a
    } else if pb <= pc {
        b
    } else {
        c
    }
}
