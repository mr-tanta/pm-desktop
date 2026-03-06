import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useProjects } from "@/hooks/use-projects";
import { LayoutDashboard, FolderKanban, ChevronLeft, ChevronRight, Plus, HardDrive, Network, Layers } from "lucide-react";

export function Sidebar() {
  const { currentView, setView, sidebarCollapsed, toggleSidebar, setSelectedProject } = useAppStore();
  const { data: activeProjects } = useProjects("active");

  const navItems = [
    {
      id: "today" as const,
      label: "Today",
      icon: LayoutDashboard,
    },
    {
      id: "projects" as const,
      label: "Projects",
      icon: FolderKanban,
      count: activeProjects?.length,
    },
    {
      id: "disk-manager" as const,
      label: "Disk Manager",
      icon: HardDrive,
    },
    {
      id: "port-manager" as const,
      label: "Port Manager",
      icon: Network,
    },
    {
      id: "workspaces" as const,
      label: "Workspaces",
      icon: Layers,
    },
  ];

  return (
    <aside
      className={cn(
        "h-full border-r border-border bg-sidebar flex flex-col transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id ||
              ((currentView === "project-detail" || currentView === "create-project") && item.id === "projects");

            return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedProject(null);
                  setView(item.id);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count !== undefined && (
                      <span className="text-xs text-muted-foreground">{item.count}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}

          {/* New Project Button */}
          <button
            onClick={() => setView("create-project")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-md text-sm transition-colors",
              "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>New Project</span>}
          </button>
        </nav>

              </div>

      <div className="p-2 border-t border-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
