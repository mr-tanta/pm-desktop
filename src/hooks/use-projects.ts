import { useQuery } from "@tanstack/react-query";
import { listProjects, getProject, getProjectSize } from "@/lib/tauri";
import type { ProjectLocation } from "@/types";

export function useProjects(location?: ProjectLocation) {
  return useQuery({
    queryKey: ["projects", location],
    queryFn: () => listProjects(location),
    staleTime: 60000, // Increased from 30s to 60s
  });
}

export function useProject(name: string | null) {
  return useQuery({
    queryKey: ["project", name],
    queryFn: () => (name ? getProject(name) : null),
    enabled: !!name,
    staleTime: 30000, // Increased from 10s to 30s
  });
}

export function useProjectSize(name: string | null) {
  return useQuery({
    queryKey: ["project-size", name],
    queryFn: () => (name ? getProjectSize(name) : null),
    enabled: !!name,
    staleTime: 300000, // 5 minutes - size doesn't change often
  });
}
