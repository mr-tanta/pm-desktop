import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Timer,
  Square,
  Play,
  Folder,
  ExternalLink,
  StopCircle,
  ChevronRight,
  AppWindow,
  Power,
  Database,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Set transparent background for tray popup window only
if (typeof document !== "undefined" && window.location.hash === "#tray") {
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.body.style.margin = "0";
  document.body.style.padding = "8px";
  document.body.style.height = "100vh";
  document.body.style.boxSizing = "border-box";
}

interface PortEntry {
  port: number;
  category: string;
  process?: {
    name: string;
    project_name?: string;
    working_directory?: string;
  };
}

interface ActiveTimer {
  project_name: string;
  elapsed_seconds: number;
}

interface Config {
  active_dir: string;
  default_editor: string;
}

export function TrayPopup() {
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [timerData, configData] = await Promise.all([
          invoke<ActiveTimer | null>("get_active_timer"),
          invoke<Config>("load_config"),
        ]);
        setTimer(timerData);
        setConfig(configData);

        // Load projects
        const projectsData = await invoke<string[]>("get_recent_projects_list", {
          limit: 5,
        }).catch(() => []);
        setProjects(projectsData);

        // Load ports
        const portsData = await invoke<{ ports: PortEntry[] }>("scan_dev_ports").catch(
          () => ({ ports: [] })
        );
        setPorts(portsData.ports || []);
      } catch (e) {
        console.error("Failed to load data:", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Refresh timer every second
    const interval = setInterval(async () => {
      try {
        const timerData = await invoke<ActiveTimer | null>("get_active_timer");
        setTimer(timerData);
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Close on blur
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = listen("tauri://blur", () => {
      win.hide();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
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

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStopTimer = async () => {
    try {
      await invoke("stop_timer");
      setTimer(null);
    } catch {}
  };

  const handleStartTimer = async (project: string) => {
    try {
      await invoke("start_timer", { projectName: project });
      const timerData = await invoke<ActiveTimer | null>("get_active_timer");
      setTimer(timerData);
      setExpandedSection(null);
    } catch {}
  };

  const handleKillPort = async (port: number) => {
    try {
      await invoke("kill_port", { port, force: false });
      setPorts((prev) => prev.filter((p) => p.port !== port));
    } catch {}
  };

  const handleKillAll = async () => {
    try {
      await invoke("batch_kill_ports", {
        ports: ports.map((p) => p.port),
        force: false,
      });
      setPorts([]);
    } catch {}
  };

  const handleOpenProject = async (project: string) => {
    await invoke("emit_open_project", { projectName: project });
    getCurrentWindow().hide();
  };

  const handleOpenEditor = async (project: string) => {
    if (!config) return;
    await invoke("open_in_editor_cmd", {
      path: `${config.active_dir}/${project}`,
      editor: config.default_editor,
    });
    getCurrentWindow().hide();
  };

  const handleShowWindow = async () => {
    await invoke("show_main_window");
    getCurrentWindow().hide();
  };

  const handleQuit = async () => {
    await invoke("quit_app");
  };

  const getPortIcon = (category: string) => {
    switch (category) {
      case "dev_server":
        return <Globe className="h-3.5 w-3.5" />;
      case "database":
        return <Database className="h-3.5 w-3.5" />;
      default:
        return <Globe className="h-3.5 w-3.5" />;
    }
  };

  const getDisplayName = (port: PortEntry) => {
    if (port.process?.project_name) return port.process.project_name;
    if (port.process?.name) {
      const name = port.process.name.toLowerCase();
      if (name === "node") return "Node.js";
      if (name === "postgres" || name === "postgresql") return "PostgreSQL";
      if (name === "mysql" || name === "mysqld") return "MySQL";
      if (name === "redis" || name === "redis-server") return "Redis";
      if (name === "mongod") return "MongoDB";
      return port.process.name;
    }
    return "Unknown";
  };

  const getEditorDisplayName = (editor: string) => {
    const map: Record<string, string> = {
      cursor: "Cursor",
      code: "VS Code",
      vscode: "VS Code",
      zed: "Zed",
      sublime: "Sublime",
      subl: "Sublime",
      vim: "Vim",
      nvim: "Neovim",
      atom: "Atom",
    };
    return map[editor.toLowerCase()] || editor.charAt(0).toUpperCase() + editor.slice(1);
  };

  // Group ports
  const devServers = ports.filter(
    (p) => p.category === "dev_server" || p.category === "node_process"
  );
  const databases = ports.filter((p) => p.category === "database");
  const others = ports.filter(
    (p) => !["dev_server", "node_process", "database"].includes(p.category)
  );

  if (loading) {
    return (
      <div className="tray-popup-container h-full flex items-center justify-center bg-zinc-950/95 backdrop-blur-xl rounded-xl border border-zinc-800 shadow-2xl">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="tray-popup-container h-full flex flex-col bg-zinc-950/95 backdrop-blur-xl rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Timer Section */}
      <div className="p-3 border-b border-zinc-800/50">
        {timer ? (
          <button
            onClick={handleStopTimer}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20">
              <Timer className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-zinc-100">
                {timer.project_name}
              </div>
              <div className="text-xs text-emerald-400 font-mono">
                {formatDuration(timer.elapsed_seconds)}
              </div>
            </div>
            <Square className="h-4 w-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
          </button>
        ) : (
          <button
            onClick={() =>
              setExpandedSection(expandedSection === "timer" ? null : "timer")
            }
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
                expandedSection === "timer" && "rotate-90"
              )}
            />
          </button>
        )}
        {expandedSection === "timer" && !timer && (
          <div className="mt-2 space-y-1 pl-11">
            {projects.map((project) => (
              <button
                key={project}
                onClick={() => handleStartTimer(project)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
              >
                <Play className="h-3 w-3" />
                {project}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ports Section */}
      <div className="flex-1 overflow-y-auto">
        {ports.length > 0 ? (
          <div className="p-2">
            {/* Dev Servers */}
            {devServers.length > 0 && (
              <div className="mb-3">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  Projects
                </div>
                {devServers.map((port) => (
                  <button
                    key={port.port}
                    onClick={() => handleKillPort(port.port)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-500/10 text-blue-400">
                      {getPortIcon(port.category)}
                    </div>
                    <span className="flex-1 text-left text-sm text-zinc-300 truncate">
                      {getDisplayName(port)}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">
                      :{port.port}
                    </span>
                    <StopCircle className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:text-red-400 transition-all" />
                  </button>
                ))}
              </div>
            )}

            {/* Databases */}
            {databases.length > 0 && (
              <div className="mb-3">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  Databases
                </div>
                {databases.map((port) => (
                  <button
                    key={port.port}
                    onClick={() => handleKillPort(port.port)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-amber-500/10 text-amber-400">
                      <Database className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1 text-left text-sm text-zinc-300 truncate">
                      {getDisplayName(port)}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">
                      :{port.port}
                    </span>
                    <StopCircle className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:text-red-400 transition-all" />
                  </button>
                ))}
              </div>
            )}

            {/* Others */}
            {others.length > 0 && (
              <div className="mb-3">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  Other
                </div>
                {others.map((port) => (
                  <button
                    key={port.port}
                    onClick={() => handleKillPort(port.port)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-zinc-500/10 text-zinc-400">
                      {getPortIcon(port.category)}
                    </div>
                    <span className="flex-1 text-left text-sm text-zinc-300 truncate">
                      {getDisplayName(port)}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">
                      :{port.port}
                    </span>
                    <StopCircle className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:text-red-400 transition-all" />
                  </button>
                ))}
              </div>
            )}

            {/* Stop All */}
            {ports.length > 1 && (
              <button
                onClick={handleKillAll}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <StopCircle className="h-4 w-4" />
                Stop All ({ports.length})
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-zinc-600">
            No running servers
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="border-t border-zinc-800/50 p-2">
        <button
          onClick={() =>
            setExpandedSection(expandedSection === "open" ? null : "open")
          }
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
        >
          <Folder className="h-4 w-4" />
          <span className="flex-1 text-left">Open Project</span>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-zinc-600 transition-transform",
              expandedSection === "open" && "rotate-90"
            )}
          />
        </button>
        {expandedSection === "open" && (
          <div className="mt-1 space-y-0.5 pl-6">
            {projects.map((project) => (
              <button
                key={project}
                onClick={() => handleOpenProject(project)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
              >
                {project}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() =>
            setExpandedSection(expandedSection === "editor" ? null : "editor")
          }
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="flex-1 text-left">
            Open in {config ? getEditorDisplayName(config.default_editor) : "Editor"}
          </span>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-zinc-600 transition-transform",
              expandedSection === "editor" && "rotate-90"
            )}
          />
        </button>
        {expandedSection === "editor" && (
          <div className="mt-1 space-y-0.5 pl-6">
            {projects.map((project) => (
              <button
                key={project}
                onClick={() => handleOpenEditor(project)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
              >
                {project}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800/50 p-2 flex gap-1">
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
  );
}
