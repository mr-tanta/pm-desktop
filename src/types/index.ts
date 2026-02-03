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
