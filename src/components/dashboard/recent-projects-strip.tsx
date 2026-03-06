import { memo, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { useConfig } from "@/hooks/use-system";
import { usePinnedProjects } from "@/hooks/use-projects";
import { openInEditor, openInTerminal } from "@/lib/tauri";
import { LaunchButton } from "@/components/shared/launch-button";
import { Folder, ExternalLink, Terminal, Star, Clock } from "lucide-react";
import { formatRelativeTime, getProjectTypeColor } from "@/lib/utils";
import type { Project } from "@/types";

interface RecentProjectsStripProps {
  projects: Project[];
}

export const RecentProjectsStrip = memo(function RecentProjectsStrip({ projects }: RecentProjectsStripProps) {
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const setView = useAppStore((s) => s.setView);
  const { data: config } = useConfig();
  const { data: pinnedNames } = usePinnedProjects();
  const editor = config?.default_editor || "cursor";

  const pinnedSet = new Set(pinnedNames || []);

  // Sort: pinned first, then by last_modified
  const sortedProjects = [...projects].sort((a, b) => {
    const aPinned = pinnedSet.has(a.name);
    const bPinned = pinnedSet.has(b.name);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  const handleOpenEditor = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      openInEditor(path, editor);
    },
    [editor]
  );

  const handleOpenTerminal = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      openInTerminal(path);
    },
    []
  );

  if (sortedProjects.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">No projects yet</p>
        <button
          onClick={() => setView("create-project")}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Create your first project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Projects</h3>
        <button
          onClick={() => setView("projects")}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {sortedProjects.map((project) => {
          const isPinned = pinnedSet.has(project.name);
          return (
            <div
              key={project.name}
              onClick={() => setSelectedProject(project.name)}
              className="flex-shrink-0 w-56 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent hover:border-muted-foreground/30 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                {isPinned && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium truncate flex-1">{project.name}</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {project.project_type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getProjectTypeColor(project.project_type)}`}>
                    {project.project_type}
                  </span>
                )}
                {project.git_status?.branch && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {project.git_status.branch}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                {project.last_modified && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelativeTime(project.last_modified)}
                  </span>
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleOpenEditor(e, project.path)}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title={`Open in ${editor}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleOpenTerminal(e, project.path)}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Terminal"
                  >
                    <Terminal className="h-3 w-3" />
                  </button>
                  <LaunchButton
                    projectName={project.name}
                    projectPath={project.path}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
