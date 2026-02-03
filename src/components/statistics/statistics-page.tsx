import { useQuery } from "@tanstack/react-query";
import { getStatistics } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import {
  ArrowLeft,
  BarChart3,
  FolderKanban,
  Archive,
  HardDrive,
  GitBranch,
  AlertTriangle,
  Loader2,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function StatisticsPage() {
  const setView = useAppStore((s) => s.setView);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["statistics"],
    queryFn: getStatistics,
    staleTime: 60000,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => setView("dashboard")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Statistics</h1>
          <p className="text-sm text-muted-foreground">
            Project analytics and insights
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          Failed to load statistics
        </div>
      ) : stats ? (
        <div className="space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={<FolderKanban className="h-5 w-5" />}
              label="Total Projects"
              value={stats.total_projects}
              sublabel={`${stats.active_projects} active, ${stats.archived_projects} archived`}
            />
            <StatCard
              icon={<HardDrive className="h-5 w-5" />}
              label="Total Size"
              value={formatBytes(stats.total_size_bytes)}
              sublabel={`Active: ${formatBytes(stats.active_size_bytes)}`}
            />
            <StatCard
              icon={<Archive className="h-5 w-5" />}
              label="Archived Size"
              value={formatBytes(stats.archived_size_bytes)}
              sublabel="Saved by archiving"
            />
          </div>

          {/* Git Activity */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Git Activity (Last 7 Days)
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {stats.git_activity.total_commits_7d}
                </div>
                <div className="text-sm text-muted-foreground">Total Commits</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">
                  {stats.git_activity.projects_with_changes}
                </div>
                <div className="text-sm text-muted-foreground">Projects with Changes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">
                  {stats.git_activity.total_uncommitted_changes}
                </div>
                <div className="text-sm text-muted-foreground">Uncommitted Changes</div>
              </div>
            </div>
          </div>

          {/* Project Types */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-sm font-semibold mb-4">Project Types</h2>
            {stats.project_types.length > 0 ? (
              <div className="space-y-3">
                {stats.project_types.map((type) => {
                  const percentage = Math.round((type.count / stats.total_projects) * 100);
                  return (
                    <div key={type.project_type} className="flex items-center gap-3">
                      <div className="w-24 text-sm truncate">{type.project_type}</div>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-16 text-sm text-muted-foreground text-right">
                        {type.count} ({percentage}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No project types detected</p>
            )}
          </div>

          {/* Uncommitted Changes Warning */}
          {stats.git_activity.projects_with_changes > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-yellow-500">
                  {stats.git_activity.projects_with_changes} project(s) have uncommitted changes
                </div>
                <div className="text-xs text-yellow-500/80 mt-1">
                  Consider committing or stashing your changes
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sublabel && (
        <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>
      )}
    </div>
  );
}
