import { useState } from "react";
import { useEnvFiles, useWriteEnvVariable } from "@/hooks/use-env-manager";
import { copyToClipboard } from "@/lib/tauri";
import {
  FileKey,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";

interface EnvManagerProps {
  projectPath: string;
}

export function EnvManager({ projectPath }: EnvManagerProps) {
  const { data: envFiles } = useEnvFiles(projectPath);
  const writeVar = useWriteEnvVariable(projectPath);
  const [activeTab, setActiveTab] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (!envFiles || envFiles.length === 0) return null;

  const currentFile = envFiles[activeTab];

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCopy = async (value: string, key: string) => {
    await copyToClipboard(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (editingKey && currentFile) {
      writeVar.mutate({ path: currentFile.path, key: editingKey, value: editValue });
      setEditingKey(null);
      setEditValue("");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-accent/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <FileKey className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Environment Variables</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {envFiles.length} file{envFiles.length !== 1 ? "s" : ""}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Tabs */}
          {envFiles.length > 1 && (
            <div className="flex gap-1 mb-3 border-b border-border">
              {envFiles.map((file, i) => (
                <button
                  key={file.name}
                  onClick={() => setActiveTab(i)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    i === activeTab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}

          {/* Variables table */}
          {currentFile && (
            <div className="space-y-1">
              {currentFile.variables.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No variables found
                </p>
              ) : (
                currentFile.variables.map((v) => (
                  <div
                    key={v.key}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/50 group"
                  >
                    <span className="text-xs font-mono font-medium min-w-[140px] text-foreground">
                      {v.key}
                    </span>
                    <span className="text-xs text-muted-foreground">=</span>

                    {editingKey === v.key ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave();
                            if (e.key === "Escape") setEditingKey(null);
                          }}
                          className="flex-1 px-2 py-0.5 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <button
                          onClick={handleSave}
                          className="p-0.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="p-0.5 text-muted-foreground hover:bg-secondary rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-xs font-mono text-muted-foreground truncate">
                          {v.is_secret && !revealedKeys.has(v.key)
                            ? "••••••••"
                            : v.value}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {v.is_secret && (
                            <button
                              onClick={() => toggleReveal(v.key)}
                              className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                              title={revealedKeys.has(v.key) ? "Hide" : "Reveal"}
                            >
                              {revealedKeys.has(v.key) ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(v.value, v.key)}
                            className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                            title="Copy value"
                          >
                            {copiedKey === v.key ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(v.key, v.value)}
                            className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
