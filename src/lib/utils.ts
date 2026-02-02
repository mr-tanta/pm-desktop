import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function getProjectTypeColor(type: string | null): string {
  if (!type) return "bg-zinc-700";

  const colors: Record<string, string> = {
    "Next.js": "bg-zinc-800",
    "React": "bg-blue-900/50",
    "React + Vite": "bg-purple-900/50",
    "Vue.js": "bg-emerald-900/50",
    "Svelte": "bg-orange-900/50",
    "NestJS": "bg-red-900/50",
    "Express": "bg-zinc-700",
    "Node.js": "bg-green-900/50",
    "Rust": "bg-orange-900/50",
    "Tauri": "bg-yellow-900/50",
    "Go": "bg-cyan-900/50",
    "Python": "bg-blue-900/50",
  };

  return colors[type] || "bg-zinc-700";
}
