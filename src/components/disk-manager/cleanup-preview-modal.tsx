import { useState, useEffect } from "react";
import { useDiskManagerStore } from "@/stores/disk-manager-store";
import { previewCleanup, executeCleanup, checkFullDiskAccessStatus, requestFullDiskAccessWithDialog } from "@/lib/tauri";
import type { ScannableItem, CleanupPreview, SafetyLevel } from "@/types";
import {
  X,
  AlertTriangle,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CleanupPreviewModalProps {
  items: ScannableItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CleanupPreviewModal({
  items,
  onClose,
  onSuccess,
}: CleanupPreviewModalProps) {
  const { selectedItemIds, getSelectedItems, deselectAll } = useDiskManagerStore();
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [moveToTrash, setMoveToTrash] = useState(true);
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>("moderate");
  const [hasFDA, setHasFDA] = useState<boolean | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    freedBytes: number;
    formattedFreed: string;
    deletedCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const selectedItems = getSelectedItems();
  const hasAggressiveItems = selectedItems.some(
    (i) => i.safety_level === "aggressive"
  );
  const needsConfirmation =
    hasAggressiveItems && safetyLevel === "aggressive";

  // Check for FDA on mount
  useEffect(() => {
    checkFullDiskAccessStatus().then(setHasFDA).catch(() => setHasFDA(false));
  }, []);

  // Check if any selected items might require FDA (Library paths)
  const mightRequireFDA = selectedItems.some((item) =>
    item.path.includes("/Library/") || item.path.includes("/private/var/")
  );

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const previewResult = await previewCleanup(
        {
          item_ids: Array.from(selectedItemIds),
          safety_level: safetyLevel,
          move_to_trash: moveToTrash,
          dry_run: true,
        },
        items
      );
      setPreview(previewResult);
    } catch (error) {
      console.error("Preview failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (needsConfirmation && confirmText !== "DELETE") {
      return;
    }

    setIsExecuting(true);
    try {
      const cleanupResult = await executeCleanup(
        {
          item_ids: Array.from(selectedItemIds),
          safety_level: safetyLevel,
          move_to_trash: moveToTrash,
          dry_run: false,
        },
        items
      );
      setResult({
        success: cleanupResult.success,
        freedBytes: cleanupResult.freed_bytes,
        formattedFreed: cleanupResult.formatted_freed,
        deletedCount: cleanupResult.deleted_count,
        failedCount: cleanupResult.failed_count,
        errors: cleanupResult.errors,
      });
      if (cleanupResult.success) {
        deselectAll();
      }
    } catch (error) {
      setResult({
        success: false,
        freedBytes: 0,
        formattedFreed: "0 B",
        deletedCount: 0,
        failedCount: selectedItems.length,
        errors: [error instanceof Error ? error.message : "Cleanup failed"],
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Load preview on mount
  useState(() => {
    handlePreview();
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Cleanup Preview</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Result View */}
          {result && (
            <div className="space-y-4">
              <div
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg",
                  result.success
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-red-500/10 border border-red-500/30"
                )}
              >
                {result.success ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
                <div>
                  <p className="font-medium">
                    {result.success ? "Cleanup Complete" : "Cleanup Failed"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.success
                      ? `Freed ${result.formattedFreed} (${result.deletedCount} items)`
                      : `${result.failedCount} items failed`}
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-500 mb-2">Errors:</p>
                  <ul className="text-xs text-red-400 space-y-1">
                    {result.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <button
                onClick={result.success ? onSuccess : onClose}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                {result.success ? "Done" : "Close"}
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !result && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Preview View */}
          {preview && !isLoading && !result && (
            <div className="space-y-4">
              {/* FDA Warning - Required for Library paths */}
              {hasFDA === false && mightRequireFDA && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-500">
                        Full Disk Access Required
                      </p>
                      <p className="text-xs text-red-400 mt-1">
                        The selected items include Library Caches which require Full Disk Access permission. Without it, macOS will block the cleanup.
                      </p>
                      <div className="mt-3 p-2 bg-red-500/10 rounded text-xs text-red-300">
                        <strong>To fix:</strong> System Settings → Privacy & Security → Full Disk Access → Add PM Desktop → Restart app
                      </div>
                      <button
                        onClick={() => requestFullDiskAccessWithDialog()}
                        className="flex items-center gap-1.5 px-3 py-1.5 mt-3 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-400"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open System Settings
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {preview.items.length} items to clean
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {preview.formatted_size}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {preview.total_files.toLocaleString()} files will be{" "}
                  {moveToTrash ? "moved to Trash" : "permanently deleted"}
                </p>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-500 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Warnings</span>
                  </div>
                  <ul className="text-xs text-yellow-400 space-y-1">
                    {preview.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {/* Safety Level */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Safety Level
                  </label>
                  <div className="flex gap-2">
                    {(["safe", "moderate", "aggressive"] as SafetyLevel[]).map(
                      (level) => (
                        <button
                          key={level}
                          onClick={() => {
                            setSafetyLevel(level);
                            setPreview(null);
                            handlePreview();
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border",
                            safetyLevel === level
                              ? level === "safe"
                                ? "bg-green-500/20 border-green-500 text-green-500"
                                : level === "moderate"
                                ? "bg-yellow-500/20 border-yellow-500 text-yellow-500"
                                : "bg-red-500/20 border-red-500 text-red-500"
                              : "border-border hover:border-muted-foreground"
                          )}
                        >
                          {level === "safe" && <ShieldCheck className="h-3 w-3" />}
                          {level === "moderate" && <ShieldAlert className="h-3 w-3" />}
                          {level === "aggressive" && <ShieldOff className="h-3 w-3" />}
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Move to Trash toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Move to Trash</p>
                    <p className="text-xs text-muted-foreground">
                      Recoverable for 30 days
                    </p>
                  </div>
                  <button
                    onClick={() => setMoveToTrash(!moveToTrash)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative",
                      moveToTrash ? "bg-primary" : "bg-secondary"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                        moveToTrash ? "left-6" : "left-1"
                      )}
                    />
                  </button>
                </div>

                {/* Aggressive confirmation */}
                {needsConfirmation && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-500 mb-2">
                      Type <strong>DELETE</strong> to confirm aggressive cleanup:
                    </p>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <p className="text-sm font-medium mb-2">Items to clean:</p>
                <div className="max-h-48 overflow-y-auto space-y-1 bg-secondary/30 rounded-lg p-2">
                  {preview.items.slice(0, 20).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs py-1 px-2"
                    >
                      <span className="truncate flex-1 mr-2">{item.name}</span>
                      <span className="text-muted-foreground font-mono">
                        {item.formatted_size}
                      </span>
                    </div>
                  ))}
                  {preview.items.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ...and {preview.items.length - 20} more items
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preview && !isLoading && !result && (
          <div className="p-4 border-t border-border flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-secondary rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={
                isExecuting ||
                preview.items.length === 0 ||
                (needsConfirmation && confirmText !== "DELETE")
              }
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm text-white rounded-md",
                "bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Clean {preview.items.length} Items
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
