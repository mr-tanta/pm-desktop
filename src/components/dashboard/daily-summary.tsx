import { formatDuration } from "@/lib/utils";
import { Clock, TrendingUp } from "lucide-react";
import type { TodayTimeStats, DaySummary } from "@/types";

interface DailySummaryProps {
  todayTime: TodayTimeStats;
  weeklyOverview: DaySummary[];
}

export function DailySummary({ todayTime, weeklyOverview }: DailySummaryProps) {
  const hasTimeData = todayTime.total_today_seconds > 0 || todayTime.sessions_today > 0 || weeklyOverview.length > 0;

  if (!hasTimeData) return null;

  const maxSeconds = Math.max(...weeklyOverview.map((d) => d.total_seconds), 1);

  // Get day labels
  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Time Today</h3>
      </div>

      <div className="flex items-baseline gap-4 mb-4">
        <div className="text-3xl font-semibold font-mono">
          {formatDuration(todayTime.total_today_seconds)}
        </div>
        <div className="text-sm text-muted-foreground">
          {todayTime.sessions_today} session{todayTime.sessions_today !== 1 ? "s" : ""}
          {todayTime.current_project && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              Working on {todayTime.current_project}
            </span>
          )}
        </div>
      </div>

      {/* Weekly bar chart */}
      {weeklyOverview.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {weeklyOverview.map((day) => {
              const height = Math.max((day.total_seconds / maxSeconds) * 100, 4);
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
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
    </div>
  );
}
