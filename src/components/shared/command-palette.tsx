import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Folder, ExternalLink, Terminal, Play, Archive, RotateCcw, Square, Star, HardDrive, Network, LayoutDashboard, Settings } from "lucide-react";
import { useProjects, usePinProject, useUnpinProject, usePinnedProjects } from "@/hooks/use-projects";
import { useAppStore } from "@/stores/app-store";
import { useConfig } from "@/hooks/use-system";
import { useStartTimer, useStopTimer, useActiveTimer } from "@/hooks/use-timer";
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
  const { data: pinnedNames } = usePinnedProjects();
  const { data: activeTimer } = useActiveTimer();
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const setView = useAppStore((s) => s.setView);
  const startTimer = useStartTimer();
  const stopTimerMutation = useStopTimer();
  const pinProjectMutation = usePinProject();
  const unpinProjectMutation = useUnpinProject();
  const queryClient = useQueryClient();

  const editor = config?.default_editor || "cursor";
  const pinnedSet = new Set(pinnedNames || []);

  // Build commands list
  const commands = useMemo((): Command[] => {
    const cmds: Command[] = [];

    // Navigation commands
    cmds.push({
      id: "nav:today",
      label: "Go to Today",
      icon: <LayoutDashboard className="h-4 w-4" />,
      action: () => {
        setView("today");
        onClose();
      },
      keywords: ["home", "dashboard", "overview"],
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
      id: "nav:disk-manager",
      label: "Go to Disk Manager",
      icon: <HardDrive className="h-4 w-4" />,
      action: () => {
        setView("disk-manager");
        onClose();
      },
      keywords: ["storage", "clean", "space"],
    });

    cmds.push({
      id: "nav:port-manager",
      label: "Go to Port Manager",
      icon: <Network className="h-4 w-4" />,
      action: () => {
        setView("port-manager");
        onClose();
      },
      keywords: ["ports", "server", "network"],
    });

    cmds.push({
      id: "nav:settings",
      label: "Go to Settings",
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        setView("settings");
        onClose();
      },
      keywords: ["preferences", "config"],
    });

    // Stop timer command
    if (activeTimer) {
      cmds.push({
        id: "timer:stop",
        label: "Stop timer",
        description: `Currently tracking ${activeTimer.project_name}`,
        icon: <Square className="h-4 w-4" />,
        action: () => {
          stopTimerMutation.mutate();
          onClose();
        },
        keywords: ["time", "stop", "end"],
      });
    }

    // Project commands
    if (projects) {
      for (const project of projects.slice(0, 20)) {
        const isPinned = pinnedSet.has(project.name);

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

        // Start Working (open editor + start timer)
        if (project.location === "active") {
          cmds.push({
            id: `project:start-working:${project.name}`,
            label: `Start Working on ${project.name}`,
            description: "Open in editor and start timer",
            icon: <Play className="h-4 w-4" />,
            action: () => {
              openInEditor(project.path, editor);
              if (!activeTimer) {
                startTimer.mutate(project.name);
              }
              onClose();
            },
            keywords: ["work", "launch", "begin"],
          });
        }

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
        if (!activeTimer) {
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
        }

        // Pin/Unpin
        if (project.location === "active") {
          cmds.push({
            id: `project:pin:${project.name}`,
            label: isPinned ? `Unpin ${project.name}` : `Pin ${project.name}`,
            description: isPinned ? "Remove from favorites" : "Add to favorites",
            icon: <Star className="h-4 w-4" />,
            action: () => {
              if (isPinned) {
                unpinProjectMutation.mutate(project.name);
              } else {
                pinProjectMutation.mutate(project.name);
              }
              onClose();
            },
            keywords: ["favorite", "star", "pin"],
          });
        }

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
  }, [projects, editor, pinnedSet, activeTimer, setSelectedProject, setView, startTimer, stopTimerMutation, pinProjectMutation, unpinProjectMutation, queryClient, onClose]);

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
        className="relative w-full max-w-lg bg-popover border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands and projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Commands list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/80 hover:bg-accent/50"
                }`}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="text-muted-foreground">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cmd.label}</div>
                  {cmd.description && (
                    <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
