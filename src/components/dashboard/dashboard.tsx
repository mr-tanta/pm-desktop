import { useMemo } from "react";
import { SystemMetrics } from "./system-metrics";
import { ProjectsGrid } from "./projects-grid";
import { useAppStore } from "@/stores/app-store";
import { useProjects } from "@/hooks/use-projects";

export function Dashboard() {
  const setView = useAppStore((s) => s.setView);
  // Single query for all projects - ProjectsGrid will reuse this cached data
  const { data: allProjects } = useProjects();

  const stats = useMemo(() => {
    if (!allProjects) return { active: 0, archived: 0, dirty: 0 };
    const active = allProjects.filter((p) => p.location === "active");
    const archived = allProjects.filter((p) => p.location === "archived");
    const dirty = active.filter((p) => p.git_status?.is_dirty).length;
    return { active: active.length, archived: archived.length, dirty };
  }, [allProjects]);

  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">System</h2>
        <SystemMetrics />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Projects</h2>
          <button
            onClick={() => setView("projects")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View all ({stats.active})
          </button>
        </div>
        <ProjectsGrid projects={allProjects?.filter((p) => p.location === "active")} />
      </section>

      <section className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Active Projects</h3>
          <p className="mt-2 text-3xl font-semibold">{stats.active}</p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Archived</h3>
          <p className="mt-2 text-3xl font-semibold">{stats.archived}</p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">With Git Changes</h3>
          <p className="mt-2 text-3xl font-semibold">{stats.dirty}</p>
        </div>
      </section>
    </div>
  );
}
