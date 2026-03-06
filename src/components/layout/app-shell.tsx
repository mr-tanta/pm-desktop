import { useEffect } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useAppStore } from "@/stores/app-store";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { zoomLevel, zoomIn, zoomOut, theme } = useAppStore();

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        // Zoom shortcuts
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          useAppStore.getState().resetZoom();
        }
        // Navigation shortcuts: Cmd+1-4
        else if (e.key === '1') {
          e.preventDefault();
          useAppStore.getState().setView('today');
        } else if (e.key === '2') {
          e.preventDefault();
          useAppStore.getState().setView('projects');
        } else if (e.key === '3') {
          e.preventDefault();
          useAppStore.getState().setView('disk-manager');
        } else if (e.key === '4') {
          e.preventDefault();
          useAppStore.getState().setView('port-manager');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main
          className="flex-1 overflow-auto"
          style={{ zoom: `${zoomLevel}%` }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
