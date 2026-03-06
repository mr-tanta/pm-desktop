import { useTimeEntries } from "@/hooks/use-timer";
import { useWeeklyTimeSummary } from "@/hooks/use-time-insights";
import { formatDuration } from "@/lib/utils";
import { Clock, Calendar } from "lucide-react";
import type { TimeEntry } from "@/types";

interface ProjectTimeHistoryProps {
  projectName: string;
}

export function ProjectTimeHistory({ projectName }: ProjectTimeHistoryProps) {
  const { data: entries } = useTimeEntries(projectName, 20);
  const { data: weeklySummary } = useWeeklyTimeSummary();

  const projectEntries = entries?.filter((e) => e.ended_at) ?? [];
  const totalSeconds = projectEntries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);

  // Filter weekly data for this project's contribution
  const weeklyDays = weeklySummary?.days ?? [];
  const maxSeconds = Math.max(...weeklyDays.map((d) => d.total_seconds), 1);

  if (projectEntries.length === 0 && weeklyDays.length === 0) return null;

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Time History</h3>
      </div>

      {/* Summary stats */}
      <div className="flex items-baseline gap-4">
        <div>
          <div className="text-2xl font-semibold font-mono">
            {formatDuration(totalSeconds)}
          </div>
          <div className="text-xs text-muted-foreground">total tracked</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{projectEntries.length}</div>
          <div className="text-xs text-muted-foreground">sessions</div>
        </div>
      </div>

      {/* Weekly bar chart */}
      {weeklyDays.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Last 7 days (all projects)</div>
          <div className="flex items-end gap-1 h-12">
            {weeklyDays.map((day) => {
              const height = Math.max((day.total_seconds / maxSeconds) * 100, 4);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/60 rounded-t transition-all hover:bg-primary"
                    style={{ height: `${height}%` }}
                    title={`${getDayLabel(day.date)}: ${formatDuration(day.total_seconds)}`}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {getDayLabel(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {projectEntries.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Recent sessions</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {projectEntries.slice(0, 10).map((entry: TimeEntry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-secondary/50"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">{formatDate(entry.started_at)}</span>
                  <span className="text-xs">
                    {formatTime(entry.started_at)}
                    {entry.ended_at && ` - ${formatTime(entry.ended_at)}`}
                  </span>
                </div>
                <span className="font-mono text-xs">
                  {entry.duration_seconds ? formatDuration(entry.duration_seconds) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
