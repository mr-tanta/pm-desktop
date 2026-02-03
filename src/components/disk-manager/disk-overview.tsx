import type { DiskScanResult } from "@/types";
import { HardDrive, Trash2, ShieldCheck, Clock } from "lucide-react";

interface DiskOverviewProps {
  result: DiskScanResult;
}

export function DiskOverview({ result }: DiskOverviewProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const safeSize = result.categories
    .filter((c) => c.safety_level === "safe")
    .reduce((sum, c) => sum + c.size_bytes, 0);

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        icon={<HardDrive className="h-5 w-5" />}
        label="Total Found"
        value={result.formatted_total}
        sublabel={`${result.items.length} locations`}
        color="primary"
      />
      <StatCard
        icon={<Trash2 className="h-5 w-5" />}
        label="Cleanable"
        value={result.formatted_cleanable}
        sublabel="Safe + Moderate items"
        color="yellow"
      />
      <StatCard
        icon={<ShieldCheck className="h-5 w-5" />}
        label="Safe to Clean"
        value={formatBytes(safeSize)}
        sublabel="One-click cleanup"
        color="green"
      />
      <StatCard
        icon={<Clock className="h-5 w-5" />}
        label="Scan Time"
        value={`${(result.scan_duration_ms / 1000).toFixed(1)}s`}
        sublabel={`${result.categories.length} categories`}
        color="muted"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  color?: "primary" | "green" | "yellow" | "red" | "muted";
}) {
  const colorClasses = {
    primary: "text-primary",
    green: "text-green-500",
    yellow: "text-yellow-500",
    red: "text-red-500",
    muted: "text-muted-foreground",
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <span className={colorClasses[color]}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      {sublabel && (
        <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>
      )}
    </div>
  );
}
