import { cn } from "@/lib/utils";
import type { GitStatus } from "@/types";
import { GitBranch, Circle, ArrowUp, ArrowDown } from "lucide-react";

interface StatusBadgeProps {
  status: GitStatus;
  className?: string;
}

export function GitStatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      {status.branch && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          {status.branch}
        </span>
      )}

      {status.is_dirty && (
        <span className="flex items-center gap-1 text-yellow-500">
          <Circle className="h-2 w-2 fill-current" />
          {status.modified_count + status.staged_count} changes
        </span>
      )}

      {status.ahead > 0 && (
        <span className="flex items-center gap-0.5 text-green-500">
          <ArrowUp className="h-3 w-3" />
          {status.ahead}
        </span>
      )}

      {status.behind > 0 && (
        <span className="flex items-center gap-0.5 text-orange-500">
          <ArrowDown className="h-3 w-3" />
          {status.behind}
        </span>
      )}
    </div>
  );
}

interface ProjectTypeBadgeProps {
  type: string | null;
  className?: string;
}

export function ProjectTypeBadge({ type, className }: ProjectTypeBadgeProps) {
  if (!type) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {type}
    </span>
  );
}

interface LocationBadgeProps {
  location: "active" | "archived";
  className?: string;
}

export function LocationBadge({ location, className }: LocationBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        location === "active"
          ? "bg-green-900/30 text-green-400"
          : "bg-zinc-800 text-zinc-400",
        className
      )}
    >
      {location}
    </span>
  );
}
