import { memo } from "react";
import type { PortScanResult, PortCategory } from "@/types";
import { Radio, Link2, Clock, Layers } from "lucide-react";

interface PortOverviewProps {
  result: PortScanResult;
}

export const PortOverview = memo(function PortOverview({ result }: PortOverviewProps) {
  const devServerCount = result.categories.find(c => c.category === "dev_server")?.count ?? 0;

  const stats = [
    {
      label: "Listening Ports",
      value: result.total_listening,
      icon: Radio,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Established",
      value: result.total_established,
      icon: Link2,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Dev Servers",
      value: devServerCount,
      icon: Layers,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Scan Time",
      value: `${result.scan_duration_ms}ms`,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      isText: true,
    },
  ];

  const CATEGORY_COLORS: Record<PortCategory, { bg: string; label: string }> = {
    dev_server: { bg: "bg-purple-500", label: "Projects" },
    database: { bg: "bg-blue-500", label: "Databases" },
    system: { bg: "bg-gray-500", label: "System" },
    docker: { bg: "bg-cyan-500", label: "Docker" },
    node_process: { bg: "bg-green-500", label: "Node.js" },
    other: { bg: "bg-orange-500", label: "Other" },
  };

  const totalPorts = result.ports.length;
  const sortedCategories = [...result.categories].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {stat.isText ? stat.value : stat.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Inline Category Bar */}
      {totalPorts > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Port Distribution</span>
            <span className="text-xs text-muted-foreground">{totalPorts} total</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-secondary">
            {sortedCategories.map((cat) => {
              const config = CATEGORY_COLORS[cat.category];
              const percentage = (cat.count / totalPorts) * 100;
              if (percentage < 1) return null;
              return (
                <div
                  key={cat.category}
                  className={`${config.bg} transition-all`}
                  style={{ width: `${percentage}%` }}
                  title={`${config.label}: ${cat.count} (${percentage.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {sortedCategories.map((cat) => {
              const config = CATEGORY_COLORS[cat.category];
              return (
                <div key={cat.category} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${config.bg}`} />
                  <span>{config.label}</span>
                  <span className="font-medium text-foreground">{cat.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
