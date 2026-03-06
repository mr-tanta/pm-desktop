use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

// ==================== Types ====================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Starting,
    Running,
    Stopped,
    Crashed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedProcess {
    pub pid: u32,
    pub project_name: String,
    pub project_path: String,
    pub command: String,
    pub port: Option<u16>,
    pub started_at: String,
    pub status: ProcessStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogLine {
    pub timestamp: String,
    pub stream: String, // "stdout" | "stderr"
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessLogEvent {
    pub pid: u32,
    pub project_name: String,
    pub line: LogLine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessCrashedEvent {
    pub pid: u32,
    pub project_name: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchResult {
    pub pid: u32,
    pub project_name: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchOptions {
    pub project_path: String,
    pub script: Option<String>,
    pub port: Option<u16>,
}

// ==================== Internal State ====================

struct ProcessEntry {
    info: ManagedProcess,
    logs: VecDeque<LogLine>,
}

const MAX_LOG_LINES: usize = 1000;

pub struct ProcessManager {
    processes: Mutex<HashMap<u32, ProcessEntry>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub fn get_processes(&self) -> Vec<ManagedProcess> {
        let procs = self.processes.lock().unwrap();
        procs.values().map(|e| e.info.clone()).collect()
    }
}

// ==================== Helpers ====================

fn detect_package_manager(project_path: &Path) -> &'static str {
    if project_path.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if project_path.join("yarn.lock").exists() {
        "yarn"
    } else if project_path.join("bun.lockb").exists() || project_path.join("bun.lock").exists() {
        "bun"
    } else {
        "npm"
    }
}

fn detect_launch_command(project_path: &Path, script: Option<&str>) -> Option<(String, Vec<String>)> {
    let path = project_path;

    // Cargo.toml → cargo run
    if path.join("Cargo.toml").exists() {
        return Some(("cargo".to_string(), vec!["run".to_string()]));
    }

    // go.mod → go run .
    if path.join("go.mod").exists() {
        return Some(("go".to_string(), vec!["run".to_string(), ".".to_string()]));
    }

    // package.json → detect PM + script
    if path.join("package.json").exists() {
        let pm = detect_package_manager(path);
        let script_name = script.unwrap_or("dev");
        return Some((pm.to_string(), vec!["run".to_string(), script_name.to_string()]));
    }

    // pyproject.toml → uvicorn
    if path.join("pyproject.toml").exists() {
        return Some((
            "python".to_string(),
            vec![
                "-m".to_string(),
                "uvicorn".to_string(),
                "main:app".to_string(),
                "--reload".to_string(),
            ],
        ));
    }

    None
}

fn detect_port_from_project(project_path: &Path) -> Option<u16> {
    let pkg_path = project_path.join("package.json");
    if let Ok(content) = std::fs::read_to_string(&pkg_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
                let dev_script = scripts
                    .get("dev")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                // Check for --port or -p flags
                let words: Vec<&str> = dev_script.split_whitespace().collect();
                for (i, word) in words.iter().enumerate() {
                    if (*word == "--port" || *word == "-p") && i + 1 < words.len() {
                        if let Ok(port) = words[i + 1].parse::<u16>() {
                            return Some(port);
                        }
                    }
                    // --port=XXXX
                    if word.starts_with("--port=") {
                        if let Ok(port) = word.trim_start_matches("--port=").parse::<u16>() {
                            return Some(port);
                        }
                    }
                }

                // Framework defaults
                if dev_script.contains("next") {
                    return Some(3000);
                }
                if dev_script.contains("vite") || dev_script.contains("astro") {
                    return Some(5173);
                }
                if dev_script.contains("nuxt") {
                    return Some(3000);
                }
                if dev_script.contains("angular") || dev_script.contains("ng serve") {
                    return Some(4200);
                }
                if dev_script.contains("svelte") {
                    return Some(5173);
                }
            }
        }
    }

    // Cargo defaults
    if project_path.join("Cargo.toml").exists() {
        return Some(8080);
    }

    // Go defaults
    if project_path.join("go.mod").exists() {
        return Some(8080);
    }

    // Python/uvicorn defaults
    if project_path.join("pyproject.toml").exists() {
        return Some(8000);
    }

    None
}

// ==================== Commands ====================

#[tauri::command]
pub async fn launch_project(
    app: AppHandle,
    options: LaunchOptions,
) -> Result<LaunchResult, String> {
    let project_path = Path::new(&options.project_path);

    if !project_path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let project_name = project_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Detect command
    let (cmd, args) = detect_launch_command(project_path, options.script.as_deref())
        .ok_or_else(|| "Could not detect how to launch this project".to_string())?;

    let command_str = format!("{} {}", cmd, args.join(" "));

    // Detect port
    let port = options.port.or_else(|| detect_port_from_project(project_path));

    // Spawn the child process with piped stdout/stderr
    let mut child = Command::new(&cmd)
        .args(&args)
        .current_dir(project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to launch: {}", e))?;

    let pid = child.id();
    let now = chrono::Utc::now().to_rfc3339();

    let managed = ManagedProcess {
        pid,
        project_name: project_name.clone(),
        project_path: options.project_path.clone(),
        command: command_str.clone(),
        port,
        started_at: now,
        status: ProcessStatus::Running,
    };

    // Register in state
    let pm = app.state::<ProcessManager>();
    {
        let mut procs = pm.processes.lock().unwrap();
        procs.insert(
            pid,
            ProcessEntry {
                info: managed,
                logs: VecDeque::new(),
            },
        );
    }

    // Spawn stdout reader thread
    let stdout = child.stdout.take();
    let app_stdout = app.clone();
    let pname_stdout = project_name.clone();
    if let Some(stdout) = stdout {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let Ok(content) = line else { break };
                let log_line = LogLine {
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    stream: "stdout".to_string(),
                    content,
                };
                let event = ProcessLogEvent {
                    pid,
                    project_name: pname_stdout.clone(),
                    line: log_line.clone(),
                };
                let _ = app_stdout.emit("process-log", &event);

                // Buffer in state
                if let Some(pm) = app_stdout.try_state::<ProcessManager>() {
                    let mut procs = pm.processes.lock().unwrap();
                    if let Some(entry) = procs.get_mut(&pid) {
                        entry.logs.push_back(log_line);
                        if entry.logs.len() > MAX_LOG_LINES {
                            entry.logs.pop_front();
                        }
                    }
                }
            }
        });
    }

    // Spawn stderr reader thread
    let stderr = child.stderr.take();
    let app_stderr = app.clone();
    let pname_stderr = project_name.clone();
    if let Some(stderr) = stderr {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                let Ok(content) = line else { break };
                let log_line = LogLine {
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    stream: "stderr".to_string(),
                    content,
                };
                let event = ProcessLogEvent {
                    pid,
                    project_name: pname_stderr.clone(),
                    line: log_line.clone(),
                };
                let _ = app_stderr.emit("process-log", &event);

                // Buffer in state
                if let Some(pm) = app_stderr.try_state::<ProcessManager>() {
                    let mut procs = pm.processes.lock().unwrap();
                    if let Some(entry) = procs.get_mut(&pid) {
                        entry.logs.push_back(log_line);
                        if entry.logs.len() > MAX_LOG_LINES {
                            entry.logs.pop_front();
                        }
                    }
                }
            }
        });
    }

    // Spawn wait/exit detector thread
    let app_wait = app.clone();
    let pname_wait = project_name.clone();
    std::thread::spawn(move || {
        let exit_status = child.wait();
        let exit_code = exit_status.ok().and_then(|s| s.code());
        let crashed = exit_code.map(|c| c != 0).unwrap_or(true);

        if let Some(pm) = app_wait.try_state::<ProcessManager>() {
            let mut procs = pm.processes.lock().unwrap();
            if let Some(entry) = procs.get_mut(&pid) {
                entry.info.status = if crashed {
                    ProcessStatus::Crashed
                } else {
                    ProcessStatus::Stopped
                };
            }
        }

        if crashed {
            let event = ProcessCrashedEvent {
                pid,
                project_name: pname_wait,
                exit_code,
            };
            let _ = app_wait.emit("process-crashed", &event);
        }
        // Update tray state after process exit/crash
        crate::tray::update_tray_state(&app_wait);
        let _ = app_wait.emit("tray-state-changed", ());
    });

    // Update tray state after launch
    crate::tray::update_tray_state(&app);
    let _ = app.emit("tray-state-changed", ());

    Ok(LaunchResult {
        pid,
        project_name,
        command: command_str,
    })
}

#[tauri::command]
pub async fn stop_project(app: AppHandle, pid: u32) -> Result<(), String> {
    // First try SIGTERM
    let term_result = Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .output();

    if term_result.is_err() {
        return Err(format!("Failed to send SIGTERM to PID {}", pid));
    }

    // Wait up to 3 seconds for graceful shutdown
    let pid_clone = pid;
    let graceful = tokio::task::spawn_blocking(move || {
        for _ in 0..30 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            // Check if process is still alive
            let check = Command::new("kill")
                .args(["-0", &pid_clone.to_string()])
                .output();
            if let Ok(output) = check {
                if !output.status.success() {
                    return true; // Process is gone
                }
            }
        }
        false
    })
    .await
    .unwrap_or(false);

    if !graceful {
        // Force kill
        let _ = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }

    // Update state
    let pm = app.state::<ProcessManager>();
    let mut procs = pm.processes.lock().unwrap();
    if let Some(entry) = procs.get_mut(&pid) {
        entry.info.status = ProcessStatus::Stopped;
    }
    drop(procs);

    // Update tray state after stop
    crate::tray::update_tray_state(&app);
    let _ = app.emit("tray-state-changed", ());

    Ok(())
}

#[tauri::command]
pub fn get_managed_processes(app: AppHandle) -> Result<Vec<ManagedProcess>, String> {
    let pm = app.state::<ProcessManager>();
    let procs = pm.processes.lock().unwrap();
    let result: Vec<ManagedProcess> = procs.values().map(|e| e.info.clone()).collect();
    Ok(result)
}

#[tauri::command]
pub fn get_process_logs(app: AppHandle, pid: u32) -> Result<Vec<LogLine>, String> {
    let pm = app.state::<ProcessManager>();
    let procs = pm.processes.lock().unwrap();
    if let Some(entry) = procs.get(&pid) {
        Ok(entry.logs.iter().cloned().collect())
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn clear_process_logs(app: AppHandle, pid: u32) -> Result<(), String> {
    let pm = app.state::<ProcessManager>();
    let mut procs = pm.processes.lock().unwrap();
    if let Some(entry) = procs.get_mut(&pid) {
        entry.logs.clear();
    }
    Ok(())
}

#[tauri::command]
pub fn remove_managed_process(app: AppHandle, pid: u32) -> Result<(), String> {
    let pm = app.state::<ProcessManager>();
    let mut procs = pm.processes.lock().unwrap();
    procs.remove(&pid);
    Ok(())
}

#[tauri::command]
pub fn detect_project_port(project_path: String) -> Result<Option<u16>, String> {
    let path = Path::new(&project_path);
    Ok(detect_port_from_project(path))
}
