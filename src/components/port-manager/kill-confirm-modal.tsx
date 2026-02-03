import { memo, useState } from "react";
import { killPort } from "@/lib/tauri";
import type { PortEntry } from "@/types";
import { X, AlertTriangle, Skull, Loader2 } from "lucide-react";

interface KillConfirmModalProps {
  port: PortEntry;
  onClose: () => void;
  onSuccess: () => void;
}

export const KillConfirmModal = memo(function KillConfirmModal({
  port,
  onClose,
  onSuccess,
}: KillConfirmModalProps) {
  const [isKilling, setIsKilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceKill, setForceKill] = useState(false);

  const processName = port.process?.name || "Unknown process";
  const pid = port.process?.pid;

  const handleKill = async () => {
    setIsKilling(true);
    setError(null);

    try {
      const result = await killPort(port.port, forceKill);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kill process");
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Kill Process</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to kill the process on port{" "}
            <span className="font-mono font-semibold text-foreground">{port.port}</span>?
          </p>

          <div className="bg-secondary/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Process</span>
              <span className="text-sm font-medium">{processName}</span>
            </div>
            {pid && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">PID</span>
                <span className="text-sm font-mono">{pid}</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Port</span>
              <span className="text-sm font-mono">{port.port}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">State</span>
              <span className="text-sm capitalize">{port.state.replace("_", " ")}</span>
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
            <span>Force kill (SIGKILL)</span>
            <span className="text-xs text-muted-foreground">
              - Use if normal termination fails
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-xs text-yellow-500">
              Killing a process may cause data loss if the process has unsaved work.
              Development servers will need to be restarted manually.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isKilling}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleKill}
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
                Kill Process
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
