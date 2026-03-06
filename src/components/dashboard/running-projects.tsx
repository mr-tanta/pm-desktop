import { useManagedProcesses, useStopProject } from "@/hooks/use-process-manager";
import { useAppStore } from "@/stores/app-store";
import { useProcessManagerStore } from "@/stores/process-manager-store";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Activity, Globe, ScrollText, ChevronRight, Square } from "lucide-react";

export function RunningProjects() {
  const { data: processes } = useManagedProcesses();
  const stopProject = useStopProject();
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const setActiveLogPid = useProcessManagerStore((s) => s.setActiveLogPid);

  const running = processes?.filter(
    (p) => p.status === "running" || p.status === "starting"
  );

  if (!running || running.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-green-500" />
        <h3 className="text-sm font-medium text-muted-foreground">Currently Running</h3>
        <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
          {running.length}
        </span>
      </div>
      <div className="space-y-2">
        {running.map((proc) => (
          <div
            key={proc.pid}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{proc.project_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {proc.command}
                {proc.port && <span className="ml-1">:{proc.port}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {proc.port && (
                <button
                  onClick={() => openUrl(`http://localhost:${proc.port}`)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Open in browser"
                >
                  <Globe className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setActiveLogPid(proc.pid)}
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="View logs"
              >
                <ScrollText className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setSelectedProject(proc.project_name)}
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Go to project"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => stopProject.mutate(proc.pid)}
                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500"
                title="Stop"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
