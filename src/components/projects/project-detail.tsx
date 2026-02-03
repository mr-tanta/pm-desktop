import { useState } from "react";
import { useProject } from "@/hooks/use-projects";
import { useStartTimer, useActiveTimer } from "@/hooks/use-timer";
import { useConfig } from "@/hooks/use-system";
import { useAppStore } from "@/stores/app-store";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { GitStatusBadge, ProjectTypeBadge, LocationBadge } from "@/components/shared/status-badge";
import {
  openInEditor,
  openInTerminal,
  openInFinder,
  archiveProject,
  restoreProject,
  deleteProject,
} from "@/lib/tauri";
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
} from "lucide-react";

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

  const editor = config?.default_editor || "cursor";

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
        <button
          onClick={handleStartTimer}
          disabled={isTimerActive}
          className={`flex items-center gap-2 px-4 py-2 rounded-md ${
            isTimerActive
              ? "bg-green-900/30 text-green-400 cursor-not-allowed"
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
            className="flex items-center gap-2 px-4 py-2 bg-yellow-900/30 text-yellow-500 rounded-md hover:bg-yellow-900/50 disabled:opacity-50"
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 text-blue-400 rounded-md hover:bg-blue-900/50 disabled:opacity-50"
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
          className="flex items-center gap-2 px-4 py-2 bg-red-900/30 text-red-400 rounded-md hover:bg-red-900/50"
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
              <div className="p-2 bg-red-900/30 rounded-lg">
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

      {project.git_status && (
        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium mb-3">Git Status</h3>
          <GitStatusBadge status={project.git_status} className="text-sm" />
        </div>
      )}

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
            {project.disk_size && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Size (excl. deps)</dt>
                <dd>{formatBytes(project.disk_size)}</dd>
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

      {project.readme_preview && (
        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium mb-3">README Preview</h3>
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
            {project.readme_preview}
            {project.readme_preview.length >= 500 && "..."}
          </pre>
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
