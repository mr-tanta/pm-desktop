import { memo, useState, useMemo } from "react";
import { usePortManagerStore } from "@/stores/port-manager-store";
import { useAppStore } from "@/stores/app-store";
import type { PortEntry } from "@/types";
import {
  Radio,
  Skull,
  ChevronDown,
  ChevronRight,
  FolderCode,
  Server,
  Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickPortsPanelProps {
  onKillPort: (port: PortEntry) => void;
}

// Dev frameworks/tools to match against process names (case-insensitive)
const DEV_FRAMEWORKS = [
  // JavaScript/TypeScript
  "node",
  "next",
  "nuxt",
  "nest",
  "bun",
  "deno",
  "vite",
  "webpack",
  "esbuild",
  "turbo",
  "npm",
  "pnpm",
  "yarn",
  // Python
  "python",
  "uvicorn",
  "gunicorn",
  "flask",
  "django",
  // Ruby
  "ruby",
  "rails",
  "puma",
  // Rust
  "cargo",
  // Go
  "go",
  "air",
  // PHP
  "php",
  "artisan",
  // Mobile
  "expo",
  "react-native",
  "flutter",
  // Java
  "java",
  "gradle",
  "maven",
  // .NET
  "dotnet",
];

// Framework display names for nicer UI
const FRAMEWORK_NAMES: Record<string, string> = {
  node: "Node.js",
  next: "Next.js",
  nuxt: "Nuxt",
  nest: "NestJS",
  bun: "Bun",
  deno: "Deno",
  vite: "Vite",
  webpack: "Webpack",
  esbuild: "esbuild",
  turbo: "Turbo",
  npm: "npm",
  pnpm: "pnpm",
  yarn: "Yarn",
  python: "Python",
  uvicorn: "Uvicorn",
  gunicorn: "Gunicorn",
  flask: "Flask",
  django: "Django",
  ruby: "Ruby",
  rails: "Rails",
  puma: "Puma",
  cargo: "Rust",
  go: "Go",
  air: "Air (Go)",
  php: "PHP",
  artisan: "Laravel",
  expo: "Expo",
  "react-native": "React Native",
  flutter: "Flutter",
  java: "Java",
  gradle: "Gradle",
  maven: "Maven",
  dotnet: ".NET",
};

function getFrameworkName(processName: string): string | null {
  const lowerName = processName.toLowerCase();
  for (const framework of DEV_FRAMEWORKS) {
    if (lowerName.includes(framework)) {
      return FRAMEWORK_NAMES[framework] || framework;
    }
  }
  return null;
}

function isDevFrameworkProcess(processName: string): boolean {
  const lowerName = processName.toLowerCase();
  return DEV_FRAMEWORKS.some((fw) => lowerName.includes(fw));
}

interface PortRowProps {
  port: PortEntry;
  onKill: () => void;
  showProjectBadge?: boolean;
}

const PortRow = memo(function PortRow({
  port,
  onKill,
  showProjectBadge = false,
}: PortRowProps) {
  const projectName = port.process?.project_name;
  const processName = port.process?.name || "Unknown";
  const frameworkName = getFrameworkName(processName);

  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-secondary/30 transition-colors rounded-lg">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{port.port}</span>
            <span
              className={cn(
                "text-sm truncate",
                projectName ? "font-semibold" : "font-medium"
              )}
            >
              {projectName || processName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {frameworkName && <span>{frameworkName}</span>}
            {projectName && processName && (
              <>
                {frameworkName && <span>·</span>}
                <span className="truncate">{processName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showProjectBadge && projectName && (
          <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">
            Project
          </span>
        )}
        <span className="text-xs text-green-500 flex items-center gap-1">
          <Radio className="h-3 w-3" />
          Active
        </span>
        <button
          onClick={onKill}
          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-500"
          title="Kill process"
        >
          <Skull className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

interface PinnedPortRowProps {
  portNum: number;
  portEntry: PortEntry | null;
  onKill: (port: PortEntry) => void;
}

const PinnedPortRow = memo(function PinnedPortRow({
  portNum,
  portEntry,
  onKill,
}: PinnedPortRowProps) {
  const isActive = !!portEntry;

  if (isActive && portEntry) {
    return <PortRow port={portEntry} onKill={() => onKill(portEntry)} />;
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 rounded-lg opacity-60">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-gray-500" />
        <div>
          <span className="font-mono text-sm font-medium">{portNum}</span>
          <span className="text-xs text-muted-foreground ml-2">
            (not running)
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">Available</span>
    </div>
  );
});

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  count,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (count === 0) return null;

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-secondary/50 rounded-lg transition-colors"
      >
        <span className="text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">
          {count}
        </span>
      </button>

      {isExpanded && <div className="space-y-1 pl-1">{children}</div>}
    </div>
  );
}

export const QuickPortsPanel = memo(function QuickPortsPanel({
  onKillPort,
}: QuickPortsPanelProps) {
  const { scanResult, pinnedPorts } = usePortManagerStore();
  const { config } = useAppStore();

  // Categorize ports
  const { myProjects, devServers, pinnedPortsList } = useMemo(() => {
    const activePorts = scanResult?.ports || [];
    const activeDir = config?.active_dir || "";

    // My Projects: ports where working_directory starts with active_dir
    const myProjects = activeDir
      ? activePorts.filter((p) => {
          const workDir = p.process?.working_directory;
          return workDir && workDir.startsWith(activeDir);
        })
      : [];

    // Dev Servers: ports from dev framework processes NOT in myProjects
    const myProjectPorts = new Set(myProjects.map((p) => p.port));
    const devServers = activePorts.filter((p) => {
      if (myProjectPorts.has(p.port)) return false;
      const processName = p.process?.name || "";
      return isDevFrameworkProcess(processName);
    });

    // Pinned: user-pinned ports (show even if not running)
    const devServerPorts = new Set(devServers.map((p) => p.port));
    const pinnedPortsList = pinnedPorts.filter(
      (portNum) => !myProjectPorts.has(portNum) && !devServerPorts.has(portNum)
    );

    return { myProjects, devServers, pinnedPortsList };
  }, [scanResult?.ports, config?.active_dir, pinnedPorts]);

  // Helper to find port entry
  const getPortEntry = (portNum: number): PortEntry | null => {
    return scanResult?.ports.find((p) => p.port === portNum) ?? null;
  };

  const totalPorts =
    myProjects.length + devServers.length + pinnedPortsList.length;

  if (totalPorts === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          No active dev servers found
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a dev server or pin ports to track them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {/* My Projects Section */}
      <CollapsibleSection
        title="My Projects"
        icon={<FolderCode className="h-4 w-4" />}
        count={myProjects.length}
        defaultExpanded={true}
      >
        {myProjects.map((port) => (
          <PortRow
            key={port.port}
            port={port}
            onKill={() => onKillPort(port)}
          />
        ))}
      </CollapsibleSection>

      {/* Dev Servers Section */}
      <CollapsibleSection
        title="Dev Servers"
        icon={<Server className="h-4 w-4" />}
        count={devServers.length}
        defaultExpanded={true}
      >
        {devServers.map((port) => (
          <PortRow
            key={port.port}
            port={port}
            onKill={() => onKillPort(port)}
            showProjectBadge={true}
          />
        ))}
      </CollapsibleSection>

      {/* Pinned Section */}
      <CollapsibleSection
        title="Pinned"
        icon={<Pin className="h-4 w-4" />}
        count={pinnedPortsList.length}
        defaultExpanded={true}
      >
        {pinnedPortsList.map((portNum) => (
          <PinnedPortRow
            key={portNum}
            portNum={portNum}
            portEntry={getPortEntry(portNum)}
            onKill={onKillPort}
          />
        ))}
      </CollapsibleSection>
    </div>
  );
});
