import { useTodaySummary } from "@/hooks/use-today";
import { useActiveTimer, useStopTimer } from "@/hooks/use-timer";
import { useAppStore } from "@/stores/app-store";
import { useProcessManagerStore } from "@/stores/process-manager-store";
import { formatDuration } from "@/lib/utils";
import { AttentionList } from "./attention-list";
import { RecentProjectsStrip } from "./recent-projects-strip";
import { DailySummary } from "./daily-summary";
import { StartWorkingCard } from "./start-working-card";
import { RunningProjects } from "./running-projects";
import { LogViewer } from "@/components/shared/log-viewer";
import { Timer, Square, Folder, Network, HardDrive } from "lucide-react";

export function Dashboard() {
  const { data: summary, isLoading } = useTodaySummary();
  const { data: activeTimer } = useActiveTimer();
  const stopTimer = useStopTimer();
  const setView = useAppStore((s) => s.setView);
  const activeLogPid = useProcessManagerStore((s) => s.activeLogPid);
  const setActiveLogPid = useProcessManagerStore((s) => s.setActiveLogPid);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-10 w-64 bg-card rounded animate-pulse" />
        <div className="h-32 bg-card rounded animate-pulse" />
        <div className="h-48 bg-card rounded animate-pulse" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Failed to load today's summary.</p>
      </div>
    );
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 space-y-6">
      {/* Greeting + Timer Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{summary.greeting}</h1>
          <p className="text-sm text-muted-foreground mt-1">{dateStr}</p>
        </div>
        {activeTimer && (
          <button
            onClick={() => stopTimer.mutate()}
            className="flex items-center gap-3 px-4 py-2 rounded-lg bg-green-50 border border-green-300 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800/50 dark:hover:bg-green-900/30 transition-colors group"
          >
            <Timer className="h-4 w-4 text-green-600 dark:text-green-400" />
            <div className="text-left">
              <div className="text-sm font-medium">{activeTimer.project_name}</div>
              <div className="text-xs text-green-600 dark:text-green-400 font-mono">
                {formatDuration(activeTimer.elapsed_seconds)}
              </div>
            </div>
            <Square className="h-3.5 w-3.5 text-muted-foreground group-hover:text-red-400 transition-colors" />
          </button>
        )}
      </div>

      {/* Currently Running */}
      <RunningProjects />

      {/* Active Log Viewer */}
      {activeLogPid && (
        <LogViewer
          pid={activeLogPid}
          projectName=""
          onClose={() => setActiveLogPid(null)}
        />
      )}

      {/* Start Working (only when no timer active) */}
      <StartWorkingCard projects={summary.recent_projects} />

      {/* Attention Cards */}
      <AttentionList items={summary.attention_items} />

      {/* Projects Strip */}
      <RecentProjectsStrip projects={summary.recent_projects} />

      {/* Daily Summary */}
      <DailySummary
        todayTime={summary.today_time}
        weeklyOverview={summary.weekly_overview}
      />

      {/* Quick Stats Footer */}
      <div className="flex items-center gap-6 pt-2 border-t border-border">
        <button
          onClick={() => setView("projects")}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Folder className="h-3.5 w-3.5" />
          {summary.recent_projects.length} active projects
        </button>
        <button
          onClick={() => setView("port-manager")}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Network className="h-3.5 w-3.5" />
          {summary.active_ports_count} ports running
        </button>
        <button
          onClick={() => setView("disk-manager")}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <HardDrive className="h-3.5 w-3.5" />
          Disk Manager
        </button>
      </div>
    </div>
  );
}
