import { create } from "zustand";
import type { Config, ActiveTimer } from "@/types";

type View = "dashboard" | "projects" | "settings" | "project-detail" | "create-project" | "statistics" | "archive";

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
}));
