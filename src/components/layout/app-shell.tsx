import { useEffect } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useAppStore } from "@/stores/app-store";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { zoomLevel, zoomIn, zoomOut } = useAppStore();

  // Apply zoom to main content via CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--content-zoom', `${zoomLevel / 100}`);
  }, [zoomLevel]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
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
          className="flex-1 overflow-auto origin-top-left"
          style={{
            transform: `scale(${zoomLevel / 100})`,
            width: `${100 / (zoomLevel / 100)}%`,
            height: `${100 / (zoomLevel / 100)}%`,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
