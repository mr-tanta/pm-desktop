import { useState } from "react";
import { useProject, useProjectDiskInfo } from "@/hooks/use-projects";
import { useStartTimer, useActiveTimer } from "@/hooks/use-timer";
import { useProjectPorts } from "@/hooks/use-port-manager";
import { useConfig } from "@/hooks/use-system";
import { useAppStore } from "@/stores/app-store";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { ProjectTypeBadge, LocationBadge } from "@/components/shared/status-badge";
import {
  openInEditor,
  openInTerminal,
  openInFinder,
  archiveProject,
  restoreProject,
  deleteProject,
} from "@/lib/tauri";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Terminal,
  FolderOpen,
  Timer,
  Package,
  FileCode,
  Container,
  FileKey,
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  HardDrive,
  RefreshCw,
  Globe,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Circle,
  FileEdit,
  Files,
  Eye,
} from "lucide-react";
import { ProjectTimeHistory } from "./project-time-history";
import { ProjectPorts } from "./project-ports";
import { ProjectScripts } from "./project-scripts";
import { EnvManager } from "./env-manager";
import { LaunchButton } from "@/components/shared/launch-button";
import { LogViewer } from "@/components/shared/log-viewer";
import { useProjectProcess } from "@/hooks/use-process-manager";
import type { DiskSizeInfo } from "@/types";

export function ProjectDetail() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const setView = useAppStore((s) => s.setView);
  const { data: project, isLoading } = useProject(selectedProject);
  const { data: config } = useConfig();
  const { data: activeTimer } = useActiveTimer();
  const startTimerMutation = useStartTimer();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showFullDiskInfo, setShowFullDiskInfo] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(true);

  // Fetch detailed disk info with all directories included
  const { data: diskInfo, isLoading: diskInfoLoading, refetch: refetchDiskInfo } = useProjectDiskInfo(
    selectedProject,
    showFullDiskInfo
      ? { include_node_modules: true, include_git: true, include_target: true }
      : undefined
  );

  const { data: projectPorts } = useProjectPorts(selectedProject);
  const runningProcess = useProjectProcess(selectedProject);
  const editor = config?.default_editor || "cursor";
  const lowestPort = projectPorts?.length ? Math.min(...projectPorts.map((p) => p.port)) : null;

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(project!.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", project!.name] });
      setSelectedProject(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreProject(project!.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", project!.name] });
      setSelectedProject(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(project!.name, project!.location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProject(null);
      setView("projects");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-card rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-card rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const isTimerActive = activeTimer?.project_name === project.name;

  const handleStartTimer = () => {
    if (!isTimerActive) {
      startTimerMutation.mutate(project.name);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSelectedProject(null)}
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <LocationBadge location={project.location} />
            <ProjectTypeBadge type={project.project_type} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{project.path}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => openInEditor(project.path, editor)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <ExternalLink className="h-4 w-4" />
          Open in {editor}
        </button>
        <button
          onClick={() => openInTerminal(project.path)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
        >
          <Terminal className="h-4 w-4" />
          Terminal
        </button>
        <button
          onClick={() => openInFinder(project.path)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
        >
          <FolderOpen className="h-4 w-4" />
          Finder
        </button>
        {lowestPort && (
          <button
            onClick={() => openUrl(`http://localhost:${lowestPort}`)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
          >
            <Globe className="h-4 w-4" />
            Open in Browser
          </button>
        )}
        <LaunchButton
          projectName={project.name}
          projectPath={project.path}
          size="md"
        />
        <button
          onClick={handleStartTimer}
          disabled={isTimerActive}
          className={`flex items-center gap-2 px-4 py-2 rounded-md ${
            isTimerActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-not-allowed"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          <Timer className="h-4 w-4" />
          {isTimerActive ? "Timer Running" : "Start Timer"}
        </button>

        <div className="flex-1" />

        {/* Archive Management */}
        {project.location === "active" ? (
          <button
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/50 disabled:opacity-50"
          >
            {archiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archive
          </button>
        ) : (
          <button
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
          >
            {restoreMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Restore
          </button>
        )}

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Delete Project</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete <strong>{project.name}</strong> and all its files.
                  This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="p-1 hover:bg-secondary rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-muted-foreground mb-2">
                Type <strong>{project.name}</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={project.name}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate();
                  setShowDeleteConfirm(false);
                }}
                disabled={deleteConfirmText !== project.name || deleteMutation.isPending}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Git Status */}
      {project.git_status && (
        <div className="rounded-lg bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Git Status</h3>
            </div>
            <button
              onClick={() => openInEditor(project.path, editor)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Open in editor"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Editor
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {project.git_status.branch && (
              <div className="rounded-md bg-secondary/50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <GitBranch className="h-3 w-3" />
                  Branch
                </div>
                <div className="text-sm font-medium truncate">{project.git_status.branch}</div>
              </div>
            )}
            {project.git_status.staged_count > 0 && (
              <div className="rounded-md bg-green-500/5 border border-green-500/10 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mb-1">
                  <Files className="h-3 w-3" />
                  Staged
                </div>
                <div className="text-sm font-medium">{project.git_status.staged_count}</div>
              </div>
            )}
            {project.git_status.modified_count > 0 && (
              <div className="rounded-md bg-yellow-500/5 border border-yellow-500/10 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 mb-1">
                  <FileEdit className="h-3 w-3" />
                  Modified
                </div>
                <div className="text-sm font-medium">{project.git_status.modified_count}</div>
              </div>
            )}
            {project.git_status.untracked_count > 0 && (
              <div className="rounded-md bg-secondary/50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Eye className="h-3 w-3" />
                  Untracked
                </div>
                <div className="text-sm font-medium">{project.git_status.untracked_count}</div>
              </div>
            )}
            {project.git_status.ahead > 0 && (
              <div className="rounded-md bg-green-500/5 border border-green-500/10 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mb-1">
                  <ArrowUp className="h-3 w-3" />
                  Ahead
                </div>
                <div className="text-sm font-medium">{project.git_status.ahead}</div>
              </div>
            )}
            {project.git_status.behind > 0 && (
              <div className="rounded-md bg-orange-500/5 border border-orange-500/10 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 mb-1">
                  <ArrowDown className="h-3 w-3" />
                  Behind
                </div>
                <div className="text-sm font-medium">{project.git_status.behind}</div>
              </div>
            )}
            {!project.git_status.is_dirty && project.git_status.ahead === 0 && project.git_status.behind === 0 && (
              <div className="rounded-md bg-green-500/5 border border-green-500/10 px-3 py-2 col-span-2 sm:col-span-3">
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <Circle className="h-2 w-2 fill-current" />
                  Clean — working tree is up to date
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Running Ports */}
      <ProjectPorts projectName={project.name} />

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium mb-3">Project Info</h3>
          <dl className="space-y-2 text-sm">
            {project.last_modified && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last Modified</dt>
                <dd>{formatRelativeTime(project.last_modified)}</dd>
              </div>
            )}
            {project.created_at && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatRelativeTime(project.created_at)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium mb-3">Features</h3>
          <div className="grid grid-cols-2 gap-2">
            <Feature icon={Package} label="package.json" active={project.has_package_json} />
            <Feature icon={FileCode} label="Cargo.toml" active={project.has_cargo_toml} />
            <Feature icon={Container} label="Docker" active={project.has_docker} />
            <Feature icon={FileKey} label=".env file" active={project.has_env_file} />
          </div>
        </div>
      </div>

      {/* Log Viewer */}
      {runningProcess && showLogViewer && (
        <LogViewer
          pid={runningProcess.pid}
          projectName={project.name}
          onClose={() => setShowLogViewer(false)}
        />
      )}

      {/* Env Manager */}
      {project.has_env_file && <EnvManager projectPath={project.path} />}

      {/* Scripts Section */}
      <ProjectScripts projectPath={project.path} hasPackageJson={project.has_package_json} />

      {/* Disk Usage Section */}
      <div className="rounded-lg bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Disk Usage</h3>
            {diskInfoLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchDiskInfo()}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Refresh disk info"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showFullDiskInfo}
                onChange={(e) => setShowFullDiskInfo(e.target.checked)}
                className="rounded border-border"
              />
              Include all directories
            </label>
          </div>
        </div>

        {diskInfo ? (
          <DiskUsageBreakdown info={diskInfo} showFull={showFullDiskInfo} />
        ) : (
          <div className="text-sm text-muted-foreground">
            {diskInfoLoading ? "Calculating..." : "No disk info available"}
          </div>
        )}
      </div>

      {/* Time History */}
      <ProjectTimeHistory projectName={project.name} />

      {project.readme_preview && (
        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium mb-3">README Preview</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {project.readme_preview}
          </p>
        </div>
      )}
    </div>
  );
}

function Feature({ icon: Icon, label, active }: { icon: typeof Package; label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 text-sm ${
        active ? "text-foreground" : "text-muted-foreground/50"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

function DiskUsageBreakdown({ info, showFull }: { info: DiskSizeInfo; showFull: boolean }) {
  const items = [
    { label: "Source Code", bytes: info.source_bytes, color: "bg-blue-500" },
    ...(showFull
      ? [
          { label: "node_modules", bytes: info.node_modules_bytes, color: "bg-yellow-500" },
          { label: ".git", bytes: info.git_bytes, color: "bg-purple-500" },
          { label: "target", bytes: info.target_bytes, color: "bg-orange-500" },
        ]
      : []),
  ].filter((item) => item.bytes > 0);

  const total = showFull ? info.total_bytes : info.source_bytes;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">{info.formatted}</div>
        <div className="text-xs text-muted-foreground">
          {info.file_count.toLocaleString()} files • {info.dir_count.toLocaleString()} directories
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
        {items.map((item, i) => {
          const percent = total > 0 ? (item.bytes / total) * 100 : 0;
          return (
            <div
              key={i}
              className={`${item.color} transition-all duration-300`}
              style={{ width: `${percent}%` }}
              title={`${item.label}: ${formatBytes(item.bytes)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${item.color}`} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
            <span className="font-mono text-xs">{formatBytes(item.bytes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
