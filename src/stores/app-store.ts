import { create } from "zustand";
import type { Config, ActiveTimer } from "@/types";

type View = "dashboard" | "projects" | "settings" | "project-detail" | "create-project" | "statistics" | "archive" | "disk-manager" | "port-manager" | "permissions";

type Theme = "dark" | "light";

interface AppState {
  // Navigation
  currentView: View;
  selectedProject: string | null;
  setView: (view: View) => void;
  setSelectedProject: (name: string | null) => void;

  // Config
  config: Config | null;
  setConfig: (config: Config) => void;

  // Timer
  activeTimer: ActiveTimer | null;
  setActiveTimer: (timer: ActiveTimer | null) => void;

  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Theme
  theme: Theme;
  toggleTheme: () => void;

  // Zoom
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentView: "dashboard",
  selectedProject: null,
  setView: (view) => set({ currentView: view }),
  setSelectedProject: (name) =>
    set({ selectedProject: name, currentView: name ? "project-detail" : "projects" }),

  // Config
  config: null,
  setConfig: (config) => set({ config }),

  // Timer
  activeTimer: null,
  setActiveTimer: (timer) => set({ activeTimer: timer }),

  // UI State
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Theme
  theme: (localStorage.getItem("pm-theme") as Theme) || "dark",
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("pm-theme", next);
      return { theme: next };
    }),

  // Zoom (50% to 150%)
  zoomLevel: 100,
  setZoomLevel: (level) => set({ zoomLevel: Math.min(150, Math.max(50, level)) }),
  zoomIn: () => set((state) => ({ zoomLevel: Math.min(150, state.zoomLevel + 10) })),
  zoomOut: () => set((state) => ({ zoomLevel: Math.max(50, state.zoomLevel - 10) })),
  resetZoom: () => set({ zoomLevel: 100 }),
}));
