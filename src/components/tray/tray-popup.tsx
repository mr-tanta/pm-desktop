import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Timer,
  Square,
  Play,
  ChevronRight,
  ChevronDown,
  AppWindow,
  Power,
  Star,
  StopCircle,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrayData, ManagedProcess } from "@/types";
import { getTrayData, resizeTrayPopup, startWorking, stopTrayProcess } from "@/lib/tauri";

// Set transparent background for tray popup window only
if (typeof document !== "undefined" && window.location.hash === "#tray") {
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.body.style.margin = "0";
  document.body.style.padding = "8px";
  document.body.style.height = "100vh";
  document.body.style.boxSizing = "border-box";
}

export function TrayPopup() {
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);
  const [localElapsed, setLocalElapsed] = useState<number>(0);
  const [expandedTimer, setExpandedTimer] = useState(false);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState(false);

  // Single query for all tray data — no polling
  const { data, isLoading } = useQuery<TrayData>({
    queryKey: ["tray-data"],
    queryFn: getTrayData,
    staleTime: 5000,
  });

  // Event-driven refresh
  useEffect(() => {
    const unlisteners: Promise<() => void>[] = [];
    unlisteners.push(
      listen("tray-state-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["tray-data"] });
      })
    );
    unlisteners.push(
      listen("process-crashed", () => {
        queryClient.invalidateQueries({ queryKey: ["tray-data"] });
      })
    );
    return () => {
      unlisteners.forEach((u) => u.then((fn) => fn()));
    };
  }, [queryClient]);

  // Sync local elapsed with timer data
  useEffect(() => {
    if (data?.timer) {
      setLocalElapsed(data.timer.elapsed_seconds);
    }
  }, [data?.timer?.elapsed_seconds, data?.timer?.project_name]);

  // Local timer tick for smooth second updates
  useEffect(() => {
    if (!data?.timer) return;
    const interval = setInterval(() => {
      setLocalElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.timer?.project_name]);

  // Dynamic sizing with ResizeObserver
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height + 16; // padding
        resizeTrayPopup(height).catch(() => {});
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWindow().hide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Refetch on window focus/show
  useEffect(() => {
    const unlisten = listen("tauri://focus", () => {
      queryClient.invalidateQueries({ queryKey: ["tray-data"] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStopTimer = useCallback(async () => {
    try {
      await invoke("stop_timer");
      queryClient.invalidateQueries({ queryKey: ["tray-data"] });
    } catch {}
  }, [queryClient]);

  const handleStartTimer = useCallback(
    async (project: string) => {
      try {
        await invoke("start_timer", { projectName: project });
        queryClient.invalidateQueries({ queryKey: ["tray-data"] });
        setExpandedTimer(false);
      } catch {}
    },
    [queryClient]
  );

  const handleStartWorking = useCallback(
    async (project: string) => {
      try {
        await startWorking(project, true, true, true);
        getCurrentWindow().hide();
      } catch {}
    },
    []
  );

  const handleStopProcess = useCallback(async (pid: number) => {
    try {
      await stopTrayProcess(pid);
    } catch {}
  }, []);

  const handleStopAll = useCallback(async () => {
    if (!data?.processes) return;
    const running = data.processes.filter(
      (p) => p.status === "running" || p.status === "starting"
    );
    for (const proc of running) {
      try {
        await stopTrayProcess(proc.pid);
      } catch {}
    }
  }, [data?.processes]);

  const handleOpenProject = useCallback(async (projectName: string) => {
    try {
      await invoke("emit_open_project", { projectName });
      getCurrentWindow().hide();
    } catch {}
  }, []);

  const handleShowWindow = useCallback(async () => {
    await invoke("show_main_window");
    getCurrentWindow().hide();
  }, []);

  const handleQuit = useCallback(async () => {
    await invoke("quit_app");
  }, []);

  const handleStartWorkspace = useCallback(
    async (workspaceId: number) => {
      try {
        await invoke("start_workspace", { workspaceId });
        queryClient.invalidateQueries({ queryKey: ["tray-data"] });
      } catch {}
    },
    [queryClient]
  );

  const handleStopWorkspace = useCallback(
    async (workspaceId: number) => {
      try {
        await invoke("stop_workspace", { workspaceId });
        queryClient.invalidateQueries({ queryKey: ["tray-data"] });
      } catch {}
    },
    [queryClient]
  );

  // Derived state
  const runningProcesses =
    data?.processes?.filter(
      (p) => p.status === "running" || p.status === "starting"
    ) ?? [];
  const hasTimer = !!data?.timer;
  const pinnedProjects = data?.pinned_projects ?? [];
  const workspaces = data?.workspaces ?? [];

  // Check if a workspace has any running processes
  const workspaceHasRunning = (ws: { projects: { project_name: string }[] }) => {
    return ws.projects.some((wp) =>
      runningProcesses.some((rp) => rp.project_name === wp.project_name)
    );
  };

  if (isLoading) {
    return (
      <div className="tray-popup-container h-full flex items-center justify-center bg-zinc-950/95 backdrop-blur-xl rounded-xl border border-zinc-800 shadow-2xl">
        <div className="animate-pulse text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="tray-popup-container h-full flex flex-col bg-zinc-950/95 backdrop-blur-xl rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div ref={contentRef}>
        {/* Running Processes Section */}
        {runningProcesses.length > 0 && (
          <div className="p-2 border-b border-zinc-800/50">
            <div className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
              Running
            </div>
            {runningProcesses.map((proc: ManagedProcess) => (
              <div
                key={proc.pid}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors group"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    proc.status === "running"
                      ? "bg-emerald-400"
                      : "bg-yellow-400 animate-pulse"
                  )}
                />
                <button
                  onClick={() => handleOpenProject(proc.project_name)}
                  className="flex-1 text-left text-sm text-zinc-300 truncate hover:text-zinc-100 transition-colors"
                >
                  {proc.project_name}
                  {proc.port && (
                    <span className="text-zinc-600 font-mono text-xs ml-1">
                      :{proc.port}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleStopProcess(proc.pid)}
                  className="p-1 rounded hover:bg-red-500/10 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                  title="Stop"
                >
                  <Square className="h-3 w-3" />
                </button>
              </div>
            ))}
            {runningProcesses.length >= 2 && (
              <button
                onClick={handleStopAll}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-1 rounded-md text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <StopCircle className="h-3 w-3" />
                Stop All
              </button>
            )}
          </div>
        )}

        {/* Active Timer Section */}
        {hasTimer && data?.timer && (
          <div className="p-2 border-b border-zinc-800/50">
            <button
              onClick={handleStopTimer}
              className="w-full flex items-center gap-3 p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20">
                <Timer className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-zinc-100">
                  {data.timer.project_name}
                </div>
                <div className="text-xs text-emerald-400 font-mono">
                  {formatDuration(localElapsed)}
                </div>
              </div>
              <Square className="h-4 w-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        )}

        {/* Quick Actions Section */}
        <div className="p-2 border-b border-zinc-800/50">
          {/* Start Timer (only when no timer active) */}
          {!hasTimer && (
            <>
              <button
                onClick={() => setExpandedTimer(!expandedTimer)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800">
                  <Timer className="h-4 w-4 text-zinc-400" />
                </div>
                <span className="flex-1 text-left text-sm text-zinc-400">
                  Start Timer
                </span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-zinc-600 transition-transform",
                    expandedTimer && "rotate-90"
                  )}
                />
              </button>
              {expandedTimer && (
                <div className="mt-1 space-y-0.5 pl-11">
                  {pinnedProjects.length > 0 ? (
                    pinnedProjects.map((project) => (
                      <button
                        key={project}
                        onClick={() => handleStartTimer(project)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
                      >
                        <Play className="h-3 w-3" />
                        <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />
                        {project}
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-600 px-2 py-1">
                      No pinned projects
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Pinned Projects with Start Working */}
          {pinnedProjects.length > 0 && (
            <div className="mt-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                Pinned Projects
              </div>
              {pinnedProjects.map((project) => {
                const isRunning = runningProcesses.some(
                  (p) => p.project_name === project
                );
                return (
                  <div
                    key={project}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors group"
                  >
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    <button
                      onClick={() => handleOpenProject(project)}
                      className="flex-1 text-left text-sm text-zinc-300 truncate hover:text-zinc-100"
                    >
                      {project}
                    </button>
                    {isRunning ? (
                      <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    ) : (
                      <button
                        onClick={() => handleStartWorking(project)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-500 hover:text-emerald-400 hover:bg-emerald-900/30 opacity-0 group-hover:opacity-100 transition-all"
                        title="Open editor + Start timer + Launch dev"
                      >
                        <Play className="h-2.5 w-2.5" />
                        Start
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workspaces Section (collapsible) */}
        {workspaces.length > 0 && (
          <div className="p-2 border-b border-zinc-800/50">
            <button
              onClick={() => setExpandedWorkspaces(!expandedWorkspaces)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <Layers className="h-3.5 w-3.5 text-zinc-500" />
              <span className="flex-1 text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                Workspaces
              </span>
              <span className="text-xs text-zinc-600">{workspaces.length}</span>
              {expandedWorkspaces ? (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
              )}
            </button>
            {expandedWorkspaces && (
              <div className="mt-1 space-y-1">
                {workspaces.map((ws) => {
                  const isRunning = workspaceHasRunning(ws);
                  return (
                    <div
                      key={ws.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors"
                    >
                      <span className="flex-1 text-sm text-zinc-400 truncate">
                        {ws.name}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {ws.projects.length} projects
                      </span>
                      {isRunning ? (
                        <button
                          onClick={() => handleStopWorkspace(ws.id)}
                          className="px-2 py-0.5 rounded text-[11px] text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartWorkspace(ws.id)}
                          className="px-2 py-0.5 rounded text-[11px] text-zinc-500 hover:text-emerald-400 hover:bg-emerald-900/30 transition-colors"
                        >
                          Start
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-2 flex gap-1">
          <button
            onClick={handleShowWindow}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
          >
            <AppWindow className="h-4 w-4" />
            Show App
          </button>
          <button
            onClick={handleQuit}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
