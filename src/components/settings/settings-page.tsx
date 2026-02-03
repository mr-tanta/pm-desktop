import { useState, useEffect } from "react";
import { useConfig } from "@/hooks/use-system";
import { useUpdater } from "@/hooks/use-updater";
import { saveConfig, getInstalledEditors } from "@/lib/tauri";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { Config, InstalledEditor } from "@/types";
import { Save, RotateCcw, FolderOpen, Code, GitBranch, Timer, Info, RefreshCw, Download, Check, ChevronDown } from "lucide-react";

const APP_VERSION = "0.1.0";

export function SettingsPage() {
  const { data: config, isLoading } = useConfig();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { checking, updateAvailable, checkForUpdates, downloadAndInstall, downloading, progress } = useUpdater();
  const [checkedOnce, setCheckedOnce] = useState(false);

  const { data: installedEditors } = useQuery({
    queryKey: ["installed-editors"],
    queryFn: getInstalledEditors,
    staleTime: 300000, // 5 minutes
  });

  useEffect(() => {
    if (config) {
      setForm(config);
    }
  }, [config]);

  if (isLoading || !form) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-card rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(form);
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setForm(config);
    }
  };

  const hasChanges = JSON.stringify(form) !== JSON.stringify(config);

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-md ${
              saved
                ? "bg-green-900/30 text-green-400"
                : hasChanges
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Directories" icon={FolderOpen}>
          <Field
            label="Active Projects"
            value={form.active_dir}
            onChange={(v) => setForm({ ...form, active_dir: v })}
            placeholder="~/Developer/active"
          />
          <Field
            label="Archive Directory"
            value={form.archive_dir}
            onChange={(v) => setForm({ ...form, archive_dir: v })}
            placeholder="~/Developer/archived"
          />
        </Section>

        <Section title="Editor & Templates" icon={Code}>
          <EditorSelect
            label="Default Editor"
            value={form.default_editor}
            onChange={(v) => setForm({ ...form, default_editor: v })}
            editors={installedEditors || []}
          />
          <Field
            label="Default Template"
            value={form.default_template}
            onChange={(v) => setForm({ ...form, default_template: v })}
            placeholder="nextjs"
          />
        </Section>

        <Section title="Git" icon={GitBranch}>
          <Field
            label="GitHub Username"
            value={form.github_username || ""}
            onChange={(v) => setForm({ ...form, github_username: v || null })}
            placeholder="your-username"
          />
          <Toggle
            label="Auto Git Init"
            description="Initialize git repository when creating projects"
            checked={form.auto_git_init}
            onChange={(v) => setForm({ ...form, auto_git_init: v })}
          />
        </Section>

        <Section title="Automation" icon={Timer}>
          <Toggle
            label="Auto Install Dependencies"
            description="Run package manager install after project creation"
            checked={form.auto_install_deps}
            onChange={(v) => setForm({ ...form, auto_install_deps: v })}
          />
          <Toggle
            label="Time Tracking"
            description="Enable time tracking for projects"
            checked={form.time_tracking_enabled}
            onChange={(v) => setForm({ ...form, time_tracking_enabled: v })}
          />
        </Section>

        <Section title="About" icon={Info}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">PM Desktop</p>
              <p className="text-xs text-muted-foreground">Version {APP_VERSION}</p>
            </div>
            {updateAvailable ? (
              <button
                onClick={downloadAndInstall}
                disabled={downloading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {progress}%
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Update to {updateAvailable.version}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={async () => {
                  await checkForUpdates();
                  setCheckedOnce(true);
                }}
                disabled={checking}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50"
              >
                {checking ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Checking...
                  </>
                ) : checkedOnce ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Up to date
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Check for Updates
                  </>
                )}
              </button>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FolderOpen;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "left-5" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

const EDITOR_ICONS: Record<string, string> = {
  vscode: "💻",
  cursor: "🖱️",
  zed: "⚡",
  sublime: "🔶",
  jetbrains: "🧠",
  vim: "📟",
  neovim: "📟",
  emacs: "🦬",
  xcode: "🔨",
  android: "🤖",
  nova: "🌟",
  textmate: "📝",
  bbedit: "✏️",
  helix: "🧬",
  nano: "📄",
  atom: "⚛️",
};

function EditorSelect({
  label,
  value,
  onChange,
  editors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editors: InstalledEditor[];
}) {
  const selectedEditor = editors.find((e) => e.command === value);

  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-10 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
        >
          {editors.length === 0 ? (
            <option value={value}>{value || "No editors detected"}</option>
          ) : (
            editors.map((editor) => (
              <option key={editor.id} value={editor.command}>
                {EDITOR_ICONS[editor.icon] || "📝"} {editor.name}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
      {selectedEditor && (
        <p className="text-xs text-muted-foreground mt-1">
          Command: <code className="bg-secondary px-1 rounded">{selectedEditor.command}</code>
        </p>
      )}
      {editors.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {editors.length} editor{editors.length !== 1 ? "s" : ""} detected on your system
        </p>
      )}
    </div>
  );
}
