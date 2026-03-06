import { AlertTriangle, X } from "lucide-react";

interface PortConflictModalProps {
  port: number;
  processName: string;
  pid: number;
  onKillAndStart: () => void;
  onCancel: () => void;
}

export function PortConflictModal({
  port,
  processName,
  pid,
  onKillAndStart,
  onCancel,
}: PortConflictModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Port {port} is occupied</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Port {port} is currently being used by <strong>{processName}</strong> (PID {pid}).
              Would you like to kill it and start your project?
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-secondary rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onKillAndStart}
            className="px-4 py-2 text-sm rounded-md bg-yellow-600 text-white hover:bg-yellow-500 flex items-center gap-2"
          >
            Kill & Start
          </button>
        </div>
      </div>
    </div>
  );
}
