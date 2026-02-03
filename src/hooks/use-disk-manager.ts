import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  scanDisk,
  scanCategory,
  previewCleanup,
  executeCleanup,
  emptyTrash,
  getCleanupHistory,
  getTrashSize,
} from "@/lib/tauri";
import type { DiskCategory, CleanupOptions, ScannableItem } from "@/types";

export function useDiskScan() {
  return useQuery({
    queryKey: ["disk-scan"],
    queryFn: scanDisk,
    staleTime: 60000, // 1 minute
    enabled: false, // Manual trigger only
  });
}

export function useCategoryScan(category: DiskCategory | null) {
  return useQuery({
    queryKey: ["disk-category", category],
    queryFn: () => (category ? scanCategory(category) : null),
    enabled: !!category,
    staleTime: 60000,
  });
}

export function useTrashSize() {
  return useQuery({
    queryKey: ["trash-size"],
    queryFn: getTrashSize,
    staleTime: 30000, // 30 seconds
  });
}

export function useCleanupHistory() {
  return useQuery({
    queryKey: ["cleanup-history"],
    queryFn: getCleanupHistory,
    staleTime: 300000, // 5 minutes
  });
}

export function usePreviewCleanup() {
  return useMutation({
    mutationFn: ({
      options,
      allItems,
    }: {
      options: CleanupOptions;
      allItems: ScannableItem[];
    }) => previewCleanup(options, allItems),
  });
}

export function useExecuteCleanup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      options,
      allItems,
    }: {
      options: CleanupOptions;
      allItems: ScannableItem[];
    }) => executeCleanup(options, allItems),
    onSuccess: () => {
      // Invalidate all disk-related queries
      queryClient.invalidateQueries({ queryKey: ["disk-scan"] });
      queryClient.invalidateQueries({ queryKey: ["disk-category"] });
      queryClient.invalidateQueries({ queryKey: ["trash-size"] });
      queryClient.invalidateQueries({ queryKey: ["cleanup-history"] });
    },
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: emptyTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash-size"] });
      queryClient.invalidateQueries({ queryKey: ["disk-scan"] });
    },
  });
}
