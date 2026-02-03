import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DiskScanResult, ScannableItem, DiskCategory, SafetyLevel } from "@/types";

interface DiskManagerState {
  // Scan state
  scanResult: DiskScanResult | null;
  lastScanTime: number | null; // Unix timestamp for serialization
  isScanning: boolean;
  scanProgress: number;
  currentScanPath: string;
  scanError: string | null;

  // Selection state
  selectedItemIds: Set<string>;
  expandedCategories: Set<DiskCategory>;

  // Filter state
  safetyFilter: SafetyLevel | "all";
  searchQuery: string;

  // Actions
  setScanResult: (result: DiskScanResult | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setScanProgress: (progress: number, path: string) => void;
  setScanError: (error: string | null) => void;

  // Selection actions
  toggleItemSelection: (itemId: string) => void;
  selectAllInCategory: (category: DiskCategory, items: ScannableItem[]) => void;
  deselectAllInCategory: (category: DiskCategory, items: ScannableItem[]) => void;
  selectAll: (items: ScannableItem[]) => void;
  deselectAll: () => void;
  isItemSelected: (itemId: string) => boolean;

  // Category actions
  toggleCategoryExpanded: (category: DiskCategory) => void;
  isCategoryExpanded: (category: DiskCategory) => boolean;

  // Filter actions
  setSafetyFilter: (filter: SafetyLevel | "all") => void;
  setSearchQuery: (query: string) => void;

  // Computed
  getSelectedItems: () => ScannableItem[];
  getSelectedSize: () => number;
  getSelectedCount: () => number;
  getLastScanDate: () => Date | null;

  // Reset
  reset: () => void;
  clearSelection: () => void;
}

export const useDiskManagerStore = create<DiskManagerState>()(
  persist(
    (set, get) => ({
      // Initial state
      scanResult: null,
      lastScanTime: null,
      isScanning: false,
      scanProgress: 0,
      currentScanPath: "",
      scanError: null,
      selectedItemIds: new Set(),
      expandedCategories: new Set(),
      safetyFilter: "all",
      searchQuery: "",

      // Scan actions
      setScanResult: (result) => set({
        scanResult: result,
        scanError: null,
        lastScanTime: result ? Date.now() : null
      }),
      setIsScanning: (scanning) =>
        set({
          isScanning: scanning,
          scanProgress: scanning ? 0 : get().scanProgress,
          currentScanPath: scanning ? "" : get().currentScanPath,
        }),
      setScanProgress: (progress, path) =>
        set({ scanProgress: progress, currentScanPath: path }),
      setScanError: (error) => set({ scanError: error, isScanning: false }),

      // Selection actions
      toggleItemSelection: (itemId) =>
        set((state) => {
          const newSelected = new Set(state.selectedItemIds);
          if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
          } else {
            newSelected.add(itemId);
          }
          return { selectedItemIds: newSelected };
        }),

      selectAllInCategory: (category, items) =>
        set((state) => {
          const newSelected = new Set(state.selectedItemIds);
          const categoryItems = items.filter((i) => i.category === category);
          for (const item of categoryItems) {
            newSelected.add(item.id);
            // Also add children
            for (const child of item.children) {
              newSelected.add(child.id);
            }
          }
          return { selectedItemIds: newSelected };
        }),

      deselectAllInCategory: (category, items) =>
        set((state) => {
          const newSelected = new Set(state.selectedItemIds);
          const categoryItems = items.filter((i) => i.category === category);
          for (const item of categoryItems) {
            newSelected.delete(item.id);
            for (const child of item.children) {
              newSelected.delete(child.id);
            }
          }
          return { selectedItemIds: newSelected };
        }),

      selectAll: (items) =>
        set(() => {
          const newSelected = new Set<string>();
          for (const item of items) {
            newSelected.add(item.id);
            for (const child of item.children) {
              newSelected.add(child.id);
            }
          }
          return { selectedItemIds: newSelected };
        }),

      deselectAll: () => set({ selectedItemIds: new Set() }),

      isItemSelected: (itemId) => get().selectedItemIds.has(itemId),

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

      // Filter actions
      setSafetyFilter: (filter) => set({ safetyFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Computed
      getSelectedItems: () => {
        const state = get();
        if (!state.scanResult) return [];

        const allItems: ScannableItem[] = [];
        for (const item of state.scanResult.items) {
          if (state.selectedItemIds.has(item.id)) {
            allItems.push(item);
          }
          for (const child of item.children) {
            if (state.selectedItemIds.has(child.id)) {
              allItems.push(child);
            }
          }
        }
        return allItems;
      },

      getSelectedSize: () => {
        const items = get().getSelectedItems();
        return items.reduce((sum, item) => sum + item.size_bytes, 0);
      },

      getSelectedCount: () => get().selectedItemIds.size,

      getLastScanDate: () => {
        const timestamp = get().lastScanTime;
        return timestamp ? new Date(timestamp) : null;
      },

      // Reset everything (including persisted scan data)
      reset: () =>
        set({
          scanResult: null,
          lastScanTime: null,
          isScanning: false,
          scanProgress: 0,
          currentScanPath: "",
          scanError: null,
          selectedItemIds: new Set(),
          expandedCategories: new Set(),
          safetyFilter: "all",
          searchQuery: "",
        }),

      // Clear only selection state (preserves scan results)
      clearSelection: () =>
        set({
          selectedItemIds: new Set(),
          expandedCategories: new Set(),
          safetyFilter: "all",
          searchQuery: "",
        }),
    }),
    {
      name: "pm-disk-manager-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist scan results and last scan time
      partialize: (state) => ({
        scanResult: state.scanResult,
        lastScanTime: state.lastScanTime,
      }),
    }
  )
);
