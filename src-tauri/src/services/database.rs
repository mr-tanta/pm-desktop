use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDate, Utc};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::commands::workspaces::{Workspace, WorkspaceProject, WorkspaceWithProjects};
use crate::models::{ActiveTimer, DailyProjectTime, DaySummary, TimeEntry, TimeStreaks, TodayTimeStats, WeeklySummary};

const CURRENT_SCHEMA_VERSION: u32 = 4;

/// SQLite database for persisting time entries and deployments.
/// Uses WAL journal mode and versioned migrations.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Opens (or creates) the database at `~/.devconfig/pm-desktop.db` and runs pending migrations.
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path()?;

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path).context("Failed to open database")?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .context("Failed to set database pragmas")?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        db.run_migrations()?;
        Ok(db)
    }

    fn get_db_path() -> Result<PathBuf> {
        let path = dirs::home_dir()
            .context("Could not find home directory")?
            .join(".devconfig/pm-desktop.db");
        Ok(path)
    }

    fn get_schema_version(conn: &Connection) -> u32 {
        conn.query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap_or(0)
    }

    fn set_schema_version(conn: &Connection, version: u32) -> Result<()> {
        conn.execute_batch(&format!("PRAGMA user_version = {}", version))
            .context("Failed to set schema version")?;
        Ok(())
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let current_version = Self::get_schema_version(&conn);

        if current_version >= CURRENT_SCHEMA_VERSION {
            return Ok(());
        }

        // Migration 0 -> 1: Initial schema
        if current_version < 1 {
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS time_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    duration_seconds INTEGER
                );

                CREATE INDEX IF NOT EXISTS idx_time_entries_project
                ON time_entries(project_name);

                CREATE INDEX IF NOT EXISTS idx_time_entries_started
                ON time_entries(started_at);

                CREATE TABLE IF NOT EXISTS deployments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    environment TEXT,
                    status TEXT,
                    url TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_deployments_project
                ON deployments(project_name);
                "#,
            )
            .context("Failed to run migration v1")?;
        }

        // Migration 1 -> 2: Project pinning
        if current_version < 2 {
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS project_meta (
                    project_name TEXT PRIMARY KEY,
                    is_pinned INTEGER NOT NULL DEFAULT 0,
                    pinned_at TEXT
                );
                "#,
            )
            .context("Failed to run migration v2")?;
        }

        // Migration 2 -> 3: Workspaces
        if current_version < 3 {
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS workspaces (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS workspace_projects (
                    workspace_id INTEGER NOT NULL,
                    project_name TEXT NOT NULL,
                    sort_order INTEGER DEFAULT 0,
                    PRIMARY KEY (workspace_id, project_name),
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                );
                "#,
            )
            .context("Failed to run migration v3")?;
        }

        // Migration 3 -> 4: Disk scan history
        if current_version < 4 {
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS disk_scan_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_date TEXT NOT NULL,
                    total_size INTEGER NOT NULL,
                    category_sizes_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_disk_scan_date ON disk_scan_history(scan_date);
                "#,
            )
            .context("Failed to run migration v4")?;
        }

        Self::set_schema_version(&conn, CURRENT_SCHEMA_VERSION)?;
        Ok(())
    }

    /// Starts a timer for the given project. Fails if a timer is already running.
    pub fn start_timer(&self, project_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Check if there's already an active timer
        let active: Option<i64> = conn
            .query_row(
                "SELECT id FROM time_entries WHERE ended_at IS NULL LIMIT 1",
                [],
                |row| row.get(0),
            )
            .ok();

        if active.is_some() {
            anyhow::bail!("A timer is already running. Stop it first.");
        }

        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO time_entries (project_name, started_at) VALUES (?1, ?2)",
            params![project_name, now],
        )
        .context("Failed to start timer")?;

        Ok(())
    }

    /// Stops the active timer and returns the completed time entry, or `None` if no timer was running.
    pub fn stop_timer(&self) -> Result<Option<TimeEntry>> {
        let conn = self.conn.lock().unwrap();

        let active_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM time_entries WHERE ended_at IS NULL LIMIT 1",
                [],
                |row| row.get(0),
            )
            .ok();

        let Some(id) = active_id else {
            return Ok(None);
        };

        let now = Utc::now();
        let now_str = now.to_rfc3339();

        conn.execute(
            r#"
            UPDATE time_entries
            SET ended_at = ?1,
                duration_seconds = CAST((julianday(?1) - julianday(started_at)) * 86400 AS INTEGER)
            WHERE id = ?2
            "#,
            params![now_str, id],
        )
        .context("Failed to stop timer")?;

        let entry = conn.query_row(
            "SELECT id, project_name, started_at, ended_at, duration_seconds FROM time_entries WHERE id = ?1",
            params![id],
            |row| {
                Ok(TimeEntry {
                    id: row.get(0)?,
                    project_name: row.get(1)?,
                    started_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    ended_at: row.get::<_, Option<String>>(3)?
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    duration_seconds: row.get(4)?,
                })
            },
        )?;

        Ok(Some(entry))
    }

    /// Returns the currently running timer, if any, with its elapsed seconds.
    pub fn get_active_timer(&self) -> Result<Option<ActiveTimer>> {
        let conn = self.conn.lock().unwrap();

        let result = conn.query_row(
            "SELECT project_name, started_at FROM time_entries WHERE ended_at IS NULL LIMIT 1",
            [],
            |row| {
                let project_name: String = row.get(0)?;
                let started_at_str: String = row.get(1)?;
                Ok((project_name, started_at_str))
            },
        );

        match result {
            Ok((project_name, started_at_str)) => {
                let started_at = DateTime::parse_from_rfc3339(&started_at_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let elapsed = Utc::now().signed_duration_since(started_at);

                Ok(Some(ActiveTimer {
                    project_name,
                    started_at,
                    elapsed_seconds: elapsed.num_seconds(),
                }))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Returns completed time entries, optionally filtered by project name and limited in count.
    pub fn get_time_entries(
        &self,
        project_name: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<TimeEntry>> {
        let conn = self.conn.lock().unwrap();

        let mut query = String::from(
            "SELECT id, project_name, started_at, ended_at, duration_seconds FROM time_entries WHERE ended_at IS NOT NULL",
        );

        if project_name.is_some() {
            query.push_str(" AND project_name = ?1");
        }

        query.push_str(" ORDER BY started_at DESC");

        if let Some(limit) = limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }

        let mut stmt = conn.prepare(&query)?;

        let entries = if let Some(name) = project_name {
            stmt.query_map(params![name], Self::map_time_entry)?
        } else {
            stmt.query_map([], Self::map_time_entry)?
        };

        entries
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to fetch time entries")
    }

    fn map_time_entry(row: &rusqlite::Row) -> rusqlite::Result<TimeEntry> {
        Ok(TimeEntry {
            id: row.get(0)?,
            project_name: row.get(1)?,
            started_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            ended_at: row
                .get::<_, Option<String>>(3)?
                .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            duration_seconds: row.get(4)?,
        })
    }

    // ==================== Today Summary Queries ====================

    pub fn get_today_time_stats(&self) -> Result<TodayTimeStats> {
        let conn = self.conn.lock().unwrap();

        let today = Utc::now().format("%Y-%m-%d").to_string();

        let (total, sessions): (i64, u32) = conn
            .query_row(
                "SELECT COALESCE(SUM(duration_seconds), 0), COUNT(*) FROM time_entries WHERE date(started_at) = ?1 AND ended_at IS NOT NULL",
                params![today],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap_or((0, 0));

        // Check for active timer project
        let current_project: Option<String> = conn
            .query_row(
                "SELECT project_name FROM time_entries WHERE ended_at IS NULL LIMIT 1",
                [],
                |row| row.get(0),
            )
            .ok();

        Ok(TodayTimeStats {
            total_today_seconds: total,
            sessions_today: sessions,
            current_project,
        })
    }

    pub fn get_weekly_overview(&self) -> Result<Vec<DaySummary>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            r#"
            SELECT date(started_at) as day,
                   COALESCE(SUM(duration_seconds), 0),
                   COUNT(DISTINCT project_name)
            FROM time_entries
            WHERE started_at >= date('now', '-7 days') AND ended_at IS NOT NULL
            GROUP BY date(started_at)
            ORDER BY day
            "#,
        )?;

        let days = stmt
            .query_map([], |row| {
                Ok(DaySummary {
                    date: row.get(0)?,
                    total_seconds: row.get(1)?,
                    project_count: row.get(2)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to fetch weekly overview")?;

        Ok(days)
    }

    // ==================== Time Insights Queries ====================

    pub fn get_daily_time_summary(&self, date: Option<&str>) -> Result<Vec<DailyProjectTime>> {
        let conn = self.conn.lock().unwrap();

        let date_str = date
            .map(|d| d.to_string())
            .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

        let mut stmt = conn.prepare(
            r#"
            SELECT project_name,
                   COALESCE(SUM(duration_seconds), 0),
                   COUNT(*)
            FROM time_entries
            WHERE date(started_at) = ?1 AND ended_at IS NOT NULL
            GROUP BY project_name
            ORDER BY SUM(duration_seconds) DESC
            "#,
        )?;

        let entries = stmt
            .query_map(params![date_str], |row| {
                Ok(DailyProjectTime {
                    project_name: row.get(0)?,
                    total_seconds: row.get(1)?,
                    session_count: row.get(2)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to fetch daily time summary")?;

        Ok(entries)
    }

    pub fn get_weekly_time_summary(&self, week_offset: i32) -> Result<WeeklySummary> {
        let conn = self.conn.lock().unwrap();

        let offset_str = format!("-{} days", 7 + (week_offset * 7));
        let end_offset_str = format!("-{} days", week_offset * 7);

        let mut stmt = conn.prepare(
            r#"
            SELECT date(started_at) as day,
                   COALESCE(SUM(duration_seconds), 0),
                   COUNT(DISTINCT project_name)
            FROM time_entries
            WHERE started_at >= date('now', ?1)
              AND started_at < date('now', ?2)
              AND ended_at IS NOT NULL
            GROUP BY date(started_at)
            ORDER BY day
            "#,
        )?;

        let days: Vec<DaySummary> = stmt
            .query_map(params![offset_str, end_offset_str], |row| {
                Ok(DaySummary {
                    date: row.get(0)?,
                    total_seconds: row.get(1)?,
                    project_count: row.get(2)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to fetch weekly summary")?;

        let total_seconds: i64 = days.iter().map(|d| d.total_seconds).sum();
        let avg_daily_seconds = if days.is_empty() { 0 } else { total_seconds / 7 };

        // Most active project this week
        let most_active_project: Option<String> = conn
            .query_row(
                r#"
                SELECT project_name FROM time_entries
                WHERE started_at >= date('now', ?1)
                  AND started_at < date('now', ?2)
                  AND ended_at IS NOT NULL
                GROUP BY project_name
                ORDER BY SUM(duration_seconds) DESC
                LIMIT 1
                "#,
                params![offset_str, end_offset_str],
                |row| row.get(0),
            )
            .ok();

        Ok(WeeklySummary {
            days,
            total_seconds,
            most_active_project,
            avg_daily_seconds,
        })
    }

    pub fn get_time_streaks(&self) -> Result<TimeStreaks> {
        let conn = self.conn.lock().unwrap();

        // Get all unique dates with time entries, ordered descending
        let mut stmt = conn.prepare(
            r#"
            SELECT DISTINCT date(started_at) as day
            FROM time_entries
            WHERE ended_at IS NOT NULL
            ORDER BY day DESC
            "#,
        )?;

        let dates: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        if dates.is_empty() {
            return Ok(TimeStreaks {
                current_streak_days: 0,
                longest_streak_days: 0,
                last_active_date: None,
            });
        }

        let last_active_date = dates.first().cloned();

        // Calculate current streak
        let today = Utc::now().format("%Y-%m-%d").to_string();
        let yesterday = (Utc::now() - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

        let mut current_streak: u32 = 0;
        let mut longest_streak: u32 = 0;
        let mut streak: u32 = 0;

        for (i, date_str) in dates.iter().enumerate() {
            if i == 0 {
                // First date must be today or yesterday for current streak
                if date_str == &today || date_str == &yesterday {
                    streak = 1;
                    current_streak = 1;
                } else {
                    streak = 1;
                }
            } else {
                // Check if consecutive with previous
                let prev = NaiveDate::parse_from_str(&dates[i - 1], "%Y-%m-%d");
                let curr = NaiveDate::parse_from_str(date_str, "%Y-%m-%d");

                if let (Ok(prev_date), Ok(curr_date)) = (prev, curr) {
                    if (prev_date - curr_date).num_days() == 1 {
                        streak += 1;
                        if i < dates.len() && (dates[0] == today || dates[0] == yesterday) {
                            current_streak = streak;
                        }
                    } else {
                        longest_streak = longest_streak.max(streak);
                        streak = 1;
                    }
                }
            }
        }
        longest_streak = longest_streak.max(streak);

        Ok(TimeStreaks {
            current_streak_days: current_streak,
            longest_streak_days: longest_streak,
            last_active_date,
        })
    }

    // ==================== Project Pinning ====================

    pub fn pin_project(&self, project_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO project_meta (project_name, is_pinned, pinned_at) VALUES (?1, 1, ?2)",
            params![project_name, now],
        )
        .context("Failed to pin project")?;
        Ok(())
    }

    pub fn unpin_project(&self, project_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE project_meta SET is_pinned = 0, pinned_at = NULL WHERE project_name = ?1",
            params![project_name],
        )
        .context("Failed to unpin project")?;
        Ok(())
    }

    pub fn get_pinned_project_names(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT project_name FROM project_meta WHERE is_pinned = 1 ORDER BY pinned_at ASC",
        )?;

        let names = stmt
            .query_map([], |row| row.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()
            .context("Failed to fetch pinned projects")?;

        Ok(names)
    }

    pub fn is_project_pinned(&self, project_name: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let result: Option<i32> = conn
            .query_row(
                "SELECT is_pinned FROM project_meta WHERE project_name = ?1",
                params![project_name],
                |row| row.get(0),
            )
            .ok();
        Ok(result.unwrap_or(0) == 1)
    }

    // ==================== Workspaces ====================

    pub fn create_workspace(&self, name: &str) -> Result<Workspace> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO workspaces (name) VALUES (?1)",
            params![name],
        )
        .context("Failed to create workspace")?;

        let id = conn.last_insert_rowid();
        let created_at: String = conn.query_row(
            "SELECT created_at FROM workspaces WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        Ok(Workspace {
            id,
            name: name.to_string(),
            created_at,
        })
    }

    pub fn delete_workspace(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])
            .context("Failed to delete workspace")?;
        Ok(())
    }

    pub fn list_workspaces(&self) -> Result<Vec<WorkspaceWithProjects>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, created_at FROM workspaces ORDER BY name",
        )?;

        let workspaces: Vec<(i64, String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to list workspaces")?;

        let mut result = Vec::new();
        for (id, name, created_at) in workspaces {
            let mut proj_stmt = conn.prepare(
                "SELECT workspace_id, project_name, sort_order FROM workspace_projects WHERE workspace_id = ?1 ORDER BY sort_order",
            )?;

            let projects: Vec<WorkspaceProject> = proj_stmt
                .query_map(params![id], |row| {
                    Ok(WorkspaceProject {
                        workspace_id: row.get(0)?,
                        project_name: row.get(1)?,
                        sort_order: row.get(2)?,
                    })
                })?
                .collect::<std::result::Result<Vec<_>, _>>()
                .context("Failed to list workspace projects")?;

            result.push(WorkspaceWithProjects {
                id,
                name,
                created_at,
                projects,
            });
        }

        Ok(result)
    }

    pub fn update_workspace(&self, id: i64, name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE workspaces SET name = ?1 WHERE id = ?2",
            params![name, id],
        )
        .context("Failed to update workspace")?;
        Ok(())
    }

    pub fn add_project_to_workspace(&self, workspace_id: i64, project_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let max_order: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), -1) FROM workspace_projects WHERE workspace_id = ?1",
                params![workspace_id],
                |row| row.get(0),
            )
            .unwrap_or(-1);

        conn.execute(
            "INSERT OR IGNORE INTO workspace_projects (workspace_id, project_name, sort_order) VALUES (?1, ?2, ?3)",
            params![workspace_id, project_name, max_order + 1],
        )
        .context("Failed to add project to workspace")?;
        Ok(())
    }

    pub fn remove_project_from_workspace(&self, workspace_id: i64, project_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM workspace_projects WHERE workspace_id = ?1 AND project_name = ?2",
            params![workspace_id, project_name],
        )
        .context("Failed to remove project from workspace")?;
        Ok(())
    }

    // ==================== Disk Scan History ====================

    pub fn save_disk_scan(
        &self,
        total_size: u64,
        category_sizes_json: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().format("%Y-%m-%d").to_string();

        // Upsert: replace if already scanned today
        conn.execute(
            "DELETE FROM disk_scan_history WHERE scan_date = ?1",
            params![now],
        )?;

        conn.execute(
            "INSERT INTO disk_scan_history (scan_date, total_size, category_sizes_json) VALUES (?1, ?2, ?3)",
            params![now, total_size as i64, category_sizes_json],
        )
        .context("Failed to save disk scan")?;
        Ok(())
    }

    pub fn get_disk_trend(&self, days: u32) -> Result<Vec<DiskScanHistoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let offset = format!("-{} days", days);

        let mut stmt = conn.prepare(
            "SELECT id, scan_date, total_size, category_sizes_json FROM disk_scan_history WHERE scan_date >= date('now', ?1) ORDER BY scan_date",
        )?;

        let entries = stmt
            .query_map(params![offset], |row| {
                Ok(DiskScanHistoryEntry {
                    id: row.get(0)?,
                    scan_date: row.get(1)?,
                    total_size: row.get::<_, i64>(2)? as u64,
                    category_sizes_json: row.get(3)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to fetch disk trend")?;

        Ok(entries)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiskScanHistoryEntry {
    pub id: i64,
    pub scan_date: String,
    pub total_size: u64,
    pub category_sizes_json: String,
}
