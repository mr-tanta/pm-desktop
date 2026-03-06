import { useCallback } from "react";
import { useConfig } from "@/hooks/use-system";
import { useStartTimer, useActiveTimer } from "@/hooks/use-timer";
import { usePinnedProjects } from "@/hooks/use-projects";
import { useLaunchProject } from "@/hooks/use-process-manager";
import { openInEditor } from "@/lib/tauri";
import { Play, Rocket } from "lucide-react";
import type { Project } from "@/types";

interface StartWorkingCardProps {
  projects: Project[];
}

export function StartWorkingCard({ projects }: StartWorkingCardProps) {
  const { data: config } = useConfig();
  const { data: activeTimer } = useActiveTimer();
  const startTimer = useStartTimer();
  const launchProject = useLaunchProject();
  const { data: pinnedNames } = usePinnedProjects();
  const editor = config?.default_editor || "cursor";

  const pinnedSet = new Set(pinnedNames || []);

  // Show pinned projects first, then recent
  const quickLaunchProjects = [...projects]
    .sort((a, b) => {
      const aPinned = pinnedSet.has(a.name);
      const bPinned = pinnedSet.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    })
    .slice(0, 4);

  const handleStartWorking = useCallback(
    async (project: Project) => {
      openInEditor(project.path, editor);
      if (!activeTimer) {
        startTimer.mutate(project.name);
      }
      // Also launch the dev server
      launchProject.mutate({
        project_path: project.path,
        script: null,
        port: null,
      });
    },
    [editor, activeTimer, startTimer, launchProject]
  );

  if (activeTimer || quickLaunchProjects.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">Start Working</h3>
      </div>
      <div className="flex gap-2 flex-wrap">
        {quickLaunchProjects.map((project) => (
          <button
            key={project.name}
            onClick={() => handleStartWorking(project)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-colors text-sm"
          >
            <Play className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span>{project.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
