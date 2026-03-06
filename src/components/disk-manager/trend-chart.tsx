import { useQuery } from "@tanstack/react-query";
import { getDiskTrend } from "@/lib/tauri";
import { TrendingUp } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export function TrendChart() {
  const { data: trend } = useQuery({
    queryKey: ["disk-trend"],
    queryFn: () => getDiskTrend(30),
    staleTime: 60_000,
  });

  if (!trend || trend.length < 2) return null;

  const maxSize = Math.max(...trend.map((t) => t.total_size));

  // Calculate change
  const first = trend[0].total_size;
  const last = trend[trend.length - 1].total_size;
  const diff = last - first;
  const diffPositive = diff > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Disk Usage Trend</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          {diffPositive ? "+" : ""}
          {formatBytes(Math.abs(diff))} in {trend.length} scans
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-24">
        {trend.map((entry, i) => {
          const height = maxSize > 0 ? (entry.total_size / maxSize) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${entry.scan_date}: ${formatBytes(entry.total_size)}`}
            >
              <div
                className={`w-full rounded-t transition-all ${
                  diffPositive ? "bg-orange-400" : "bg-green-400"
                }`}
                style={{ height: `${height}%`, minHeight: "2px" }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">
          {trend[0].scan_date}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {trend[trend.length - 1].scan_date}
        </span>
      </div>
    </div>
  );
}
