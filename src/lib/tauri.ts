import { invoke } from "@tauri-apps/api/core";
import type {
  Project,
  ProjectDetail,
  ProjectLocation,
  SystemInfo,
  Config,
  ActiveTimer,
  TimeEntry,
  ProjectTemplate,
  CreateProjectOptions,
  CreateProjectResult,
  CloneOptions,
  PlaygroundOptions,
  Statistics,
  OutdatedPackage,
  InstalledEditor,
  DiskSizeOptions,
  DiskSizeInfo,
  DiskScanResult,
  DiskCategory,
  ScannableItem,
  CleanupOptions,
  CleanupPreview,
  CleanupResult,
  CleanupHistoryEntry,
  PermissionsResult,
  TodaySummary,
  DailyProjectTime,
  WeeklySummary,
  TimeStreaks,
  ProjectScripts,
  // Port Manager types
  PortScanResult,
  PortScanOptions,
  KillResult,
  BatchKillResult,
  ProcessInfo,
  ProcessTreeNode,
  NetworkConnection,
  PortWatch,
  PortWatchType,
  PortHistoryEntry,
  // Process Manager types
  ManagedProcess,
  LaunchResult,
  LaunchOptions,
  LogLine,
  // Workspace types
  Workspace,
  WorkspaceWithProjects,
  // Env Manager types
  EnvFile,
  // Disk trend types
  DiskScanHistoryEntry,
  // Tray types
  TrayData,
} from "@/types";

// Config commands
export async function loadConfig(): Promise<Config> {
  return invoke("load_config");
}

export async function saveConfig(config: Config): Promise<void> {
  return invoke("save_config", { config });
}

// Project commands
export async function listProjects(location?: ProjectLocation): Promise<Project[]> {
  return invoke("list_projects", { location });
}

export async function getProject(name: string, includeSize?: boolean): Promise<ProjectDetail> {
  return invoke("get_project", { name, includeSize });
}

export async function archiveProject(name: string): Promise<void> {
  return invoke("archive_project", { name });
}

export async function restoreProject(name: string): Promise<void> {
  return invoke("restore_project", { name });
}

export async function deleteProject(name: string, location: ProjectLocation): Promise<void> {
  return invoke("delete_project", { name, location });
}

export async function getProjectSize(name: string): Promise<number | null> {
  return invoke("get_project_size", { name });
}

export async function getProjectDiskInfo(
  name: string,
  options?: DiskSizeOptions
): Promise<DiskSizeInfo> {
  return invoke("get_project_disk_info", { name, options });
}

export async function calculatePathSize(
  path: string,
  options?: DiskSizeOptions
): Promise<DiskSizeInfo> {
  return invoke("calculate_path_size", { path, options });
}

export async function getProjectScripts(projectPath: string): Promise<ProjectScripts> {
  return invoke("get_project_scripts", { projectPath });
}

// System commands
export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke("get_system_info");
}

export async function getInstalledEditors(): Promise<InstalledEditor[]> {
  return invoke("get_installed_editors");
}

export async function openInEditor(path: string, editor: string): Promise<void> {
  return invoke("open_in_editor", { path, editor });
}

export async function openInTerminal(path: string): Promise<void> {
  return invoke("open_in_terminal", { path });
}

export async function openInFinder(path: string): Promise<void> {
  return invoke("open_in_finder", { path });
}

export async function checkDockerRunning(): Promise<boolean> {
  return invoke("check_docker_running");
}

// Timer commands
export async function startTimer(projectName: string): Promise<void> {
  return invoke("start_timer", { projectName });
}

export async function stopTimer(): Promise<TimeEntry | null> {
  return invoke("stop_timer");
}

export async function getActiveTimer(): Promise<ActiveTimer | null> {
  return invoke("get_active_timer");
}

export async function getTimeEntries(
  projectName?: string,
  limit?: number
): Promise<TimeEntry[]> {
  return invoke("get_time_entries", { projectName, limit });
}

// Create project commands
export async function listTemplates(): Promise<ProjectTemplate[]> {
  return invoke("list_templates");
}

export async function createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
  return invoke("create_project", { options });
}

export async function checkToolInstalled(tool: string): Promise<boolean> {
  return invoke("check_tool_installed", { tool });
}

export async function cloneRepository(options: CloneOptions): Promise<CreateProjectResult> {
  return invoke("clone_repository", { options });
}

export async function createPlayground(options: PlaygroundOptions): Promise<CreateProjectResult> {
  return invoke("create_playground", { options });
}

// Statistics commands
export async function getStatistics(): Promise<Statistics> {
  return invoke("get_statistics");
}

export async function runDevServer(projectPath: string): Promise<void> {
  return invoke("run_dev_server", { projectPath });
}

export async function killNodeProcesses(): Promise<number> {
  return invoke("kill_node_processes");
}

export async function copyToClipboard(text: string): Promise<void> {
  return invoke("copy_to_clipboard", { text });
}

export async function checkOutdatedPackages(projectPath: string): Promise<OutdatedPackage[]> {
  return invoke("check_outdated_packages", { projectPath });
}

// Disk Manager commands
export async function scanDisk(): Promise<DiskScanResult> {
  return invoke("scan_disk");
}

export async function cancelDiskScan(): Promise<void> {
  return invoke("cancel_disk_scan");
}

export async function scanCategory(category: DiskCategory): Promise<ScannableItem[]> {
  return invoke("scan_category", { category });
}

export async function previewCleanup(
  options: CleanupOptions,
  allItems: ScannableItem[]
): Promise<CleanupPreview> {
  return invoke("preview_cleanup", { options, allItems });
}

export async function executeCleanup(
  options: CleanupOptions,
  allItems: ScannableItem[]
): Promise<CleanupResult> {
  return invoke("execute_cleanup", { options, allItems });
}

export async function emptyTrash(): Promise<CleanupResult> {
  return invoke("empty_trash");
}

export async function getCleanupHistory(): Promise<CleanupHistoryEntry[]> {
  return invoke("get_cleanup_history");
}

export async function getTrashSize(): Promise<ScannableItem> {
  return invoke("get_trash_size");
}

// Permissions commands
export async function getPermissions(): Promise<PermissionsResult> {
  return invoke("get_permissions");
}

export async function triggerFilesPermission(): Promise<boolean> {
  return invoke("trigger_files_permission");
}

export async function openFullDiskAccessSettings(): Promise<void> {
  return invoke("open_full_disk_access_settings");
}

export async function openPrivacySettings(settingsUrl: string): Promise<void> {
  return invoke("open_privacy_settings", { settingsUrl });
}

export async function requestFullDiskAccessWithDialog(): Promise<void> {
  return invoke("request_full_disk_access_with_dialog");
}

export async function getAppPath(): Promise<string> {
  return invoke("get_app_path");
}

export async function checkFullDiskAccessStatus(): Promise<boolean> {
  return invoke("check_full_disk_access_status");
}

// ==================== Port Manager commands ====================

export async function scanPorts(options?: PortScanOptions): Promise<PortScanResult> {
  return invoke("scan_ports", { options });
}

export async function scanDevPorts(): Promise<PortScanResult> {
  return invoke("scan_dev_ports");
}

export async function cancelPortScan(): Promise<void> {
  return invoke("cancel_port_scan");
}

export async function checkPortAvailable(port: number): Promise<boolean> {
  return invoke("check_port_available", { port });
}

export async function killProcess(pid: number, force: boolean = false): Promise<KillResult> {
  return invoke("kill_process", { pid, force });
}

export async function killPort(port: number, force: boolean = false): Promise<KillResult> {
  return invoke("kill_port", { port, force });
}

export async function batchKillProcesses(pids: number[], force: boolean = false): Promise<BatchKillResult> {
  return invoke("batch_kill_processes", { pids, force });
}

export async function batchKillPorts(ports: number[], force: boolean = false): Promise<BatchKillResult> {
  return invoke("batch_kill_ports", { ports, force });
}

export async function getProcessDetails(pid: number): Promise<ProcessInfo> {
  return invoke("get_process_details", { pid });
}

export async function getProcessTree(pid: number): Promise<ProcessTreeNode> {
  return invoke("get_process_tree", { pid });
}

export async function getNetworkConnections(): Promise<NetworkConnection[]> {
  return invoke("get_network_connections");
}

export async function addPortWatch(port: number, watchType: PortWatchType, notify: boolean): Promise<PortWatch> {
  return invoke("add_port_watch", { port, watchType, notify });
}

export async function removePortWatch(watchId: string): Promise<void> {
  return invoke("remove_port_watch", { watchId });
}

export async function getPortWatches(): Promise<PortWatch[]> {
  return invoke("get_port_watches");
}

export async function getPortHistory(port?: number, limit?: number): Promise<PortHistoryEntry[]> {
  return invoke("get_port_history", { port, limit });
}

export async function getCommonDevPorts(): Promise<number[]> {
  return invoke("get_common_dev_ports");
}

// ==================== Today Summary commands ====================

export async function getTodaySummary(): Promise<TodaySummary> {
  return invoke("get_today_summary");
}

// ==================== Time Insights commands ====================

export async function getDailyTimeSummary(date?: string): Promise<DailyProjectTime[]> {
  return invoke("get_daily_time_summary", { date });
}

export async function getWeeklyTimeSummary(weekOffset?: number): Promise<WeeklySummary> {
  return invoke("get_weekly_time_summary", { weekOffset });
}

export async function getTimeStreaks(): Promise<TimeStreaks> {
  return invoke("get_time_streaks");
}

// ==================== Project Pinning commands ====================

export async function pinProject(projectName: string): Promise<void> {
  return invoke("pin_project", { projectName });
}

export async function unpinProject(projectName: string): Promise<void> {
  return invoke("unpin_project", { projectName });
}

export async function getPinnedProjects(): Promise<string[]> {
  return invoke("get_pinned_projects");
}

// ==================== Process Manager commands ====================

export async function launchProject(options: LaunchOptions): Promise<LaunchResult> {
  return invoke("launch_project", { options });
}

export async function stopProject(pid: number): Promise<void> {
  return invoke("stop_project", { pid });
}

export async function getManagedProcesses(): Promise<ManagedProcess[]> {
  return invoke("get_managed_processes");
}

export async function getProcessLogs(pid: number): Promise<LogLine[]> {
  return invoke("get_process_logs", { pid });
}

export async function clearProcessLogs(pid: number): Promise<void> {
  return invoke("clear_process_logs", { pid });
}

export async function removeManagedProcess(pid: number): Promise<void> {
  return invoke("remove_managed_process", { pid });
}

export async function detectProjectPort(projectPath: string): Promise<number | null> {
  return invoke("detect_project_port", { projectPath });
}

// ==================== Workspace commands ====================

export async function listWorkspaces(): Promise<WorkspaceWithProjects[]> {
  return invoke("list_workspaces");
}

export async function createWorkspace(name: string): Promise<Workspace> {
  return invoke("create_workspace", { name });
}

export async function deleteWorkspace(id: number): Promise<void> {
  return invoke("delete_workspace", { id });
}

export async function updateWorkspace(id: number, name: string): Promise<void> {
  return invoke("update_workspace", { id, name });
}

export async function addProjectToWorkspace(workspaceId: number, projectName: string): Promise<void> {
  return invoke("add_project_to_workspace", { workspaceId, projectName });
}

export async function removeProjectFromWorkspace(workspaceId: number, projectName: string): Promise<void> {
  return invoke("remove_project_from_workspace", { workspaceId, projectName });
}

export async function startWorkspace(workspaceId: number): Promise<string[]> {
  return invoke("start_workspace", { workspaceId });
}

export async function stopWorkspace(workspaceId: number): Promise<void> {
  return invoke("stop_workspace", { workspaceId });
}

// ==================== Env Manager commands ====================

export async function listProjectEnvFiles(projectPath: string): Promise<EnvFile[]> {
  return invoke("list_project_env_files", { projectPath });
}

export async function readEnvFile(path: string): Promise<EnvFile> {
  return invoke("read_env_file", { path });
}

export async function writeEnvVariable(path: string, key: string, value: string): Promise<void> {
  return invoke("write_env_variable", { path, key, value });
}

export async function copyEnvVariables(sourcePath: string, targetPath: string, keys: string[]): Promise<void> {
  return invoke("copy_env_variables", { sourcePath, targetPath, keys });
}

// ==================== Disk Trend commands ====================

export async function getDiskTrend(days?: number): Promise<DiskScanHistoryEntry[]> {
  return invoke("get_disk_trend", { days });
}

// ==================== Tray commands ====================

export async function getTrayData(): Promise<TrayData> {
  return invoke("get_tray_data");
}

export async function resizeTrayPopup(height: number): Promise<void> {
  return invoke("resize_tray_popup", { height });
}

export async function startWorking(
  projectName: string,
  openEditor: boolean,
  startTimer: boolean,
  launchDev: boolean
): Promise<void> {
  return invoke("start_working", { projectName, openEditor, startTimer, launchDev });
}

export async function stopTrayProcess(pid: number): Promise<void> {
  return invoke("stop_tray_process", { pid });
}
