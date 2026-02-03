import { memo } from "react";
import { usePortManagerStore } from "@/stores/port-manager-store";
import type { PortCategory, ConnectionState } from "@/types";
import { Search, X } from "lucide-react";

const CATEGORY_OPTIONS: { value: PortCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "dev_server", label: "Dev Servers" },
  { value: "node_process", label: "Node.js" },
  { value: "database", label: "Databases" },
  { value: "docker", label: "Docker" },
  { value: "system", label: "System" },
  { value: "other", label: "Other" },
];

const STATE_OPTIONS: { value: ConnectionState | "all"; label: string }[] = [
  { value: "all", label: "All States" },
  { value: "listen", label: "Listening" },
  { value: "established", label: "Established" },
  { value: "time_wait", label: "Time Wait" },
  { value: "close_wait", label: "Close Wait" },
];

export const FiltersBar = memo(function FiltersBar() {
  const {
    categoryFilter,
    stateFilter,
    searchQuery,
    showSystemPorts,
    setCategoryFilter,
    setStateFilter,
    setSearchQuery,
    setShowSystemPorts,
    clearFilters,
  } = usePortManagerStore();

  const hasActiveFilters =
    categoryFilter !== "all" ||
    stateFilter !== "all" ||
    searchQuery.trim() !== "" ||
    showSystemPorts;

  return (
    <div className="flex flex-wrap items-center gap-3 mt-6 p-4 bg-card border border-border rounded-lg">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search ports, processes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-secondary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Category Filter */}
      <select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value as PortCategory | "all")}
        className="px-3 py-2 text-sm bg-secondary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* State Filter */}
      <select
        value={stateFilter}
        onChange={(e) => setStateFilter(e.target.value as ConnectionState | "all")}
        className="px-3 py-2 text-sm bg-secondary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {STATE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* System Ports Toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showSystemPorts}
          onChange={(e) => setShowSystemPorts(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-muted-foreground">Show system ports</span>
      </label>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear filters
        </button>
      )}
    </div>
  );
});
