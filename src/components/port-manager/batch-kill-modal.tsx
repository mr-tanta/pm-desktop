import { memo, useState } from "react";
import { batchKillPorts } from "@/lib/tauri";
import type { PortEntry, BatchKillResult } from "@/types";
import { X, AlertTriangle, Skull, Loader2, CheckCircle, XCircle } from "lucide-react";

interface BatchKillModalProps {
  ports: PortEntry[];
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchKillModal = memo(function BatchKillModal({
  ports,
  onClose,
  onSuccess,
}: BatchKillModalProps) {
  const [isKilling, setIsKilling] = useState(false);
  const [forceKill, setForceKill] = useState(false);
  const [result, setResult] = useState<BatchKillResult | null>(null);

  const portNumbers = ports.map((p) => p.port);

  const handleBatchKill = async () => {
    setIsKilling(true);
    setResult(null);

    try {
      const res = await batchKillPorts(portNumbers, forceKill);
      setResult(res);

      // If all succeeded, auto-close after a delay
      if (res.failed === 0) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      setResult({
        total: portNumbers.length,
        succeeded: 0,
        failed: portNumbers.length,
        results: [{
          success: false,
          pid: null,
          port: null,
          message: err instanceof Error ? err.message : "Batch kill failed",
        }],
      });
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg mx-4 shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Kill Multiple Processes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {!result ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                You are about to kill{" "}
                <span className="font-semibold text-foreground">{ports.length}</span>{" "}
                processes. This action cannot be undone.
              </p>

              {/* Port List */}
              <div className="bg-secondary/50 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {ports.map((port) => (
                    <div
                      key={port.port}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono">{port.port}</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {port.process?.name || "Unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Force Kill Option */}
              <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceKill}
                  onChange={(e) => setForceKill(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Force kill all (SIGKILL)</span>
              </label>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-500">
                  Killing processes may cause data loss. All development servers
                  will need to be restarted manually.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="text-center py-4">
                {result.failed === 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <p className="text-lg font-medium">All processes killed</p>
                    <p className="text-sm text-muted-foreground">
                      Successfully terminated {result.succeeded} processes
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <XCircle className="h-12 w-12 text-orange-500" />
                    <p className="text-lg font-medium">Partial success</p>
                    <p className="text-sm text-muted-foreground">
                      Killed {result.succeeded} of {result.total} processes
                    </p>
                  </div>
                )}
              </div>

              {/* Result Details */}
              {result.results.length > 0 && (
                <div className="bg-secondary/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {result.results.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {r.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-mono">{r.port}</span>
                        </div>
                        <span
                          className={
                            r.success
                              ? "text-green-500"
                              : "text-red-500 truncate max-w-[200px]"
                          }
                        >
                          {r.success ? "Killed" : r.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          {!result ? (
            <>
              <button
                onClick={onClose}
                disabled={isKilling}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchKill}
                disabled={isKilling}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isKilling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Killing...
                  </>
                ) : (
                  <>
                    <Skull className="h-4 w-4" />
                    Kill {ports.length} Processes
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={result.failed === 0 ? onSuccess : onClose}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              {result.failed === 0 ? "Done" : "Close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
