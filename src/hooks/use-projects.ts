import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProjects, getProject, getProjectSize, getProjectDiskInfo, pinProject, unpinProject, getPinnedProjects } from "@/lib/tauri";
import type { ProjectLocation, DiskSizeOptions } from "@/types";

export function useProjects(location?: ProjectLocation) {
  return useQuery({
    queryKey: ["projects", location],
    queryFn: () => listProjects(location),
    staleTime: 60000,
  });
}

export function useProject(name: string | null) {
  return useQuery({
    queryKey: ["project", name],
    queryFn: () => (name ? getProject(name) : null),
    enabled: !!name,
    staleTime: 30000,
  });
}

export function useProjectSize(name: string | null) {
  return useQuery({
    queryKey: ["project-size", name],
    queryFn: () => (name ? getProjectSize(name) : null),
    enabled: !!name,
    staleTime: 300000,
  });
}

export function useProjectDiskInfo(name: string | null, options?: DiskSizeOptions) {
  return useQuery({
    queryKey: ["project-disk-info", name, options],
    queryFn: () => (name ? getProjectDiskInfo(name, options) : null),
    enabled: !!name,
    staleTime: 300000,
  });
}

export function usePinnedProjects() {
  return useQuery({
    queryKey: ["pinned-projects"],
    queryFn: getPinnedProjects,
    staleTime: 30000,
  });
}

export function usePinProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pinProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-projects"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
    },
  });
}

export function useUnpinProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unpinProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-projects"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
    },
  });
}
