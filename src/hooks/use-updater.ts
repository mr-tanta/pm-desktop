import { useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
}

// Check if updater is properly configured (has endpoints)
// When endpoints are empty, the updater plugin will fail
const UPDATER_CONFIGURED = false; // Set to true when update server is configured

export function useUpdater() {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    // Skip if updater is not configured
    if (!UPDATER_CONFIGURED) {
      return null;
    }

    setChecking(true);
    setError(null);

    try {
      const update = await check();

      if (update) {
        setUpdateAvailable({
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body,
        });
        return update;
      }
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to check for updates";
      setError(message);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setDownloading(true);
    setProgress(0);
    setError(null);

    try {
      const update = await check();
      if (!update) {
        setError("No update available");
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      // Relaunch the app after update
      await relaunch();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to install update";
      setError(message);
    } finally {
      setDownloading(false);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(null);
  }, []);

  return {
    checking,
    downloading,
    progress,
    updateAvailable,
    error,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}
