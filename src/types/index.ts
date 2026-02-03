export type ProjectLocation = "active" | "archived";

export interface GitStatus {
  branch: string | null;
  is_dirty: boolean;
  ahead: number;
  behind: number;
  has_remote: boolean;
  staged_count: number;
  modified_count: number;
  untracked_count: number;
}

export interface Project {
  name: string;
  path: string;
  location: ProjectLocation;
  project_type: string | null;
  created_at: string | null;
  last_modified: string | null;
  git_status: GitStatus | null;
}

export interface ProjectDetail extends Project {
  has_package_json: boolean;
  has_cargo_toml: boolean;
  has_docker: boolean;
  has_env_file: boolean;
  disk_size: number | null;
  readme_preview: string | null;
}

export interface SystemInfo {
  total_memory: number;
  used_memory: number;
  total_disk: number;
  used_disk: number;
  cpu_count: number;
  cpu_usage: number;
  os_name: string;
  os_version: string;
  hostname: string;
}

export interface Config {
  active_dir: string;
  archive_dir: string;
  default_editor: string;
  default_template: string;
  github_username: string | null;
  auto_git_init: boolean;
  auto_install_deps: boolean;
  time_tracking_enabled: boolean;
}

export interface TimeEntry {
  id: number;
  project_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface ActiveTimer {
  project_name: string;
  started_at: string;
  elapsed_seconds: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  command: string | null;
  icon: string;
}

export interface CreateProjectOptions {
  name: string;
  template: string;
  init_git: boolean;
  open_in_editor: boolean;
  create_github_repo: boolean;
  github_visibility: string | null;
}

export interface CreateProjectResult {
  success: boolean;
  path: string;
  message: string;
  github_url: string | null;
}

export interface CloneOptions {
  url: string;
  name: string | null;
  shallow: boolean;
  open_in_editor: boolean;
}

export interface PlaygroundOptions {
  name: string | null;
  open_in_editor: boolean;
}

export interface ProjectTypeCount {
  project_type: string;
  count: number;
}

export interface GitActivityStats {
  total_commits_7d: number;
  projects_with_changes: number;
  total_uncommitted_changes: number;
}

export interface Statistics {
  total_projects: number;
  active_projects: number;
  archived_projects: number;
  total_size_bytes: number;
  active_size_bytes: number;
  archived_size_bytes: number;
  project_types: ProjectTypeCount[];
  git_activity: GitActivityStats;
}

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
}

export interface InstalledEditor {
  id: string;
  name: string;
  command: string;
  icon: string;
}

export interface DiskSizeOptions {
  use_disk_blocks?: boolean;
  include_node_modules?: boolean;
  include_git?: boolean;
  include_target?: boolean;
  include_hidden?: boolean;
}

export interface DiskSizeInfo {
  total_bytes: number;
  source_bytes: number;
  node_modules_bytes: number;
  git_bytes: number;
  target_bytes: number;
  file_count: number;
  dir_count: number;
  formatted: string;
}

// Disk Manager Types
export type SafetyLevel = "safe" | "moderate" | "aggressive";

export type DiskCategory =
  | "safe_to_clean"
  | "build_artifacts"
  | "package_managers"
  | "dev_tools"
  | "app_caches"
  | "docker"
  | "system"
  | "trash";

export interface ScannableItem {
  id: string;
  name: string;
  path: string;
  category: DiskCategory;
  safety_level: SafetyLevel;
  size_bytes: number;
  formatted_size: string;
  file_count: number;
  description: string;
  icon: string;
  children: ScannableItem[];
  exists: boolean;
}

export interface CategorySummary {
  category: DiskCategory;
  name: string;
  size_bytes: number;
  formatted_size: string;
  item_count: number;
  safety_level: SafetyLevel;
  icon: string;
  description: string;
}

export interface DiskScanResult {
  total_size_bytes: number;
  cleanable_size_bytes: number;
  formatted_total: string;
  formatted_cleanable: string;
  items: ScannableItem[];
  categories: CategorySummary[];
  scan_duration_ms: number;
}

export interface CleanupOptions {
  item_ids: string[];
  safety_level: SafetyLevel;
  move_to_trash?: boolean;
  dry_run?: boolean;
}

export interface CleanupPreview {
  items: ScannableItem[];
  total_size_bytes: number;
  formatted_size: string;
  total_files: number;
  warnings: string[];
}

export interface CleanupResult {
  success: boolean;
  freed_bytes: number;
  formatted_freed: string;
  deleted_count: number;
  failed_count: number;
  errors: string[];
}

export interface CleanupHistoryEntry {
  id: string;
  timestamp: string;
  freed_bytes: number;
  formatted_freed: string;
  item_count: number;
  categories: string[];
}

export interface ScanProgressEvent {
  current_path: string;
  items_found: number;
  bytes_scanned: number;
  progress_percent: number;
}

// Permissions Types
export interface PermissionStatus {
  id: string;
  name: string;
  description: string;
  required: boolean;
  granted: boolean;
  can_prompt: boolean;
  settings_url: string;
}

export interface PermissionsResult {
  permissions: PermissionStatus[];
  all_granted: boolean;
  required_granted: boolean;
  app_path: string;
}

// ==================== Port Manager Types ====================

export type Protocol = "tcp" | "udp";

export type ConnectionState =
  | "listen"
  | "established"
  | "time_wait"
  | "close_wait"
  | "syn_sent"
  | "syn_received"
  | "fin_wait1"
  | "fin_wait2"
  | "closing"
  | "last_ack"
  | "closed"
  | "unknown";

export type PortCategory =
  | "dev_server"
  | "database"
  | "system"
  | "docker"
  | "node_process"
  | "other";

export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  user: string;
  cpu_percent: number;
  memory_bytes: number;
  memory_percent: number;
  parent_pid: number | null;
  children_pids: number[];
  start_time: string | null;
  project_name: string | null;
  working_directory: string | null;
}

export interface PortEntry {
  port: number;
  protocol: Protocol;
  state: ConnectionState;
  local_address: string;
  remote_address: string | null;
  process: ProcessInfo | null;
  category: PortCategory;
  is_common_dev_port: boolean;
}

export interface NetworkConnection {
  local_address: string;
  local_port: number;
  remote_address: string;
  remote_port: number;
  protocol: Protocol;
  state: ConnectionState;
  pid: number | null;
  process_name: string | null;
}

export interface PortCategorySummary {
  category: PortCategory;
  name: string;
  count: number;
  icon: string;
  ports: number[];
}

export interface PortScanResult {
  ports: PortEntry[];
  connections: NetworkConnection[];
  total_listening: number;
  total_established: number;
  categories: PortCategorySummary[];
  scan_duration_ms: number;
}

export interface PortScanOptions {
  port_range?: [number, number];
  protocols?: Protocol[];
  states?: ConnectionState[];
  categories?: PortCategory[];
  include_system_ports?: boolean;
}

export interface PortScanProgress {
  stage: string;
  progress_percent: number;
  ports_found: number;
}

export interface KillResult {
  success: boolean;
  pid: number | null;
  port: number | null;
  message: string;
}

export interface BatchKillResult {
  total: number;
  succeeded: number;
  failed: number;
  results: KillResult[];
}

export type PortWatchType = "available" | "taken";

export interface PortWatch {
  id: string;
  port: number;
  watch_type: PortWatchType;
  notify: boolean;
  created_at: string;
}

export interface PortHistoryEntry {
  port: number;
  process_name: string;
  pid: number;
  timestamp: string;
  action: string;
}

export interface ProcessTreeNode {
  pid: number;
  name: string;
  command: string;
  children: ProcessTreeNode[];
}

// Common dev port info
export interface CommonDevPort {
  port: number;
  name: string;
  description: string;
}
