import { useState, useEffect, useRef, useCallback } from "react";
import { useProcessLogs, useProcessLogStream } from "@/hooks/use-process-manager";
import { clearProcessLogs } from "@/lib/tauri";
import { X, Trash2, Search, ArrowDown } from "lucide-react";
import type { LogLine, ProcessLogEvent } from "@/types";

interface LogViewerProps {
  pid: number;
  projectName: string;
  onClose: () => void;
}

export function LogViewer({ pid, projectName, onClose }: LogViewerProps) {
  const { data: initialLogs } = useProcessLogs(pid);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial logs
  useEffect(() => {
    if (initialLogs) {
      setLines(initialLogs);
    }
  }, [initialLogs]);

  // Stream real-time logs
  const handleLog = useCallback((event: ProcessLogEvent) => {
    setLines((prev) => {
      const next = [...prev, event.line];
      if (next.length > 1000) next.shift();
      return next;
    });
  }, []);

  useProcessLogStream(pid, handleLog);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const handleClear = async () => {
    await clearProcessLogs(pid);
    setLines([]);
  };

  const filteredLines = search
    ? lines.filter((l) => l.content.toLowerCase().includes(search.toLowerCase()))
    : lines;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">Logs: {projectName}</span>
          <span className="text-xs text-muted-foreground">PID {pid}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs..."
              className="pl-7 pr-2 py-1 text-xs rounded bg-secondary border border-border w-48 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleClear}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Clear logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {!autoScroll && (
            <button
              onClick={() => setAutoScroll(true)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Scroll to bottom"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-64 overflow-y-auto overflow-x-auto p-2 font-mono text-xs leading-5 bg-black/90 text-green-400"
      >
        {filteredLines.length === 0 ? (
          <div className="text-muted-foreground italic">Waiting for output...</div>
        ) : (
          filteredLines.map((line, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap break-all ${
                line.stream === "stderr" ? "text-red-400" : ""
              }`}
            >
              {line.content}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
