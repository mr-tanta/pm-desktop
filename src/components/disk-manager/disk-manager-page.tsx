import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/stores/app-store";
import { useDiskManagerStore } from "@/stores/disk-manager-store";
import { scanDisk, cancelDiskScan, getPermissions, requestFullDiskAccessWithDialog } from "@/lib/tauri";
import { DiskOverview } from "./disk-overview";
import { CategoryList } from "./category-list";
import { CleanupPreviewModal } from "./cleanup-preview-modal";
import { DiskVisualization } from "./disk-visualization";
import type { ScanProgressEvent } from "@/types";
import type { PermissionsResult } from "@/types";
import {
  ArrowLeft,
  HardDrive,
  RefreshCw,
  Loader2,
  X,
  History,
  Trash2,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

export function DiskManagerPage() {
  const setView = useAppStore((s) => s.setView);
  const {
    scanResult,
    scanProgress,
    currentScanPath,
    scanError,
    setScanResult,
    setScanProgress,
    setScanError,
    getSelectedSize,
    getSelectedCount,
    getLastScanDate,
    clearSelection,
  } = useDiskManagerStore();

  // Use local state for scanning to ensure immediate UI feedback
  const [isScanning, setIsScanning] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsResult | null>(null);

  const lastScanDate = getLastScanDate();

  // Check permissions on mount
  useEffect(() => {
    getPermissions().then(setPermissions).catch(console.error);
  }, []);

  // Listen for scan progress events
  useEffect(() => {
    const unlisten = listen<ScanProgressEvent>("disk-scan-progress", (event) => {
      setScanProgress(event.payload.progress_percent, event.payload.current_path);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setScanProgress]);

  // Format relative time
  const getRelativeTime = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleScan = async () => {
    console.log("Starting disk scan...");
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await scanDisk();
      console.log("Scan complete:", result);
      setScanResult(result);
    } catch (error) {
      console.error("Scan error:", error);
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsScanning(false);
    }
  };

  const handleCancelScan = async () => {
    try {
      await cancelDiskScan();
    } catch (e) {
      // Ignore
    }
    setIsScanning(false);
  };

  const selectedSize = getSelectedSize();
  const selectedCount = getSelectedCount();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => {
            clearSelection();
            setView("dashboard");
          }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div className="flex items-center gap-3">
          {lastScanDate && !isScanning && (
            <span className="text-xs text-muted-foreground">
              Last scan: {getRelativeTime(lastScanDate)}
            </span>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <History className="h-4 w-4" />
            History
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {scanResult ? "Rescan" : "Scan Disk"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 rounded-lg">
          <HardDrive className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Disk Manager</h1>
          <p className="text-sm text-muted-foreground">
            Clean up developer caches, build artifacts, and free disk space
          </p>
        </div>
      </div>

      {/* Permissions Warning */}
      {permissions && !permissions.required_granted && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-500">
                Full Disk Access Required
              </p>
              <p className="text-xs text-yellow-500/80 mt-1">
                PM Desktop needs Full Disk Access to scan and clean system caches, logs, and protected directories.
                Some items may not be accessible until this permission is granted.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => requestFullDiskAccessWithDialog()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-yellow-500 text-black rounded-md hover:bg-yellow-400"
                >
                  <ExternalLink className="h-3 w-3" />
                  Grant Permission
                </button>
                <button
                  onClick={() => setView("permissions")}
                  className="text-xs text-yellow-500 hover:text-yellow-400"
                >
                  Learn more
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanning Progress */}
      {isScanning && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Scanning disk...</span>
            <button
              onClick={handleCancelScan}
              className="p-1 hover:bg-secondary rounded"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {currentScanPath || "Initializing..."}
          </p>
        </div>
      )}

      {/* Error State */}
      {scanError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-500">{scanError}</p>
        </div>
      )}

      {/* Empty State - only shown when there's no persisted data */}
      {!scanResult && !isScanning && !scanError && (
        <div className="text-center py-16">
          <HardDrive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">Ready to Scan</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Scan your disk to find developer caches, build artifacts, and other
            cleanable files. This will analyze common development directories.
          </p>
          <button
            onClick={handleScan}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Start Scan
          </button>
        </div>
      )}

      {/* Results */}
      {scanResult && !isScanning && (
        <>
          {/* Overview Cards */}
          <DiskOverview result={scanResult} />

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Visualization */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-4">Disk Usage</h2>
              <DiskVisualization result={scanResult} />
            </div>

            {/* Category List */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-4">Categories</h2>
              <CategoryList result={scanResult} />
            </div>
          </div>

          {/* Selection Footer */}
          {selectedCount > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm">
                    <span className="font-medium">{selectedCount}</span>{" "}
                    item{selectedCount !== 1 ? "s" : ""} selected
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(selectedSize)}
                  </span>
                </div>
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Clean Selected...
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      {showPreviewModal && scanResult && (
        <CleanupPreviewModal
          items={scanResult.items}
          onClose={() => setShowPreviewModal(false)}
          onSuccess={() => {
            setShowPreviewModal(false);
            handleScan(); // Refresh after cleanup
          }}
        />
      )}
    </div>
  );
}
