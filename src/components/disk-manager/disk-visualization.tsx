import { useDiskManagerStore } from "@/stores/disk-manager-store";
import type { DiskScanResult, DiskCategory } from "@/types";
import { cn } from "@/lib/utils";

interface DiskVisualizationProps {
  result: DiskScanResult;
}

const categoryColors: Record<DiskCategory, string> = {
  safe_to_clean: "#22c55e", // green-500
  build_artifacts: "#3b82f6", // blue-500
  package_managers: "#a855f7", // purple-500
  dev_tools: "#f59e0b", // amber-500
  app_caches: "#06b6d4", // cyan-500
  docker: "#2563eb", // blue-600
  system: "#6b7280", // gray-500
  trash: "#ef4444", // red-500
};

export function DiskVisualization({ result }: DiskVisualizationProps) {
  const { toggleCategoryExpanded, expandedCategories } = useDiskManagerStore();

  const maxSize = Math.max(...result.categories.map((c) => c.size_bytes));

  return (
    <div className="space-y-4">
      {/* Stacked Bar */}
      <div className="h-8 rounded-lg overflow-hidden flex bg-secondary">
        {result.categories
          .filter((c) => c.size_bytes > 0)
          .map((category) => {
            const percentage = (category.size_bytes / result.total_size_bytes) * 100;
            return (
              <div
                key={category.category}
                className="h-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: categoryColors[category.category],
                  minWidth: percentage > 0 ? "4px" : 0,
                }}
                title={`${category.name}: ${category.formatted_size}`}
                onClick={() => toggleCategoryExpanded(category.category)}
              />
            );
          })}
      </div>

      {/* Legend & Bars */}
      <div className="space-y-3">
        {result.categories
          .filter((c) => c.size_bytes > 0)
          .map((category) => {
            const percentage = (category.size_bytes / maxSize) * 100;
            const isExpanded = expandedCategories.has(category.category);

            return (
              <div key={category.category} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: categoryColors[category.category] }}
                    />
                    <span
                      className={cn(
                        "text-sm cursor-pointer hover:text-primary",
                        isExpanded && "text-primary font-medium"
                      )}
                      onClick={() => toggleCategoryExpanded(category.category)}
                    >
                      {category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {category.item_count} items
                    </span>
                    <span className="text-sm font-mono font-medium">
                      {category.formatted_size}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: categoryColors[category.category],
                    }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Total */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Scannable</span>
          <span className="font-bold text-lg">{result.formatted_total}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>Scanned in {(result.scan_duration_ms / 1000).toFixed(1)}s</span>
          <span>{result.items.length} locations</span>
        </div>
      </div>
    </div>
  );
}
