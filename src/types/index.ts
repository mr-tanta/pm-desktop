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
