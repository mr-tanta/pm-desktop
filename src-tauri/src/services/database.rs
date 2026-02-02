use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::models::{ActiveTimer, TimeEntry};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path()?;

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path).context("Failed to open database")?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        db.init_schema()?;
        Ok(db)
    }

    fn get_db_path() -> Result<PathBuf> {
        let path = dirs::home_dir()
            .context("Could not find home directory")?
            .join(".devconfig/pm-desktop.db");
        Ok(path)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

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
        .context("Failed to initialize database schema")?;

        Ok(())
    }

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
}
