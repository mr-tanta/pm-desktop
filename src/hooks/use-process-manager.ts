import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useCallback } from "react";
import {
  launchProject,
  stopProject,
  getManagedProcesses,
  getProcessLogs,
  detectProjectPort,
  checkPortAvailable,
  killPort,
  scanDevPorts,
} from "@/lib/tauri";
import { useProcessManagerStore } from "@/stores/process-manager-store";
import type { LaunchOptions, ProcessLogEvent, ProcessCrashedEvent } from "@/types";

export const processManagerKeys = {
  all: ["process-manager"] as const,
  processes: () => [...processManagerKeys.all, "processes"] as const,
  logs: (pid: number) => [...processManagerKeys.all, "logs", pid] as const,
};

export function useManagedProcesses() {
  const setProcesses = useProcessManagerStore((s) => s.setProcesses);

  return useQuery({
    queryKey: processManagerKeys.processes(),
    queryFn: async () => {
      const procs = await getManagedProcesses();
      setProcesses(procs);
      return procs;
    },
    refetchInterval: 5000,
  });
}

export function useLaunchProject() {
  const queryClient = useQueryClient();
  const { addLaunching, removeLaunching } = useProcessManagerStore();

  return useMutation({
    mutationFn: async (options: LaunchOptions) => {
      addLaunching(options.project_path);
      return launchProject(options);
    },
    onSuccess: (_data, variables) => {
      removeLaunching(variables.project_path);
      queryClient.invalidateQueries({ queryKey: processManagerKeys.processes() });
    },
    onError: (_error, variables) => {
      removeLaunching(variables.project_path);
    },
  });
}

export function useStopProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pid: number) => stopProject(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: processManagerKeys.processes() });
    },
  });
}

export function useProcessLogs(pid: number | null) {
  return useQuery({
    queryKey: processManagerKeys.logs(pid ?? 0),
    queryFn: () => (pid ? getProcessLogs(pid) : []),
    enabled: !!pid,
  });
}

export function useProcessLogStream(
  pid: number | null,
  onLog: (event: ProcessLogEvent) => void
) {
  useEffect(() => {
    if (!pid) return;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<ProcessLogEvent>("process-log", (event) => {
        if (event.payload.pid === pid) {
          onLog(event.payload);
        }
      });
    };

    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [pid, onLog]);
}

export function useProcessCrashListener(
  onCrash: (event: ProcessCrashedEvent) => void
) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<ProcessCrashedEvent>("process-crashed", (event) => {
        onCrash(event.payload);
      });
    };

    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [onCrash]);
}

export function useProjectProcess(projectName: string | null) {
  const processes = useProcessManagerStore((s) => s.processes);
  return processes.find(
    (p) =>
      p.project_name === projectName &&
      (p.status === "running" || p.status === "starting")
  );
}

// Port conflict check + launch
export function useLaunchWithConflictCheck() {
  const launch = useLaunchProject();

  const checkAndLaunch = useCallback(
    async (
      options: LaunchOptions,
      onConflict: (info: { port: number; processName: string; pid: number }) => void
    ) => {
      // Detect expected port
      const port = options.port ?? (await detectProjectPort(options.project_path));

      if (port) {
        const available = await checkPortAvailable(port);
        if (!available) {
          // Find occupying process
          try {
            const scan = await scanDevPorts();
            const occupying = scan.ports.find((p) => p.port === port);
            if (occupying?.process) {
              onConflict({
                port,
                processName: occupying.process.name,
                pid: occupying.process.pid,
              });
              return;
            }
          } catch {
            // If scan fails, try to launch anyway
          }
        }
      }

      launch.mutate(options);
    },
    [launch]
  );

  const forceKillAndLaunch = useCallback(
    async (port: number, options: LaunchOptions) => {
      await killPort(port, true);
      // Small delay to let the port free up
      await new Promise((r) => setTimeout(r, 500));
      launch.mutate(options);
    },
    [launch]
  );

  return {
    checkAndLaunch,
    forceKillAndLaunch,
    isLaunching: launch.isPending,
  };
}
