import { useProjectPorts, useKillPort } from "@/hooks/use-port-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { PortEntry } from "@/types";
import { Globe, Skull, Loader2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  listen: { bg: "bg-green-500/10", text: "text-green-500" },
  established: { bg: "bg-blue-500/10", text: "text-blue-500" },
  time_wait: { bg: "bg-yellow-500/10", text: "text-yellow-500" },
  close_wait: { bg: "bg-orange-500/10", text: "text-orange-500" },
  closed: { bg: "bg-gray-500/10", text: "text-gray-500" },
  unknown: { bg: "bg-gray-500/10", text: "text-gray-500" },
};

const STATE_LABELS: Record<string, string> = {
  listen: "Listening",
  established: "Established",
  time_wait: "Time Wait",
  close_wait: "Close Wait",
  closed: "Closed",
  unknown: "Unknown",
};

interface ProjectPortsProps {
  projectName: string;
}

export function ProjectPorts({ projectName }: ProjectPortsProps) {
  const { data: ports, isLoading } = useProjectPorts(projectName);
  const killMutation = useKillPort();

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card border border-border p-4">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Running Ports</h3>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!ports || ports.length === 0) return null;

  return (
    <div className="rounded-lg bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wifi className="h-4 w-4 text-green-500" />
        <h3 className="text-sm font-medium">Running Ports ({ports.length})</h3>
      </div>

      <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
        {ports.map((port) => (
          <PortRow
            key={port.port}
            port={port}
            onKill={() => killMutation.mutate({ port: port.port })}
            isKilling={killMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function PortRow({
  port,
  onKill,
  isKilling,
}: {
  port: PortEntry;
  onKill: () => void;
  isKilling: boolean;
}) {
  const stateColor = STATE_COLORS[port.state] || STATE_COLORS.unknown;
  const stateLabel = STATE_LABELS[port.state] || port.state;

  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-medium w-16">:{port.port}</span>
        <span className="text-xs text-muted-foreground uppercase">{port.protocol}</span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            stateColor.bg,
            stateColor.text
          )}
        >
          {stateLabel}
        </span>
        {port.process?.name && (
          <span className="text-xs text-muted-foreground">{port.process.name}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => openUrl(`http://localhost:${port.port}`)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-secondary text-muted-foreground hover:text-foreground"
          title="Open in browser"
        >
          <Globe className="h-3.5 w-3.5" />
          Open
        </button>
        <button
          onClick={onKill}
          disabled={isKilling}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-red-500/10 text-muted-foreground hover:text-red-500 disabled:opacity-50"
          title="Kill process"
        >
          <Skull className="h-3.5 w-3.5" />
          Kill
        </button>
      </div>
    </div>
  );
}
