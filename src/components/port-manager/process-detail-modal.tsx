import { memo, useState, useEffect } from "react";
import { getProcessTree } from "@/lib/tauri";
import type { ProcessInfo, ProcessTreeNode } from "@/types";
import { X, Cpu, HardDrive, User, GitBranch, ChevronRight, ChevronDown, Loader2, FolderCode, Folder } from "lucide-react";

interface ProcessDetailModalProps {
  process: ProcessInfo;
  port: number;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Process Tree Component
function ProcessTreeView({ node, depth = 0 }: { node: ProcessTreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 hover:bg-secondary/50 rounded px-2 cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren && (
          <button className="p-0.5">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <span className="text-xs font-mono text-muted-foreground">{node.pid}</span>
        <span className="text-sm font-medium">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <ProcessTreeView key={child.pid} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export const ProcessDetailModal = memo(function ProcessDetailModal({
  process,
  port,
  onClose,
}: ProcessDetailModalProps) {
  const [processTree, setProcessTree] = useState<ProcessTreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "tree">("details");

  useEffect(() => {
    if (activeTab === "tree" && !processTree && !loadingTree) {
      setLoadingTree(true);
      getProcessTree(process.pid)
        .then(setProcessTree)
        .catch(console.error)
        .finally(() => setLoadingTree(false));
    }
  }, [activeTab, process.pid, processTree, loadingTree]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {process.project_name ? (
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FolderCode className="h-5 w-5 text-green-500" />
              </div>
            ) : (
              <div className="p-2 bg-secondary rounded-lg">
                <Folder className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {process.project_name || process.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {process.project_name && (
                  <span className="text-foreground/70">{process.name} • </span>
                )}
                Port {port} • PID {process.pid}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === "details"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("tree")}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === "tree"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Process Tree
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {activeTab === "details" && (
            <div className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Cpu className="h-4 w-4" />
                    <span className="text-xs">CPU Usage</span>
                  </div>
                  <span className="text-lg font-semibold">
                    {process.cpu_percent.toFixed(1)}%
                  </span>
                </div>

                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <HardDrive className="h-4 w-4" />
                    <span className="text-xs">Memory</span>
                  </div>
                  <span className="text-lg font-semibold">
                    {formatBytes(process.memory_bytes)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({process.memory_percent.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Project Info - Show prominently if available */}
              {process.project_name && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderCode className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">Project Detected</span>
                  </div>
                  <p className="text-sm font-semibold">{process.project_name}</p>
                  {process.working_directory && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate" title={process.working_directory}>
                      {process.working_directory}
                    </p>
                  )}
                </div>
              )}

              {/* Info List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="text-sm">User</span>
                  </div>
                  <span className="text-sm font-medium">{process.user}</span>
                </div>

                {process.parent_pid && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      <span className="text-sm">Parent PID</span>
                    </div>
                    <span className="text-sm font-mono">{process.parent_pid}</span>
                  </div>
                )}

                {process.children_pids.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      <span className="text-sm">Children</span>
                    </div>
                    <span className="text-sm">
                      {process.children_pids.length} processes
                    </span>
                  </div>
                )}

                {/* Show working directory if no project name (as fallback info) */}
                {!process.project_name && process.working_directory && (
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Folder className="h-4 w-4" />
                      <span className="text-sm">Working Directory</span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate" title={process.working_directory}>
                      {process.working_directory}
                    </p>
                  </div>
                )}
              </div>

              {/* Command */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">
                  Command
                </label>
                <div className="bg-secondary/50 rounded-lg p-3 font-mono text-xs break-all max-h-24 overflow-y-auto">
                  {process.command}
                </div>
              </div>
            </div>
          )}

          {activeTab === "tree" && (
            <div className="min-h-[200px]">
              {loadingTree ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : processTree ? (
                <div className="bg-secondary/30 rounded-lg p-2 max-h-64 overflow-y-auto">
                  <ProcessTreeView node={processTree} />
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    Unable to load process tree
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-secondary text-foreground rounded-md hover:bg-secondary/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});
