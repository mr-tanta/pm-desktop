import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTemplates,
  createProject,
  checkToolInstalled,
  cloneRepository,
  createPlayground,
} from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import {
  ArrowLeft,
  FolderPlus,
  GitBranch,
  Code2,
  Github,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Download,
  Beaker,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProjectTemplate,
  CreateProjectOptions,
  CloneOptions,
  PlaygroundOptions,
} from "@/types";

const TEMPLATE_ICONS: Record<string, string> = {
  nextjs: "▲",
  react: "⚛",
  nestjs: "🐱",
  expo: "📱",
  typescript: "TS",
  astro: "🚀",
  svelte: "🔥",
  tauri: "🦀",
  python: "🐍",
  go: "🐹",
  folder: "📁",
};

type Tab = "create" | "clone" | "playground";

export function CreateProject() {
  const queryClient = useQueryClient();
  const setView = useAppStore((s) => s.setView);
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);

  const [activeTab, setActiveTab] = useState<Tab>("create");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => setView("projects")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FolderPlus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">New Project</h1>
          <p className="text-sm text-muted-foreground">
            Create from template, clone a repo, or start a playground
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg mb-8">
        <TabButton
          active={activeTab === "create"}
          onClick={() => setActiveTab("create")}
          icon={<FolderPlus className="h-4 w-4" />}
          label="Create"
        />
        <TabButton
          active={activeTab === "clone"}
          onClick={() => setActiveTab("clone")}
          icon={<Download className="h-4 w-4" />}
          label="Clone"
        />
        <TabButton
          active={activeTab === "playground"}
          onClick={() => setActiveTab("playground")}
          icon={<Beaker className="h-4 w-4" />}
          label="Playground"
        />
      </div>

      {activeTab === "create" && (
        <CreateFromTemplate
          queryClient={queryClient}
          setSelectedProject={setSelectedProject}
          setView={setView}
        />
      )}
      {activeTab === "clone" && (
        <CloneRepository
          queryClient={queryClient}
          setSelectedProject={setSelectedProject}
          setView={setView}
        />
      )}
      {activeTab === "playground" && (
        <CreatePlayground
          queryClient={queryClient}
          setView={setView}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

type View = "dashboard" | "projects" | "settings" | "project-detail" | "create-project" | "statistics";

// Create from Template Tab
function CreateFromTemplate({
  queryClient,
  setSelectedProject,
  setView,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  setSelectedProject: (name: string) => void;
  setView: (view: View) => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [initGit, setInitGit] = useState(true);
  const [openInEditor, setOpenInEditor] = useState(true);
  const [createGithubRepo, setCreateGithubRepo] = useState(false);
  const [githubVisibility, setGithubVisibility] = useState<"public" | "private">("private");
  const [error, setError] = useState<string | null>(null);

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ["templates"],
    queryFn: listTemplates,
  });

  const { data: pnpmInstalled } = useQuery({
    queryKey: ["tool-check", "pnpm"],
    queryFn: () => checkToolInstalled("pnpm"),
  });

  const { data: ghInstalled } = useQuery({
    queryKey: ["tool-check", "gh"],
    queryFn: () => checkToolInstalled("gh"),
  });

  const createMutation = useMutation({
    mutationFn: (options: CreateProjectOptions) => createProject(options),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      const projectName = result.path.split("/").pop() || "";
      setSelectedProject(projectName);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }

    createMutation.mutate({
      name: projectName,
      template: selectedTemplate,
      init_git: initGit,
      open_in_editor: openInEditor,
      create_github_repo: createGithubRepo,
      github_visibility: createGithubRepo ? githubVisibility : null,
    });
  };

  const groupedTemplates = templates?.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, ProjectTemplate[]>);

  const selectedTemplateData = templates?.find((t) => t.id === selectedTemplate);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Project Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Project Name</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="my-awesome-project"
          className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>

      {/* Template Selection */}
      <div className="space-y-4">
        <label className="text-sm font-medium">Choose Template</label>

        {loadingTemplates ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {groupedTemplates &&
              Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                <div key={category}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {categoryTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplate(template.id)}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                          selectedTemplate === template.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-muted-foreground/30 hover:bg-secondary/50"
                        )}
                      >
                        <span className="text-xl w-8 text-center shrink-0">
                          {TEMPLATE_ICONS[template.icon] || "📦"}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-4">
        <label className="text-sm font-medium">Options</label>
        <div className="space-y-3">
          <OptionCheckbox
            checked={initGit}
            onChange={setInitGit}
            icon={<GitBranch className="h-4 w-4" />}
            label="Initialize Git Repository"
            description="Create a git repo with initial commit"
          />
          <OptionCheckbox
            checked={openInEditor}
            onChange={setOpenInEditor}
            icon={<Code2 className="h-4 w-4" />}
            label="Open in Editor"
            description="Open project in your default editor"
          />
          <div className={cn("rounded-lg border border-border", !ghInstalled && "opacity-50")}>
            <OptionCheckbox
              checked={createGithubRepo}
              onChange={setCreateGithubRepo}
              disabled={!ghInstalled}
              icon={<Github className="h-4 w-4" />}
              label="Create GitHub Repository"
              description={ghInstalled ? "Create and push to GitHub" : "Install GitHub CLI (gh) to enable"}
            />
            {createGithubRepo && ghInstalled && (
              <div className="px-3 pb-3 pl-10">
                <div className="flex gap-2">
                  {(["private", "public"] as const).map((vis) => (
                    <button
                      key={vis}
                      type="button"
                      onClick={() => setGithubVisibility(vis)}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-md border transition-colors capitalize",
                        githubVisibility === vis
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      {vis}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {!pnpmInstalled && selectedTemplateData?.command && (
        <Warning message="pnpm not found. Install it with: npm i -g pnpm" />
      )}

      {error && <ErrorMessage message={error} />}
      {createMutation.isSuccess && (
        <SuccessMessage
          message={createMutation.data?.message || ""}
          url={createMutation.data?.github_url}
        />
      )}

      <FormActions
        onCancel={() => setView("projects")}
        isLoading={createMutation.isPending}
        disabled={!projectName || !selectedTemplate}
        label="Create Project"
      />
    </form>
  );
}

// Clone Repository Tab
function CloneRepository({
  queryClient,
  setSelectedProject,
  setView,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  setSelectedProject: (name: string) => void;
  setView: (view: View) => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [shallow, setShallow] = useState(true);
  const [openInEditor, setOpenInEditor] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cloneMutation = useMutation({
    mutationFn: (options: CloneOptions) => cloneRepository(options),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      const projectName = result.path.split("/").pop() || "";
      setSelectedProject(projectName);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!repoUrl.trim()) {
      setError("Repository URL is required");
      return;
    }

    cloneMutation.mutate({
      url: repoUrl,
      name: customName || null,
      shallow,
      open_in_editor: openInEditor,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <label className="text-sm font-medium">Repository URL</label>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/user/repo or user/repo"
          className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Enter a full URL or GitHub username/repo format
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Project Name (optional)</label>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Leave empty to use repo name"
          className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium">Options</label>
        <div className="space-y-3">
          <OptionCheckbox
            checked={shallow}
            onChange={setShallow}
            icon={<Download className="h-4 w-4" />}
            label="Shallow Clone"
            description="Clone with --depth 1 for faster download"
          />
          <OptionCheckbox
            checked={openInEditor}
            onChange={setOpenInEditor}
            icon={<Code2 className="h-4 w-4" />}
            label="Open in Editor"
            description="Open project in your default editor"
          />
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {cloneMutation.isSuccess && (
        <SuccessMessage
          message={cloneMutation.data?.message || ""}
          url={cloneMutation.data?.github_url}
        />
      )}

      <FormActions
        onCancel={() => setView("projects")}
        isLoading={cloneMutation.isPending}
        disabled={!repoUrl}
        label="Clone Repository"
      />
    </form>
  );
}

// Playground Tab
function CreatePlayground({
  queryClient,
  setView,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  setView: (view: View) => void;
}) {
  const [name, setName] = useState("");
  const [openInEditor, setOpenInEditor] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playgroundMutation = useMutation({
    mutationFn: (options: PlaygroundOptions) => createPlayground(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    playgroundMutation.mutate({
      name: name || null,
      open_in_editor: openInEditor,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Playgrounds are temporary projects for quick experiments. They're stored separately
          from your active projects.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Playground Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Leave empty for auto-generated name"
          className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Auto-generated: exp-YYYYMMDD-HHMMSS
        </p>
      </div>

      <div className="space-y-3">
        <OptionCheckbox
          checked={openInEditor}
          onChange={setOpenInEditor}
          icon={<Code2 className="h-4 w-4" />}
          label="Open in Editor"
          description="Open playground in your default editor"
        />
      </div>

      {error && <ErrorMessage message={error} />}
      {playgroundMutation.isSuccess && (
        <SuccessMessage message={playgroundMutation.data?.message || ""} />
      )}

      <FormActions
        onCancel={() => setView("projects")}
        isLoading={playgroundMutation.isPending}
        disabled={false}
        label="Create Playground"
      />
    </form>
  );
}

// Shared Components
function OptionCheckbox({
  checked,
  onChange,
  icon,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-border"
      />
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}

function Warning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
      <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
      <div className="text-sm text-yellow-500">{message}</div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
      <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      <div className="text-sm text-red-500">{message}</div>
    </div>
  );
}

function SuccessMessage({ message, url }: { message: string; url?: string | null }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-medium text-green-500">{message}</div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-500/80 hover:underline flex items-center gap-1 mt-1"
          >
            <ExternalLink className="h-3 w-3" />
            {url}
          </a>
        )}
      </div>
    </div>
  );
}

function FormActions({
  onCancel,
  isLoading,
  disabled,
  label,
}: {
  onCancel: () => void;
  isLoading: boolean;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm rounded-md border border-border hover:bg-secondary"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isLoading || disabled}
        className={cn(
          "px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium flex items-center gap-2",
          (isLoading || disabled) ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <FolderPlus className="h-4 w-4" />
            {label}
          </>
        )}
      </button>
    </div>
  );
}
