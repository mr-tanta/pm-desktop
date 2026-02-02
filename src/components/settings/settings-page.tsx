import { useState, useEffect } from "react";
import { useConfig } from "@/hooks/use-system";
import { saveConfig } from "@/lib/tauri";
import { useQueryClient } from "@tanstack/react-query";
import type { Config } from "@/types";
import { Save, RotateCcw, FolderOpen, Code, GitBranch, Timer } from "lucide-react";

export function SettingsPage() {
  const { data: config, isLoading } = useConfig();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          <Field
            label="Default Editor"
            value={form.default_editor}
            onChange={(v) => setForm({ ...form, default_editor: v })}
            placeholder="cursor"
          />
          <Field
            label="Default Template"
            value={form.default_template}
            onChange={(v) => setForm({ ...form, default_template: v })}
            placeholder="next"
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
