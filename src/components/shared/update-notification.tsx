import { Download, X, RefreshCw, AlertCircle } from "lucide-react";
import { useUpdater } from "@/hooks/use-updater";

export function UpdateNotification() {
  const {
    downloading,
    progress,
    updateAvailable,
    error,
    downloadAndInstall,
    dismissUpdate,
  } = useUpdater();

  // Don't render if no update and not downloading
  // Note: Auto-check disabled until update server is configured
  if (!updateAvailable && !downloading && !error) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {error && (
        <div className="bg-red-50 border border-red-300 dark:bg-red-900/90 dark:border-red-700 rounded-lg p-4 shadow-lg backdrop-blur">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Update Error</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {updateAvailable && !downloading && (
        <div className="bg-popover border border-border rounded-lg p-4 shadow-lg backdrop-blur">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Update Available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Version {updateAvailable.version} is ready to install
              </p>
              {updateAvailable.body && (
                <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2">
                  {updateAvailable.body}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={downloadAndInstall}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 rounded-md transition-colors"
                >
                  Install Update
                </button>
                <button
                  onClick={dismissUpdate}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={dismissUpdate}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {downloading && (
        <div className="bg-popover border border-border rounded-lg p-4 shadow-lg backdrop-blur">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium">Installing Update...</p>
              <p className="text-xs text-muted-foreground mt-1">
                {progress < 100 ? `Downloading: ${progress}%` : "Installing..."}
              </p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
