import { memo } from "react";
import { usePortManagerStore } from "@/stores/port-manager-store";
import type { PortEntry, ConnectionState } from "@/types";
import {
  Skull,
  Info,
  Pin,
  PinOff,
  Check,
  Globe,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";

interface PortEntryRowProps {
  port: PortEntry;
  onKill: () => void;
  onViewProcess: () => void;
}

const STATE_COLORS: Record<ConnectionState, { bg: string; text: string }> = {
  listen: { bg: "bg-green-500/10", text: "text-green-500" },
  established: { bg: "bg-blue-500/10", text: "text-blue-500" },
  time_wait: { bg: "bg-yellow-500/10", text: "text-yellow-500" },
  close_wait: { bg: "bg-orange-500/10", text: "text-orange-500" },
  syn_sent: { bg: "bg-purple-500/10", text: "text-purple-500" },
  syn_received: { bg: "bg-purple-500/10", text: "text-purple-500" },
  fin_wait1: { bg: "bg-orange-500/10", text: "text-orange-500" },
  fin_wait2: { bg: "bg-orange-500/10", text: "text-orange-500" },
  closing: { bg: "bg-red-500/10", text: "text-red-500" },
  last_ack: { bg: "bg-red-500/10", text: "text-red-500" },
  closed: { bg: "bg-gray-500/10", text: "text-gray-500" },
  unknown: { bg: "bg-gray-500/10", text: "text-gray-500" },
};

const STATE_LABELS: Record<ConnectionState, string> = {
  listen: "Listening",
  established: "Established",
  time_wait: "Time Wait",
  close_wait: "Close Wait",
  syn_sent: "SYN Sent",
  syn_received: "SYN Received",
  fin_wait1: "FIN Wait 1",
  fin_wait2: "FIN Wait 2",
  closing: "Closing",
  last_ack: "Last ACK",
  closed: "Closed",
  unknown: "Unknown",
};

export const PortEntryRow = memo(function PortEntryRow({
  port,
  onKill,
  onViewProcess,
}: PortEntryRowProps) {
  const { togglePortSelection, isPortSelected, togglePinnedPort, isPinnedPort } =
    usePortManagerStore();

  const isSelected = isPortSelected(port.port);
  const isPinned = isPinnedPort(port.port);
  const stateColor = STATE_COLORS[port.state] || STATE_COLORS.unknown;
  const stateLabel = STATE_LABELS[port.state] || "Unknown";

  const processName = port.process?.name || "Unknown";
  const projectName = port.process?.project_name;
  const pid = port.process?.pid;

  // Show project name as primary if available, otherwise show process name
  const displayName = projectName || processName;
  const secondaryName = projectName ? processName : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors",
        isSelected && "bg-primary/5"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Checkbox */}
        <button
          onClick={() => togglePortSelection(port.port)}
          className={cn(
            "h-5 w-5 rounded border flex items-center justify-center transition-colors",
            isSelected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border hover:border-primary"
          )}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </button>

        {/* Port Number */}
        <div className="w-20">
          <span className="font-mono text-sm font-medium">{port.port}</span>
          <span className="text-xs text-muted-foreground ml-1 uppercase">
            {port.protocol}
          </span>
        </div>

        {/* State Badge */}
        <div
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            stateColor.bg,
            stateColor.text
          )}
        >
          {stateLabel}
        </div>

        {/* Process Info - Show project name prominently */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm truncate",
              projectName ? "font-semibold" : "font-medium"
            )}>
              {displayName}
            </span>
            {secondaryName && (
              <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                {secondaryName}
              </span>
            )}
            {pid && (
              <span className="text-xs text-muted-foreground">PID {pid}</span>
            )}
          </div>
          {/* Show working directory path */}
          {port.process?.working_directory ? (
            <span className="text-xs text-muted-foreground truncate block" title={port.process.working_directory}>
              {port.process.working_directory}
            </span>
          ) : port.local_address && port.local_address !== "*" ? (
            <span className="text-xs text-muted-foreground">
              {port.local_address}
            </span>
          ) : null}
        </div>

        {/* Project Badge - highlight that it's a detected project */}
        {projectName && (
          <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
            Project
          </span>
        )}

        {/* Common Dev Port Badge */}
        {port.is_common_dev_port && !projectName && (
          <span className="text-xs bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">
            Dev Port
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => togglePinnedPort(port.port)}
          className={cn(
            "p-1.5 rounded hover:bg-secondary",
            isPinned ? "text-yellow-500" : "text-muted-foreground"
          )}
          title={isPinned ? "Unpin port" : "Pin port"}
        >
          {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
        </button>

        {port.state === "listen" && (
          <button
            onClick={() => openUrl(`http://localhost:${port.port}`)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Open in browser"
          >
            <Globe className="h-4 w-4" />
          </button>
        )}

        {port.process && (
          <button
            onClick={onViewProcess}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="View process details"
          >
            <Info className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={onKill}
          className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
          title="Kill process"
        >
          <Skull className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
