import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  PortScanResult,
  PortEntry,
  PortCategory,
  ConnectionState,
  PortWatch,
  PortHistoryEntry,
} from "@/types";

interface PortManagerState {
  // Scan state
  scanResult: PortScanResult | null;
  lastScanTime: number | null;
  isScanning: boolean;
  scanProgress: number;
  scanStage: string;
  scanError: string | null;

  // Selection state
  selectedPorts: Set<number>;
  expandedCategories: Set<PortCategory>;

  // Filter state
  categoryFilter: PortCategory | "all";
  stateFilter: ConnectionState | "all";
  searchQuery: string;
  showSystemPorts: boolean;

  // Pinned ports (persisted)
  pinnedPorts: number[];

  // Port watches (persisted)
  portWatches: PortWatch[];

  // Port history (limited, persisted)
  portHistory: PortHistoryEntry[];

  // Actions - Scan
  setScanResult: (result: PortScanResult | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setScanProgress: (progress: number, stage: string) => void;
  setScanError: (error: string | null) => void;

  // Actions - Selection
  togglePortSelection: (port: number) => void;
  selectAllInCategory: (category: PortCategory) => void;
  deselectAllInCategory: (category: PortCategory) => void;
  selectAll: () => void;
  deselectAll: () => void;
  isPortSelected: (port: number) => boolean;

  // Actions - Category
  toggleCategoryExpanded: (category: PortCategory) => void;
  isCategoryExpanded: (category: PortCategory) => boolean;
  expandAllCategories: () => void;
  collapseAllCategories: () => void;

  // Actions - Filters
  setCategoryFilter: (filter: PortCategory | "all") => void;
  setStateFilter: (filter: ConnectionState | "all") => void;
  setSearchQuery: (query: string) => void;
  setShowSystemPorts: (show: boolean) => void;
  clearFilters: () => void;

  // Actions - Pinned ports
  togglePinnedPort: (port: number) => void;
  isPinnedPort: (port: number) => boolean;
  clearPinnedPorts: () => void;

  // Actions - Watches
  addWatch: (watch: PortWatch) => void;
  removeWatch: (watchId: string) => void;
  clearWatches: () => void;

  // Actions - History
  addHistoryEntry: (entry: PortHistoryEntry) => void;
  clearHistory: () => void;

  // Computed
  getSelectedPorts: () => PortEntry[];
  getSelectedCount: () => number;
  getFilteredPorts: () => PortEntry[];
  getPortsByCategory: (category: PortCategory) => PortEntry[];
  getLastScanDate: () => Date | null;

  // Reset
  reset: () => void;
  clearSelection: () => void;
}

const MAX_HISTORY_ENTRIES = 100;

export const usePortManagerStore = create<PortManagerState>()(
  persist(
    (set, get) => ({
      // Initial state
      scanResult: null,
      lastScanTime: null,
      isScanning: false,
      scanProgress: 0,
      scanStage: "",
      scanError: null,
      selectedPorts: new Set(),
      expandedCategories: new Set(),
      categoryFilter: "all",
      stateFilter: "all",
      searchQuery: "",
      showSystemPorts: false,
      pinnedPorts: [],
      portWatches: [],
      portHistory: [],

      // Scan actions
      setScanResult: (result) =>
        set({
          scanResult: result,
          scanError: null,
          lastScanTime: result ? Date.now() : null,
          isScanning: false,
        }),

      setIsScanning: (scanning) =>
        set({
          isScanning: scanning,
          scanProgress: scanning ? 0 : get().scanProgress,
          scanStage: scanning ? "Initializing..." : get().scanStage,
          scanError: scanning ? null : get().scanError,
        }),

      setScanProgress: (progress, stage) =>
        set({ scanProgress: progress, scanStage: stage }),

      setScanError: (error) =>
        set({ scanError: error, isScanning: false }),

      // Selection actions
      togglePortSelection: (port) =>
        set((state) => {
          const newSelected = new Set(state.selectedPorts);
          if (newSelected.has(port)) {
            newSelected.delete(port);
          } else {
            newSelected.add(port);
          }
          return { selectedPorts: newSelected };
        }),

      selectAllInCategory: (category) =>
        set((state) => {
          const newSelected = new Set(state.selectedPorts);
          const ports = state.scanResult?.ports.filter(
            (p) => p.category === category
          ) ?? [];
          for (const port of ports) {
            newSelected.add(port.port);
          }
          return { selectedPorts: newSelected };
        }),

      deselectAllInCategory: (category) =>
        set((state) => {
          const newSelected = new Set(state.selectedPorts);
          const ports = state.scanResult?.ports.filter(
            (p) => p.category === category
          ) ?? [];
          for (const port of ports) {
            newSelected.delete(port.port);
          }
          return { selectedPorts: newSelected };
        }),

      selectAll: () =>
        set((state) => {
          const newSelected = new Set<number>();
          const ports = state.scanResult?.ports ?? [];
          for (const port of ports) {
            newSelected.add(port.port);
          }
          return { selectedPorts: newSelected };
        }),

      deselectAll: () => set({ selectedPorts: new Set() }),

      isPortSelected: (port) => get().selectedPorts.has(port),

      // Category actions
      toggleCategoryExpanded: (category) =>
        set((state) => {
          const newExpanded = new Set(state.expandedCategories);
          if (newExpanded.has(category)) {
            newExpanded.delete(category);
          } else {
            newExpanded.add(category);
          }
          return { expandedCategories: newExpanded };
        }),

      isCategoryExpanded: (category) => get().expandedCategories.has(category),

      expandAllCategories: () =>
        set((state) => {
          const categories = state.scanResult?.categories.map(c => c.category) ?? [];
          return { expandedCategories: new Set(categories) };
        }),

      collapseAllCategories: () => set({ expandedCategories: new Set() }),

      // Filter actions
      setCategoryFilter: (filter) => set({ categoryFilter: filter }),
      setStateFilter: (filter) => set({ stateFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setShowSystemPorts: (show) => set({ showSystemPorts: show }),

      clearFilters: () =>
        set({
          categoryFilter: "all",
          stateFilter: "all",
          searchQuery: "",
          showSystemPorts: false,
        }),

      // Pinned ports actions
      togglePinnedPort: (port) =>
        set((state) => {
          const newPinned = state.pinnedPorts.includes(port)
            ? state.pinnedPorts.filter((p) => p !== port)
            : [...state.pinnedPorts, port];
          return { pinnedPorts: newPinned };
        }),

      isPinnedPort: (port) => get().pinnedPorts.includes(port),

      clearPinnedPorts: () => set({ pinnedPorts: [] }),

      // Watch actions
      addWatch: (watch) =>
        set((state) => ({
          portWatches: [...state.portWatches, watch],
        })),

      removeWatch: (watchId) =>
        set((state) => ({
          portWatches: state.portWatches.filter((w) => w.id !== watchId),
        })),

      clearWatches: () => set({ portWatches: [] }),

      // History actions
      addHistoryEntry: (entry) =>
        set((state) => {
          const newHistory = [entry, ...state.portHistory].slice(0, MAX_HISTORY_ENTRIES);
          return { portHistory: newHistory };
        }),

      clearHistory: () => set({ portHistory: [] }),

      // Computed
      getSelectedPorts: () => {
        const state = get();
        if (!state.scanResult) return [];
        return state.scanResult.ports.filter((p) =>
          state.selectedPorts.has(p.port)
        );
      },

      getSelectedCount: () => get().selectedPorts.size,

      getFilteredPorts: () => {
        const state = get();
        if (!state.scanResult) return [];

        let ports = state.scanResult.ports;

        // Filter by system ports
        if (!state.showSystemPorts) {
          ports = ports.filter((p) => p.port >= 1024);
        }

        // Filter by category
        if (state.categoryFilter !== "all") {
          ports = ports.filter((p) => p.category === state.categoryFilter);
        }

        // Filter by state
        if (state.stateFilter !== "all") {
          ports = ports.filter((p) => p.state === state.stateFilter);
        }

        // Filter by search query
        if (state.searchQuery.trim()) {
          const query = state.searchQuery.toLowerCase();
          ports = ports.filter(
            (p) =>
              p.port.toString().includes(query) ||
              p.process?.name.toLowerCase().includes(query) ||
              p.process?.command.toLowerCase().includes(query) ||
              p.local_address.toLowerCase().includes(query)
          );
        }

        return ports;
      },

      getPortsByCategory: (category) => {
        const state = get();
        if (!state.scanResult) return [];
        return state.scanResult.ports.filter((p) => p.category === category);
      },

      getLastScanDate: () => {
        const timestamp = get().lastScanTime;
        return timestamp ? new Date(timestamp) : null;
      },

      // Reset
      reset: () =>
        set({
          scanResult: null,
          lastScanTime: null,
          isScanning: false,
          scanProgress: 0,
          scanStage: "",
          scanError: null,
          selectedPorts: new Set(),
          expandedCategories: new Set(),
          categoryFilter: "all",
          stateFilter: "all",
          searchQuery: "",
          showSystemPorts: false,
        }),

      clearSelection: () =>
        set({
          selectedPorts: new Set(),
        }),
    }),
    {
      name: "pm-port-manager-storage",
      storage: createJSONStorage(() => localStorage),
      // Persist scan results, pinned ports, watches, and history
      partialize: (state) => ({
        scanResult: state.scanResult,
        lastScanTime: state.lastScanTime,
        pinnedPorts: state.pinnedPorts,
        portWatches: state.portWatches,
        portHistory: state.portHistory,
      }),
    }
  )
);
