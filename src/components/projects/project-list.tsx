import { useState, useMemo, useCallback } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useAppStore } from "@/stores/app-store";
import { ProjectCard } from "@/components/shared/project-card";
import { Search, Filter } from "lucide-react";
import type { ProjectLocation } from "@/types";

export function ProjectList() {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<ProjectLocation | "all">("all");
  const { data: allProjects, isLoading } = useProjects(
    locationFilter === "all" ? undefined : locationFilter
  );
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);

  const filteredProjects = useMemo(() => {
    if (!allProjects) return [];
    if (!search) return allProjects;
    const searchLower = search.toLowerCase();
    return allProjects.filter((project) =>
      project.name.toLowerCase().includes(searchLower) ||
      project.project_type?.toLowerCase().includes(searchLower)
    );
  }, [allProjects, search]);

  const handleProjectClick = useCallback((name: string) => {
    setSelectedProject(name);
  }, [setSelectedProject]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value as ProjectLocation | "all")}
            className="bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.path}
              project={project}
              onClick={() => handleProjectClick(project.name)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {search ? "No projects match your search" : "No projects found"}
          </p>
        </div>
      )}
    </div>
  );
}
