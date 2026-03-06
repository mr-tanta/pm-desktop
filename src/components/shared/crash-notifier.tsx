import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProcessCrashListener, processManagerKeys } from "@/hooks/use-process-manager";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { useEffect } from "react";
import type { ProcessCrashedEvent } from "@/types";

export function CrashNotifier() {
  const queryClient = useQueryClient();

  // Request notification permission on mount
  useEffect(() => {
    (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
    })();
  }, []);

  const handleCrash = useCallback(
    async (event: ProcessCrashedEvent) => {
      queryClient.invalidateQueries({ queryKey: processManagerKeys.processes() });

      const granted = await isPermissionGranted();
      if (granted) {
        sendNotification({
          title: "Process Crashed",
          body: `${event.project_name} exited with code ${event.exit_code ?? "unknown"}`,
        });
      }
    },
    [queryClient]
  );

  useProcessCrashListener(handleCrash);

  return null;
}
