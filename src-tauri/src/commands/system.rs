use crate::models::SystemInfo;
use sysinfo::System;

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
