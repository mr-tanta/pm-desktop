import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "@/components/layout/app-shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectDetail } from "@/components/projects/project-detail";
import { SettingsPage } from "@/components/settings/settings-page";
import { CommandPalette } from "@/components/shared/command-palette";
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
      {currentView === "dashboard" && <Dashboard />}
      {currentView === "projects" && <ProjectList />}
      {currentView === "project-detail" && <ProjectDetail />}
      {currentView === "settings" && <SettingsPage />}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
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
