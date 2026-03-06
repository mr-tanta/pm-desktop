import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { usePortManagerStore } from "@/stores/port-manager-store";
import { scanPorts, scanDevPorts, cancelPortScan } from "@/lib/tauri";
import { PortOverview } from "./port-overview";
import { PortList } from "./port-list";
import { FiltersBar } from "./filters-bar";
import { KillConfirmModal } from "./kill-confirm-modal";
import { BatchKillModal } from "./batch-kill-modal";
import { ProcessDetailModal } from "./process-detail-modal";
import type { PortScanProgress, PortEntry } from "@/types";
import {
  Network,
  RefreshCw,
  Loader2,
  X,
  Zap,
  Skull,
} from "lucide-react";

export function PortManagerPage() {
  const {
    scanResult,
    scanProgress,
    scanStage,
    scanError,
    lastScanTime,
    setScanResult,
    setScanProgress,
    setScanError,
    setIsScanning,
    getSelectedCount,
    getSelectedPorts,
    getLastScanDate,
    deselectAll,
    isPortSelected,
    togglePortSelection,
    expandAllCategories,
  } = usePortManagerStore();

  const [isScanning, setLocalIsScanning] = useState(false);
  const [showKillModal, setShowKillModal] = useState(false);
  const [showBatchKillModal, setShowBatchKillModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedPort, setSelectedPort] = useState<PortEntry | null>(null);
  const hasAutoScanned = useRef(false);

  const lastScanDate = getLastScanDate();
  const selectedCount = getSelectedCount();
  const selectedPorts = getSelectedPorts();

  // Listen for scan progress events
  useEffect(() => {
    const unlisten = listen<PortScanProgress>("port-scan-progress", (event) => {
      setScanProgress(event.payload.progress_percent, event.payload.stage);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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

  const handleFullScan = async () => {
    setLocalIsScanning(true);
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await scanPorts({ include_system_ports: false });
      setScanResult(result);
      expandAllCategories();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocalIsScanning(false);
      setIsScanning(false);
    }
  };

  const handleQuickScan = useCallback(async () => {
    setLocalIsScanning(true);
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await scanDevPorts();
      setScanResult(result);
      expandAllCategories();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocalIsScanning(false);
      setIsScanning(false);
    }
  }, [setIsScanning, setScanError, setScanResult, expandAllCategories]);

  const handleCancelScan = async () => {
    try {
      await cancelPortScan();
    } catch {
      // Ignore
    }
    setLocalIsScanning(false);
    setIsScanning(false);
  };

  // Auto-scan on mount if no results or stale (>60s)
  useEffect(() => {
    if (hasAutoScanned.current) return;
    const isStale = !lastScanTime || Date.now() - lastScanTime > 60_000;
    if (isStale && !isScanning) {
      hasAutoScanned.current = true;
      handleQuickScan();
    } else if (scanResult) {
      // Already have fresh results, just expand categories
      hasAutoScanned.current = true;
      expandAllCategories();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKillPort = (port: PortEntry) => {
    setSelectedPort(port);
    setShowKillModal(true);
  };

  const handleViewProcess = (port: PortEntry) => {
    setSelectedPort(port);
    setShowProcessModal(true);
  };

  const handleBatchKill = () => {
    if (selectedCount > 0) {
      setShowBatchKillModal(true);
    }
  };

  // Re-scan after kill with a short delay
  const rescanAfterKill = useCallback(() => {
    setTimeout(() => handleQuickScan(), 1000);
  }, [handleQuickScan]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Port Manager</h1>
            {lastScanDate && !isScanning && (
              <p className="text-xs text-muted-foreground">
                Last scan {getRelativeTime(lastScanDate)} · {scanResult?.ports.length ?? 0} ports
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-secondary border border-border disabled:opacity-50"
            title="Scan common development ports"
          >
            <Zap className="h-4 w-4" />
            Quick
          </button>
          <button
            onClick={handleFullScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Full Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scanning Progress */}
      {isScanning && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Scanning ports...</span>
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
          <p className="text-xs text-muted-foreground">
            {scanStage || "Initializing..."}
          </p>
        </div>
      )}

      {/* Error State */}
      {scanError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-500">{scanError}</p>
        </div>
      )}

      {/* Results */}
      {scanResult && !isScanning && (
        <>
          {/* Overview Cards + Inline Visualization */}
          <PortOverview result={scanResult} />

          {/* Filters */}
          <FiltersBar />

          {/* Port List - Full Width */}
          <div className="bg-card border border-border rounded-lg p-4">
            <PortList
              onKillPort={handleKillPort}
              onViewProcess={handleViewProcess}
            />
          </div>

          {/* Selection Footer */}
          {selectedCount > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-10">
              <div className="px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm">
                    <span className="font-medium">{selectedCount}</span>{" "}
                    port{selectedCount !== 1 ? "s" : ""} selected
                  </span>
                  <button
                    onClick={deselectAll}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear selection
                  </button>
                </div>
                <button
                  onClick={handleBatchKill}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <Skull className="h-4 w-4" />
                  Kill Selected ({selectedCount})
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showKillModal && selectedPort && (
        <KillConfirmModal
          port={selectedPort}
          onClose={() => {
            setShowKillModal(false);
            setSelectedPort(null);
          }}
          onSuccess={() => {
            setShowKillModal(false);
            if (selectedPort && isPortSelected(selectedPort.port)) {
              togglePortSelection(selectedPort.port);
            }
            setSelectedPort(null);
            rescanAfterKill();
          }}
        />
      )}

      {showBatchKillModal && (
        <BatchKillModal
          ports={selectedPorts}
          onClose={() => setShowBatchKillModal(false)}
          onSuccess={() => {
            setShowBatchKillModal(false);
            deselectAll();
            rescanAfterKill();
          }}
        />
      )}

      {showProcessModal && selectedPort?.process && (
        <ProcessDetailModal
          process={selectedPort.process}
          port={selectedPort.port}
          onClose={() => {
            setShowProcessModal(false);
            setSelectedPort(null);
          }}
        />
      )}
    </div>
  );
}
