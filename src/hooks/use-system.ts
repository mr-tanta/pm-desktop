import { useQuery } from "@tanstack/react-query";
import { getSystemInfo, loadConfig, checkDockerRunning } from "@/lib/tauri";

export function useSystemInfo(enabled = false) {
  return useQuery({
    queryKey: ["system-info"],
    queryFn: getSystemInfo,
    staleTime: 60000,
    enabled,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: loadConfig,
    staleTime: 60000,
  });
}

export function useDockerStatus(enabled = false) {
  return useQuery({
    queryKey: ["docker-status"],
    queryFn: checkDockerRunning,
    staleTime: 60000,
    enabled,
  });
}
