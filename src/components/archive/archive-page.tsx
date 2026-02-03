import { useState, useMemo, useCallback } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useAppStore } from "@/stores/app-store";
import { ProjectCard } from "@/components/shared/project-card";
import { restoreProject, deleteProject } from "@/lib/tauri";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  FolderOpen,
} from "lucide-react";

export function ArchivePage() {
  const [search, setSearch] = useState("");
  const { data: archivedProjects, isLoading } = useProjects("archived");
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const queryClient = useQueryClient();

  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const filteredProjects = useMemo(() => {
    if (!archivedProjects) return [];
    if (!search) return archivedProjects;
    const searchLower = search.toLowerCase();
    return archivedProjects.filter(
      (project) =>
        project.name.toLowerCase().includes(searchLower) ||
        project.project_type?.toLowerCase().includes(searchLower)
    );
  }, [archivedProjects, search]);

  const handleProjectClick = useCallback(
    (name: string) => {
      setSelectedProject(name);
    },
    [setSelectedProject]
  );

  const toggleProjectSelection = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map((p) => p.name)));
    }
  }, [filteredProjects, selectedProjects.size]);

  const bulkRestoreMutation = useMutation({
    mutationFn: async () => {
      for (const name of selectedProjects) {
        await restoreProject(name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjects(new Set());
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      for (const name of selectedProjects) {
        await deleteProject(name, "archived");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjects(new Set());
      setShowBulkDeleteConfirm(false);
      setDeleteConfirmText("");
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 bg-yellow-900/30 rounded-lg">
          <Archive className="h-6 w-6 text-yellow-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Archived Projects</h1>
          <p className="text-sm text-muted-foreground">
            {archivedProjects?.length || 0} archived project
            {archivedProjects?.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search archived projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {filteredProjects.length > 0 && (
          <button
            onClick={selectAll}
            className="px-3 py-2 text-sm bg-secondary rounded-md hover:bg-secondary/80"
          >
            {selectedProjects.size === filteredProjects.length ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedProjects.size > 0 && (
        <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
          <span className="text-sm font-medium">
            {selectedProjects.size} project{selectedProjects.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => bulkRestoreMutation.mutate()}
            disabled={bulkRestoreMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-900/30 text-blue-400 rounded-md hover:bg-blue-900/50 disabled:opacity-50"
          >
            {bulkRestoreMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Restore Selected
          </button>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-900/30 text-red-400 rounded-md hover:bg-red-900/50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div key={project.path} className="relative">
              {/* Selection checkbox */}
              <button
                onClick={(e) => toggleProjectSelection(project.name, e)}
                className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedProjects.has(project.name)
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/50 hover:border-muted-foreground"
                }`}
              >
                {selectedProjects.has(project.name) && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <ProjectCard
                project={project}
                onClick={() => handleProjectClick(project.name)}
                className="pl-10"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search ? "No archived projects match your search" : "No archived projects"}
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Archive projects you're not actively working on to keep your workspace clean
          </p>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Delete {selectedProjects.size} Projects</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete {selectedProjects.size} project
                  {selectedProjects.size !== 1 ? "s" : ""} and all their files. This action cannot
                  be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBulkDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="p-1 hover:bg-secondary rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 p-3 bg-secondary rounded-md max-h-32 overflow-y-auto">
              <ul className="text-sm space-y-1">
                {Array.from(selectedProjects).map((name) => (
                  <li key={name} className="text-muted-foreground">
                    • {name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-muted-foreground mb-2">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBulkDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkDeleteMutation.mutate()}
                disabled={deleteConfirmText !== "DELETE" || bulkDeleteMutation.isPending}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedProjects.size} Projects
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
