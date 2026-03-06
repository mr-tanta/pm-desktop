import { useQuery } from "@tanstack/react-query";
import { getProjectScripts } from "@/lib/tauri";
import { openInTerminal } from "@/lib/tauri";
import { ScrollText, Play, Loader2 } from "lucide-react";

interface ProjectScriptsProps {
  projectPath: string;
  hasPackageJson: boolean;
}

export function ProjectScripts({ projectPath, hasPackageJson }: ProjectScriptsProps) {
  const { data: scripts, isLoading } = useQuery({
    queryKey: ["project-scripts", projectPath],
    queryFn: () => getProjectScripts(projectPath),
    enabled: hasPackageJson,
    staleTime: 60_000,
  });

  if (!hasPackageJson) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card border border-border p-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Scripts</h3>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!scripts || Object.keys(scripts).length === 0) return null;

  const entries = Object.entries(scripts);

  return (
    <div className="rounded-lg bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Scripts ({entries.length})</h3>
      </div>

      <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
        {entries.map(([name, command]) => (
          <div
            key={name}
            className="flex items-center justify-between px-3 py-2 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="font-mono text-sm font-medium text-foreground shrink-0">
                {name}
              </span>
              <span className="text-xs text-muted-foreground truncate">{command}</span>
            </div>
            <button
              onClick={() => openInTerminal(projectPath)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0 ml-2"
              title={`Open terminal to run: npm run ${name}`}
            >
              <Play className="h-3.5 w-3.5" />
              Run
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
