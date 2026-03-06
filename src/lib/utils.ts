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
  if (!type) return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";

  const colors: Record<string, string> = {
    "Next.js": "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    "React": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
    "React + Vite": "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
    "Vue.js": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
    "Svelte": "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
    "NestJS": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
    "Express": "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    "Node.js": "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
    "Rust": "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
    "Tauri": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200",
    "Go": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200",
    "Python": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  };

  return colors[type] || "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
}
