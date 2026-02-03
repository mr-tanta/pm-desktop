import { useDiskManagerStore } from "@/stores/disk-manager-store";
import type { DiskScanResult, ScannableItem, DiskCategory, SafetyLevel } from "@/types";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Minus,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Package,
  Archive,
  Wrench,
  AppWindow,
  Container,
  Cog,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryListProps {
  result: DiskScanResult;
}

const categoryIcons: Record<DiskCategory, React.ReactNode> = {
  safe_to_clean: <ShieldCheck className="h-4 w-4" />,
  build_artifacts: <Package className="h-4 w-4" />,
  package_managers: <Archive className="h-4 w-4" />,
  dev_tools: <Wrench className="h-4 w-4" />,
  app_caches: <AppWindow className="h-4 w-4" />,
  docker: <Container className="h-4 w-4" />,
  system: <Cog className="h-4 w-4" />,
  trash: <Trash2 className="h-4 w-4" />,
};

const safetyColors: Record<SafetyLevel, { bg: string; text: string; border: string }> = {
  safe: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30" },
  moderate: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30" },
  aggressive: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
};

const safetyIcons: Record<SafetyLevel, React.ReactNode> = {
  safe: <ShieldCheck className="h-3 w-3" />,
  moderate: <ShieldAlert className="h-3 w-3" />,
  aggressive: <ShieldOff className="h-3 w-3" />,
};

export function CategoryList({ result }: CategoryListProps) {
  const {
    selectedItemIds,
    expandedCategories,
    toggleItemSelection,
    toggleCategoryExpanded,
    selectAllInCategory,
    deselectAllInCategory,
  } = useDiskManagerStore();

  // Group items by category
  const itemsByCategory = result.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<DiskCategory, ScannableItem[]>);

  const getCategorySelectionState = (
    category: DiskCategory
  ): "none" | "partial" | "all" => {
    const items = itemsByCategory[category] || [];
    if (items.length === 0) return "none";

    const allIds: string[] = [];
    items.forEach((item) => {
      allIds.push(item.id);
      item.children.forEach((child) => allIds.push(child.id));
    });

    const selectedCount = allIds.filter((id) => selectedItemIds.has(id)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === allIds.length) return "all";
    return "partial";
  };

  const handleCategoryToggle = (category: DiskCategory) => {
    const state = getCategorySelectionState(category);
    if (state === "all") {
      deselectAllInCategory(category, result.items);
    } else {
      selectAllInCategory(category, result.items);
    }
  };

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
      {result.categories.map((category) => {
        const items = itemsByCategory[category.category] || [];
        const isExpanded = expandedCategories.has(category.category);
        const selectionState = getCategorySelectionState(category.category);
        const safety = safetyColors[category.safety_level];

        return (
          <div key={category.category} className="border border-border rounded-lg overflow-hidden">
            {/* Category Header */}
            <div
              className="flex items-center gap-3 p-3 hover:bg-secondary/50 cursor-pointer"
              onClick={() => toggleCategoryExpanded(category.category)}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategoryToggle(category.category);
                }}
                className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                  selectionState === "all"
                    ? "bg-primary border-primary text-primary-foreground"
                    : selectionState === "partial"
                    ? "bg-primary/50 border-primary text-primary-foreground"
                    : "border-border hover:border-primary"
                )}
              >
                {selectionState === "all" && <Check className="h-3 w-3" />}
                {selectionState === "partial" && <Minus className="h-3 w-3" />}
              </button>

              {/* Icon */}
              <span className="text-muted-foreground">
                {categoryIcons[category.category]}
              </span>

              {/* Name & Size */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{category.name}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1",
                      safety.bg,
                      safety.text,
                      safety.border,
                      "border"
                    )}
                  >
                    {safetyIcons[category.safety_level]}
                    {category.safety_level}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {category.item_count} item{category.item_count !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Size */}
              <span className="text-sm font-mono font-medium">
                {category.formatted_size}
              </span>

              {/* Expand */}
              <span className="text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            </div>

            {/* Items */}
            {isExpanded && items.length > 0 && (
              <div className="border-t border-border bg-secondary/30">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    level={0}
                    selectedItemIds={selectedItemIds}
                    toggleItemSelection={toggleItemSelection}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({
  item,
  level,
  selectedItemIds,
  toggleItemSelection,
}: {
  item: ScannableItem;
  level: number;
  selectedItemIds: Set<string>;
  toggleItemSelection: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedItemIds.has(item.id);
  const hasChildren = item.children.length > 0;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 hover:bg-secondary/50",
          level > 0 && "pl-8"
        )}
        style={{ paddingLeft: level > 0 ? `${level * 24 + 12}px` : undefined }}
      >
        {/* Expand toggle for items with children */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-secondary rounded"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Checkbox */}
        <button
          onClick={() => toggleItemSelection(item.id)}
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
            isSelected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border hover:border-primary"
          )}
        >
          {isSelected && <Check className="h-2.5 w-2.5" />}
        </button>

        {/* Icon */}
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm truncate block">{item.name}</span>
          {level === 0 && (
            <span className="text-xs text-muted-foreground truncate block">
              {item.path}
            </span>
          )}
        </div>

        {/* Size */}
        <span className="text-xs font-mono text-muted-foreground">
          {item.formatted_size}
        </span>
      </div>

      {/* Children */}
      {expanded &&
        hasChildren &&
        item.children.map((child) => (
          <ItemRow
            key={child.id}
            item={child}
            level={level + 1}
            selectedItemIds={selectedItemIds}
            toggleItemSelection={toggleItemSelection}
          />
        ))}
    </>
  );
}

// Need to import useState for ItemRow
import { useState } from "react";
