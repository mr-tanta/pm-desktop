import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProjectEnvFiles,
  readEnvFile,
  writeEnvVariable,
  copyEnvVariables,
} from "@/lib/tauri";

export const envManagerKeys = {
  all: ["env-manager"] as const,
  files: (projectPath: string) => [...envManagerKeys.all, "files", projectPath] as const,
  file: (path: string) => [...envManagerKeys.all, "file", path] as const,
};

export function useEnvFiles(projectPath: string | null) {
  return useQuery({
    queryKey: envManagerKeys.files(projectPath ?? ""),
    queryFn: () => (projectPath ? listProjectEnvFiles(projectPath) : []),
    enabled: !!projectPath,
  });
}

export function useEnvFile(path: string | null) {
  return useQuery({
    queryKey: envManagerKeys.file(path ?? ""),
    queryFn: () => (path ? readEnvFile(path) : null),
    enabled: !!path,
  });
}

export function useWriteEnvVariable(projectPath: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      path,
      key,
      value,
    }: {
      path: string;
      key: string;
      value: string;
    }) => writeEnvVariable(path, key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: envManagerKeys.files(projectPath),
      });
    },
  });
}

export function useCopyEnvVariables() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourcePath,
      targetPath,
      keys,
    }: {
      sourcePath: string;
      targetPath: string;
      keys: string[];
    }) => copyEnvVariables(sourcePath, targetPath, keys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: envManagerKeys.all });
    },
  });
}
