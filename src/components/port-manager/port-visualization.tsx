import { memo } from "react";
import type { PortScanResult, PortCategory } from "@/types";
import {
  FolderCode,
  Database,
  Shield,
  Container,
  Hexagon,
  Circle,
} from "lucide-react";

interface PortVisualizationProps {
  result: PortScanResult;
}

const CATEGORY_CONFIG: Record<
  PortCategory,
  { label: string; color: string; bgColor: string; icon: typeof FolderCode }
> = {
  dev_server: {
    label: "Projects",
    color: "text-purple-500",
    bgColor: "bg-purple-500",
    icon: FolderCode,
  },
  database: {
    label: "Databases",
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    icon: Database,
  },
  system: {
    label: "System",
    color: "text-gray-500",
    bgColor: "bg-gray-500",
    icon: Shield,
  },
  docker: {
    label: "Docker",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500",
    icon: Container,
  },
  node_process: {
    label: "Node.js",
    color: "text-green-500",
    bgColor: "bg-green-500",
    icon: Hexagon,
  },
  other: {
    label: "Other",
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    icon: Circle,
  },
};

export const PortVisualization = memo(function PortVisualization({
  result,
}: PortVisualizationProps) {
  const totalPorts = result.ports.length;

  // Sort categories by count
  const sortedCategories = [...result.categories].sort((a, b) => b.count - a.count);

  if (sortedCategories.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">No ports to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stacked Bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-secondary">
        {sortedCategories.map((cat) => {
          const config = CATEGORY_CONFIG[cat.category];
          const percentage = (cat.count / totalPorts) * 100;

          if (percentage < 1) return null;

          return (
            <div
              key={cat.category}
              className={`${config.bgColor} transition-all`}
              style={{ width: `${percentage}%` }}
              title={`${config.label}: ${cat.count} ports (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {sortedCategories.map((cat) => {
          const config = CATEGORY_CONFIG[cat.category];
          const percentage = ((cat.count / totalPorts) * 100).toFixed(1);
          const Icon = config.icon;

          return (
            <div
              key={cat.category}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${config.bgColor}`} />
                <Icon className={`h-4 w-4 ${config.color}`} />
                <span>{config.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{cat.count}</span>
                <span className="text-muted-foreground text-xs">
                  ({percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total Ports</span>
        <span className="font-semibold">{totalPorts}</span>
      </div>
    </div>
  );
});
