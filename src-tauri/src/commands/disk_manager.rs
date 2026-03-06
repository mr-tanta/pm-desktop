use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

use crate::models::Config;
use crate::services::{ConfigService, Database};
use crate::services::database::DiskScanHistoryEntry;

/// Safety levels for cleanup operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SafetyLevel {
    /// Caches, logs, temp files - always safe to delete
    Safe,
    /// Build artifacts, node_modules - can be regenerated
    Moderate,
    /// Docker, system files - requires explicit confirmation
    Aggressive,
}

/// Categories of disk items optimized for developers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiskCategory {
    /// ~/Library/Caches, ~/Library/Logs
    SafeToClean,
    /// node_modules, .next, target, DerivedData
    BuildArtifacts,
    /// pnpm store, npm cache, Homebrew, CocoaPods, Cargo, Gradle
    PackageManagers,
    /// Xcode simulators, iOS DeviceSupport, Android SDK, Playwright
    DevTools,
    /// Chrome, JetBrains, other app caches
    AppCaches,
    /// Docker containers and images
    Docker,
    /// System temp files
    System,
    /// macOS Trash
    Trash,
}

impl DiskCategory {
    pub fn display_name(&self) -> &'static str {
        match self {
            DiskCategory::SafeToClean => "Safe to Clean",
            DiskCategory::BuildArtifacts => "Build Artifacts",
            DiskCategory::PackageManagers => "Package Managers",
            DiskCategory::DevTools => "Dev Tools",
            DiskCategory::AppCaches => "App Caches",
            DiskCategory::Docker => "Docker",
            DiskCategory::System => "System",
            DiskCategory::Trash => "Trash",
        }
    }

    pub fn safety_level(&self) -> SafetyLevel {
        match self {
            DiskCategory::SafeToClean | DiskCategory::Trash => SafetyLevel::Safe,
            DiskCategory::BuildArtifacts | DiskCategory::PackageManagers => SafetyLevel::Moderate,
            DiskCategory::DevTools | DiskCategory::AppCaches => SafetyLevel::Moderate,
            DiskCategory::Docker | DiskCategory::System => SafetyLevel::Aggressive,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            DiskCategory::SafeToClean => "shield-check",
            DiskCategory::BuildArtifacts => "package",
            DiskCategory::PackageManagers => "archive",
            DiskCategory::DevTools => "wrench",
            DiskCategory::AppCaches => "app-window",
            DiskCategory::Docker => "container",
            DiskCategory::System => "cog",
            DiskCategory::Trash => "trash-2",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            DiskCategory::SafeToClean => "Cache files and logs that are safe to remove",
            DiskCategory::BuildArtifacts => "Build outputs like node_modules, .next, target directories",
            DiskCategory::PackageManagers => "Package manager caches and stores",
            DiskCategory::DevTools => "Developer tool data like Xcode simulators",
            DiskCategory::AppCaches => "Application-specific cache data",
            DiskCategory::Docker => "Docker containers, images, and volumes",
            DiskCategory::System => "System temporary files",
            DiskCategory::Trash => "Files waiting to be permanently deleted",
        }
    }
}

/// A scannable item representing a directory or file that can be cleaned
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannableItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub category: DiskCategory,
    pub safety_level: SafetyLevel,
    pub size_bytes: u64,
    pub formatted_size: String,
    pub file_count: u64,
    pub description: String,
    pub icon: String,
    #[serde(default)]
    pub children: Vec<ScannableItem>,
    pub exists: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

/// Summary for a category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySummary {
    pub category: DiskCategory,
    pub name: String,
    pub size_bytes: u64,
    pub formatted_size: String,
    pub item_count: u32,
    pub safety_level: SafetyLevel,
    pub icon: String,
    pub description: String,
}

/// Result of a disk scan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskScanResult {
    pub total_size_bytes: u64,
    pub cleanable_size_bytes: u64,
    pub formatted_total: String,
    pub formatted_cleanable: String,
    pub items: Vec<ScannableItem>,
    pub categories: Vec<CategorySummary>,
    pub scan_duration_ms: u64,
}

/// Options for cleanup operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupOptions {
    pub item_ids: Vec<String>,
    pub safety_level: SafetyLevel,
    #[serde(default = "default_true")]
    pub move_to_trash: bool,
    #[serde(default)]
    pub dry_run: bool,
}

fn default_true() -> bool {
    true
}

/// Result of a cleanup preview
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupPreview {
    pub items: Vec<ScannableItem>,
    pub total_size_bytes: u64,
    pub formatted_size: String,
    pub total_files: u64,
    pub warnings: Vec<String>,
}

/// Result of an executed cleanup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupResult {
    pub success: bool,
    pub freed_bytes: u64,
    pub formatted_freed: String,
    pub deleted_count: u32,
    pub failed_count: u32,
    pub errors: Vec<String>,
}

/// A cleanup history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupHistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub freed_bytes: u64,
    pub formatted_freed: String,
    pub item_count: u32,
    pub categories: Vec<String>,
}

/// Progress event for disk scanning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgressEvent {
    pub current_path: String,
    pub items_found: u32,
    pub bytes_scanned: u64,
    pub progress_percent: f32,
}

/// Format bytes into human-readable string
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Load config for project directory awareness
fn load_app_config() -> Option<Config> {
    let service = ConfigService::new();
    service.load().ok()
}

/// Protected paths that should never be deleted
fn is_protected_path(path: &Path) -> bool {
    let home = dirs::home_dir().unwrap_or_default();
    let protected = [
        home.join(".ssh"),
        home.join(".gnupg"),
        home.join(".aws"),
        home.join(".kube").join("config"),
        PathBuf::from("/System"),
        PathBuf::from("/Applications"),
        PathBuf::from("/Library"),
    ];

    if protected.iter().any(|p| path.starts_with(p)) {
        return true;
    }

    // Protect the configured active_dir and archive_dir root directories themselves
    // (exact match only — their contents like node_modules are still cleanable)
    if let Some(config) = load_app_config() {
        let active = PathBuf::from(&config.active_dir);
        let archive = PathBuf::from(&config.archive_dir);
        if path == active || path == archive {
            return true;
        }
    }

    false
}

/// Check if a path is inside one of the user's configured project directories.
/// Returns Some("Inside active project 'project-name'") or similar if inside a project.
fn is_inside_project_dir(path: &Path, config: &Config) -> Option<String> {
    let active_dir = PathBuf::from(&config.active_dir);
    let archive_dir = PathBuf::from(&config.archive_dir);

    // Check if path is inside active_dir
    if let Ok(relative) = path.strip_prefix(&active_dir) {
        let project_name = relative
            .components()
            .next()
            .map(|c| c.as_os_str().to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        return Some(format!("Inside active project '{}'", project_name));
    }

    // Check if path is inside archive_dir
    if let Ok(relative) = path.strip_prefix(&archive_dir) {
        let project_name = relative
            .components()
            .next()
            .map(|c| c.as_os_str().to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        return Some(format!("Inside archived project '{}'", project_name));
    }

    None
}

/// Check if a project directory has uncommitted git changes.
/// `project_path` should be the root of the project (e.g. ~/Developer/active/my-app).
fn check_project_git_dirty(project_path: &Path) -> bool {
    Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(project_path)
        .output()
        .map(|output| {
            output.status.success()
                && !output.stdout.is_empty()
        })
        .unwrap_or(false)
}

/// Given a build artifact path (e.g. ~/Developer/active/my-app/node_modules),
/// find the project root (the first directory under active_dir or archive_dir).
fn find_project_root(artifact_path: &Path, config: &Config) -> Option<PathBuf> {
    let active_dir = PathBuf::from(&config.active_dir);
    let archive_dir = PathBuf::from(&config.archive_dir);

    for base_dir in &[active_dir, archive_dir] {
        if let Ok(relative) = artifact_path.strip_prefix(base_dir) {
            if let Some(first_component) = relative.components().next() {
                return Some(base_dir.join(first_component));
            }
        }
    }
    None
}

/// Calculate directory size using disk blocks
fn calculate_size(path: &Path) -> (u64, u64) {
    let mut total_bytes = 0u64;
    let mut file_count = 0u64;

    if path.is_file() {
        if let Ok(meta) = fs::metadata(path) {
            return (meta.blocks() * 512, 1);
        }
        return (0, 0);
    }

    fn recurse(path: &Path, total: &mut u64, count: &mut u64) {
        let entries = match fs::read_dir(path) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let entry_path = entry.path();
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    *total += meta.blocks() * 512;
                    *count += 1;
                } else if meta.is_dir() {
                    recurse(&entry_path, total, count);
                }
            }
        }
    }

    recurse(path, &mut total_bytes, &mut file_count);
    (total_bytes, file_count)
}

/// Get scan targets organized by category
fn get_scan_targets() -> Vec<(DiskCategory, Vec<ScanTarget>)> {
    let home = dirs::home_dir().unwrap_or_default();
    let library = home.join("Library");

    vec![
        (
            DiskCategory::SafeToClean,
            vec![
                ScanTarget::new(library.join("Caches"), "Library Caches", "System and app cache files"),
                ScanTarget::new(library.join("Logs"), "Library Logs", "Application log files"),
                ScanTarget::new(home.join(".cache"), "User Cache", "User-level cache directory"),
            ],
        ),
        (
            DiskCategory::BuildArtifacts,
            vec![
                ScanTarget::new(
                    home.join("Developer"),
                    "node_modules (scan)",
                    "Node.js dependencies in projects",
                ).with_pattern("**/node_modules"),
                ScanTarget::new(
                    home.join("Developer"),
                    ".next (scan)",
                    "Next.js build outputs",
                ).with_pattern("**/.next"),
                ScanTarget::new(
                    home.join("Developer"),
                    "target (scan)",
                    "Rust/Cargo build outputs",
                ).with_pattern("**/target"),
                ScanTarget::new(
                    library.join("Developer").join("Xcode").join("DerivedData"),
                    "Xcode DerivedData",
                    "Xcode build artifacts",
                ),
            ],
        ),
        (
            DiskCategory::PackageManagers,
            vec![
                ScanTarget::new(
                    library.join("pnpm").join("store"),
                    "pnpm Store",
                    "pnpm package cache",
                ),
                ScanTarget::new(
                    home.join(".pnpm-store"),
                    "pnpm Store (alt)",
                    "Alternative pnpm store location",
                ),
                ScanTarget::new(
                    library.join("Caches").join("Homebrew"),
                    "Homebrew Cache",
                    "Homebrew downloaded packages",
                ),
                ScanTarget::new(
                    home.join(".npm"),
                    "npm Cache",
                    "npm package cache",
                ),
                ScanTarget::new(
                    library.join("Caches").join("CocoaPods"),
                    "CocoaPods Cache",
                    "CocoaPods pod cache",
                ),
                ScanTarget::new(
                    home.join(".cargo").join("registry"),
                    "Cargo Registry",
                    "Rust crate downloads",
                ),
                ScanTarget::new(
                    home.join(".gradle").join("caches"),
                    "Gradle Cache",
                    "Gradle build cache",
                ),
                ScanTarget::new(
                    home.join(".rustup").join("toolchains"),
                    "Rustup Toolchains",
                    "Rust toolchain installations",
                ),
            ],
        ),
        (
            DiskCategory::DevTools,
            vec![
                ScanTarget::new(
                    library.join("Developer").join("Xcode").join("iOS DeviceSupport"),
                    "iOS DeviceSupport",
                    "iOS device symbols for debugging",
                ),
                ScanTarget::new(
                    library.join("Developer").join("CoreSimulator").join("Devices"),
                    "iOS Simulators",
                    "Xcode iOS simulator data",
                ),
                ScanTarget::new(
                    library.join("Developer").join("CoreSimulator").join("Caches"),
                    "Simulator Caches",
                    "iOS simulator cache files",
                ),
                ScanTarget::new(
                    library.join("Android").join("sdk"),
                    "Android SDK",
                    "Android development SDK",
                ),
                ScanTarget::new(
                    library.join("Caches").join("ms-playwright"),
                    "Playwright Browsers",
                    "Playwright browser downloads",
                ),
            ],
        ),
        (
            DiskCategory::AppCaches,
            vec![
                ScanTarget::new(
                    library.join("Application Support").join("Google").join("Chrome"),
                    "Chrome Data",
                    "Chrome browser data and cache",
                ),
                ScanTarget::new(
                    library.join("Caches").join("Google"),
                    "Google Caches",
                    "Google app caches",
                ),
                ScanTarget::new(
                    library.join("Application Support").join("JetBrains"),
                    "JetBrains IDEs",
                    "IntelliJ, WebStorm, etc. data",
                ),
                ScanTarget::new(
                    library.join("Application Support").join("Claude"),
                    "Claude Data",
                    "Claude app data",
                ),
                ScanTarget::new(
                    library.join("Application Support").join("Slack"),
                    "Slack Data",
                    "Slack cache and data",
                ),
            ],
        ),
        (
            DiskCategory::Docker,
            vec![
                ScanTarget::new(
                    library.join("Containers").join("com.docker.docker"),
                    "Docker Desktop",
                    "Docker containers, images, and volumes",
                ),
                ScanTarget::new(
                    home.join(".docker"),
                    "Docker Config",
                    "Docker configuration and credentials",
                ),
            ],
        ),
        (
            DiskCategory::System,
            vec![
                ScanTarget::new(
                    PathBuf::from("/private/var/folders"),
                    "System Temp",
                    "macOS temporary files (requires admin)",
                ),
                ScanTarget::new(
                    home.join("Downloads"),
                    "Downloads",
                    "Downloaded files",
                ),
            ],
        ),
        (
            DiskCategory::Trash,
            vec![ScanTarget::new(home.join(".Trash"), "Trash", "Files waiting to be deleted")],
        ),
    ]
}

/// A scan target with optional glob pattern
struct ScanTarget {
    path: PathBuf,
    name: &'static str,
    description: &'static str,
    pattern: Option<&'static str>,
}

impl ScanTarget {
    fn new(path: PathBuf, name: &'static str, description: &'static str) -> Self {
        Self {
            path,
            name,
            description,
            pattern: None,
        }
    }

    fn with_pattern(mut self, pattern: &'static str) -> Self {
        self.pattern = Some(pattern);
        self
    }
}

/// Scan a single target and return a ScannableItem
fn scan_target(target: &ScanTarget, category: DiskCategory) -> Option<ScannableItem> {
    let path = &target.path;

    if !path.exists() {
        return None;
    }

    // Handle glob patterns (scan for multiple directories)
    if let Some(_pattern) = target.pattern {
        // For patterns, we'll scan the base directory for matching subdirs
        return scan_pattern_target(target, category);
    }

    let (size_bytes, file_count) = calculate_size(path);

    // Skip if empty or very small (< 1MB)
    if size_bytes < 1_000_000 {
        return None;
    }

    Some(ScannableItem {
        id: format!("{:x}", md5_hash(&path.to_string_lossy())),
        name: target.name.to_string(),
        path: path.to_string_lossy().to_string(),
        category,
        safety_level: category.safety_level(),
        size_bytes,
        formatted_size: format_bytes(size_bytes),
        file_count,
        description: target.description.to_string(),
        icon: category.icon().to_string(),
        children: vec![],
        exists: true,
        warning: None,
    })
}

/// Simple hash function for ID generation
fn md5_hash(s: &str) -> u64 {
    let mut hash: u64 = 0;
    for byte in s.bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
    }
    hash
}

/// Scan for pattern-based targets (node_modules, .next, target dirs)
fn scan_pattern_target(target: &ScanTarget, category: DiskCategory) -> Option<ScannableItem> {
    let base_path = &target.path;
    if !base_path.exists() {
        return None;
    }

    let pattern_name = target.pattern?;
    let dir_name = pattern_name.trim_start_matches("**/");

    let mut children = Vec::new();
    let mut total_size: u64 = 0;
    let mut total_files: u64 = 0;

    // Only scan one level deep for projects
    fn find_matching_dirs(base: &Path, target_name: &str, max_depth: u32, found: &mut Vec<PathBuf>) {
        if max_depth == 0 {
            return;
        }

        let entries = match fs::read_dir(base) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

            // Skip hidden dirs except our targets
            if name.starts_with('.') && name != target_name {
                continue;
            }

            if name == target_name {
                found.push(path);
            } else {
                // Recurse into project directories
                find_matching_dirs(&path, target_name, max_depth - 1, found);
            }
        }
    }

    let mut found_dirs = Vec::new();
    find_matching_dirs(base_path, dir_name, 3, &mut found_dirs);

    // Load config once for all project-awareness checks in this scan
    let config = load_app_config();

    for dir in found_dirs.iter().take(100) {
        // Limit to 100 entries
        let (size, files) = calculate_size(dir);
        if size < 1_000_000 {
            continue; // Skip small dirs
        }

        // Get parent project name
        let project_name = dir
            .parent()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        total_size += size;
        total_files += files;

        // Check if this artifact is inside a configured project directory
        let warning = if let Some(ref cfg) = config {
            let mut warning_parts: Vec<String> = Vec::new();
            if let Some(project_warning) = is_inside_project_dir(dir, cfg) {
                warning_parts.push(project_warning);

                // Also check if the project has uncommitted changes
                if let Some(project_root) = find_project_root(dir, cfg) {
                    if check_project_git_dirty(&project_root) {
                        warning_parts.push("Has uncommitted changes".to_string());
                    }
                }
            }
            if warning_parts.is_empty() { None } else { Some(warning_parts.join(" — ")) }
        } else {
            None
        };

        children.push(ScannableItem {
            id: format!("{:x}", md5_hash(&dir.to_string_lossy())),
            name: format!("{}/{}", project_name, dir_name),
            path: dir.to_string_lossy().to_string(),
            category,
            safety_level: category.safety_level(),
            size_bytes: size,
            formatted_size: format_bytes(size),
            file_count: files,
            description: format!("{} in {}", dir_name, project_name),
            icon: category.icon().to_string(),
            children: vec![],
            exists: true,
            warning,
        });
    }

    if children.is_empty() {
        return None;
    }

    // Sort children by size descending
    children.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

    Some(ScannableItem {
        id: format!("{:x}", md5_hash(&format!("{}_{}", base_path.display(), dir_name))),
        name: target.name.to_string(),
        path: base_path.to_string_lossy().to_string(),
        category,
        safety_level: category.safety_level(),
        size_bytes: total_size,
        formatted_size: format_bytes(total_size),
        file_count: total_files,
        description: format!("{} ({} locations)", target.description, children.len()),
        icon: category.icon().to_string(),
        children,
        exists: true,
        warning: None,
    })
}

// Global cancel flag for scans
static SCAN_CANCELLED: AtomicBool = AtomicBool::new(false);

/// Scan disk for cleanable items
#[tauri::command]
pub async fn scan_disk(app: AppHandle, db: tauri::State<'_, Database>) -> Result<DiskScanResult, String> {
    SCAN_CANCELLED.store(false, Ordering::SeqCst);

    let start = std::time::Instant::now();

    let result = tokio::task::spawn_blocking(move || {
        let targets = get_scan_targets();
        let mut all_items: Vec<ScannableItem> = Vec::new();
        let mut category_map: HashMap<DiskCategory, Vec<ScannableItem>> = HashMap::new();
        let mut items_found = 0u32;
        let mut bytes_scanned = 0u64;

        let total_targets: usize = targets.iter().map(|(_, t)| t.len()).sum();
        let mut processed = 0;

        for (category, category_targets) in &targets {
            if SCAN_CANCELLED.load(Ordering::SeqCst) {
                return Err("Scan cancelled".to_string());
            }

            for target in category_targets {
                processed += 1;

                // Emit progress
                let progress = ScanProgressEvent {
                    current_path: target.path.to_string_lossy().to_string(),
                    items_found,
                    bytes_scanned,
                    progress_percent: (processed as f32 / total_targets as f32) * 100.0,
                };
                let _ = app.emit("disk-scan-progress", progress);

                if let Some(item) = scan_target(target, *category) {
                    items_found += 1 + item.children.len() as u32;
                    bytes_scanned += item.size_bytes;

                    category_map
                        .entry(*category)
                        .or_default()
                        .push(item.clone());
                    all_items.push(item);
                }
            }
        }

        // Build category summaries
        let mut categories: Vec<CategorySummary> = category_map
            .iter()
            .map(|(cat, items)| {
                let total_size: u64 = items.iter().map(|i| i.size_bytes).sum();
                CategorySummary {
                    category: *cat,
                    name: cat.display_name().to_string(),
                    size_bytes: total_size,
                    formatted_size: format_bytes(total_size),
                    item_count: items.len() as u32,
                    safety_level: cat.safety_level(),
                    icon: cat.icon().to_string(),
                    description: cat.description().to_string(),
                }
            })
            .collect();

        // Sort categories by size descending
        categories.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

        // Sort items by size descending
        all_items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

        let total_size: u64 = all_items.iter().map(|i| i.size_bytes).sum();
        let cleanable_size: u64 = all_items
            .iter()
            .filter(|i| i.safety_level != SafetyLevel::Aggressive)
            .map(|i| i.size_bytes)
            .sum();

        Ok(DiskScanResult {
            total_size_bytes: total_size,
            cleanable_size_bytes: cleanable_size,
            formatted_total: format_bytes(total_size),
            formatted_cleanable: format_bytes(cleanable_size),
            items: all_items,
            categories,
            scan_duration_ms: start.elapsed().as_millis() as u64,
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    // Save scan to history
    let category_map: HashMap<String, u64> = result
        .categories
        .iter()
        .map(|c| (c.name.clone(), c.size_bytes))
        .collect();
    if let Ok(json) = serde_json::to_string(&category_map) {
        let _ = db.save_disk_scan(result.total_size_bytes, &json);
    }

    Ok(result)
}

/// Cancel an ongoing disk scan
#[tauri::command]
pub fn cancel_disk_scan() -> Result<(), String> {
    SCAN_CANCELLED.store(true, Ordering::SeqCst);
    Ok(())
}

/// Scan a specific category
#[tauri::command]
pub async fn scan_category(category: DiskCategory) -> Result<Vec<ScannableItem>, String> {
    let result = tokio::task::spawn_blocking(move || {
        let targets = get_scan_targets();
        let mut items = Vec::new();

        for (cat, category_targets) in targets {
            if cat != category {
                continue;
            }

            for target in category_targets {
                if let Some(item) = scan_target(&target, cat) {
                    items.push(item);
                }
            }
        }

        items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        items
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Preview what will be cleaned without actually deleting
#[tauri::command]
pub async fn preview_cleanup(options: CleanupOptions, all_items: Vec<ScannableItem>) -> Result<CleanupPreview, String> {
    let result = tokio::task::spawn_blocking(move || {
        let mut selected_items: Vec<ScannableItem> = Vec::new();
        let mut warnings: Vec<String> = Vec::new();

        // Build a map of all items including children
        let mut item_map: HashMap<String, ScannableItem> = HashMap::new();
        for item in &all_items {
            item_map.insert(item.id.clone(), item.clone());
            for child in &item.children {
                item_map.insert(child.id.clone(), child.clone());
            }
        }

        for item_id in &options.item_ids {
            if let Some(item) = item_map.get(item_id) {
                // Check if path is protected
                let path = Path::new(&item.path);
                if is_protected_path(path) {
                    warnings.push(format!("Protected path skipped: {}", item.path));
                    continue;
                }

                // Check safety level
                if item.safety_level as u8 > options.safety_level as u8 {
                    warnings.push(format!(
                        "Item '{}' requires higher safety level ({})",
                        item.name,
                        match item.safety_level {
                            SafetyLevel::Moderate => "moderate",
                            SafetyLevel::Aggressive => "aggressive",
                            SafetyLevel::Safe => "safe",
                        }
                    ));
                    continue;
                }

                selected_items.push(item.clone());
            }
        }

        let total_size: u64 = selected_items.iter().map(|i| i.size_bytes).sum();
        let total_files: u64 = selected_items.iter().map(|i| i.file_count).sum();

        CleanupPreview {
            items: selected_items,
            total_size_bytes: total_size,
            formatted_size: format_bytes(total_size),
            total_files,
            warnings,
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Check if a path likely requires Full Disk Access
fn path_requires_fda(path: &Path) -> bool {
    let home = dirs::home_dir().unwrap_or_default();
    let library = home.join("Library");

    // Paths that typically require FDA
    let fda_paths = [
        library.join("Caches"),
        library.join("Logs"),
        library.join("Application Support"),
        library.join("Containers"),
        library.join("Mail"),
        library.join("Messages"),
        library.join("Safari"),
        PathBuf::from("/private/var"),
    ];

    fda_paths.iter().any(|p| path.starts_with(p))
}

/// Categorize an error to provide actionable messages
fn categorize_error(error: &str, path: &Path) -> String {
    // Check for permission-related errors
    if error.contains("Operation not permitted")
        || error.contains("Permission denied")
        || error.contains("EPERM")
        || error.contains("EACCES")
    {
        if path_requires_fda(path) {
            return format!(
                "Permission denied for '{}'. Full Disk Access is required. Grant it in System Settings > Privacy & Security > Full Disk Access.",
                path.file_name().unwrap_or_default().to_string_lossy()
            );
        }
        return format!(
            "Permission denied for '{}'. Check file permissions or grant Full Disk Access.",
            path.file_name().unwrap_or_default().to_string_lossy()
        );
    }

    // File in use
    if error.contains("Resource busy") || error.contains("EBUSY") {
        return format!(
            "'{}' is currently in use. Close any applications using this file and try again.",
            path.file_name().unwrap_or_default().to_string_lossy()
        );
    }

    // Generic error with path context
    format!("Failed to delete '{}': {}", path.file_name().unwrap_or_default().to_string_lossy(), error)
}

/// Execute cleanup
#[tauri::command]
pub async fn execute_cleanup(options: CleanupOptions, all_items: Vec<ScannableItem>) -> Result<CleanupResult, String> {
    if options.dry_run {
        let preview = preview_cleanup(options.clone(), all_items).await?;
        return Ok(CleanupResult {
            success: true,
            freed_bytes: preview.total_size_bytes,
            formatted_freed: preview.formatted_size,
            deleted_count: preview.items.len() as u32,
            failed_count: 0,
            errors: preview.warnings,
        });
    }

    let result = tokio::task::spawn_blocking(move || {
        let mut freed_bytes = 0u64;
        let mut deleted_count = 0u32;
        let mut failed_count = 0u32;
        let mut errors: Vec<String> = Vec::new();
        let mut permission_errors = 0u32;

        // Build item map
        let mut item_map: HashMap<String, ScannableItem> = HashMap::new();
        for item in &all_items {
            item_map.insert(item.id.clone(), item.clone());
            for child in &item.children {
                item_map.insert(child.id.clone(), child.clone());
            }
        }

        for item_id in &options.item_ids {
            if let Some(item) = item_map.get(item_id) {
                let path = Path::new(&item.path);

                // Skip protected paths
                if is_protected_path(path) {
                    errors.push(format!("Protected path skipped: {}", item.name));
                    failed_count += 1;
                    continue;
                }

                // Skip if doesn't exist
                if !path.exists() {
                    continue;
                }

                // Check safety level
                if item.safety_level as u8 > options.safety_level as u8 {
                    errors.push(format!("Safety level mismatch: {}", item.name));
                    failed_count += 1;
                    continue;
                }

                let size = item.size_bytes;

                let delete_result: Result<(), String> = if options.move_to_trash {
                    // Use trash crate to move to Trash
                    trash::delete(path).map_err(|e| e.to_string())
                } else {
                    // Permanently delete
                    if path.is_dir() {
                        fs::remove_dir_all(path).map_err(|e| e.to_string())
                    } else {
                        fs::remove_file(path).map_err(|e| e.to_string())
                    }
                };

                match delete_result {
                    Ok(_) => {
                        freed_bytes += size;
                        deleted_count += 1;
                    }
                    Err(e) => {
                        // Categorize the error for better user feedback
                        let is_permission_error = e.contains("Operation not permitted")
                            || e.contains("Permission denied")
                            || e.contains("EPERM")
                            || e.contains("EACCES");

                        if is_permission_error {
                            permission_errors += 1;
                        }

                        errors.push(categorize_error(&e, path));
                        failed_count += 1;
                    }
                }
            }
        }

        // If all failures were permission errors, add a summary message at the start
        if permission_errors > 0 && permission_errors == failed_count && !errors.is_empty() {
            errors.insert(0, format!(
                "Full Disk Access required for {} item(s). Grant permission in System Settings > Privacy & Security > Full Disk Access, then try again.",
                permission_errors
            ));
        }

        CleanupResult {
            success: failed_count == 0,
            freed_bytes,
            formatted_freed: format_bytes(freed_bytes),
            deleted_count,
            failed_count,
            errors,
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Empty the macOS Trash
#[tauri::command]
pub async fn empty_trash() -> Result<CleanupResult, String> {
    let result = tokio::task::spawn_blocking(|| -> Result<CleanupResult, String> {
        let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
        let trash_path = home.join(".Trash");

        if !trash_path.exists() {
            return Ok(CleanupResult {
                success: true,
                freed_bytes: 0,
                formatted_freed: "0 B".to_string(),
                deleted_count: 0,
                failed_count: 0,
                errors: vec![],
            });
        }

        let (size, _file_count) = calculate_size(&trash_path);
        let mut deleted = 0u32;
        let mut failed = 0u32;
        let mut errors = Vec::new();

        let entries = fs::read_dir(&trash_path).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();
            let result = if path.is_dir() {
                fs::remove_dir_all(&path)
            } else {
                fs::remove_file(&path)
            };

            match result {
                Ok(_) => deleted += 1,
                Err(e) => {
                    errors.push(format!("{}: {}", path.display(), e));
                    failed += 1;
                }
            }
        }

        Ok(CleanupResult {
            success: failed == 0,
            freed_bytes: size,
            formatted_freed: format_bytes(size),
            deleted_count: deleted,
            failed_count: failed,
            errors,
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Get cleanup history (placeholder - could be stored in SQLite)
#[tauri::command]
pub fn get_cleanup_history() -> Result<Vec<CleanupHistoryEntry>, String> {
    // For now, return empty - could be stored in the app's SQLite database
    Ok(vec![])
}

/// Get disk usage trend over time
#[tauri::command]
pub fn get_disk_trend(db: tauri::State<'_, Database>, days: Option<u32>) -> Result<Vec<DiskScanHistoryEntry>, String> {
    let days = days.unwrap_or(30);
    db.get_disk_trend(days).map_err(|e| e.to_string())
}

/// Get trash size
#[tauri::command]
pub async fn get_trash_size() -> Result<ScannableItem, String> {
    let result = tokio::task::spawn_blocking(|| -> Result<ScannableItem, String> {
        let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
        let trash_path = home.join(".Trash");

        let (size, file_count) = if trash_path.exists() {
            calculate_size(&trash_path)
        } else {
            (0, 0)
        };

        Ok(ScannableItem {
            id: "trash".to_string(),
            name: "Trash".to_string(),
            path: trash_path.to_string_lossy().to_string(),
            category: DiskCategory::Trash,
            safety_level: SafetyLevel::Safe,
            size_bytes: size,
            formatted_size: format_bytes(size),
            file_count,
            description: "Files waiting to be permanently deleted".to_string(),
            icon: "trash-2".to_string(),
            children: vec![],
            exists: trash_path.exists(),
            warning: None,
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}
