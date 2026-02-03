use crate::models::SystemInfo;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use sysinfo::System;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledEditor {
    pub id: String,
    pub name: String,
    pub command: String,
    pub icon: String,
}

#[tauri::command]
pub fn get_installed_editors() -> Vec<InstalledEditor> {
    let mut editors = Vec::new();

    // Check for CLI commands
    let cli_editors = [
        ("code", "Visual Studio Code", "code", "vscode"),
        ("cursor", "Cursor", "cursor", "cursor"),
        ("zed", "Zed", "zed", "zed"),
        ("subl", "Sublime Text", "subl", "sublime"),
        ("atom", "Atom", "atom", "atom"),
        ("nvim", "Neovim", "nvim", "neovim"),
        ("vim", "Vim", "vim", "vim"),
        ("emacs", "Emacs", "emacs", "emacs"),
        ("nano", "Nano", "nano", "nano"),
        ("hx", "Helix", "hx", "helix"),
    ];

    for (cmd, name, command, icon) in cli_editors {
        if Command::new("which")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            editors.push(InstalledEditor {
                id: cmd.to_string(),
                name: name.to_string(),
                command: command.to_string(),
                icon: icon.to_string(),
            });
        }
    }

    // Check for macOS applications
    let app_editors = [
        ("/Applications/Visual Studio Code.app", "code", "Visual Studio Code", "code", "vscode"),
        ("/Applications/Cursor.app", "cursor", "Cursor", "cursor", "cursor"),
        ("/Applications/Zed.app", "zed", "Zed", "zed", "zed"),
        ("/Applications/Sublime Text.app", "subl", "Sublime Text", "subl", "sublime"),
        ("/Applications/Nova.app", "nova", "Nova", "nova", "nova"),
        ("/Applications/BBEdit.app", "bbedit", "BBEdit", "bbedit", "bbedit"),
        ("/Applications/TextMate.app", "mate", "TextMate", "mate", "textmate"),
        ("/Applications/WebStorm.app", "webstorm", "WebStorm", "webstorm", "jetbrains"),
        ("/Applications/IntelliJ IDEA.app", "idea", "IntelliJ IDEA", "idea", "jetbrains"),
        ("/Applications/PyCharm.app", "pycharm", "PyCharm", "pycharm", "jetbrains"),
        ("/Applications/GoLand.app", "goland", "GoLand", "goland", "jetbrains"),
        ("/Applications/RubyMine.app", "rubymine", "RubyMine", "rubymine", "jetbrains"),
        ("/Applications/PhpStorm.app", "phpstorm", "PhpStorm", "phpstorm", "jetbrains"),
        ("/Applications/CLion.app", "clion", "CLion", "clion", "jetbrains"),
        ("/Applications/Rider.app", "rider", "Rider", "rider", "jetbrains"),
        ("/Applications/Fleet.app", "fleet", "Fleet", "fleet", "jetbrains"),
        ("/Applications/Android Studio.app", "studio", "Android Studio", "studio", "android"),
        ("/Applications/Xcode.app", "xcode", "Xcode", "xed", "xcode"),
    ];

    for (app_path, id, name, command, icon) in app_editors {
        // Skip if we already found this editor via CLI
        if editors.iter().any(|e| e.id == id) {
            continue;
        }

        if Path::new(app_path).exists() {
            editors.push(InstalledEditor {
                id: id.to_string(),
                name: name.to_string(),
                command: command.to_string(),
                icon: icon.to_string(),
            });
        }
    }

    // Check JetBrains Toolbox scripts
    let toolbox_dir = dirs::home_dir()
        .map(|h| h.join("Library/Application Support/JetBrains/Toolbox/scripts"));

    if let Some(toolbox_path) = toolbox_dir {
        if toolbox_path.exists() {
            let toolbox_editors = [
                ("webstorm", "WebStorm", "jetbrains"),
                ("pycharm", "PyCharm", "jetbrains"),
                ("idea", "IntelliJ IDEA", "jetbrains"),
                ("goland", "GoLand", "jetbrains"),
                ("clion", "CLion", "jetbrains"),
                ("phpstorm", "PhpStorm", "jetbrains"),
                ("rubymine", "RubyMine", "jetbrains"),
                ("rider", "Rider", "jetbrains"),
                ("fleet", "Fleet", "jetbrains"),
            ];

            for (cmd, name, icon) in toolbox_editors {
                if editors.iter().any(|e| e.id == cmd) {
                    continue;
                }

                if toolbox_path.join(cmd).exists() {
                    editors.push(InstalledEditor {
                        id: cmd.to_string(),
                        name: name.to_string(),
                        command: cmd.to_string(),
                        icon: icon.to_string(),
                    });
                }
            }
        }
    }

    // Sort by name
    editors.sort_by(|a, b| a.name.cmp(&b.name));

    editors
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let disks = sysinfo::Disks::new_with_refreshed_list();
    let (total_disk, used_disk) = disks.iter().fold((0, 0), |(total, used), disk| {
        (
            total + disk.total_space(),
            used + (disk.total_space() - disk.available_space()),
        )
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
