use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

// ==================== ENUMS ====================

/// Protocol type for network connections
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Tcp,
    Udp,
}

/// Connection state for ports
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Listen,
    Established,
    TimeWait,
    CloseWait,
    SynSent,
    SynReceived,
    FinWait1,
    FinWait2,
    Closing,
    LastAck,
    Closed,
    Unknown,
}

impl ConnectionState {
    fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "LISTEN" => ConnectionState::Listen,
            "ESTABLISHED" => ConnectionState::Established,
            "TIME_WAIT" | "TIME-WAIT" => ConnectionState::TimeWait,
            "CLOSE_WAIT" | "CLOSE-WAIT" => ConnectionState::CloseWait,
            "SYN_SENT" | "SYN-SENT" => ConnectionState::SynSent,
            "SYN_RECEIVED" | "SYN-RECEIVED" | "SYN_RECV" => ConnectionState::SynReceived,
            "FIN_WAIT_1" | "FIN-WAIT-1" | "FIN_WAIT1" => ConnectionState::FinWait1,
            "FIN_WAIT_2" | "FIN-WAIT-2" | "FIN_WAIT2" => ConnectionState::FinWait2,
            "CLOSING" => ConnectionState::Closing,
            "LAST_ACK" | "LAST-ACK" => ConnectionState::LastAck,
            "CLOSED" => ConnectionState::Closed,
            _ => ConnectionState::Unknown,
        }
    }
}

/// Category of port usage
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortCategory {
    DevServer,
    Database,
    System,
    Docker,
    NodeProcess,
    Other,
}

impl PortCategory {
    fn from_port_and_process(port: u16, process_name: &str) -> Self {
        // Check by process name first
        let name_lower = process_name.to_lowercase();

        // Docker processes
        if name_lower.contains("docker") || name_lower.contains("containerd") {
            return PortCategory::Docker;
        }

        // Database processes
        if name_lower.contains("mysql") || name_lower.contains("postgres") || name_lower.contains("mongo")
           || name_lower.contains("redis") || name_lower.contains("sqlite") || name_lower.contains("mariadb") {
            return PortCategory::Database;
        }

        // Development runtimes - these are "Projects" (running dev apps)
        if name_lower.contains("node") || name_lower.contains("npm") || name_lower.contains("pnpm")
           || name_lower.contains("bun") || name_lower.contains("deno") || name_lower.contains("vite")
           || name_lower.contains("next") || name_lower.contains("nuxt") || name_lower.contains("webpack")
           || name_lower.contains("esbuild") || name_lower.contains("turbo")
           || name_lower.contains("python") || name_lower.contains("uvicorn") || name_lower.contains("gunicorn")
           || name_lower.contains("flask") || name_lower.contains("django")
           || name_lower.contains("ruby") || name_lower.contains("rails") || name_lower.contains("puma")
           || name_lower.contains("cargo") || name_lower.contains("rustc")
           || name_lower.contains("go") || name_lower.contains("air")  // Go live reload
           || name_lower.contains("php") || name_lower.contains("artisan") || name_lower.contains("laravel") {
            return PortCategory::DevServer;
        }

        // Check by common port ranges
        // Note: Specific ports must be checked before ranges that include them
        match port {
            // Database ports (specific ports checked first)
            3306 | 5432 | 27017 | 6379 | 9200 | 5984 | 7474 | 8529 | 9042 | 26257 => {
                PortCategory::Database
            }
            // Docker
            2375 | 2376 | 2377 => PortCategory::Docker,
            // System ports
            1..=1023 => PortCategory::System,
            // Common dev server ports -> Projects (ranges checked last)
            3000..=3999 | 4000..=4999 | 5000..=5999 | 8000..=8999 | 9000..=9999 => {
                PortCategory::DevServer
            }
            _ => PortCategory::Other,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            PortCategory::DevServer => "Projects",  // Renamed from "Dev Servers"
            PortCategory::Database => "Databases",
            PortCategory::System => "System",
            PortCategory::Docker => "Docker",
            PortCategory::NodeProcess => "Node.js",
            PortCategory::Other => "Other",
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            PortCategory::DevServer => "folder-code",  // Better icon for projects
            PortCategory::Database => "database",
            PortCategory::System => "shield",
            PortCategory::Docker => "container",
            PortCategory::NodeProcess => "hexagon",
            PortCategory::Other => "circle",
        }
    }
}

// ==================== STRUCTS ====================

/// Information about a process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub command: String,
    pub user: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub memory_percent: f32,
    pub parent_pid: Option<u32>,
    pub children_pids: Vec<u32>,
    pub start_time: Option<String>,
    pub project_name: Option<String>,
    pub working_directory: Option<String>,
}

/// A port entry representing a network port in use
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortEntry {
    pub port: u16,
    pub protocol: Protocol,
    pub state: ConnectionState,
    pub local_address: String,
    pub remote_address: Option<String>,
    pub process: Option<ProcessInfo>,
    pub category: PortCategory,
    pub is_common_dev_port: bool,
}

/// Network connection information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConnection {
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub protocol: Protocol,
    pub state: ConnectionState,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
}

/// Summary for a port category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortCategorySummary {
    pub category: PortCategory,
    pub name: String,
    pub count: u32,
    pub icon: String,
    pub ports: Vec<u16>,
}

/// Result of a port scan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortScanResult {
    pub ports: Vec<PortEntry>,
    pub connections: Vec<NetworkConnection>,
    pub total_listening: u32,
    pub total_established: u32,
    pub categories: Vec<PortCategorySummary>,
    pub scan_duration_ms: u64,
}

/// Options for port scanning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortScanOptions {
    #[serde(default)]
    pub port_range: Option<(u16, u16)>,
    #[serde(default)]
    pub protocols: Option<Vec<Protocol>>,
    #[serde(default)]
    pub states: Option<Vec<ConnectionState>>,
    #[serde(default)]
    pub categories: Option<Vec<PortCategory>>,
    #[serde(default)]
    pub include_system_ports: bool,
}

impl Default for PortScanOptions {
    fn default() -> Self {
        Self {
            port_range: None,
            protocols: None,
            states: None,
            categories: None,
            include_system_ports: false,
        }
    }
}

/// Progress event for port scanning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortScanProgress {
    pub stage: String,
    pub progress_percent: f32,
    pub ports_found: u32,
}

/// Result of a kill operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillResult {
    pub success: bool,
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub message: String,
}

/// Result of a batch kill operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchKillResult {
    pub total: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub results: Vec<KillResult>,
}

/// A port watch configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortWatch {
    pub id: String,
    pub port: u16,
    pub watch_type: PortWatchType,
    pub notify: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortWatchType {
    Available,
    Taken,
}

/// Port history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortHistoryEntry {
    pub port: u16,
    pub process_name: String,
    pub pid: u32,
    pub timestamp: String,
    pub action: String, // "opened" or "closed"
}

/// Process tree node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessTreeNode {
    pub pid: u32,
    pub name: String,
    pub command: String,
    pub children: Vec<ProcessTreeNode>,
}

// ==================== CONSTANTS ====================

/// Common development ports for quick scanning
const COMMON_DEV_PORTS: &[u16] = &[
    3000, 3001, 3002, 3003, // React/Next.js
    4200, 4201,             // Angular
    5000, 5001,             // Flask/Various
    5173, 5174,             // Vite
    8000, 8001,             // Django/FastAPI
    8080, 8081, 8888,       // HTTP alternates
    3306,                    // MySQL
    5432,                    // PostgreSQL
    27017,                   // MongoDB
    6379,                    // Redis
    9200,                    // Elasticsearch
    2181,                    // Zookeeper
    9092,                    // Kafka
];

// Global cancel flag for scans
static SCAN_CANCELLED: AtomicBool = AtomicBool::new(false);

// ==================== HELPER FUNCTIONS ====================

/// Check if a port is a common development port
fn is_common_dev_port(port: u16) -> bool {
    COMMON_DEV_PORTS.contains(&port) ||
    (port >= 3000 && port <= 3999) ||
    (port >= 5000 && port <= 5999) ||
    (port >= 8000 && port <= 9999)
}

/// Parse lsof output to get port and process information
/// lsof output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME [STATE]
/// Note: COMMAND may contain spaces, so we parse from the end backwards
fn parse_lsof_output(output: &str) -> Vec<PortEntry> {
    let mut ports: HashMap<(u16, Protocol), PortEntry> = HashMap::new();

    for line in output.lines().skip(1) { // Skip header
        // Parse from right to left since NAME and state are predictable at the end
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        // Find TYPE column (IPv4, IPv6, UDP) to determine protocol and position
        let type_idx = parts.iter().position(|&p|
            p == "IPv4" || p == "IPv6" || p.starts_with("UDP")
        );

        let type_idx = match type_idx {
            Some(idx) => idx,
            None => continue,
        };

        // PID is always at index 1 (after potentially multi-word COMMAND)
        // We need to find PID by looking for a numeric value after COMMAND
        let pid: u32 = match parts.get(1).and_then(|s| s.parse().ok()) {
            Some(p) => p,
            None => {
                // COMMAND might have spaces, find first numeric
                let pid_found = parts.iter().skip(1).find_map(|s| s.parse::<u32>().ok());
                match pid_found {
                    Some(p) => p,
                    None => continue,
                }
            }
        };

        // Find the PID index to get USER and COMMAND
        let pid_idx = parts.iter().position(|&p| p.parse::<u32>().ok() == Some(pid))
            .unwrap_or(1);

        // COMMAND is everything before PID
        let command = if pid_idx > 0 {
            parts[0..pid_idx].join(" ")
        } else {
            parts[0].to_string()
        };

        // USER is right after PID
        let user = parts.get(pid_idx + 1).unwrap_or(&"").to_string();

        // Protocol from TYPE column
        let type_col = parts.get(type_idx).unwrap_or(&"");
        let protocol = if type_col.contains("UDP") {
            Protocol::Udp
        } else {
            Protocol::Tcp
        };

        // NAME is second to last or last column (before optional state)
        // State (LISTEN, ESTABLISHED) is in parentheses at the end
        let last = parts.last().unwrap_or(&"");
        let (name, state_str) = if last.starts_with('(') && last.ends_with(')') {
            // Last column is state, second to last is NAME
            let name = parts.get(parts.len() - 2).unwrap_or(&"");
            let state = last.trim_start_matches('(').trim_end_matches(')');
            (*name, Some(state))
        } else {
            // Last column is NAME (no state, typical for some connections)
            (*last, None)
        };

        // Parse state
        let state = if protocol == Protocol::Tcp {
            state_str.map(ConnectionState::from_str).unwrap_or(ConnectionState::Listen)
        } else {
            ConnectionState::Listen // UDP doesn't have connection states
        };

        // Parse local address and port
        let (local_addr, port_num, remote_addr) = parse_address(name);

        let port = match port_num {
            Some(p) => p,
            None => continue,
        };

        // Don't filter system ports here - let the caller decide via options

        let category = PortCategory::from_port_and_process(port, &command);
        let is_common = is_common_dev_port(port);

        let key = (port, protocol);

        // Get project info for dev-related processes
        let (project_name, working_directory) = if category == PortCategory::DevServer || category == PortCategory::NodeProcess {
            get_project_info_for_process(pid)
        } else {
            (None, None)
        };

        // Update or insert port entry
        if let Some(existing) = ports.get_mut(&key) {
            // Update with more recent info if needed
            if existing.process.is_none() {
                existing.process = Some(ProcessInfo {
                    pid,
                    name: command.clone(),
                    command: command.clone(),
                    user,
                    cpu_percent: 0.0,
                    memory_bytes: 0,
                    memory_percent: 0.0,
                    parent_pid: None,
                    children_pids: vec![],
                    start_time: None,
                    project_name: project_name.clone(),
                    working_directory: working_directory.clone(),
                });
            }
        } else {
            ports.insert(key, PortEntry {
                port,
                protocol,
                state,
                local_address: local_addr,
                remote_address: remote_addr,
                process: Some(ProcessInfo {
                    pid,
                    name: command.clone(),
                    command,
                    user,
                    cpu_percent: 0.0,
                    memory_bytes: 0,
                    memory_percent: 0.0,
                    parent_pid: None,
                    children_pids: vec![],
                    start_time: None,
                    project_name,
                    working_directory,
                }),
                category,
                is_common_dev_port: is_common,
            });
        }
    }

    let mut result: Vec<PortEntry> = ports.into_values().collect();
    result.sort_by(|a, b| a.port.cmp(&b.port));
    result
}

/// Parse address string from lsof output
fn parse_address(addr_str: &str) -> (String, Option<u16>, Option<String>) {
    // Handle formats like:
    // *:3000 (LISTEN)
    // localhost:3000 (ESTABLISHED)
    // 127.0.0.1:3000->127.0.0.1:52343
    // [::1]:3000

    let clean = addr_str.split('(').next().unwrap_or(addr_str).trim();

    // Handle connection format with ->
    if let Some(arrow_pos) = clean.find("->") {
        let local = &clean[..arrow_pos];
        let remote = &clean[arrow_pos + 2..];

        let (local_addr, local_port) = parse_single_address(local);
        let (remote_addr, _) = parse_single_address(remote);

        return (local_addr, local_port, Some(remote_addr));
    }

    let (addr, port) = parse_single_address(clean);
    (addr, port, None)
}

fn parse_single_address(addr_str: &str) -> (String, Option<u16>) {
    // Handle IPv6 [::1]:port
    if addr_str.starts_with('[') {
        if let Some(bracket_end) = addr_str.find("]:") {
            let addr = &addr_str[1..bracket_end];
            let port_str = &addr_str[bracket_end + 2..];
            let port = port_str.parse().ok();
            return (addr.to_string(), port);
        }
    }

    // Handle IPv4 or hostname:port
    if let Some(colon_pos) = addr_str.rfind(':') {
        let addr = &addr_str[..colon_pos];
        let port_str = &addr_str[colon_pos + 1..];

        // Check if port is actually a number (not part of IPv6)
        if let Ok(port) = port_str.parse::<u16>() {
            return (addr.to_string(), Some(port));
        }
    }

    // Handle just port number like *:3000
    if addr_str.starts_with("*:") {
        let port_str = &addr_str[2..];
        let port = port_str.parse().ok();
        return ("*".to_string(), port);
    }

    (addr_str.to_string(), None)
}

/// Get process details using ps command
fn get_process_details_internal(pid: u32) -> Result<ProcessInfo, String> {
    // Get basic process info with ps
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "pid,ppid,user,%cpu,%mem,command"])
        .output()
        .map_err(|e| format!("Failed to run ps: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();

    if lines.len() < 2 {
        return Err(format!("Process {} not found", pid));
    }

    let parts: Vec<&str> = lines[1].split_whitespace().collect();
    if parts.len() < 6 {
        return Err("Invalid ps output".to_string());
    }

    let ppid: Option<u32> = parts.get(1).and_then(|s| s.parse().ok());
    let user = parts.get(2).unwrap_or(&"").to_string();
    let cpu: f32 = parts.get(3).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let mem: f32 = parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let command = parts[5..].join(" ");
    let name = parts.get(5).map(|s| {
        s.split('/').last().unwrap_or(s).to_string()
    }).unwrap_or_default();

    // Get children PIDs
    let children_output = Command::new("pgrep")
        .args(["-P", &pid.to_string()])
        .output()
        .ok();

    let children_pids: Vec<u32> = children_output
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|l| l.trim().parse().ok())
                .collect()
        })
        .unwrap_or_default();

    // Get memory in bytes (approximate from percentage)
    let total_mem = get_total_memory();
    let memory_bytes = ((mem as f64 / 100.0) * total_mem as f64) as u64;

    // Get project info
    let (project_name, working_directory) = get_project_info_for_process(pid);

    Ok(ProcessInfo {
        pid,
        name,
        command,
        user,
        cpu_percent: cpu,
        memory_bytes,
        memory_percent: mem,
        parent_pid: ppid,
        children_pids,
        start_time: None,
        project_name,
        working_directory,
    })
}

/// Get total system memory
fn get_total_memory() -> u64 {
    let output = Command::new("sysctl")
        .args(["-n", "hw.memsize"])
        .output()
        .ok();

    output
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse().ok())
        .unwrap_or(8_000_000_000) // Default to 8GB
}

/// Get the working directory of a process using lsof
fn get_process_cwd(pid: u32) -> Option<String> {
    // Use lsof to get the current working directory (cwd)
    // -a flag is crucial - it ANDs the conditions together
    let output = Command::new("lsof")
        .args(["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // lsof output format:
    // p<pid>
    // fcwd
    // n<path>
    for line in stdout.lines() {
        if line.starts_with('n') && line.len() > 1 {
            let path = &line[1..];
            // Filter out root directory as it's not useful
            if path != "/" {
                return Some(path.to_string());
            }
        }
    }

    None
}

/// Get project name from a directory by reading package.json or using folder name
fn get_project_name_from_dir(dir: &str) -> Option<String> {
    use std::path::Path;
    use std::fs;

    let path = Path::new(dir);

    // Try to read package.json
    let package_json_path = path.join("package.json");
    if package_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&package_json_path) {
            // Simple JSON parsing for "name" field
            if let Some(name) = extract_json_string_field(&content, "name") {
                if !name.is_empty() && name != "undefined" {
                    return Some(name);
                }
            }
        }
    }

    // Try pyproject.toml for Python projects
    let pyproject_path = path.join("pyproject.toml");
    if pyproject_path.exists() {
        if let Ok(content) = fs::read_to_string(&pyproject_path) {
            // Look for name = "project-name" in [project] section
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("name") && trimmed.contains('=') {
                    if let Some(name) = extract_toml_string_value(trimmed) {
                        return Some(name);
                    }
                }
            }
        }
    }

    // Try Cargo.toml for Rust projects
    let cargo_path = path.join("Cargo.toml");
    if cargo_path.exists() {
        if let Ok(content) = fs::read_to_string(&cargo_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("name") && trimmed.contains('=') {
                    if let Some(name) = extract_toml_string_value(trimmed) {
                        return Some(name);
                    }
                }
            }
        }
    }

    // Fallback: use the directory name, but filter out generic directories
    if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
        let lower = dir_name.to_lowercase();
        // Skip generic directory names (including monorepo common folders)
        if !matches!(lower.as_str(),
            "src" | "app" | "apps" | "packages" | "lib" | "bin" | "dist" | "build" |
            "node_modules" | "." | ".." | "home" | "users" | "developer" | "projects" |
            "code" | "active" | "archived" | "landing" | "web" | "api" | "server" | "client"
        ) {
            return Some(dir_name.to_string());
        }
    }

    None
}

/// Extract a string field from JSON (simple parser, avoids serde_json dependency for this)
fn extract_json_string_field(json: &str, field: &str) -> Option<String> {
    // Look for "field": "value" pattern
    let search = format!("\"{}\"", field);
    let field_start = json.find(&search)?;

    // Find the colon after the field name
    let after_field = &json[field_start + search.len()..];
    let colon_pos = after_field.find(':')?;
    let after_colon = &after_field[colon_pos + 1..];

    // Skip whitespace and find opening quote
    let trimmed = after_colon.trim_start();
    if !trimmed.starts_with('"') {
        return None;
    }

    // Find the closing quote
    let value_start = 1; // After opening quote
    let remaining = &trimmed[value_start..];

    // Find end of string (handle escaped quotes)
    let mut end = 0;
    let mut escaped = false;
    for (i, c) in remaining.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if c == '\\' {
            escaped = true;
            continue;
        }
        if c == '"' {
            end = i;
            break;
        }
    }

    if end > 0 {
        Some(remaining[..end].to_string())
    } else {
        None
    }
}

/// Extract string value from TOML line like: name = "value"
fn extract_toml_string_value(line: &str) -> Option<String> {
    let eq_pos = line.find('=')?;
    let value_part = line[eq_pos + 1..].trim();

    // Remove quotes
    if value_part.starts_with('"') && value_part.len() > 2 {
        let end = value_part[1..].find('"')?;
        return Some(value_part[1..1+end].to_string());
    }

    None
}

/// Get project info for a process (project name and working directory)
fn get_project_info_for_process(pid: u32) -> (Option<String>, Option<String>) {
    let cwd = get_process_cwd(pid);

    let project_name = cwd.as_ref().and_then(|dir| {
        // Try to find project root by walking up directories
        let mut current = std::path::Path::new(dir);

        for _ in 0..5 {  // Max 5 levels up
            if let Some(name) = get_project_name_from_dir(current.to_str().unwrap_or("")) {
                return Some(name);
            }

            // Check if we have a project marker file
            if current.join("package.json").exists() ||
               current.join("Cargo.toml").exists() ||
               current.join("pyproject.toml").exists() ||
               current.join(".git").exists() {
                if let Some(dir_name) = current.file_name().and_then(|n| n.to_str()) {
                    return Some(dir_name.to_string());
                }
            }

            current = match current.parent() {
                Some(p) => p,
                None => break,
            };
        }

        None
    });

    (project_name, cwd)
}

/// Kill a process by PID
fn kill_process_internal(pid: u32, force: bool) -> Result<(), String> {
    let signal = if force { "-9" } else { "-15" };

    let output = Command::new("kill")
        .args([signal, &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to execute kill: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("No such process") {
            Ok(()) // Already dead
        } else if stderr.contains("Operation not permitted") {
            Err(format!(
                "Permission denied. The process (PID {}) may require elevated privileges to kill. Try running with sudo or check process ownership.",
                pid
            ))
        } else {
            Err(format!("Failed to kill process {}: {}", pid, stderr))
        }
    }
}

/// Find PIDs using a specific port
fn get_pids_for_port(port: u16) -> Vec<u32> {
    let output = Command::new("lsof")
        .args(["-i", &format!(":{}", port), "-t"])
        .output()
        .ok();

    output
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|l| l.trim().parse().ok())
                .collect()
        })
        .unwrap_or_default()
}

// ==================== TAURI COMMANDS ====================

/// Scan all ports with options
#[tauri::command]
pub async fn scan_ports(app: AppHandle, options: Option<PortScanOptions>) -> Result<PortScanResult, String> {
    SCAN_CANCELLED.store(false, Ordering::SeqCst);
    let start = Instant::now();
    let opts = options.unwrap_or_default();

    let result = tokio::task::spawn_blocking(move || -> Result<PortScanResult, String> {
        // Emit progress: Starting
        let _ = app.emit("port-scan-progress", PortScanProgress {
            stage: "Scanning network ports...".to_string(),
            progress_percent: 10.0,
            ports_found: 0,
        });

        if SCAN_CANCELLED.load(Ordering::SeqCst) {
            return Err("Scan cancelled".to_string());
        }

        // Run lsof to get all listening ports
        let lsof_output = Command::new("lsof")
            .args(["-i", "-n", "-P"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .map_err(|e| format!("Failed to run lsof: {}", e))?;

        let _ = app.emit("port-scan-progress", PortScanProgress {
            stage: "Parsing results...".to_string(),
            progress_percent: 50.0,
            ports_found: 0,
        });

        if SCAN_CANCELLED.load(Ordering::SeqCst) {
            return Err("Scan cancelled".to_string());
        }

        let stdout = String::from_utf8_lossy(&lsof_output.stdout);
        let mut ports = parse_lsof_output(&stdout);

        // Apply filters
        if let Some((min, max)) = opts.port_range {
            ports.retain(|p| p.port >= min && p.port <= max);
        }

        if let Some(ref protocols) = opts.protocols {
            ports.retain(|p| protocols.contains(&p.protocol));
        }

        if let Some(ref states) = opts.states {
            ports.retain(|p| states.contains(&p.state));
        }

        if let Some(ref categories) = opts.categories {
            ports.retain(|p| categories.contains(&p.category));
        }

        if !opts.include_system_ports {
            ports.retain(|p| p.port >= 1024);
        }

        let _ = app.emit("port-scan-progress", PortScanProgress {
            stage: "Building results...".to_string(),
            progress_percent: 80.0,
            ports_found: ports.len() as u32,
        });

        // Calculate statistics
        let total_listening = ports.iter().filter(|p| p.state == ConnectionState::Listen).count() as u32;
        let total_established = ports.iter().filter(|p| p.state == ConnectionState::Established).count() as u32;

        // Build category summaries
        let mut category_map: HashMap<PortCategory, Vec<u16>> = HashMap::new();
        for port in &ports {
            category_map.entry(port.category).or_default().push(port.port);
        }

        let categories: Vec<PortCategorySummary> = category_map
            .into_iter()
            .map(|(cat, port_list)| PortCategorySummary {
                category: cat,
                name: cat.display_name().to_string(),
                count: port_list.len() as u32,
                icon: cat.icon().to_string(),
                ports: port_list,
            })
            .collect();

        // Get network connections (established)
        let connections: Vec<NetworkConnection> = ports
            .iter()
            .filter(|p| p.state == ConnectionState::Established && p.remote_address.is_some())
            .map(|p| NetworkConnection {
                local_address: p.local_address.clone(),
                local_port: p.port,
                remote_address: p.remote_address.clone().unwrap_or_default(),
                remote_port: 0, // Would need to parse from remote address
                protocol: p.protocol,
                state: p.state,
                pid: p.process.as_ref().map(|pr| pr.pid),
                process_name: p.process.as_ref().map(|pr| pr.name.clone()),
            })
            .collect();

        let _ = app.emit("port-scan-progress", PortScanProgress {
            stage: "Complete".to_string(),
            progress_percent: 100.0,
            ports_found: ports.len() as u32,
        });

        Ok(PortScanResult {
            ports,
            connections,
            total_listening,
            total_established,
            categories,
            scan_duration_ms: start.elapsed().as_millis() as u64,
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Quick scan for common development ports
#[tauri::command]
pub async fn scan_dev_ports(app: AppHandle) -> Result<PortScanResult, String> {
    let options = PortScanOptions {
        port_range: None,
        protocols: None,
        states: Some(vec![ConnectionState::Listen]),
        categories: Some(vec![
            PortCategory::DevServer,
            PortCategory::Database,
            PortCategory::NodeProcess,
        ]),
        include_system_ports: false,
    };

    scan_ports(app, Some(options)).await
}

/// Cancel an ongoing port scan
#[tauri::command]
pub fn cancel_port_scan() -> Result<(), String> {
    SCAN_CANCELLED.store(true, Ordering::SeqCst);
    Ok(())
}

/// Check if a specific port is available
#[tauri::command]
pub async fn check_port_available(port: u16) -> Result<bool, String> {
    let result = tokio::task::spawn_blocking(move || -> Result<bool, String> {
        let output = Command::new("lsof")
            .args(["-i", &format!(":{}", port)])
            .output()
            .map_err(|e| format!("Failed to run lsof: {}", e))?;

        // If lsof returns no output, port is available
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().is_empty() || stdout.lines().count() <= 1)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Kill a process by PID
#[tauri::command]
pub async fn kill_process(pid: u32, force: bool) -> Result<KillResult, String> {
    let result = tokio::task::spawn_blocking(move || -> Result<KillResult, String> {
        match kill_process_internal(pid, force) {
            Ok(_) => Ok(KillResult {
                success: true,
                pid: Some(pid),
                port: None,
                message: format!("Process {} terminated successfully", pid),
            }),
            Err(e) => Ok(KillResult {
                success: false,
                pid: Some(pid),
                port: None,
                message: e,
            }),
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Kill process(es) using a specific port
#[tauri::command]
pub async fn kill_port(port: u16, force: bool) -> Result<KillResult, String> {
    let result = tokio::task::spawn_blocking(move || -> Result<KillResult, String> {
        let pids = get_pids_for_port(port);

        if pids.is_empty() {
            return Ok(KillResult {
                success: true,
                pid: None,
                port: Some(port),
                message: format!("No process found on port {}", port),
            });
        }

        let mut all_success = true;
        let mut messages = Vec::new();

        for pid in &pids {
            match kill_process_internal(*pid, force) {
                Ok(_) => messages.push(format!("Killed PID {}", pid)),
                Err(e) => {
                    all_success = false;
                    messages.push(format!("Failed to kill PID {}: {}", pid, e));
                }
            }
        }

        Ok(KillResult {
            success: all_success,
            pid: pids.first().copied(),
            port: Some(port),
            message: messages.join("; "),
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Batch kill multiple processes by PID
#[tauri::command]
pub async fn batch_kill_processes(pids: Vec<u32>, force: bool) -> Result<BatchKillResult, String> {
    let result = tokio::task::spawn_blocking(move || -> Result<BatchKillResult, String> {
        let mut results = Vec::new();
        let mut succeeded = 0u32;
        let mut failed = 0u32;

        for pid in &pids {
            let kill_result = match kill_process_internal(*pid, force) {
                Ok(_) => {
                    succeeded += 1;
                    KillResult {
                        success: true,
                        pid: Some(*pid),
                        port: None,
                        message: format!("Process {} terminated", pid),
                    }
                }
                Err(e) => {
                    failed += 1;
                    KillResult {
                        success: false,
                        pid: Some(*pid),
                        port: None,
                        message: e,
                    }
                }
            };
            results.push(kill_result);
        }

        Ok(BatchKillResult {
            total: pids.len() as u32,
            succeeded,
            failed,
            results,
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Batch kill processes on multiple ports
#[tauri::command]
pub async fn batch_kill_ports(ports: Vec<u16>, force: bool) -> Result<BatchKillResult, String> {
    let result = tokio::task::spawn_blocking(move || -> Result<BatchKillResult, String> {
        let mut results = Vec::new();
        let mut succeeded = 0u32;
        let mut failed = 0u32;

        for port in &ports {
            let pids = get_pids_for_port(*port);

            if pids.is_empty() {
                results.push(KillResult {
                    success: true,
                    pid: None,
                    port: Some(*port),
                    message: format!("No process on port {}", port),
                });
                continue;
            }

            let mut port_success = true;
            let mut port_messages = Vec::new();

            for pid in &pids {
                match kill_process_internal(*pid, force) {
                    Ok(_) => port_messages.push(format!("Killed PID {}", pid)),
                    Err(e) => {
                        port_success = false;
                        port_messages.push(format!("Failed PID {}: {}", pid, e));
                    }
                }
            }

            if port_success {
                succeeded += 1;
            } else {
                failed += 1;
            }

            results.push(KillResult {
                success: port_success,
                pid: pids.first().copied(),
                port: Some(*port),
                message: port_messages.join("; "),
            });
        }

        Ok(BatchKillResult {
            total: ports.len() as u32,
            succeeded,
            failed,
            results,
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Get detailed information about a process
#[tauri::command]
pub async fn get_process_details(pid: u32) -> Result<ProcessInfo, String> {
    let result = tokio::task::spawn_blocking(move || -> Result<ProcessInfo, String> {
        get_process_details_internal(pid)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Get process tree for a given PID
#[tauri::command]
pub async fn get_process_tree(pid: u32) -> Result<ProcessTreeNode, String> {
    fn build_tree(pid: u32, depth: u32) -> Result<ProcessTreeNode, String> {
        if depth > 10 {
            return Err("Max depth exceeded".to_string());
        }

        let info = get_process_details_internal(pid)?;

        let children: Vec<ProcessTreeNode> = info.children_pids
            .iter()
            .filter_map(|&child_pid| build_tree(child_pid, depth + 1).ok())
            .collect();

        Ok(ProcessTreeNode {
            pid,
            name: info.name,
            command: info.command,
            children,
        })
    }

    let result = tokio::task::spawn_blocking(move || -> Result<ProcessTreeNode, String> {
        build_tree(pid, 0)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Get all network connections
#[tauri::command]
pub async fn get_network_connections() -> Result<Vec<NetworkConnection>, String> {
    let result = tokio::task::spawn_blocking(|| -> Result<Vec<NetworkConnection>, String> {
        let output = Command::new("lsof")
            .args(["-i", "-n", "-P"])
            .output()
            .map_err(|e| format!("Failed to run lsof: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let ports = parse_lsof_output(&stdout);

        let connections: Vec<NetworkConnection> = ports
            .iter()
            .filter(|p| p.state == ConnectionState::Established)
            .map(|p| NetworkConnection {
                local_address: p.local_address.clone(),
                local_port: p.port,
                remote_address: p.remote_address.clone().unwrap_or_default(),
                remote_port: 0,
                protocol: p.protocol,
                state: p.state,
                pid: p.process.as_ref().map(|pr| pr.pid),
                process_name: p.process.as_ref().map(|pr| pr.name.clone()),
            })
            .collect();

        Ok(connections)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Add a port watch (watches are stored in frontend, this just validates)
#[tauri::command]
pub async fn add_port_watch(port: u16, watch_type: PortWatchType, notify: bool) -> Result<PortWatch, String> {
    let id = format!("watch_{}_{}", port, chrono::Utc::now().timestamp_millis());
    let created_at = chrono::Utc::now().to_rfc3339();

    Ok(PortWatch {
        id,
        port,
        watch_type,
        notify,
        created_at,
    })
}

/// Remove a port watch (frontend handles storage, this is a no-op)
#[tauri::command]
pub fn remove_port_watch(_watch_id: String) -> Result<(), String> {
    Ok(())
}

/// Get port watches (stored in frontend)
#[tauri::command]
pub fn get_port_watches() -> Result<Vec<PortWatch>, String> {
    // Watches are stored in frontend localStorage via Zustand
    Ok(vec![])
}

/// Get port history (placeholder - could be stored in SQLite)
#[tauri::command]
pub fn get_port_history(_port: Option<u16>, _limit: Option<u32>) -> Result<Vec<PortHistoryEntry>, String> {
    // History tracking would require background monitoring
    // For now, return empty - could be implemented with SQLite
    Ok(vec![])
}

/// Get common dev ports info
#[tauri::command]
pub fn get_common_dev_ports() -> Result<Vec<u16>, String> {
    Ok(COMMON_DEV_PORTS.to_vec())
}
