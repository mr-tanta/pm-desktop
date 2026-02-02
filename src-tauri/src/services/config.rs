use crate::models::Config;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

pub struct ConfigService {
    config_path: PathBuf,
}

impl ConfigService {
    pub fn new() -> Self {
        let config_path = dirs::home_dir()
            .unwrap_or_default()
            .join(".devconfig/pm.conf");
        Self { config_path }
    }

    pub fn load(&self) -> Result<Config> {
        if !self.config_path.exists() {
            return Ok(Config::default());
        }

        let content = fs::read_to_string(&self.config_path)
            .context("Failed to read config file")?;

        let mut map: HashMap<String, String> = HashMap::new();
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let value = value.trim_matches('"').trim_matches('\'');
                map.insert(key.to_string(), value.to_string());
            }
        }

        let home = dirs::home_dir().unwrap_or_default();
        let expand_path = |s: &str| -> String {
            s.replace("$HOME", &home.to_string_lossy())
                .replace("~", &home.to_string_lossy())
        };

        Ok(Config {
            active_dir: map
                .get("PM_ACTIVE_DIR")
                .map(|s| expand_path(s))
                .unwrap_or_else(|| home.join("Developer/active").to_string_lossy().to_string()),
            archive_dir: map
                .get("PM_ARCHIVE_DIR")
                .map(|s| expand_path(s))
                .unwrap_or_else(|| home.join("Developer/archived").to_string_lossy().to_string()),
            default_editor: map
                .get("PM_DEFAULT_EDITOR")
                .cloned()
                .unwrap_or_else(|| "cursor".to_string()),
            default_template: map
                .get("PM_DEFAULT_TEMPLATE")
                .cloned()
                .unwrap_or_else(|| "next".to_string()),
            github_username: map.get("PM_GITHUB_USERNAME").cloned(),
            auto_git_init: map
                .get("PM_AUTO_GIT_INIT")
                .map(|s| s == "true" || s == "1")
                .unwrap_or(true),
            auto_install_deps: map
                .get("PM_AUTO_INSTALL_DEPS")
                .map(|s| s == "true" || s == "1")
                .unwrap_or(true),
            time_tracking_enabled: map
                .get("PM_TIME_TRACKING")
                .map(|s| s == "true" || s == "1")
                .unwrap_or(true),
        })
    }

    pub fn save(&self, config: &Config) -> Result<()> {
        let home = dirs::home_dir().unwrap_or_default();
        let home_str = home.to_string_lossy();

        let compact_path = |s: &str| -> String {
            if s.starts_with(&*home_str) {
                s.replacen(&*home_str, "$HOME", 1)
            } else {
                s.to_string()
            }
        };

        let mut lines = Vec::new();
        lines.push("# PM Desktop Configuration".to_string());
        lines.push("# Shared with pm CLI tool".to_string());
        lines.push(String::new());

        lines.push(format!("PM_ACTIVE_DIR=\"{}\"", compact_path(&config.active_dir)));
        lines.push(format!("PM_ARCHIVE_DIR=\"{}\"", compact_path(&config.archive_dir)));
        lines.push(format!("PM_DEFAULT_EDITOR=\"{}\"", config.default_editor));
        lines.push(format!("PM_DEFAULT_TEMPLATE=\"{}\"", config.default_template));

        if let Some(ref username) = config.github_username {
            lines.push(format!("PM_GITHUB_USERNAME=\"{}\"", username));
        }

        lines.push(format!("PM_AUTO_GIT_INIT=\"{}\"", config.auto_git_init));
        lines.push(format!("PM_AUTO_INSTALL_DEPS=\"{}\"", config.auto_install_deps));
        lines.push(format!("PM_TIME_TRACKING=\"{}\"", config.time_tracking_enabled));

        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&self.config_path, lines.join("\n") + "\n")
            .context("Failed to write config file")?;

        Ok(())
    }
}
