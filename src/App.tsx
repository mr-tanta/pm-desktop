import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "@/components/layout/app-shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectDetail } from "@/components/projects/project-detail";
import { CreateProject } from "@/components/projects/create-project";
import { SettingsPage } from "@/components/settings/settings-page";
import { DiskManagerPage } from "@/components/disk-manager";
import { PortManagerPage } from "@/components/port-manager";
import { PermissionsPage } from "@/components/permissions";
import { WorkspaceManager } from "@/components/workspaces/workspace-manager";
import { CommandPalette } from "@/components/shared/command-palette";
import { UpdateNotification } from "@/components/shared/update-notification";
import { CrashNotifier } from "@/components/shared/crash-notifier";
import { useAppStore } from "@/stores/app-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const currentView = useAppStore((s) => s.currentView);
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Listen for tray "open-project" events
  useEffect(() => {
    const unlisten = listen<string>("open-project", (event) => {
      setSelectedProject(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setSelectedProject]);

  // Global keyboard shortcut for command palette (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen]);

  return (
    <AppShell>
      {currentView === "today" && <Dashboard />}
      {currentView === "projects" && <ProjectList />}
      {currentView === "project-detail" && <ProjectDetail />}
      {currentView === "create-project" && <CreateProject />}
      {currentView === "settings" && <SettingsPage />}
      {currentView === "disk-manager" && <DiskManagerPage />}
      {currentView === "port-manager" && <PortManagerPage />}
      {currentView === "permissions" && <PermissionsPage />}
      {currentView === "workspaces" && <WorkspaceManager />}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <UpdateNotification />
      <CrashNotifier />
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
