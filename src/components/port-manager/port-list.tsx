import { memo } from "react";
import { usePortManagerStore } from "@/stores/port-manager-store";
import { PortEntryRow } from "./port-entry-row";
import type { PortEntry, PortCategory } from "@/types";
import { ChevronDown, ChevronRight } from "lucide-react";

interface PortListProps {
  onKillPort: (port: PortEntry) => void;
  onViewProcess: (port: PortEntry) => void;
}

const CATEGORY_LABELS: Record<PortCategory, string> = {
  dev_server: "Projects",
  database: "Databases",
  docker: "Docker",
  node_process: "Node.js",
  system: "System",
  other: "Other",
};

const CATEGORY_ORDER: PortCategory[] = [
  "dev_server",
  "node_process",
  "database",
  "docker",
  "system",
  "other",
];

export const PortList = memo(function PortList({
  onKillPort,
  onViewProcess,
}: PortListProps) {
  const {
    getFilteredPorts,
    isCategoryExpanded,
    toggleCategoryExpanded,
    selectAllInCategory,
    deselectAllInCategory,
    isPortSelected,
  } = usePortManagerStore();

  const filteredPorts = getFilteredPorts();

  // Group ports by category and sort by port number
  const portsByCategory = filteredPorts.reduce((acc, port) => {
    const category = port.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(port);
    return acc;
  }, {} as Record<PortCategory, PortEntry[]>);

  // Sort ports numerically within each category
  for (const category of Object.keys(portsByCategory) as PortCategory[]) {
    portsByCategory[category].sort((a, b) => a.port - b.port);
  }

  // Get categories in order, only including ones with ports
  const categories = CATEGORY_ORDER.filter((cat) => portsByCategory[cat]?.length > 0);

  if (filteredPorts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          No ports match your filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">
          Active Ports ({filteredPorts.length})
        </h2>
      </div>

      {categories.map((category) => {
        const ports = portsByCategory[category];
        const isExpanded = isCategoryExpanded(category);
        const allSelected = ports.every((p) => isPortSelected(p.port));
        const someSelected = ports.some((p) => isPortSelected(p.port));

        return (
          <div key={category} className="border border-border rounded-lg overflow-hidden">
            {/* Category Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-secondary/30 cursor-pointer hover:bg-secondary/50"
              onClick={() => toggleCategoryExpanded(category)}
            >
              <div className="flex items-center gap-3">
                <button className="p-0.5">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <span className="text-sm font-medium">
                  {CATEGORY_LABELS[category]}
                </span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {ports.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (allSelected) {
                      deselectAllInCategory(category);
                    } else {
                      selectAllInCategory(category);
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {allSelected ? "Deselect all" : someSelected ? "Select all" : "Select all"}
                </button>
              </div>
            </div>

            {/* Port Entries */}
            {isExpanded && (
              <div className="divide-y divide-border">
                {ports.map((port) => (
                  <PortEntryRow
                    key={`${port.port}-${port.protocol}`}
                    port={port}
                    onKill={() => onKillPort(port)}
                    onViewProcess={() => onViewProcess(port)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
