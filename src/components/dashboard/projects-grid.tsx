import { memo, useCallback, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { ProjectCard } from "@/components/shared/project-card";
import type { Project } from "@/types";

interface ProjectsGridProps {
  projects?: Project[];
}

export const ProjectsGrid = memo(function ProjectsGrid({ projects }: ProjectsGridProps) {
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);

  const handleProjectClick = useCallback((name: string) => {
    setSelectedProject(name);
  }, [setSelectedProject]);

  const recentProjects = useMemo(() => {
    return projects?.slice(0, 6) ?? [];
  }, [projects]);

  if (!projects) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (recentProjects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No active projects</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {recentProjects.map((project) => (
        <ProjectCard
          key={project.name}
          project={project}
          onClick={() => handleProjectClick(project.name)}
        />
      ))}
    </div>
  );
});
