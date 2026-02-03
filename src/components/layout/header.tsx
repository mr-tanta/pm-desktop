import { useAppStore } from "@/stores/app-store";
import { formatDuration } from "@/lib/utils";
import { useActiveTimer, useStopTimer } from "@/hooks/use-timer";
import { Timer, Square, Search, Settings } from "lucide-react";

export function Header() {
  const { currentView, setView } = useAppStore();
  const { data: activeTimer } = useActiveTimer();
  const stopTimerMutation = useStopTimer();

  const handleStopTimer = () => {
    stopTimerMutation.mutate();
  };

  return (
    <header
      className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-4" data-tauri-drag-region>
        <div className="w-[70px]" /> {/* Space for traffic lights */}
        <h1 className="text-sm font-semibold" data-tauri-drag-region>
          {currentView === "dashboard" && "Dashboard"}
          {currentView === "projects" && "Projects"}
          {currentView === "settings" && "Settings"}
          {currentView === "project-detail" && "Project"}
          {currentView === "create-project" && "New Project"}
          {currentView === "statistics" && "Statistics"}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {activeTimer && (
          <div className="flex items-center gap-2 bg-green-900/30 text-green-400 px-3 py-1 rounded-full text-sm">
            <Timer className="h-3.5 w-3.5" />
            <span className="font-mono">
              {formatDuration(activeTimer.elapsed_seconds)}
            </span>
            <span className="text-green-500/70">
              {activeTimer.project_name}
            </span>
            <button
              onClick={handleStopTimer}
              className="ml-1 p-0.5 hover:bg-green-800/50 rounded"
              title="Stop timer"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          </div>
        )}

        <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
          <Search className="h-4 w-4" />
        </button>

        <button
          onClick={() => setView("settings")}
          className={`p-2 rounded-md hover:bg-secondary ${
            currentView === "settings" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
