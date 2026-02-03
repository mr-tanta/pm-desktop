use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Permission status for a specific capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatus {
    pub id: String,
    pub name: String,
    pub description: String,
    pub required: bool,
    pub granted: bool,
    pub can_prompt: bool,
    pub settings_url: String,
}

/// All permission statuses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsResult {
    pub permissions: Vec<PermissionStatus>,
    pub all_granted: bool,
    pub required_granted: bool,
    pub app_path: String,
}

/// Check Full Disk Access by testing TRULY protected paths
/// These paths are ONLY accessible with Full Disk Access granted
fn check_full_disk_access() -> bool {
    // Method 1: Try to read the TCC database file (most reliable check)
    // This file ALWAYS exists and ALWAYS requires FDA to read
    let tcc_db = PathBuf::from("/Library/Application Support/com.apple.TCC/TCC.db");
    if let Ok(_) = fs::metadata(&tcc_db) {
        // If we can get metadata, we have FDA
        return true;
    }

    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return false,
    };

    // Method 2: These directories REQUIRE Full Disk Access
    // Just being able to read_dir() them (even if empty) indicates FDA
    let strictly_protected_paths: Vec<PathBuf> = vec![
        home.join("Library/Mail"),
        home.join("Library/Messages"),
        home.join("Library/Safari"),
        home.join("Library/Cookies"),
        home.join("Library/HomeKit"),
    ];

    // Try to access strictly protected paths
    // If we can successfully open ANY of them, we have FDA
    for path in &strictly_protected_paths {
        // Skip paths that don't exist (user might not use these apps)
        match fs::metadata(&path) {
            Ok(_) => {
                // Path exists, try to read it
                match fs::read_dir(&path) {
                    Ok(_) => {
                        // Successfully opened directory = FDA granted
                        // (even if it's empty, being able to open it means we have access)
                        return true;
                    }
                    Err(e) => {
                        let os_error = e.raw_os_error();
                        // Error 1 = Operation not permitted (EPERM)
                        // Error 13 = Permission denied (EACCES)
                        if os_error == Some(1) || os_error == Some(13) {
                            // No FDA for this path, try next
                            continue;
                        }
                        // Other error (not permission related), assume we might have access
                        return true;
                    }
                }
            }
            Err(e) => {
                let os_error = e.raw_os_error();
                // If we get permission denied on metadata, we definitely don't have FDA
                if os_error == Some(1) || os_error == Some(13) {
                    continue;
                }
                // Path doesn't exist or other error, skip it
                continue;
            }
        }
    }

    // Method 3: Try to access ~/Library/Safari/Bookmarks.plist (file, not directory)
    // This is a reliable check because Safari creates this file on most Macs
    let safari_bookmarks = home.join("Library/Safari/Bookmarks.plist");
    if let Ok(_) = fs::metadata(&safari_bookmarks) {
        return true;
    }

    // If we couldn't access any strictly protected path, we don't have FDA
    false
}

/// Check if we can access a specific path
fn can_access_path(path: &Path) -> bool {
    if !path.exists() {
        return true;
    }

    match fs::read_dir(path) {
        Ok(mut entries) => {
            match entries.next() {
                Some(Ok(_)) => true,
                Some(Err(e)) => {
                    let os_error = e.raw_os_error();
                    os_error != Some(1) && os_error != Some(13)
                }
                None => true // Empty directory is accessible
            }
        }
        Err(e) => {
            let os_error = e.raw_os_error();
            os_error != Some(1) && os_error != Some(13)
        }
    }
}

/// Get current permission statuses
#[tauri::command]
pub fn get_permissions() -> Result<PermissionsResult, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let library = home.join("Library");

    let app_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let full_disk_granted = check_full_disk_access();

    let permissions = vec![
        PermissionStatus {
            id: "full_disk_access".to_string(),
            name: "Full Disk Access".to_string(),
            description: "Required to scan and clean system caches, logs, and protected directories. This permission must be granted manually in System Settings.".to_string(),
            required: true,
            granted: full_disk_granted,
            can_prompt: false, // macOS requires manual opt-in for FDA
            settings_url: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles".to_string(),
        },
        PermissionStatus {
            id: "files_and_folders".to_string(),
            name: "Files and Folders".to_string(),
            description: "Access to Documents, Downloads, and Desktop folders for scanning project files.".to_string(),
            required: false,
            granted: can_access_path(&home.join("Documents")) && can_access_path(&home.join("Downloads")),
            can_prompt: true, // Can trigger native prompt
            settings_url: "x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders".to_string(),
        },
        PermissionStatus {
            id: "developer_directory".to_string(),
            name: "Developer Directory".to_string(),
            description: "Access to ~/Library/Developer for Xcode caches, simulators, and device support files.".to_string(),
            required: false,
            granted: can_access_path(&library.join("Developer")),
            can_prompt: false,
            settings_url: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles".to_string(),
        },
    ];

    let all_granted = permissions.iter().all(|p| p.granted);
    let required_granted = permissions.iter().filter(|p| p.required).all(|p| p.granted);

    Ok(PermissionsResult {
        permissions,
        all_granted,
        required_granted,
        app_path,
    })
}

/// Trigger a permission prompt by accessing a protected resource
/// This will show macOS's native permission dialog for Files and Folders
#[tauri::command]
pub fn trigger_files_permission() -> Result<bool, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;

    // Try to access Documents - this triggers the native prompt
    let docs = home.join("Documents");
    if docs.exists() {
        match fs::read_dir(&docs) {
            Ok(mut entries) => {
                // Actually try to read an entry to trigger the prompt
                let _ = entries.next();
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    } else {
        Ok(true)
    }
}

/// Open System Settings to Full Disk Access pane
#[tauri::command]
pub fn open_full_disk_access_settings() -> Result<(), String> {
    Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .spawn()
        .map_err(|e| format!("Failed to open System Settings: {}", e))?;

    Ok(())
}

/// Open System Settings to a specific privacy pane
#[tauri::command]
pub fn open_privacy_settings(settings_url: String) -> Result<(), String> {
    Command::new("open")
        .arg(&settings_url)
        .spawn()
        .map_err(|e| format!("Failed to open System Settings: {}", e))?;

    Ok(())
}

/// Show a native macOS dialog explaining Full Disk Access requirement
/// Then open System Settings
#[tauri::command]
pub fn request_full_disk_access_with_dialog() -> Result<(), String> {
    // Use osascript to show a native dialog
    let script = r#"
        display dialog "PM Desktop needs Full Disk Access to scan and clean system caches, logs, and developer files.

Click OK to open System Settings. Then:
1. Click the + button
2. Navigate to Applications
3. Select PM Desktop
4. Restart the app" with title "Permission Required" buttons {"Cancel", "Open Settings"} default button "Open Settings" with icon caution
    "#;

    let result = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output();

    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("Open Settings") {
                // User clicked Open Settings
                Command::new("open")
                    .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
                    .spawn()
                    .map_err(|e| format!("Failed to open System Settings: {}", e))?;
            }
            Ok(())
        }
        Err(e) => Err(format!("Failed to show dialog: {}", e)),
    }
}

/// Public wrapper for FDA check - used by other commands
#[tauri::command]
pub fn check_full_disk_access_status() -> bool {
    check_full_disk_access()
}

/// Get the app's bundle path (for .app bundles) or executable path
#[tauri::command]
pub fn get_app_path() -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get app path: {}", e))?;

    // Check if we're inside an .app bundle
    let path_str = exe_path.to_string_lossy();
    if let Some(app_idx) = path_str.find(".app/") {
        // Return the .app bundle path
        Ok(path_str[..app_idx + 4].to_string())
    } else {
        // Return the executable path (for dev builds)
        Ok(path_str.to_string())
    }
}

