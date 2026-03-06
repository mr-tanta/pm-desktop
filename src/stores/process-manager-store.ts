import { create } from "zustand";
import type { ManagedProcess } from "@/types";

interface ProcessManagerState {
  processes: ManagedProcess[];
  activeLogPid: number | null;
  launchingProjects: Set<string>;

  setProcesses: (processes: ManagedProcess[]) => void;
  setActiveLogPid: (pid: number | null) => void;
  addLaunching: (projectPath: string) => void;
  removeLaunching: (projectPath: string) => void;
}

export const useProcessManagerStore = create<ProcessManagerState>((set) => ({
  processes: [],
  activeLogPid: null,
  launchingProjects: new Set(),

  setProcesses: (processes) => set({ processes }),
  setActiveLogPid: (pid) => set({ activeLogPid: pid }),
  addLaunching: (projectPath) =>
    set((state) => {
      const next = new Set(state.launchingProjects);
      next.add(projectPath);
      return { launchingProjects: next };
    }),
  removeLaunching: (projectPath) =>
    set((state) => {
      const next = new Set(state.launchingProjects);
      next.delete(projectPath);
      return { launchingProjects: next };
    }),
}));
