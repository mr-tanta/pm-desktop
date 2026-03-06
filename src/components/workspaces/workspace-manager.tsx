import { useState } from "react";
import {
  useWorkspaces,
  useCreateWorkspace,
  useDeleteWorkspace,
  useStartWorkspace,
  useStopWorkspace,
  useAddProjectToWorkspace,
  useRemoveProjectFromWorkspace,
} from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { useManagedProcesses } from "@/hooks/use-process-manager";
import {
  Layers,
  Plus,
  Trash2,
  Play,
  Square,
  X,
  Loader2,
  FolderPlus,
} from "lucide-react";

export function WorkspaceManager() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const { data: allProjects } = useProjects("active");
  const { data: processes } = useManagedProcesses();
  const createWorkspace = useCreateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const startWorkspace = useStartWorkspace();
  const stopWorkspace = useStopWorkspace();
  const addProject = useAddProjectToWorkspace();
  const removeProject = useRemoveProjectFromWorkspace();

  const [newName, setNewName] = useState("");
  const [addingTo, setAddingTo] = useState<number | null>(null);

  const runningNames = new Set(
    processes
      ?.filter((p) => p.status === "running" || p.status === "starting")
      .map((p) => p.project_name) ?? []
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    createWorkspace.mutate(newName.trim());
    setNewName("");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-card rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-card rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Workspaces</h1>
        </div>
      </div>

      {/* Create new workspace */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New workspace name..."
          className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || createWorkspace.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm"
        >
          {createWorkspace.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create
        </button>
      </div>

      {/* Workspace list */}
      {(!workspaces || workspaces.length === 0) ? (
        <div className="text-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No workspaces yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a workspace to group projects and launch them together
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((ws) => {
            const hasRunning = ws.projects.some((p) =>
              runningNames.has(p.project_name)
            );
            const availableProjects = allProjects?.filter(
              (p) => !ws.projects.some((wp) => wp.project_name === p.name)
            );

            return (
              <div
                key={ws.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">{ws.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setAddingTo(addingTo === ws.id ? null : ws.id)
                      }
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title="Add project"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                    {hasRunning ? (
                      <button
                        onClick={() => stopWorkspace.mutate(ws.id)}
                        disabled={stopWorkspace.isPending}
                        className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        <Square className="h-3 w-3" />
                        Stop All
                      </button>
                    ) : (
                      <button
                        onClick={() => startWorkspace.mutate(ws.id)}
                        disabled={
                          startWorkspace.isPending || ws.projects.length === 0
                        }
                        className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
                      >
                        {startWorkspace.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Start All
                      </button>
                    )}
                    <button
                      onClick={() => deleteWorkspace.mutate(ws.id)}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500"
                      title="Delete workspace"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add project dropdown */}
                {addingTo === ws.id && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {availableProjects?.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          addProject.mutate({
                            workspaceId: ws.id,
                            projectName: p.name,
                          });
                        }}
                        className="text-xs px-2 py-1 rounded border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
                      >
                        + {p.name}
                      </button>
                    ))}
                    {(!availableProjects || availableProjects.length === 0) && (
                      <span className="text-xs text-muted-foreground">
                        All projects already added
                      </span>
                    )}
                  </div>
                )}

                {/* Project chips */}
                {ws.projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No projects in this workspace
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ws.projects.map((p) => (
                      <div
                        key={p.project_name}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-xs"
                      >
                        {runningNames.has(p.project_name) && (
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        )}
                        <span>{p.project_name}</span>
                        <button
                          onClick={() =>
                            removeProject.mutate({
                              workspaceId: ws.id,
                              projectName: p.project_name,
                            })
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
