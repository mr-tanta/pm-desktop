import { useQuery } from "@tanstack/react-query";
import { getSystemInfo, loadConfig, checkDockerRunning } from "@/lib/tauri";

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system-info"],
    queryFn: getSystemInfo,
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: loadConfig,
    staleTime: 60000,
  });
}

export function useDockerStatus() {
  return useQuery({
    queryKey: ["docker-status"],
    queryFn: checkDockerRunning,
    staleTime: 30000,
  });
}
