import { invoke } from "@tauri-apps/api/core";
import type {
  Project,
  ProjectDetail,
  ProjectLocation,
  SystemInfo,
  Config,
  ActiveTimer,
  TimeEntry,
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

// System commands
export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke("get_system_info");
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
