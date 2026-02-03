import { memo, useCallback } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Project } from "@/types";
import { GitStatusBadge, ProjectTypeBadge } from "./status-badge";
import { Folder, Clock, ExternalLink, Terminal, FolderOpen, Archive, RotateCcw } from "lucide-react";
import { openInEditor, openInTerminal, openInFinder, archiveProject, restoreProject } from "@/lib/tauri";
import { useConfig } from "@/hooks/use-system";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  className?: string;
}

export const ProjectCard = memo(function ProjectCard({ project, onClick, className }: ProjectCardProps) {
  const { data: config } = useConfig();
  const queryClient = useQueryClient();
  const editor = config?.default_editor || "cursor";

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(project.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreProject(project.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const handleOpenEditor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openInEditor(project.path, editor);
  }, [project.path, editor]);

  const handleOpenTerminal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openInTerminal(project.path);
  }, [project.path]);

  const handleOpenFinder = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openInFinder(project.path);
  }, [project.path]);

  const handleArchive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    archiveMutation.mutate();
  }, [archiveMutation]);

  const handleRestore = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    restoreMutation.mutate();
  }, [restoreMutation]);

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card p-4",
        "hover:bg-zinc-900/50 transition-colors cursor-pointer",
        project.location === "archived"
          ? "border-yellow-900/50 bg-yellow-950/10"
          : "border-border hover:border-zinc-600",
        className
      )}
      onClick={onClick}
    >
      {project.location === "archived" && (
        <div className="absolute top-2 right-2">
          <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-900/30 px-2 py-0.5 rounded-full">
            <Archive className="h-3 w-3" />
            Archived
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="font-medium truncate">{project.name}</h3>
        </div>
        {project.location !== "archived" && <ProjectTypeBadge type={project.project_type} />}
      </div>

      {project.git_status && (
        <div className="mt-2">
          <GitStatusBadge status={project.git_status} />
        </div>
      )}

      <div className="mt-auto pt-3 flex items-center justify-between">
        {project.last_modified && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(project.last_modified)}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpenEditor}
            className="p-1.5 rounded-md hover:bg-zinc-700 text-muted-foreground hover:text-foreground"
            title={`Open in ${editor}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleOpenTerminal}
            className="p-1.5 rounded-md hover:bg-zinc-700 text-muted-foreground hover:text-foreground"
            title="Open in Terminal"
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleOpenFinder}
            className="p-1.5 rounded-md hover:bg-zinc-700 text-muted-foreground hover:text-foreground"
            title="Open in Finder"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          {project.location === "active" ? (
            <button
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              className="p-1.5 rounded-md hover:bg-yellow-900/50 text-muted-foreground hover:text-yellow-500 disabled:opacity-50"
              title="Archive project"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
              className="p-1.5 rounded-md hover:bg-blue-900/50 text-muted-foreground hover:text-blue-400 disabled:opacity-50"
              title="Restore project"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
