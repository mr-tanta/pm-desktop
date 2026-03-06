import { useState } from "react";
import { useProjectProcess, useLaunchWithConflictCheck, useStopProject } from "@/hooks/use-process-manager";
import { PortConflictModal } from "./port-conflict-modal";
import { Play, Square, Loader2 } from "lucide-react";
import { useProcessManagerStore } from "@/stores/process-manager-store";
import type { LaunchOptions } from "@/types";

interface LaunchButtonProps {
  projectName: string;
  projectPath: string;
  script?: string;
  port?: number;
  size?: "sm" | "md";
}

export function LaunchButton({
  projectName,
  projectPath,
  script,
  port,
  size = "sm",
}: LaunchButtonProps) {
  const process = useProjectProcess(projectName);
  const { checkAndLaunch, forceKillAndLaunch, isLaunching } = useLaunchWithConflictCheck();
  const stopProject = useStopProject();
  const launchingProjects = useProcessManagerStore((s) => s.launchingProjects);
  const isLocalLaunching = launchingProjects.has(projectPath);

  const [conflict, setConflict] = useState<{
    port: number;
    processName: string;
    pid: number;
  } | null>(null);

  const options: LaunchOptions = {
    project_path: projectPath,
    script: script ?? null,
    port: port ?? null,
  };

  const isRunning = process && (process.status === "running" || process.status === "starting");
  const loading = isLaunching || isLocalLaunching || stopProject.isPending;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    if (isRunning && process) {
      stopProject.mutate(process.pid);
    } else {
      checkAndLaunch(options, (info) => setConflict(info));
    }
  };

  const sizeClasses =
    size === "sm"
      ? "p-1 rounded"
      : "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm";

  if (loading) {
    return (
      <button disabled className={`${sizeClasses} text-muted-foreground cursor-not-allowed`}>
        <Loader2 className={`${size === "sm" ? "h-3 w-3" : "h-4 w-4"} animate-spin`} />
        {size === "md" && <span>Starting...</span>}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`${sizeClasses} transition-colors ${
          isRunning
            ? "text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
            : "text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
        }`}
        title={isRunning ? "Stop" : "Start dev server"}
      >
        {isRunning ? (
          <>
            <Square className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {size === "md" && <span>Stop</span>}
          </>
        ) : (
          <>
            <Play className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {size === "md" && <span>Start</span>}
          </>
        )}
      </button>

      {conflict && (
        <PortConflictModal
          port={conflict.port}
          processName={conflict.processName}
          pid={conflict.pid}
          onKillAndStart={() => {
            forceKillAndLaunch(conflict.port, options);
            setConflict(null);
          }}
          onCancel={() => setConflict(null)}
        />
      )}
    </>
  );
}
