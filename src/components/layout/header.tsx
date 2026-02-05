import { useAppStore } from "@/stores/app-store";
import { formatDuration } from "@/lib/utils";
import { useActiveTimer, useStopTimer } from "@/hooks/use-timer";
import { Timer, Square, Search, Settings, ZoomIn, ZoomOut, Sun, Moon } from "lucide-react";

export function Header() {
  const { currentView, setView, zoomLevel, zoomIn, zoomOut, resetZoom, theme, toggleTheme } = useAppStore();
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
          {currentView === "archive" && "Archive"}
          {currentView === "disk-manager" && "Disk Manager"}
          {currentView === "port-manager" && "Port Manager"}
          {currentView === "permissions" && "Permissions"}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
          <button
            onClick={zoomOut}
            disabled={zoomLevel <= 50}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom out (Cmd+-)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={resetZoom}
            className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary rounded min-w-[40px] text-center"
            title="Reset zoom"
          >
            {zoomLevel}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoomLevel >= 150}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom in (Cmd++)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
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
