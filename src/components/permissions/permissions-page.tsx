import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import {
  getPermissions,
  triggerFilesPermission,
  openFullDiskAccessSettings,
  openPrivacySettings,
  requestFullDiskAccessWithDialog,
} from "@/lib/tauri";
import type { PermissionsResult, PermissionStatus } from "@/types";
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  HardDrive,
  FolderOpen,
  Wrench,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function PermissionsPage() {
  const setView = useAppStore((s) => s.setView);
  const [permissions, setPermissions] = useState<PermissionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const loadPermissions = async () => {
    try {
      const result = await getPermissions();
      setPermissions(result);
    } catch (error) {
      console.error("Failed to load permissions:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPermissions();
  };

  const handleRequestPermission = async (permission: PermissionStatus) => {
    if (permission.id === "full_disk_access") {
      // Show native dialog and open settings
      await requestFullDiskAccessWithDialog();
    } else if (permission.can_prompt) {
      // Trigger native permission prompt
      await triggerFilesPermission();
      // Refresh after a delay to check if granted
      setTimeout(loadPermissions, 1000);
    } else {
      // Open settings
      await openPrivacySettings(permission.settings_url);
    }
  };

  const handleOpenSettings = async (permission: PermissionStatus) => {
    if (permission.id === "full_disk_access") {
      await openFullDiskAccessSettings();
    } else {
      await openPrivacySettings(permission.settings_url);
    }
  };

  const handleCopyPath = async () => {
    if (permissions?.app_path) {
      await navigator.clipboard.writeText(permissions.app_path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const getPermissionIcon = (id: string) => {
    switch (id) {
      case "full_disk_access":
        return <HardDrive className="h-5 w-5" />;
      case "files_and_folders":
        return <FolderOpen className="h-5 w-5" />;
      case "developer_directory":
        return <Wrench className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setView("settings")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </button>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Grant access to clean system files and caches
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : permissions ? (
        <div className="space-y-6">
          {/* Status Banner */}
          <div
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border",
              permissions.required_granted
                ? "bg-green-500/10 border-green-500/30"
                : "bg-yellow-500/10 border-yellow-500/30"
            )}
          >
            {permissions.required_granted ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-500">
                    All required permissions granted
                  </p>
                  <p className="text-xs text-green-500/80">
                    PM Desktop can access all necessary directories
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-yellow-500">
                    Some permissions are missing
                  </p>
                  <p className="text-xs text-yellow-500/80">
                    Grant the required permissions below for full functionality
                  </p>
                </div>
              </>
            )}
          </div>

          {/* App Path */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">
              When adding to Full Disk Access, select this app:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-secondary px-3 py-2 rounded-md truncate">
                {permissions.app_path}
              </code>
              <button
                onClick={handleCopyPath}
                className="p-2 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground"
                title="Copy path"
              >
                {copiedPath ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Permissions List */}
          <div className="space-y-3">
            {permissions.permissions.map((permission) => (
              <div
                key={permission.id}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      permission.granted
                        ? "bg-green-500/10 text-green-500"
                        : "bg-yellow-500/10 text-yellow-500"
                    )}
                  >
                    {getPermissionIcon(permission.id)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{permission.name}</h3>
                      {permission.required && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                          Required
                        </span>
                      )}
                      {permission.granted ? (
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                      ) : (
                        <ShieldX className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {permission.description}
                    </p>

                    {/* Actions */}
                    {!permission.granted && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRequestPermission(permission)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                          {permission.can_prompt ? (
                            "Request Permission"
                          ) : (
                            <>
                              <ExternalLink className="h-3 w-3" />
                              Grant in System Settings
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {permission.granted && (
                      <button
                        onClick={() => handleOpenSettings(permission)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open in System Settings
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Check Again Button */}
          {!permissions.required_granted && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Already granted permission?</p>
                  <p className="text-xs text-muted-foreground">
                    Click to check if permissions are now active
                  </p>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  Check Again
                </button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-secondary/50 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">
              How to grant Full Disk Access
            </h3>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click "Grant in System Settings" above</li>
              <li>System Settings will open to Privacy & Security</li>
              <li>Click the + button at the bottom</li>
              <li>Navigate to the app or paste the path above</li>
              <li>Toggle the switch to enable access</li>
              <li>Come back here and click "Check Again"</li>
            </ol>
            <p className="text-xs text-yellow-500 mt-3">
              Note: You may need to restart PM Desktop for full changes to take effect.
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Failed to load permissions
        </div>
      )}
    </div>
  );
}
