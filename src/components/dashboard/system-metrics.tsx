import { useSystemInfo, useDockerStatus } from "@/hooks/use-system";
import { formatBytes } from "@/lib/utils";
import { Cpu, HardDrive, MemoryStick, Container } from "lucide-react";

export function SystemMetrics() {
  const { data: systemInfo, isLoading } = useSystemInfo();
  const { data: dockerRunning } = useDockerStatus();

  if (isLoading || !systemInfo) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  const memoryPercent = Math.round((systemInfo.used_memory / systemInfo.total_memory) * 100);
  const diskPercent = Math.round((systemInfo.used_disk / systemInfo.total_disk) * 100);

  const metrics = [
    {
      label: "CPU",
      value: `${Math.round(systemInfo.cpu_usage)}%`,
      subtext: `${systemInfo.cpu_count} cores`,
      icon: Cpu,
      color: systemInfo.cpu_usage > 80 ? "text-red-400" : "text-blue-400",
    },
    {
      label: "Memory",
      value: `${memoryPercent}%`,
      subtext: `${formatBytes(systemInfo.used_memory)} / ${formatBytes(systemInfo.total_memory)}`,
      icon: MemoryStick,
      color: memoryPercent > 80 ? "text-red-400" : "text-green-400",
    },
    {
      label: "Disk",
      value: `${diskPercent}%`,
      subtext: `${formatBytes(systemInfo.used_disk)} / ${formatBytes(systemInfo.total_disk)}`,
      icon: HardDrive,
      color: diskPercent > 90 ? "text-red-400" : "text-purple-400",
    },
    {
      label: "Docker",
      value: dockerRunning ? "Running" : "Stopped",
      subtext: dockerRunning ? "Ready" : "Not running",
      icon: Container,
      color: dockerRunning ? "text-cyan-400" : "text-zinc-500",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className="rounded-lg bg-card border border-border p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              <Icon className={`h-4 w-4 ${metric.color}`} />
            </div>
            <div className="mt-2">
              <span className={`text-2xl font-semibold ${metric.color}`}>
                {metric.value}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{metric.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}
