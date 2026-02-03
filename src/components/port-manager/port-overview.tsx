import { memo } from "react";
import type { PortScanResult } from "@/types";
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

  return (
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
  );
});
