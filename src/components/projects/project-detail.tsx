import { useProject } from "@/hooks/use-projects";
import { useStartTimer, useActiveTimer } from "@/hooks/use-timer";
import { useConfig } from "@/hooks/use-system";
import { useAppStore } from "@/stores/app-store";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { GitStatusBadge, ProjectTypeBadge, LocationBadge } from "@/components/shared/status-badge";
import { openInEditor, openInTerminal, openInFinder } from "@/lib/tauri";
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
} from "lucide-react";

export function ProjectDetail() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const { data: project, isLoading } = useProject(selectedProject);
  const { data: config } = useConfig();
  const { data: activeTimer } = useActiveTimer();
  const startTimerMutation = useStartTimer();

  const editor = config?.default_editor || "cursor";

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
      </div>

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
