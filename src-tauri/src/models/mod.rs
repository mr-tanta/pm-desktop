use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub name: String,
    pub path: String,
    pub location: ProjectLocation,
    pub project_type: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub last_modified: Option<DateTime<Utc>>,
    pub git_status: Option<GitStatus>,
    pub is_pinned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectLocation {
    Active,
    Archived,
}

impl std::fmt::Display for ProjectLocation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProjectLocation::Active => write!(f, "active"),
            ProjectLocation::Archived => write!(f, "archived"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub is_dirty: bool,
    pub ahead: u32,
    pub behind: u32,
    pub has_remote: bool,
    pub staged_count: usize,
    pub modified_count: usize,
    pub untracked_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDetail {
    pub name: String,
    pub path: String,
    pub location: ProjectLocation,
    pub project_type: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub last_modified: Option<DateTime<Utc>>,
    pub git_status: Option<GitStatus>,
    pub has_package_json: bool,
    pub has_cargo_toml: bool,
    pub has_docker: bool,
    pub has_env_file: bool,
    pub disk_size: Option<u64>,
    pub readme_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub total_memory: u64,
    pub used_memory: u64,
    pub total_disk: u64,
    pub used_disk: u64,
    pub cpu_count: usize,
    pub cpu_usage: f32,
    pub os_name: String,
    pub os_version: String,
    pub hostname: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub active_dir: String,
    pub archive_dir: String,
    pub default_editor: String,
    pub default_template: String,
    pub github_username: Option<String>,
    pub auto_git_init: bool,
    pub auto_install_deps: bool,
    pub time_tracking_enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_default();
        Self {
            active_dir: home.join("Developer/active").to_string_lossy().to_string(),
            archive_dir: home
                .join("Developer/archived")
                .to_string_lossy()
                .to_string(),
            default_editor: "cursor".to_string(),
            default_template: "next".to_string(),
            github_username: None,
            auto_git_init: true,
            auto_install_deps: true,
            time_tracking_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeEntry {
    pub id: i64,
    pub project_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveTimer {
    pub project_name: String,
    pub started_at: DateTime<Utc>,
    pub elapsed_seconds: i64,
}

// Today Summary types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodaySummary {
    pub greeting: String,
    pub attention_items: Vec<AttentionItem>,
    pub recent_projects: Vec<Project>,
    pub pinned_projects: Vec<Project>,
    pub today_time: TodayTimeStats,
    pub weekly_overview: Vec<DaySummary>,
    pub active_ports_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttentionItem {
    pub kind: String,
    pub project_name: String,
    pub message: String,
    pub severity: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodayTimeStats {
    pub total_today_seconds: i64,
    pub sessions_today: u32,
    pub current_project: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaySummary {
    pub date: String,
    pub total_seconds: i64,
    pub project_count: u32,
}

// Time Insights types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyProjectTime {
    pub project_name: String,
    pub total_seconds: i64,
    pub session_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklySummary {
    pub days: Vec<DaySummary>,
    pub total_seconds: i64,
    pub most_active_project: Option<String>,
    pub avg_daily_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeStreaks {
    pub current_streak_days: u32,
    pub longest_streak_days: u32,
    pub last_active_date: Option<String>,
}
