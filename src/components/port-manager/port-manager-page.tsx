import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/stores/app-store";
import { usePortManagerStore } from "@/stores/port-manager-store";
import { scanPorts, scanDevPorts, cancelPortScan } from "@/lib/tauri";
import { PortOverview } from "./port-overview";
import { PortList } from "./port-list";
import { PortVisualization } from "./port-visualization";
import { QuickPortsPanel } from "./quick-ports-panel";
import { FiltersBar } from "./filters-bar";
import { KillConfirmModal } from "./kill-confirm-modal";
import { BatchKillModal } from "./batch-kill-modal";
import { ProcessDetailModal } from "./process-detail-modal";
import type { PortScanProgress, PortEntry } from "@/types";
import {
  ArrowLeft,
  Network,
  RefreshCw,
  Loader2,
  X,
  Zap,
  Skull,
} from "lucide-react";

export function PortManagerPage() {
  const setView = useAppStore((s) => s.setView);
  const {
    scanResult,
    scanProgress,
    scanStage,
    scanError,
    setScanResult,
    setScanProgress,
    setScanError,
    setIsScanning,
    getSelectedCount,
    getSelectedPorts,
    getLastScanDate,
    clearSelection,
    deselectAll,
    isPortSelected,
    togglePortSelection,
  } = usePortManagerStore();

  const [isScanning, setLocalIsScanning] = useState(false);
  const [showKillModal, setShowKillModal] = useState(false);
  const [showBatchKillModal, setShowBatchKillModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedPort, setSelectedPort] = useState<PortEntry | null>(null);

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
  }, []); // Empty deps - setScanProgress is stable from Zustand

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
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocalIsScanning(false);
      setIsScanning(false);
    }
  };

  const handleQuickScan = async () => {
    setLocalIsScanning(true);
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await scanDevPorts();
      setScanResult(result);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocalIsScanning(false);
      setIsScanning(false);
    }
  };

  const handleCancelScan = async () => {
    try {
      await cancelPortScan();
    } catch {
      // Ignore
    }
    setLocalIsScanning(false);
    setIsScanning(false);
  };

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
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
              <span>Last scan: {getRelativeTime(lastScanDate)}</span>
              {scanResult && (
                <span className="text-foreground font-medium">
                  ({scanResult.ports.length} ports)
                </span>
              )}
            </div>
          )}
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
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium shadow-sm"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {scanResult ? "Refresh" : "Scan All Ports"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Network className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Port Manager</h1>
          <p className="text-sm text-muted-foreground">
            Scan, monitor, and manage network ports and processes
          </p>
        </div>
      </div>

      {/* Scanning Progress */}
      {isScanning && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
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
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-500">{scanError}</p>
        </div>
      )}

      {/* Empty State */}
      {!scanResult && !isScanning && !scanError && (
        <div className="text-center py-16">
          <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">Ready to Scan</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Scan your system to discover active ports and the processes using them.
            Use Quick Scan for development ports or Full Scan for all ports.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleQuickScan}
              className="px-4 py-2 border border-border rounded-md hover:bg-secondary"
            >
              <Zap className="h-4 w-4 inline mr-2" />
              Quick Scan
            </button>
            <button
              onClick={handleFullScan}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Full Scan
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {scanResult && !isScanning && (
        <>
          {/* Overview Cards */}
          <PortOverview result={scanResult} />

          {/* Filters */}
          <FiltersBar />

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Port List - takes 2 columns */}
            <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
              <PortList
                onKillPort={handleKillPort}
                onViewProcess={handleViewProcess}
              />
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              {/* Quick Ports Panel */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="text-sm font-semibold mb-4">Quick Ports</h2>
                <QuickPortsPanel onKillPort={handleKillPort} />
              </div>

              {/* Visualization */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="text-sm font-semibold mb-4">Port Categories</h2>
                <PortVisualization result={scanResult} />
              </div>
            </div>
          </div>

          {/* Selection Footer */}
          {selectedCount > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-10">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
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
            // Remove from selection if it was selected
            if (selectedPort && isPortSelected(selectedPort.port)) {
              togglePortSelection(selectedPort.port);
            }
            setSelectedPort(null);
            handleFullScan();
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
            handleFullScan();
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
