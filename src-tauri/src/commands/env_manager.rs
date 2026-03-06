use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariable {
    pub key: String,
    pub value: String,
    pub is_secret: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvFile {
    pub name: String,
    pub path: String,
    pub variables: Vec<EnvVariable>,
}

/// Patterns that indicate a secret value
const SECRET_PATTERNS: &[&str] = &[
    "SECRET", "KEY", "TOKEN", "PASSWORD", "AUTH", "PRIVATE", "API_KEY",
    "APIKEY", "CREDENTIAL", "PASS", "SIGNING", "ENCRYPTION", "JWT",
    "SESSION", "HASH", "SALT",
];

fn is_secret_key(key: &str) -> bool {
    let upper = key.to_uppercase();
    SECRET_PATTERNS.iter().any(|p| upper.contains(p))
}

fn parse_env_content(content: &str) -> Vec<EnvVariable> {
    content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && !trimmed.starts_with('#')
        })
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(2, '=').collect();
            if parts.len() == 2 {
                let key = parts[0].trim().to_string();
                let value = parts[1].trim().to_string();
                // Remove surrounding quotes
                let value = value
                    .strip_prefix('"')
                    .and_then(|v| v.strip_suffix('"'))
                    .unwrap_or(&value)
                    .to_string();
                let value = value
                    .strip_prefix('\'')
                    .and_then(|v| v.strip_suffix('\''))
                    .unwrap_or(&value)
                    .to_string();
                let is_secret = is_secret_key(&key);
                Some(EnvVariable {
                    key,
                    value,
                    is_secret,
                })
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
pub fn list_project_env_files(project_path: String) -> Result<Vec<EnvFile>, String> {
    let path = Path::new(&project_path);
    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    let mut env_files: Vec<EnvFile> = Vec::new();

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(".env") && entry.path().is_file() {
            let content = fs::read_to_string(entry.path()).unwrap_or_default();
            let variables = parse_env_content(&content);
            env_files.push(EnvFile {
                name: name.clone(),
                path: entry.path().to_string_lossy().to_string(),
                variables,
            });
        }
    }

    // Sort: .env first, then alphabetical
    env_files.sort_by(|a, b| {
        if a.name == ".env" {
            std::cmp::Ordering::Less
        } else if b.name == ".env" {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(env_files)
}

#[tauri::command]
pub fn read_env_file(path: String) -> Result<EnvFile, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let variables = parse_env_content(&content);

    Ok(EnvFile {
        name,
        path,
        variables,
    })
}

#[tauri::command]
pub fn write_env_variable(
    path: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let file_path = Path::new(&path);
    let content = if file_path.exists() {
        fs::read_to_string(file_path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let mut found = false;

    for line in lines.iter_mut() {
        let trimmed = line.trim();
        if !trimmed.starts_with('#') && !trimmed.is_empty() {
            let parts: Vec<&str> = trimmed.splitn(2, '=').collect();
            if parts.len() == 2 && parts[0].trim() == key {
                *line = format!("{}={}", key, value);
                found = true;
                break;
            }
        }
    }

    if !found {
        lines.push(format!("{}={}", key, value));
    }

    fs::write(file_path, lines.join("\n") + "\n").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn copy_env_variables(
    source_path: String,
    target_path: String,
    keys: Vec<String>,
) -> Result<(), String> {
    let source = read_env_file(source_path)?;
    let key_set: std::collections::HashSet<&str> = keys.iter().map(|k| k.as_str()).collect();

    for var in &source.variables {
        if key_set.contains(var.key.as_str()) {
            write_env_variable(target_path.clone(), var.key.clone(), var.value.clone())?;
        }
    }

    Ok(())
}
