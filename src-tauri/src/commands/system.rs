use crate::models::SystemInfo;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::System;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledEditor {
    pub id: String,
    pub name: String,
    pub command: String,
    pub icon: String,
}

struct EditorDef {
    id: &'static str,
    name: &'static str,
    cli_cmd: &'static str,
    app_names: &'static [&'static str],
    is_terminal: bool,
}

const EDITORS: &[EditorDef] = &[
    EditorDef { id: "code", name: "Visual Studio Code", cli_cmd: "code", app_names: &["Visual Studio Code", "Visual Studio Code - Insiders"], is_terminal: false },
    EditorDef { id: "cursor", name: "Cursor", cli_cmd: "cursor", app_names: &["Cursor"], is_terminal: false },
    EditorDef { id: "windsurf", name: "Windsurf", cli_cmd: "windsurf", app_names: &["Windsurf"], is_terminal: false },
    EditorDef { id: "zed", name: "Zed", cli_cmd: "zed", app_names: &["Zed"], is_terminal: false },
    EditorDef { id: "subl", name: "Sublime Text", cli_cmd: "subl", app_names: &["Sublime Text"], is_terminal: false },
    EditorDef { id: "nova", name: "Nova", cli_cmd: "nova", app_names: &["Nova"], is_terminal: false },
    EditorDef { id: "bbedit", name: "BBEdit", cli_cmd: "bbedit", app_names: &["BBEdit"], is_terminal: false },
    EditorDef { id: "mate", name: "TextMate", cli_cmd: "mate", app_names: &["TextMate"], is_terminal: false },
    EditorDef { id: "webstorm", name: "WebStorm", cli_cmd: "webstorm", app_names: &["WebStorm"], is_terminal: false },
    EditorDef { id: "idea", name: "IntelliJ IDEA", cli_cmd: "idea", app_names: &["IntelliJ IDEA", "IntelliJ IDEA CE"], is_terminal: false },
    EditorDef { id: "pycharm", name: "PyCharm", cli_cmd: "pycharm", app_names: &["PyCharm", "PyCharm CE"], is_terminal: false },
    EditorDef { id: "goland", name: "GoLand", cli_cmd: "goland", app_names: &["GoLand"], is_terminal: false },
    EditorDef { id: "rubymine", name: "RubyMine", cli_cmd: "rubymine", app_names: &["RubyMine"], is_terminal: false },
    EditorDef { id: "phpstorm", name: "PhpStorm", cli_cmd: "phpstorm", app_names: &["PhpStorm"], is_terminal: false },
    EditorDef { id: "clion", name: "CLion", cli_cmd: "clion", app_names: &["CLion"], is_terminal: false },
    EditorDef { id: "rider", name: "Rider", cli_cmd: "rider", app_names: &["Rider"], is_terminal: false },
    EditorDef { id: "fleet", name: "Fleet", cli_cmd: "fleet", app_names: &["Fleet"], is_terminal: false },
    EditorDef { id: "studio", name: "Android Studio", cli_cmd: "studio", app_names: &["Android Studio"], is_terminal: false },
    EditorDef { id: "xcode", name: "Xcode", cli_cmd: "xed", app_names: &["Xcode"], is_terminal: false },
    EditorDef { id: "lapce", name: "Lapce", cli_cmd: "lapce", app_names: &["Lapce"], is_terminal: false },
    EditorDef { id: "nvim", name: "Neovim", cli_cmd: "nvim", app_names: &[], is_terminal: true },
    EditorDef { id: "vim", name: "Vim", cli_cmd: "vim", app_names: &[], is_terminal: true },
    EditorDef { id: "emacs", name: "Emacs", cli_cmd: "emacs", app_names: &[], is_terminal: true },
    EditorDef { id: "nano", name: "Nano", cli_cmd: "nano", app_names: &[], is_terminal: true },
    EditorDef { id: "hx", name: "Helix", cli_cmd: "hx", app_names: &[], is_terminal: true },
];

// Embedded fallback icons for terminal editors
const ICON_VIM: &[u8] = include_bytes!("../../assets/editor-icons/vim.png");
const ICON_NEOVIM: &[u8] = include_bytes!("../../assets/editor-icons/neovim.png");
const ICON_EMACS: &[u8] = include_bytes!("../../assets/editor-icons/emacs.png");
const ICON_NANO: &[u8] = include_bytes!("../../assets/editor-icons/nano.png");
const ICON_HELIX: &[u8] = include_bytes!("../../assets/editor-icons/helix.png");
const ICON_TERMINAL_GENERIC: &[u8] = include_bytes!("../../assets/editor-icons/terminal-generic.png");
const ICON_EDITOR_GENERIC: &[u8] = include_bytes!("../../assets/editor-icons/editor-generic.png");

fn bytes_to_data_url(bytes: &[u8]) -> String {
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:image/png;base64,{}", b64)
}

fn get_embedded_icon(editor_id: &str) -> String {
    let bytes = match editor_id {
        "vim" => ICON_VIM,
        "nvim" => ICON_NEOVIM,
        "emacs" => ICON_EMACS,
        "nano" => ICON_NANO,
        "hx" => ICON_HELIX,
        _ => ICON_TERMINAL_GENERIC,
    };
    bytes_to_data_url(bytes)
}

fn icon_cache_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".devconfig/editor-icons"))
}

fn extract_app_icon(app_path: &str) -> Option<String> {
    let app = Path::new(app_path);
    if !app.exists() {
        return None;
    }

    // Check cache first
    let app_name = app.file_stem()?.to_str()?;
    let cache_id = app_name.to_lowercase().replace(' ', "-");

    if let Some(cache_dir) = icon_cache_dir() {
        let cached_png = cache_dir.join(format!("{}.png", cache_id));
        if cached_png.exists() {
            // Check if cache is still valid (app hasn't been modified since)
            if let (Ok(cache_meta), Ok(app_meta)) = (fs::metadata(&cached_png), fs::metadata(app)) {
                if let (Ok(cache_time), Ok(app_time)) = (cache_meta.modified(), app_meta.modified()) {
                    if cache_time > app_time {
                        if let Ok(bytes) = fs::read(&cached_png) {
                            return Some(bytes_to_data_url(&bytes));
                        }
                    }
                }
            }
        }
    }

    // Read Info.plist
    let plist_path = Path::new(app_path).join("Contents/Info.plist");
    let plist_val: plist::Value = plist::from_file(&plist_path).ok()?;
    let dict = plist_val.as_dictionary()?;

    let icon_name = dict
        .get("CFBundleIconFile")
        .and_then(|v| v.as_string())
        .unwrap_or("AppIcon");

    // Append .icns if missing
    let icon_file = if icon_name.ends_with(".icns") {
        icon_name.to_string()
    } else {
        format!("{}.icns", icon_name)
    };

    let icns_path = Path::new(app_path)
        .join("Contents/Resources")
        .join(&icon_file);

    if !icns_path.exists() {
        return None;
    }

    // Use sips to convert to 32x32 PNG
    let tmp_dir = std::env::temp_dir();
    let tmp_path = tmp_dir.join(format!("pm-editor-icon-{}.png", cache_id));

    let output = Command::new("sips")
        .args([
            "-s",
            "format",
            "png",
            "--resampleWidth",
            "32",
            icns_path.to_str()?,
            "--out",
            tmp_path.to_str()?,
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let png_bytes = fs::read(&tmp_path).ok()?;
    let _ = fs::remove_file(&tmp_path);

    // Cache the result
    if let Some(cache_dir) = icon_cache_dir() {
        let _ = fs::create_dir_all(&cache_dir);
        let cached_png = cache_dir.join(format!("{}.png", cache_id));
        let _ = fs::write(&cached_png, &png_bytes);
    }

    Some(bytes_to_data_url(&png_bytes))
}

fn find_app_path(app_names: &[&str]) -> Option<String> {
    let home = dirs::home_dir();
    for name in app_names {
        let app_file = format!("{}.app", name);

        // Check /Applications
        let sys_path = Path::new("/Applications").join(&app_file);
        if sys_path.exists() {
            return sys_path.to_str().map(String::from);
        }

        // Check ~/Applications
        if let Some(ref home) = home {
            let user_path = home.join("Applications").join(&app_file);
            if user_path.exists() {
                return user_path.to_str().map(String::from);
            }
        }
    }
    None
}

fn cli_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn get_installed_editors() -> Vec<InstalledEditor> {
    let mut found: HashMap<String, InstalledEditor> = HashMap::new();

    // JetBrains Toolbox scripts dir
    let toolbox_dir = dirs::home_dir()
        .map(|h| h.join("Library/Application Support/JetBrains/Toolbox/scripts"));

    for def in EDITORS {
        if found.contains_key(def.id) {
            continue;
        }

        let has_cli = cli_exists(def.cli_cmd);
        let app_path = find_app_path(def.app_names);
        let has_toolbox = toolbox_dir
            .as_ref()
            .map(|d| d.join(def.cli_cmd).exists())
            .unwrap_or(false);

        if !has_cli && app_path.is_none() && !has_toolbox {
            continue;
        }

        // Resolve icon
        let icon = if def.is_terminal {
            get_embedded_icon(def.id)
        } else if let Some(ref path) = app_path {
            extract_app_icon(path)
                .unwrap_or_else(|| bytes_to_data_url(ICON_EDITOR_GENERIC))
        } else {
            // Found via CLI only — try to locate the .app anyway
            find_app_path(def.app_names)
                .and_then(|p| extract_app_icon(&p))
                .unwrap_or_else(|| bytes_to_data_url(ICON_EDITOR_GENERIC))
        };

        found.insert(
            def.id.to_string(),
            InstalledEditor {
                id: def.id.to_string(),
                name: def.name.to_string(),
                command: def.cli_cmd.to_string(),
                icon,
            },
        );
    }

    let mut editors: Vec<InstalledEditor> = found.into_values().collect();
    editors.sort_by(|a, b| a.name.cmp(&b.name));
    editors
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new();
    sys.refresh_memory();
    sys.refresh_cpu_all();

    let disks = sysinfo::Disks::new_with_refreshed_list();

    // Find the root disk (/) - this is the main system disk on macOS
    let (total_disk, used_disk) = disks
        .iter()
        .find(|disk| disk.mount_point() == Path::new("/"))
        .map(|disk| {
            (
                disk.total_space(),
                disk.total_space() - disk.available_space(),
            )
        })
        .unwrap_or_else(|| {
            // Fallback: use the largest disk if root not found
            disks
                .iter()
                .max_by_key(|d| d.total_space())
                .map(|disk| {
                    (
                        disk.total_space(),
                        disk.total_space() - disk.available_space(),
                    )
                })
                .unwrap_or((0, 0))
        });

    let cpu_usage =
        sys.cpus().iter().map(|cpu| cpu.cpu_usage()).sum::<f32>() / sys.cpus().len() as f32;

    Ok(SystemInfo {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        total_disk,
        used_disk,
        cpu_count: sys.cpus().len(),
        cpu_usage,
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
    })
}

#[tauri::command]
pub fn open_in_editor(path: String, editor: String) -> Result<(), String> {
    std::process::Command::new(&editor)
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open {} in {}: {}", path, editor, e))?;
    Ok(())
}

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-a", "Terminal", &path])
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn open_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open Finder: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn check_docker_running() -> bool {
    std::process::Command::new("docker")
        .args(["info"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
