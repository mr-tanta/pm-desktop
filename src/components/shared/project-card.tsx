import { memo, useCallback } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Project } from "@/types";
import { GitStatusBadge, ProjectTypeBadge } from "./status-badge";
import { Folder, Clock, ExternalLink, Terminal, FolderOpen } from "lucide-react";
import { openInEditor, openInTerminal, openInFinder } from "@/lib/tauri";
import { useConfig } from "@/hooks/use-system";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  className?: string;
}

export const ProjectCard = memo(function ProjectCard({ project, onClick, className }: ProjectCardProps) {
  const { data: config } = useConfig();
  const editor = config?.default_editor || "cursor";

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

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border border-border bg-card p-4",
        "hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="font-medium truncate">{project.name}</h3>
        </div>
        <ProjectTypeBadge type={project.project_type} />
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
        </div>
      </div>
    </div>
  );
});
