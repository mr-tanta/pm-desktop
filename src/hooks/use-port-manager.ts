import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import {
  scanPorts,
  scanDevPorts,
  cancelPortScan,
  checkPortAvailable,
  killProcess,
  killPort,
  batchKillProcesses,
  batchKillPorts,
  getProcessDetails,
  getProcessTree,
  getNetworkConnections,
  getCommonDevPorts,
} from "@/lib/tauri";
import { usePortManagerStore } from "@/stores/port-manager-store";
import type { PortScanOptions, PortScanProgress } from "@/types";

// Query keys
export const portManagerKeys = {
  all: ["port-manager"] as const,
  scan: () => [...portManagerKeys.all, "scan"] as const,
  devScan: () => [...portManagerKeys.all, "dev-scan"] as const,
  portAvailable: (port: number) => [...portManagerKeys.all, "available", port] as const,
  processDetails: (pid: number) => [...portManagerKeys.all, "process", pid] as const,
  processTree: (pid: number) => [...portManagerKeys.all, "process-tree", pid] as const,
  connections: () => [...portManagerKeys.all, "connections"] as const,
  commonPorts: () => [...portManagerKeys.all, "common-ports"] as const,
};

// Hook to listen for scan progress events
export function usePortScanProgress() {
  const { setScanProgress, setIsScanning } = usePortManagerStore();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<PortScanProgress>("port-scan-progress", (event) => {
        setScanProgress(event.payload.progress_percent, event.payload.stage);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [setScanProgress, setIsScanning]);
}

// Full port scan mutation
export function usePortScan() {
  const queryClient = useQueryClient();
  const { setScanResult, setIsScanning, setScanError } = usePortManagerStore();

  return useMutation({
    mutationFn: async (options?: PortScanOptions) => {
      setIsScanning(true);
      return scanPorts(options);
    },
    onSuccess: (data) => {
      setScanResult(data);
      queryClient.invalidateQueries({ queryKey: portManagerKeys.all });
    },
    onError: (error: Error) => {
      setScanError(error.message);
    },
  });
}

// Quick dev ports scan mutation
export function useDevPortScan() {
  const queryClient = useQueryClient();
  const { setScanResult, setIsScanning, setScanError } = usePortManagerStore();

  return useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      return scanDevPorts();
    },
    onSuccess: (data) => {
      setScanResult(data);
      queryClient.invalidateQueries({ queryKey: portManagerKeys.all });
    },
    onError: (error: Error) => {
      setScanError(error.message);
    },
  });
}

// Cancel scan mutation
export function useCancelPortScan() {
  const { setIsScanning } = usePortManagerStore();

  return useMutation({
    mutationFn: cancelPortScan,
    onSuccess: () => {
      setIsScanning(false);
    },
  });
}

// Check if a port is available
export function useCheckPortAvailable(port: number, enabled: boolean = true) {
  return useQuery({
    queryKey: portManagerKeys.portAvailable(port),
    queryFn: () => checkPortAvailable(port),
    enabled: enabled && port > 0,
    staleTime: 10000, // 10 seconds
  });
}

// Kill process by PID mutation
export function useKillProcess() {
  const queryClient = useQueryClient();
  const { addHistoryEntry } = usePortManagerStore();

  return useMutation({
    mutationFn: async ({ pid, force = false }: { pid: number; force?: boolean }) => {
      return killProcess(pid, force);
    },
    onSuccess: (result, { pid }) => {
      if (result.success) {
        // Add to history
        addHistoryEntry({
          port: result.port ?? 0,
          process_name: "Unknown",
          pid,
          timestamp: new Date().toISOString(),
          action: "killed",
        });
        // Invalidate scan results
        queryClient.invalidateQueries({ queryKey: portManagerKeys.scan() });
      }
    },
  });
}

// Kill port mutation
export function useKillPort() {
  const queryClient = useQueryClient();
  const { addHistoryEntry } = usePortManagerStore();

  return useMutation({
    mutationFn: async ({ port, force = false }: { port: number; force?: boolean }) => {
      return killPort(port, force);
    },
    onSuccess: (result, { port }) => {
      if (result.success) {
        addHistoryEntry({
          port,
          process_name: "Unknown",
          pid: result.pid ?? 0,
          timestamp: new Date().toISOString(),
          action: "killed",
        });
        queryClient.invalidateQueries({ queryKey: portManagerKeys.scan() });
      }
    },
  });
}

// Batch kill processes mutation
export function useBatchKillProcesses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pids, force = false }: { pids: number[]; force?: boolean }) => {
      return batchKillProcesses(pids, force);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portManagerKeys.scan() });
    },
  });
}

// Batch kill ports mutation
export function useBatchKillPorts() {
  const queryClient = useQueryClient();
  const { deselectAll } = usePortManagerStore();

  return useMutation({
    mutationFn: async ({ ports, force = false }: { ports: number[]; force?: boolean }) => {
      return batchKillPorts(ports, force);
    },
    onSuccess: () => {
      deselectAll();
      queryClient.invalidateQueries({ queryKey: portManagerKeys.scan() });
    },
  });
}

// Get process details
export function useProcessDetails(pid: number | null) {
  return useQuery({
    queryKey: portManagerKeys.processDetails(pid ?? 0),
    queryFn: () => (pid ? getProcessDetails(pid) : null),
    enabled: !!pid,
    staleTime: 30000, // 30 seconds
  });
}

// Get process tree
export function useProcessTree(pid: number | null) {
  return useQuery({
    queryKey: portManagerKeys.processTree(pid ?? 0),
    queryFn: () => (pid ? getProcessTree(pid) : null),
    enabled: !!pid,
    staleTime: 30000, // 30 seconds
  });
}

// Get network connections
export function useNetworkConnections() {
  return useQuery({
    queryKey: portManagerKeys.connections(),
    queryFn: getNetworkConnections,
    staleTime: 30000, // 30 seconds
  });
}

// Get common dev ports
export function useCommonDevPorts() {
  return useQuery({
    queryKey: portManagerKeys.commonPorts(),
    queryFn: getCommonDevPorts,
    staleTime: Infinity, // Never stale, these are constants
  });
}

// Utility hook to get port status by checking availability
export function usePortStatus(port: number) {
  const { data: isAvailable, isLoading } = useCheckPortAvailable(port);
  const store = usePortManagerStore();
  const portEntry = store.scanResult?.ports.find((p) => p.port === port);

  return {
    port,
    isAvailable,
    isLoading,
    portEntry,
    isPinned: store.isPinnedPort(port),
  };
}
