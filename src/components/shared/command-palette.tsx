import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Folder, ExternalLink, Terminal, Play, Archive, RotateCcw } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useAppStore } from "@/stores/app-store";
import { useConfig } from "@/hooks/use-system";
import { useStartTimer } from "@/hooks/use-timer";
import { openInEditor, openInTerminal, archiveProject, restoreProject } from "@/lib/tauri";
import { useQueryClient } from "@tanstack/react-query";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: projects } = useProjects();
  const { data: config } = useConfig();
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const setView = useAppStore((s) => s.setView);
  const startTimer = useStartTimer();
  const queryClient = useQueryClient();

  const editor = config?.default_editor || "cursor";

  // Build commands list
  const commands = useMemo((): Command[] => {
    const cmds: Command[] = [];

    // Navigation commands
    cmds.push({
      id: "nav:dashboard",
      label: "Go to Dashboard",
      icon: <Folder className="h-4 w-4" />,
      action: () => {
        setView("dashboard");
        onClose();
      },
      keywords: ["home", "overview"],
    });

    cmds.push({
      id: "nav:projects",
      label: "Go to Projects",
      icon: <Folder className="h-4 w-4" />,
      action: () => {
        setView("projects");
        onClose();
      },
      keywords: ["list", "all"],
    });

    cmds.push({
      id: "nav:settings",
      label: "Go to Settings",
      icon: <Folder className="h-4 w-4" />,
      action: () => {
        setView("settings");
        onClose();
      },
      keywords: ["preferences", "config"],
    });

    // Project commands
    if (projects) {
      for (const project of projects.slice(0, 20)) {
        // View project
        cmds.push({
          id: `project:view:${project.name}`,
          label: project.name,
          description: `Open ${project.location} project`,
          icon: <Folder className="h-4 w-4" />,
          action: () => {
            setSelectedProject(project.name);
            onClose();
          },
          keywords: [project.project_type || "", project.location],
        });

        // Open in editor
        cmds.push({
          id: `project:editor:${project.name}`,
          label: `Open ${project.name} in ${editor}`,
          description: project.path,
          icon: <ExternalLink className="h-4 w-4" />,
          action: () => {
            openInEditor(project.path, editor);
            onClose();
          },
          keywords: ["code", "edit", project.project_type || ""],
        });

        // Open in terminal
        cmds.push({
          id: `project:terminal:${project.name}`,
          label: `Open ${project.name} in Terminal`,
          description: project.path,
          icon: <Terminal className="h-4 w-4" />,
          action: () => {
            openInTerminal(project.path);
            onClose();
          },
          keywords: ["shell", "cli"],
        });

        // Start timer
        cmds.push({
          id: `project:timer:${project.name}`,
          label: `Start timer for ${project.name}`,
          description: "Track time spent on this project",
          icon: <Play className="h-4 w-4" />,
          action: () => {
            startTimer.mutate(project.name);
            onClose();
          },
          keywords: ["time", "track", "clock"],
        });

        // Archive/Restore
        if (project.location === "active") {
          cmds.push({
            id: `project:archive:${project.name}`,
            label: `Archive ${project.name}`,
            description: "Move to archived projects",
            icon: <Archive className="h-4 w-4" />,
            action: async () => {
              await archiveProject(project.name);
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              onClose();
            },
            keywords: ["hide", "remove"],
          });
        } else {
          cmds.push({
            id: `project:restore:${project.name}`,
            label: `Restore ${project.name}`,
            description: "Move back to active projects",
            icon: <RotateCcw className="h-4 w-4" />,
            action: async () => {
              await restoreProject(project.name);
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              onClose();
            },
            keywords: ["unarchive", "activate"],
          });
        }
      }
    }

    return cmds;
  }, [projects, editor, setSelectedProject, setView, startTimer, queryClient, onClose]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) {
      // Show navigation + first 10 project view commands when no search
      const navCmds = commands.filter((c) => c.id.startsWith("nav:"));
      const projectCmds = commands.filter((c) => c.id.startsWith("project:view:")).slice(0, 10);
      return [...navCmds, ...projectCmds];
    }

    const searchLower = search.toLowerCase();
    return commands
      .filter((cmd) => {
        const labelMatch = cmd.label.toLowerCase().includes(searchLower);
        const descMatch = cmd.description?.toLowerCase().includes(searchLower);
        const keywordMatch = cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower));
        return labelMatch || descMatch || keywordMatch;
      })
      .slice(0, 20);
  }, [commands, search]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selected = list.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700">
          <Search className="h-5 w-5 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands and projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-zinc-600 bg-zinc-800 px-1.5 text-[10px] font-medium text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Commands list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-300 hover:bg-zinc-800/50"
                }`}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="text-zinc-400">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cmd.label}</div>
                  {cmd.description && (
                    <div className="text-xs text-zinc-500 truncate">{cmd.description}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-700 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
