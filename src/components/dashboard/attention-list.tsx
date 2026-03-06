import { AlertTriangle, GitBranch, Archive, ExternalLink } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useConfig } from "@/hooks/use-system";
import { openInEditor, archiveProject } from "@/lib/tauri";
import { useQueryClient } from "@tanstack/react-query";
import type { AttentionItem } from "@/types";

interface AttentionListProps {
  items: AttentionItem[];
}

export function AttentionList({ items }: AttentionListProps) {
  const { data: config } = useConfig();
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const queryClient = useQueryClient();
  const editor = config?.default_editor || "cursor";

  if (items.length === 0) return null;

  const handleAction = async (item: AttentionItem) => {
    const projectPath = `${config?.active_dir}/${item.project_name}`;
    switch (item.action) {
      case "open_editor":
        openInEditor(projectPath, editor);
        break;
      case "archive":
        await archiveProject(item.project_name);
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["today-summary"] });
        break;
      case "push":
        setSelectedProject(item.project_name);
        break;
    }
  };

  const getIcon = (kind: string) => {
    switch (kind) {
      case "uncommitted":
        return <AlertTriangle className="h-4 w-4" />;
      case "unpushed":
        return <GitBranch className="h-4 w-4" />;
      case "stale":
        return <Archive className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "open_editor":
        return "Open";
      case "archive":
        return "Archive";
      case "push":
        return "View";
      default:
        return "Action";
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Needs Attention</h3>
      <div className="space-y-2">
        {items.slice(0, 5).map((item, i) => (
          <div
            key={`${item.project_name}-${item.kind}-${i}`}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              item.severity === "warning"
                ? "border-yellow-300 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/20"
                : "border-blue-300 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20"
            }`}
          >
            <div className={item.severity === "warning" ? "text-yellow-600 dark:text-yellow-500" : "text-blue-600 dark:text-blue-400"}>
              {getIcon(item.kind)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.project_name}</div>
              <div className="text-xs text-muted-foreground">{item.message}</div>
            </div>
            <button
              onClick={() => handleAction(item)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium ${
                item.severity === "warning"
                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              }`}
            >
              <ExternalLink className="h-3 w-3" />
              {getActionLabel(item.action)}
            </button>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{items.length - 5} more items
          </p>
        )}
      </div>
    </div>
  );
}
