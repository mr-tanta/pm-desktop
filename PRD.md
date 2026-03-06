# PM Desktop — Native macOS App
## Product Requirements Document (PRD)

**Version:** 2.0
**Date:** February 27, 2026
**Status:** Draft
**Platform:** macOS 14+ (Sonoma and later), Apple Silicon primary, Intel supported

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [Target Users](#4-target-users)
5. [Current State (v0.1 — Tauri)](#5-current-state-v01--tauri)
6. [Native macOS Architecture](#6-native-macos-architecture)
7. [Feature Specifications](#7-feature-specifications)
   - 7.1 [Today Dashboard](#71-today-dashboard)
   - 7.2 [Project Management](#72-project-management)
   - 7.3 [Project Detail View](#73-project-detail-view)
   - 7.4 [Project Creation & Templates](#74-project-creation--templates)
   - 7.5 [Time Tracking](#75-time-tracking)
   - 7.6 [Process Manager](#76-process-manager)
   - 7.7 [Disk Manager](#77-disk-manager)
   - 7.8 [Port Manager](#78-port-manager)
   - 7.9 [Workspaces](#79-workspaces)
   - 7.10 [Environment Variable Manager](#710-environment-variable-manager)
   - 7.11 [System Tray & Menu Bar](#711-system-tray--menu-bar)
   - 7.12 [Command Palette](#712-command-palette)
   - 7.13 [Settings](#713-settings)
   - 7.14 [Permissions Management](#714-permissions-management)
8. [Data Architecture](#8-data-architecture)
9. [Navigation & Information Architecture](#9-navigation--information-architecture)
10. [Design System](#10-design-system)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [Performance Requirements](#12-performance-requirements)
13. [Security & Privacy](#13-security--privacy)
14. [macOS Integration Points](#14-macos-integration-points)
15. [Supported Editors & Tools](#15-supported-editors--tools)
16. [Error Handling & Edge Cases](#16-error-handling--edge-cases)
17. [Analytics & Telemetry](#17-analytics--telemetry)
18. [Release & Distribution](#18-release--distribution)
19. [Future Considerations](#19-future-considerations)
20. [Glossary](#20-glossary)

---

## 1. Executive Summary

PM Desktop is a native macOS developer tool that serves as a command center for managing software projects. It combines project discovery, git status monitoring, time tracking, process management, disk cleanup, port scanning, environment variable management, and workspace grouping into a single, lightweight menu-bar-native application.

The native macOS rebuild replaces the current Tauri + React hybrid with a fully native Swift/SwiftUI application backed by a Rust core library. This unlocks deeper macOS integration (Spotlight, Shortcuts, Widgets, Notification Center), eliminates the web-view rendering layer, reduces memory footprint, and delivers a UI that feels indistinguishable from first-party Apple software.

---

## 2. Problem Statement

Professional developers routinely juggle 10–50+ projects across multiple frameworks, languages, and tools. The daily workflow involves:

- Remembering which projects have uncommitted work or unpushed branches
- Manually opening projects in the right editor, navigating to the right directory
- Losing track of time spent per project (for billing, focus, or personal productivity)
- Leaving dev servers running and forgetting which ports are occupied
- Accumulating gigabytes of build artifacts, caches, and `node_modules` without realizing it
- Managing `.env` files with secrets scattered across dozens of projects
- Context-switching between unrelated tools (terminal, Finder, Activity Monitor, editor)

No single tool exists on macOS that unifies these concerns into a developer-native experience. PM Desktop fills this gap.

---

## 3. Product Vision

**One-sentence vision:** PM Desktop is the macOS-native operating system for your development projects — always one keystroke away from your menu bar, always aware of what needs your attention.

**Design principles:**
1. **Menu-bar first** — The tray popup is the primary interaction surface. The main window is for deep-dive tasks.
2. **Awareness, not interruption** — Surface attention items (uncommitted changes, stale projects, port conflicts) passively, never block workflow.
3. **Zero-config intelligence** — Auto-detect project types, scripts, ports, and editors. Never ask the user to configure what can be inferred.
4. **Native or nothing** — Every interaction must feel like a first-party macOS app. No web-view jank, no non-standard controls.
5. **Keyboard-driven** — Every feature reachable via keyboard. Command palette as universal entry point.

---

## 4. Target Users

### Primary Persona: Full-Stack Developer ("Alex")
- Works on 5–15 active projects simultaneously
- Uses VS Code or Cursor as primary editor
- Runs multiple dev servers (Next.js, NestJS, etc.) concurrently
- Cares about disk space (MacBook with 256GB–512GB SSD)
- Bills hourly or tracks time for personal productivity
- Comfortable with terminal but prefers GUI for oversight tasks

### Secondary Persona: Team Lead ("Jordan")
- Manages 20+ repositories across multiple teams
- Needs quick git status overview across all projects
- Uses workspaces to group projects by team/sprint
- Values the "attention items" dashboard to stay on top of code hygiene

### Tertiary Persona: Freelancer ("Sam")
- Juggles client projects with strict billing
- Time tracking accuracy is critical
- Frequently archives/restores projects between engagements
- Needs clean separation of environment variables between clients

---

## 5. Current State (v0.1 — Tauri)

### Current Architecture
```
┌─────────────────────────────────────────────┐
│                  PM Desktop                  │
│                                              │
│  ┌──────────────┐    ┌───────────────────┐   │
│  │  React 19     │    │   Rust Backend    │   │
│  │  + TypeScript │◄──►│   (Tauri 2.9)     │   │
│  │  + Tailwind   │IPC │   + SQLite        │   │
│  │  + Zustand    │    │   + git2          │   │
│  │  + TanStack   │    │   + tokio         │   │
│  └──────────────┘    └───────────────────┘   │
│         WebView              Native           │
└─────────────────────────────────────────────┘
```

### Current Feature Matrix (All Implemented)

| Feature Area | Status | Commands |
|---|---|---|
| Project listing & discovery | Complete | `list_projects`, `get_project` |
| Git status monitoring | Complete | Integrated in `get_project` via `git2` |
| Project creation (10 templates) | Complete | `create_project`, `list_templates`, `clone_repository`, `create_playground` |
| Time tracking | Complete | `start_timer`, `stop_timer`, `get_active_timer`, `get_time_entries` |
| Today dashboard & insights | Complete | `get_today_summary`, `get_daily_time_summary`, `get_weekly_time_summary`, `get_time_streaks` |
| Disk scanning (8 categories) | Complete | `scan_disk`, `preview_cleanup`, `execute_cleanup`, `get_disk_trend` |
| Port scanning & management | Complete | `scan_ports`, `kill_port`, `kill_process`, `batch_kill_processes` |
| Process management | Complete | `launch_project`, `stop_project`, `get_managed_processes`, `get_process_logs` |
| Workspaces | Complete | `create_workspace`, `list_workspaces`, `start_workspace`, `stop_workspace` |
| Environment variable management | Complete | `list_project_env_files`, `read_env_file`, `write_env_variable` |
| System tray with custom popup | Complete | `get_tray_data`, `start_working`, `resize_tray_popup` |
| Settings & configuration | Complete | `load_config`, `save_config` |
| Permission checking | Complete | `get_permissions`, `check_full_disk_access_status` |
| Editor detection (24 editors) | Complete | `get_installed_editors`, `open_in_editor` |
| Command palette | Complete | `Cmd+K` overlay |
| Archive system | Complete | `archive_project`, `restore_project` |
| Auto-update | Complete | Tauri updater plugin |

### Current Database Schema (SQLite, v4)

```sql
-- Time tracking entries
CREATE TABLE time_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    started_at   TEXT NOT NULL,      -- RFC3339
    ended_at     TEXT,               -- RFC3339, NULL if active
    duration_seconds INTEGER
);

-- Project metadata (pinning)
CREATE TABLE project_meta (
    project_name TEXT PRIMARY KEY,
    is_pinned    INTEGER DEFAULT 0,
    pinned_at    TEXT
);

-- Workspace definitions
CREATE TABLE workspaces (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

-- Workspace-project relationships
CREATE TABLE workspace_projects (
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    sort_order   INTEGER DEFAULT 0,
    PRIMARY KEY (workspace_id, project_name)
);

-- Disk scan history for trend tracking
CREATE TABLE disk_scan_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_date           TEXT NOT NULL,
    total_size          INTEGER NOT NULL,
    category_sizes_json TEXT
);
```

### Current Config File (`~/.devconfig/pm-config.json`)
```json
{
  "active_directory": "~/Developer/active",
  "archive_directory": "~/Developer/archive",
  "default_editor": "cursor",
  "github_username": "",
  "features": {
    "disk_manager": true,
    "port_manager": true,
    "time_tracking": true
  }
}
```

### Design Tokens (Current Theme)

**Dark theme (default):**
| Token | Value | Usage |
|---|---|---|
| `background` | `#09090b` | App background |
| `foreground` | `#fafafa` | Primary text |
| `card` | `#0a0a0c` | Card backgrounds |
| `muted` | `#27272a` | Muted backgrounds |
| `muted-foreground` | `#a1a1aa` | Secondary text |
| `border` | `#27272a` | All borders |
| `destructive` | `#7f1d1d` | Delete/danger actions |
| `ring` | `#d4d4d8` | Focus ring |
| `sidebar` | `#0a0a0c` | Sidebar background |

**Light theme:**
| Token | Value | Usage |
|---|---|---|
| `background` | `#ffffff` | App background |
| `foreground` | `#09090b` | Primary text |
| `card` | `#ffffff` | Card backgrounds |
| `muted` | `#f4f4f5` | Muted backgrounds |
| `muted-foreground` | `#71717a` | Secondary text |
| `border` | `#e4e4e7` | All borders |
| `destructive` | `#dc2626` | Delete/danger actions |

**Border Radii:**
| Token | Value |
|---|---|
| `sm` | `0.25rem` (4px) |
| `md` | `0.375rem` (6px) |
| `lg` | `0.5rem` (8px) |
| `xl` | `0.75rem` (12px) |

---

## 6. Native macOS Architecture

### Target Architecture
```
┌──────────────────────────────────────────────────────────┐
│                     PM Desktop 2.0                        │
│                                                           │
│  ┌──────────────────┐     ┌────────────────────────────┐  │
│  │   SwiftUI Views   │     │     Rust Core Library      │  │
│  │   + AppKit        │     │     (via Swift FFI)        │  │
│  │   + Combine       │◄───►│                            │  │
│  │   + Swift Data    │FFI  │  ┌──────────────────────┐  │  │
│  │                   │     │  │  git2 (libgit2)      │  │  │
│  │  ┌─────────────┐  │     │  │  rusqlite (SQLite)   │  │  │
│  │  │ ViewModels   │  │     │  │  tokio (async)       │  │  │
│  │  │ (Observable) │  │     │  │  sysinfo             │  │  │
│  │  └─────────────┘  │     │  │  nix (process mgmt)  │  │  │
│  └──────────────────┘     │  └──────────────────────┘  │  │
│                           └────────────────────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              macOS System Integration                 │  │
│  │  Menu Bar ∙ Spotlight ∙ Shortcuts ∙ Widgets          │  │
│  │  Notification Center ∙ Keychain ∙ Sandbox            │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Technology Decisions

| Layer | Technology | Rationale |
|---|---|---|
| **UI Framework** | SwiftUI + AppKit (where needed) | Native macOS look, vibrancy materials, native animations |
| **Core Logic** | Rust library (via `uniffi` or C FFI) | Reuse existing battle-tested Rust backend. git2, SQLite, async process management already written |
| **Database** | SQLite via Rust `rusqlite` | Existing schema, WAL mode, zero migration needed |
| **Git** | `git2` (Rust) via FFI | Already implemented, faster than shelling out |
| **State** | `@Observable` + Combine | SwiftUI-native reactivity |
| **Persistence** | SQLite (Rust) + UserDefaults (Swift) for UI prefs | Structured data in SQL, UI prefs in macOS-native storage |
| **Menu Bar** | NSStatusItem + NSPopover (SwiftUI content) | Native popover with vibrancy |
| **Async** | Swift Concurrency (async/await) + Tokio (Rust side) | Swift actors for UI, Tokio for Rust async work |

### Why Keep Rust Core

The Rust backend contains ~5,000+ lines of non-trivial logic:
- Process spawning and log capture with ring buffers
- Recursive disk scanning with safety classifications
- Port scanning via `lsof`/`netstat` parsing
- Git status aggregation via `libgit2`
- SQLite database with migrations
- Template-based project creation with tool detection

Rewriting this in Swift offers no advantage. Instead, expose the Rust library via FFI (using Mozilla's `uniffi` for ergonomic Swift bindings) and build the UI layer natively.

---

## 7. Feature Specifications

### 7.1 Today Dashboard

**Purpose:** The home screen. Provides a contextual daily overview of the developer's state — what needs attention, what's active, and time statistics.

#### 7.1.1 Greeting Header
- Dynamic greeting based on time of day: "Good morning", "Good afternoon", "Good evening"
- Shows current date formatted as "Thursday, February 27"
- If a timer is active, show project name and elapsed time prominently

#### 7.1.2 Active Timer Banner
- **Trigger:** Displayed only when `get_active_timer()` returns non-null
- **Content:**
  - Project name (clickable → navigates to project detail)
  - Elapsed time in `H:MM:SS` format, updating every second
  - Stop button (calls `stop_timer()`)
- **Design:** Full-width banner at top of dashboard, accent color background, subtle pulse animation on the timer digits

#### 7.1.3 Attention Items List
- **Source:** `get_today_summary().attention_items`
- **Item types and their detection logic:**

| Type | Detection | Severity | Message Format | Action |
|---|---|---|---|---|
| `uncommitted` | `git_status.is_dirty == true` AND `git_status.modified_count + git_status.untracked_count > 0` | `warning` | "{project} has {n} uncommitted changes" | "Open in editor" |
| `unpushed` | `git_status.ahead > 0` | `warning` | "{project} has {n} unpushed commits" | "Open in terminal" |
| `stale` | `last_modified` older than 7 days AND has uncommitted changes | `info` | "{project} hasn't been touched in {n} days" | "View project" |

- **Design:** Card list with severity-colored left border (amber for warning, blue for info). Each item shows icon, message, and action button.
- **Empty state:** "All caught up — no projects need attention" with a checkmark icon.

#### 7.1.4 Running Projects Strip
- **Source:** `get_managed_processes()` filtered to `status == "running"`
- **Content per process:**
  - Project name
  - Port number (if detected)
  - Running duration (since `started_at`)
  - Status indicator (green dot)
  - Stop button
- **Interaction:** Click project name → navigate to project detail. Click stop → calls `stop_project(pid)`.
- **Empty state:** Not shown if no processes running.

#### 7.1.5 Recent Projects Strip
- **Source:** `get_today_summary().recent_projects` (last 5 by `last_modified`)
- **Content per project:** Name, type icon, last modified relative time ("2h ago")
- **Interaction:** Click → navigate to project detail

#### 7.1.6 Daily/Weekly Summary
- **Source:** `get_daily_time_summary()` and `get_weekly_time_summary()`
- **Daily breakdown:**
  - Total time coded today in `Xh Ym` format
  - Number of sessions today
  - Bar chart showing time per project (horizontal bars, sorted descending)
- **Weekly overview:**
  - 7-day heat strip (Mon–Sun), each day colored by hours worked (gray=0, light=1-2h, medium=3-4h, dark=5h+)
  - Total weekly hours
  - Comparison to previous week ("↑ 2h more than last week" or "↓ 1h less")
- **Streaks:** Current streak and longest streak from `get_time_streaks()`

#### 7.1.7 Start Working Card
- Quick-start card shown when no timer is active and no processes are running
- Shows pinned projects with a "Start" button for each
- "Start" calls `start_working(project_name, launch: true, script: "dev", port: auto)` — starts timer AND launches the dev server

---

### 7.2 Project Management

**Purpose:** Browse, search, filter, and manage all development projects.

#### 7.2.1 Project Discovery
- **Source directories:** Configured via Settings (`active_directory`, `archive_directory`)
- **Detection:** Scans top-level directories in the active directory. Each directory is a "project."
- **Project type detection** (in priority order):

| Indicator File | Detected Type |
|---|---|
| `next.config.*` or `package.json` containing `"next"` | Next.js |
| `package.json` with `"react"` + `vite.config.*` | React (Vite) |
| `package.json` with `"react"` | React |
| `package.json` with `"vue"` | Vue.js |
| `package.json` with `"svelte"` | Svelte |
| `package.json` with `"@nestjs/core"` | NestJS |
| `package.json` with `"express"` | Express |
| `Cargo.toml` with `[dependencies.tauri]` | Tauri |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pyproject.toml` or `setup.py` | Python |

#### 7.2.2 Project List View
- **Layout:** Grid of project cards (responsive, 2–4 columns based on window width)
- **Each card shows:**
  - Project name (bold)
  - Project type with framework icon (e.g., Next.js logo, Rust crab)
  - Git branch name (e.g., `main`, `feature/auth`)
  - Git status summary: dirty indicator (orange dot), ahead/behind counts
  - Last modified relative time
  - Pin indicator (star icon if pinned)
  - Disk size (formatted: "142 MB")
- **Card actions (on hover or right-click context menu):**
  - Open in Editor (uses default or lets user pick)
  - Open in Terminal
  - Open in Finder
  - Start Timer
  - Launch Dev Server
  - Archive Project
  - Pin/Unpin
  - Copy Path

#### 7.2.3 Search & Filter
- **Search bar:** Filters by project name (fuzzy match), debounced 200ms
- **Filter chips:**
  - By type: All, Next.js, React, Rust, Go, Python, etc.
  - By status: All, Has Uncommitted, Has Unpushed, Clean
  - By location: Active, Archived
- **Sort options:** Name (A-Z), Last Modified, Size, Type
- **Pinned projects** always appear first, regardless of sort

#### 7.2.4 Bulk Operations
- Multi-select mode (checkbox on each card)
- Available bulk actions:
  - Archive selected
  - Delete selected (with confirmation dialog)
  - Open all in editor

---

### 7.3 Project Detail View

**Purpose:** Deep-dive into a single project with all related information in one place.

#### 7.3.1 Header Section
- Project name (large, editable in future)
- Project type badge
- Full path (clickable → copies to clipboard, or opens in Finder)
- Action buttons row: Open in Editor, Open in Terminal, Open in Finder, Start Timer, Launch

#### 7.3.2 Git Status Panel
- **Source:** `get_project(name).git_status`
- **Content:**
  - Current branch name with branch icon
  - Remote tracking status: "↑2 ↓0" (ahead/behind)
  - Working tree status:
    - Staged changes count (green)
    - Modified files count (amber)
    - Untracked files count (gray)
  - Dirty indicator: "Clean" (green) or "Modified" (amber)
  - Has remote: Yes/No
- **Design:** Compact panel with monospace font for branch names

#### 7.3.3 Scripts Panel
- **Source:** `get_project_scripts(path)` — parses `package.json` scripts
- **Content:** List of available npm/yarn/pnpm scripts
- **For each script:**
  - Script name (e.g., `dev`, `build`, `test`, `lint`)
  - Script command preview (truncated, tooltip shows full)
  - "Run" button → calls `launch_project` with that script
- **Auto-detect package manager:** Checks for `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `package-lock.json`

#### 7.3.4 Ports Panel
- **Source:** Cross-reference running processes with port scan
- **Content:**
  - Ports currently used by this project's processes
  - Port number, protocol, process name
  - "Kill" button per port
- **Empty state:** "No active ports for this project"

#### 7.3.5 Environment Variables Panel
- **Source:** `list_project_env_files(path)` and `read_env_file(path)`
- **Content:**
  - Tabs for each `.env` file found (`.env`, `.env.local`, `.env.development`, etc.)
  - For each file: key-value table
    - Key column (monospace)
    - Value column (masked by default for secrets, revealed on click)
    - Secret indicator icon (lock icon) for auto-detected secrets
  - "Add Variable" button
  - "Copy to..." button to copy variables between env files
- **Secret detection keywords:** `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `AUTH`, `PRIVATE`, `API_KEY`, `CREDENTIAL`, `CERTIFICATE`
- **Security:** Values with `is_secret: true` are displayed as `••••••••` until explicitly revealed

#### 7.3.6 Disk Usage Panel
- **Source:** `get_project_disk_info(name)`
- **Content:**
  - Total project size (e.g., "1.2 GB")
  - Breakdown bar chart:
    - Source code: X MB
    - `node_modules`: X MB
    - `.git`: X MB
    - `target`/`.next`/build artifacts: X MB
  - "Clean" button for removable directories (node_modules, .next, target)
- **Cleanup confirmation:** Shows what will be deleted and reclaimed space before executing

#### 7.3.7 Time History Panel
- **Source:** `get_time_entries(project_name)`
- **Content:**
  - Table of time entries: date, start time, end time, duration
  - Total time spent on this project
  - Chart of time per day (last 30 days)

#### 7.3.8 README Preview
- **Source:** `get_project(name).readme_preview`
- **Content:** First ~500 characters of the project's README.md, rendered as markdown
- **Design:** Collapsible section, collapsed by default

---

### 7.4 Project Creation & Templates

**Purpose:** Scaffold new projects from templates with sensible defaults.

#### 7.4.1 Template Selection
- **Available templates (11):**

| Template | Command | Framework | Language |
|---|---|---|---|
| Next.js | `npx create-next-app@latest` | Next.js 14+ | TypeScript |
| Vite + React | `npm create vite@latest` | Vite + React | TypeScript |
| NestJS | `npx @nestjs/cli new` | NestJS | TypeScript |
| Expo | `npx create-expo-app` | Expo (React Native) | TypeScript |
| T3 Stack | `npm create t3-app@latest` | Next.js + tRPC + Prisma | TypeScript |
| Astro | `npm create astro@latest` | Astro | TypeScript |
| SvelteKit | `npm create svelte@latest` | SvelteKit | TypeScript |
| Tauri | `npm create tauri-app@latest` | Tauri | Rust + TypeScript |
| Python FastAPI | Custom scaffold | FastAPI | Python |
| Go Gin | Custom scaffold | Gin | Go |
| Empty | `mkdir` + README + .gitignore | None | None |

#### 7.4.2 Creation Options
- **Project name:** Text input, validated (no spaces, lowercase, kebab-case suggested)
- **Template:** Selection from grid with framework logos
- **Initialize Git:** Toggle (default: on), calls `git init`
- **Open in Editor:** Toggle (default: on), opens in default editor after creation
- **Create GitHub Repo:** Toggle (default: off), requires `gh` CLI and GitHub username in settings
  - If enabled: creates private repo, sets remote, pushes initial commit

#### 7.4.3 Clone Repository
- **Input:** Git URL (HTTPS or SSH)
- **Options:**
  - Custom name (optional, defaults to repo name)
  - Shallow clone toggle (default: off)
  - Open in editor after clone
- **Validation:** Checks `git` is installed via `check_tool_installed("git")`

#### 7.4.4 Create Playground
- Creates a temporary project in a temp directory
- Useful for quick experiments
- Auto-named with timestamp: `playground-2026-02-27-143022`

#### 7.4.5 Tool Detection
- Before scaffolding, checks if required tools are installed:
  - `npm`, `npx`, `pnpm`, `yarn`, `bun`, `cargo`, `go`, `python`, `gh`, `git`
- Displays warning if a required tool is missing, with install instructions

---

### 7.5 Time Tracking

**Purpose:** Track time spent on each project for billing, productivity insights, or personal awareness.

#### 7.5.1 Timer Controls
- **Start:** `start_timer(project_name)` — Stores `started_at` as RFC3339 timestamp in SQLite
- **Stop:** `stop_timer()` — Calculates `duration_seconds`, stores `ended_at`, returns the `TimeEntry`
- **Constraint:** Only one timer can be active at a time. Starting a new timer implicitly stops the current one.
- **Persistence:** Active timer survives app restarts (stored as an open-ended `time_entry` with NULL `ended_at`)

#### 7.5.2 Timer Display Locations
1. **Dashboard banner** — Full-width, prominent
2. **System tray title** — Menu bar text shows `H:MM:SS` while timer is active
3. **Sidebar** — Small timer indicator next to the active project name
4. **Project detail** — Timer controls in the header section

#### 7.5.3 Time Entries
- **Schema:** `{ id, project_name, started_at, ended_at, duration_seconds }`
- **Query options:** By project, by date range, with limit
- **Display format:** "2h 15m" for durations, "Today at 2:30 PM" for timestamps

#### 7.5.4 Daily Summary
- **API:** `get_daily_time_summary(date?)`
- **Returns:** Array of `{ project_name, total_seconds, session_count }` for the given date
- **Default:** Today

#### 7.5.5 Weekly Summary
- **API:** `get_weekly_time_summary(week_offset?)`
- **Returns:**
  - `total_seconds` for the week
  - `daily_breakdown`: Array of 7 `{ date, total_seconds, project_count }`
  - `comparison`: Difference from previous week in seconds
  - `most_active_project`: Project with most time this week

#### 7.5.6 Streaks
- **API:** `get_time_streaks()`
- **Current streak:** Consecutive days (including today) with at least one time entry
- **Longest streak:** All-time longest consecutive day streak
- **Last active date:** For streak calculation continuity

---

### 7.6 Process Manager

**Purpose:** Launch, monitor, and control dev server processes directly from PM Desktop.

#### 7.6.1 Launching Projects
- **API:** `launch_project(options)`
- **Options:**
  ```
  {
    project_name: string,
    project_path: string,
    command?: string,        // Override auto-detected command
    script?: string,         // npm script name (e.g., "dev")
    port?: number,           // Override auto-detected port
    env?: Record<string,string>  // Additional env vars
  }
  ```
- **Auto-detection logic:**
  1. If `Cargo.toml` exists → `cargo run`
  2. If `go.mod` exists → `go run .`
  3. If `package.json` exists:
     - Detect package manager from lock file (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, else npm)
     - Default script: `dev` if exists, else `start`
     - Command: `{pkg_manager} run {script}`
  4. If `pyproject.toml` exists → `python -m uvicorn main:app --reload`

#### 7.6.2 Process Tracking
- **In-memory storage:** HashMap of PID → ProcessEntry
- **ProcessEntry includes:**
  - `pid`: Process ID
  - `project_name`: Associated project
  - `project_path`: Working directory
  - `command`: The executed command
  - `port`: Detected or specified port
  - `started_at`: Timestamp
  - `status`: `starting` → `running` → `stopped` | `crashed`
- **Not persisted:** Process state is runtime-only (processes don't survive app restart, but are re-detected on next scan)

#### 7.6.3 Log Capture
- **Mechanism:** stdout and stderr are captured via pipes
- **Buffer:** Ring buffer of last 1,000 lines per process
- **Log entry format:** `{ timestamp, stream: "stdout" | "stderr", content }`
- **Real-time streaming:** Emits events as new log lines arrive (for live log viewer)
- **API:**
  - `get_process_logs(pid, limit?)` — Get buffered logs
  - `clear_process_logs(pid)` — Clear buffer

#### 7.6.4 Log Viewer Component
- **Design:** Terminal-like view with monospace font
- **Features:**
  - Auto-scroll to bottom (with "sticky" mode toggle)
  - Color-coded: stdout in default color, stderr in red
  - Timestamps in left gutter (toggleable)
  - Search within logs (Cmd+F in viewer)
  - Copy selection or full log
  - Clear log button

#### 7.6.5 Crash Detection
- **Mechanism:** When a managed process exits unexpectedly (non-zero exit code), status changes to `crashed`
- **Notification:** System notification via macOS Notification Center: "Project {name} crashed"
- **UI:** Crash notifier component shows banner with restart option
- **Event:** Emits `process-crashed` event to update tray and dashboard

#### 7.6.6 Port Detection
- **API:** `detect_project_port(project_path)`
- **Logic:** Parses `package.json` scripts for common port patterns:
  - `--port 3000`, `-p 3001`, `PORT=8080`
  - Falls back to common defaults by framework (Next.js: 3000, Vite: 5173, NestJS: 3000)

---

### 7.7 Disk Manager

**Purpose:** Visualize disk usage by development-related categories and safely reclaim space.

#### 7.7.1 Scanning
- **Full scan:** `scan_disk()` — Scans all known paths for the 8 categories
- **Category scan:** `scan_category(category)` — Scan a single category
- **Progress:** Emits events during scan with current path and percentage
- **Cancellation:** `cancel_disk_scan()` — Graceful cancel of in-progress scan
- **Async:** Runs in `tokio::spawn_blocking` to avoid blocking the UI

#### 7.7.2 Categories (8)

| # | Category ID | Label | Safety | Typical Paths Scanned |
|---|---|---|---|---|
| 1 | `safe_to_clean` | Safe to Clean | Safe | `~/Library/Caches`, `~/Library/Logs`, browser caches |
| 2 | `build_artifacts` | Build Artifacts | Moderate | `node_modules/`, `.next/`, `target/`, `dist/`, `build/` in all projects |
| 3 | `package_managers` | Package Managers | Moderate | `~/.pnpm-store`, `~/.npm/_cacache`, `~/Library/Caches/Homebrew` |
| 4 | `dev_tools` | Developer Tools | Moderate | Xcode simulators, iOS DeviceSupport, Android SDK caches |
| 5 | `app_caches` | Application Caches | Moderate | Chrome/Safari/Firefox caches, JetBrains caches |
| 6 | `docker` | Docker | Aggressive | Docker images, containers, volumes, build cache |
| 7 | `system` | System Temp | Aggressive | `/tmp`, `/var/tmp`, system temp files |
| 8 | `trash` | Trash | Safe | `~/.Trash` |

#### 7.7.3 Scannable Items Tree
Each category contains scannable items in a tree structure:
```
{
  id: "build_artifacts.node_modules.my-project",
  name: "my-project/node_modules",
  path: "/Users/x/Developer/active/my-project/node_modules",
  category: "build_artifacts",
  safety_level: "moderate",
  size_bytes: 524288000,
  formatted_size: "500 MB",
  file_count: 45000,
  description: "npm packages - can be restored with `pnpm install`",
  icon: "📦",
  children: [],
  exists: true,
  warning: null
}
```

#### 7.7.4 Cleanup Flow
1. **Select items:** User checks items from the category list
2. **Preview:** `preview_cleanup(item_ids, safety_level, dry_run: true)` returns:
   - Total bytes to reclaim
   - Number of files/directories
   - List of paths that will be affected
   - Any warnings (e.g., "This will remove Docker images that may take time to re-download")
3. **Confirmation modal:** Shows preview with clear warning text
4. **Execute:** `execute_cleanup(item_ids, safety_level, move_to_trash: true)`
   - Default: moves to macOS Trash (recoverable)
   - Option: permanent delete (irreversible, behind extra confirmation)
5. **Result:** Shows bytes reclaimed, success/failure per item

#### 7.7.5 Trend Chart
- **Source:** `get_disk_trend(days: 30)` — Returns array of `{ scan_date, total_size, category_sizes_json }`
- **Visualization:** Line chart showing total scanned size over time
- **Auto-record:** After each full scan, records entry to `disk_scan_history` table
- **Design:** Minimal spark-line style in the disk manager header, expandable to full chart

#### 7.7.6 Category List Component
- Each category shown as an expandable card:
  - Category icon and name
  - Total size for category
  - Safety level badge (green=Safe, amber=Moderate, red=Aggressive)
  - Expandable children list with individual item sizes
  - Checkbox per item for cleanup selection
- **Sort:** By size descending (largest category first)

---

### 7.8 Port Manager

**Purpose:** Scan network ports, identify what's running, and manage processes occupying ports.

#### 7.8.1 Port Scanning
- **Full scan:** `scan_ports()` — Scans all listening ports on the system
- **Dev-only scan:** `scan_dev_ports()` — Only scans common dev port ranges (3000-3999, 4000-4999, 5000-5999, 8000-8999, 9000-9999)
- **Port check:** `check_port_available(port)` — Check if a specific port is free
- **Cancellation:** `cancel_port_scan()`
- **Mechanism:** Parses output of `lsof -i -P -n` and `netstat`

#### 7.8.2 Port Entry Data

For each discovered port:
```
{
  port: 3000,
  protocol: "tcp",
  state: "listen",
  local_address: "127.0.0.1",
  remote_address: null,
  process: {
    pid: 12345,
    name: "node",
    command: "node /Users/x/project/.next/server.js",
    user: "abraham",
    cpu_percent: 2.5,
    memory_bytes: 104857600,
    memory_percent: 0.6,
    parent_pid: 12340,
    children_pids: [12346, 12347],
    start_time: "2026-02-27T10:30:00Z",
    project_name: "my-project",    // Auto-detected from working_directory
    working_directory: "/Users/x/Developer/active/my-project"
  },
  category: "dev_server",
  is_common_dev_port: true
}
```

#### 7.8.3 Port Categories (6)

| Category | Detection Logic |
|---|---|
| `dev_server` | Port in 3000–9999 range AND process is node/python/ruby/go |
| `database` | Port matches known DB ports: 3306 (MySQL), 5432 (PostgreSQL), 27017 (MongoDB), 6379 (Redis), 5984 (CouchDB) |
| `system` | Port 1–1023 |
| `docker` | Port 2375–2377 or process name contains "docker" |
| `node_process` | Legacy: process name is "node" (now folded into dev_server) |
| `other` | Everything else |

#### 7.8.4 Kill Operations
- **Kill single process:** `kill_process(pid)` → Sends SIGTERM, then SIGKILL after timeout
- **Kill by port:** `kill_port(port, protocol?)` → Finds PID on port, then kills
- **Batch kill:** `batch_kill_processes(pids)` → Kill multiple processes at once
- **Batch kill ports:** `batch_kill_ports(ports)` → Kill all processes on specified ports
- **Result:** `{ success, pid, message }` per operation. Batch returns `{ succeeded, failed, results[] }`

#### 7.8.5 Kill Confirmation
- Single kill: Inline confirmation ("Kill process {name} on port {port}?")
- Batch kill: Modal showing all processes to be killed with "Cancel" and "Kill All" buttons
- System ports (1–1023): Extra warning — "This is a system port. Killing this process may affect system stability."

#### 7.8.6 Process Details Expansion
- Click on a port entry to expand and see:
  - Full command line
  - CPU and memory usage
  - Process start time
  - Working directory
  - Parent process
  - Child processes (process tree via `get_process_tree(pid)`)

#### 7.8.7 Port Watches
- **Add watch:** `add_port_watch(port, watch_type, notify)`
  - `watch_type`: "available" (notify when port becomes free) or "occupied" (notify when port is taken)
  - `notify`: Boolean — send macOS notification
- **Remove watch:** `remove_port_watch(id)`
- **List watches:** `get_port_watches()`
- **Use case:** "Tell me when port 3000 is free so I can start my server"

#### 7.8.8 Filters & Search
- Filter by category (dev_server, database, system, docker, other)
- Filter by state (listen, established, all)
- Search by port number, process name, or project name
- Sort by: port number, process name, memory usage

#### 7.8.9 Port Overview Stats
- Total listening ports count
- Active dev servers count
- Database services running
- Port conflicts detected (multiple processes on same port)

---

### 7.9 Workspaces

**Purpose:** Group related projects for batch operations and organized workflow.

#### 7.9.1 Workspace CRUD
- **Create:** `create_workspace(name)` — Name must be unique
- **Delete:** `delete_workspace(id)` — Cascading delete removes workspace_projects entries
- **Update:** `update_workspace(id, name)` — Rename
- **List:** `list_workspaces()` — Returns workspaces with their project lists

#### 7.9.2 Workspace Members
- **Add project:** `add_project_to_workspace(workspace_id, project_name)`
- **Remove project:** `remove_project_from_workspace(workspace_id, project_name)`
- **Sort order:** Each project has a `sort_order` integer for custom ordering within the workspace
- **Constraint:** A project can belong to multiple workspaces

#### 7.9.3 Batch Operations
- **Start workspace:** `start_workspace(workspace_id)` — Launches all projects in the workspace using auto-detected commands. Returns list of successfully started project names.
- **Stop workspace:** `stop_workspace(workspace_id)` — Stops all running processes for projects in the workspace.

#### 7.9.4 Workspace UI
- **List view:** Cards showing workspace name, project count, and project avatars (type icons)
- **Detail view:** Ordered list of projects with drag-to-reorder
- **Quick actions:** "Start All", "Stop All" buttons
- **Tray integration:** Workspaces appear in tray popup with expand/collapse and quick launch

---

### 7.10 Environment Variable Manager

**Purpose:** View, edit, and manage `.env` files across projects without leaving PM Desktop.

#### 7.10.1 File Discovery
- **API:** `list_project_env_files(project_path)`
- **Scanned patterns:** `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.test`, `.env.staging`, `.env.example`
- **Returns:** Array of `{ name, path, variables[] }`

#### 7.10.2 Variable Display
- **Table format:** Key | Value | Secret?
- **Secret masking:** Variables with keys matching secret patterns are masked by default
- **Reveal:** Click the masked value or eye icon to show it temporarily
- **Secret keywords:** SECRET, KEY, TOKEN, PASSWORD, AUTH, PRIVATE, API_KEY, CREDENTIAL, CERTIFICATE (case-insensitive substring match)

#### 7.10.3 Editing
- **Add variable:** `write_env_variable(path, key, value)` — Appends or updates
- **Edit variable:** Same API, overwrites existing key
- **Copy between files:** `copy_env_variables(source_path, dest_path)` — Copies all variables from one file to another

#### 7.10.4 Security Considerations
- Env files are read from disk on demand, never cached in database
- Secret values are never logged or included in analytics
- Copy-to-clipboard for individual values (with auto-clear after 30 seconds — native macOS enhancement)

---

### 7.11 System Tray & Menu Bar

**Purpose:** Always-accessible quick interface without switching to the full app window.

#### 7.11.1 Menu Bar Item
- **Icon:** Custom monochrome template icon (16×16, 32×32 @2x) following macOS design guidelines
- **Title text (dynamic):**
  - If timer active: `H:MM:SS` (updates every second)
  - If processes running and no timer: `{n} running`
  - If nothing active: No text (icon only)

#### 7.11.2 Tray Popup (NSPopover)
- **Size:** 320×400px (height adjustable based on content via ResizeObserver equivalent)
- **Appearance:** Uses macOS vibrancy material (`.popover` or `.menu`), follows system dark/light mode
- **Activation:** Click menu bar icon OR `Cmd+Shift+P` global shortcut
- **Dismiss:** Click outside, press Escape, or click menu bar icon again

#### 7.11.3 Tray Popup Sections

**Section 1: Active Timer**
- Shows project name + `H:MM:SS` (locally ticking)
- Stop button
- Only visible when timer is active

**Section 2: Start Working**
- Dropdown to select a project (pinned projects first, then recent)
- "Start" button that starts timer + launches dev server
- Only visible when no timer is active

**Section 3: Running Processes**
- List of currently running managed processes
- Each shows: project name, port, status dot
- Stop button per process
- Click project name → opens main window to project detail

**Section 4: Workspaces**
- Expandable workspace sections
- "Start All" / "Stop All" per workspace
- Shows member projects with status indicators

**Section 5: Pinned Projects**
- Quick-access list of pinned projects
- Click → opens main window to project detail

**Section 6: Footer**
- "Show PM Desktop" button → shows main window
- "Quit" button → calls `quit_app()`

#### 7.11.4 Data Fetching
- **Single IPC call:** `get_tray_data()` returns all data needed for the popup:
  ```
  {
    processes: ManagedProcess[],
    timer: ActiveTimer | null,
    pinned_projects: string[],
    workspaces: WorkspaceWithProjects[],
    config: Config
  }
  ```
- **Refresh triggers:**
  - Popup opens → fresh fetch
  - `tray-state-changed` event → re-fetch
  - `process-crashed` event → re-fetch
  - Timer tick: local-only (no IPC, just increment elapsed seconds)

#### 7.11.5 Race Condition Handling
- Tray popup uses debounced toggle to prevent blur→click race:
  - On blur: set `lastBlurTimestamp`
  - On click: if `now - lastBlurTimestamp < 300ms`, ignore click (prevents re-open immediately after close)

---

### 7.12 Command Palette

**Purpose:** Universal search and action interface, accessible from anywhere in the app.

#### 7.12.1 Activation
- **Keyboard:** `Cmd+K` (global within app)
- **Design:** Centered overlay modal with search input and results list (similar to VS Code's command palette)

#### 7.12.2 Search Scope
- **Projects:** Search by name, fuzzy matching
- **Actions:** Search by action name (e.g., "Open Settings", "Start Timer", "Scan Ports")
- **Navigation:** Search by page name (e.g., "Dashboard", "Disk Manager")

#### 7.12.3 Result Types
- **Project result:** Shows project name, type, and available actions (Open, Timer, Launch)
- **Action result:** Shows action name and keyboard shortcut if available
- **Navigation result:** Shows page name and icon

#### 7.12.4 Keyboard Navigation
- Arrow keys to navigate results
- Enter to execute selected result
- Escape to dismiss
- Tab to cycle through action options on a selected project

---

### 7.13 Settings

**Purpose:** Configure PM Desktop behavior and preferences.

#### 7.13.1 Configuration Options

| Setting | Type | Default | Description |
|---|---|---|---|
| `active_directory` | Path | `~/Developer/active` | Directory containing active projects |
| `archive_directory` | Path | `~/Developer/archive` | Directory for archived projects |
| `default_editor` | Editor ID | Auto-detected | Preferred code editor |
| `github_username` | String | Empty | For GitHub repo creation |
| `features.disk_manager` | Boolean | `true` | Enable/disable disk manager |
| `features.port_manager` | Boolean | `true` | Enable/disable port manager |
| `features.time_tracking` | Boolean | `true` | Enable/disable time tracking |
| `theme` | `"dark" \| "light" \| "system"` | `"system"` | Color theme |
| `zoom_level` | Number (50–150) | 100 | UI zoom percentage |

#### 7.13.2 Settings UI
- **Directory pickers:** Native macOS file dialog (`NSOpenPanel`) for choosing directories
- **Editor selector:** Dropdown populated by `get_installed_editors()`, shows editor icon + name
- **Feature toggles:** Switch components for each optional feature
- **Theme selector:** Segmented control (Dark / Light / System)
- **Zoom slider:** Slider with 50%–150% range, stepped by 10%

#### 7.13.3 Storage
- Config stored at `~/.devconfig/pm-config.json`
- UI preferences (sidebar collapsed, zoom, theme) in `UserDefaults` for instant access
- Config changes emit event to refresh dependent views

---

### 7.14 Permissions Management

**Purpose:** Guide users through granting necessary macOS permissions.

#### 7.14.1 Required Permissions

| Permission | Required For | Detection |
|---|---|---|
| Full Disk Access | Disk scanning (system caches, Library folders) | `check_full_disk_access_status()` |
| Files and Folders | Reading project directories | `trigger_files_permission()` |
| Notifications | Process crash alerts, port watch alerts | Standard notification authorization |

#### 7.14.2 Permissions Page
- Shows each permission with status:
  - Green checkmark: Granted
  - Amber warning: Not granted
  - Red X: Denied
- "Grant" button for each:
  - Full Disk Access → opens System Settings Privacy pane via `open_full_disk_access_settings()`
  - Files and Folders → triggers a file dialog to prompt the OS permission
  - Notifications → standard notification request
- Explanation text for each permission explaining why it's needed

#### 7.14.3 First-Run Onboarding
- On first launch, if critical permissions are missing, show a onboarding sheet explaining:
  1. What PM Desktop does
  2. Why it needs each permission
  3. Step-by-step guide with screenshots to grant permissions
- Skippable — app works with reduced functionality without Full Disk Access

---

## 8. Data Architecture

### 8.1 Database (SQLite)

**Location:** `~/.devconfig/pm-desktop.db`
**Mode:** WAL (Write-Ahead Logging) for concurrent read performance
**Foreign keys:** Enabled
**Schema version:** 4 (with migration support)

#### Tables

```sql
-- Time tracking
time_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name    TEXT NOT NULL,
    started_at      TEXT NOT NULL,          -- RFC3339
    ended_at        TEXT,                   -- RFC3339, NULL = active timer
    duration_seconds INTEGER
)

-- Project pinning metadata
project_meta (
    project_name    TEXT PRIMARY KEY,
    is_pinned       INTEGER DEFAULT 0,
    pinned_at       TEXT
)

-- Workspace definitions
workspaces (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    created_at      TEXT NOT NULL
)

-- Many-to-many: workspace ↔ project
workspace_projects (
    workspace_id    INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_name    TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0,
    PRIMARY KEY (workspace_id, project_name)
)

-- Historical disk scan data
disk_scan_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_date           TEXT NOT NULL,
    total_size          INTEGER NOT NULL,   -- bytes
    category_sizes_json TEXT                -- JSON blob
)
```

#### Indexes (recommended for native version)
```sql
CREATE INDEX idx_time_entries_project ON time_entries(project_name);
CREATE INDEX idx_time_entries_started ON time_entries(started_at);
CREATE INDEX idx_workspace_projects_ws ON workspace_projects(workspace_id);
CREATE INDEX idx_disk_scan_date ON disk_scan_history(scan_date);
```

### 8.2 Configuration File

**Location:** `~/.devconfig/pm-config.json`
**Format:** JSON
**Managed by:** Rust core library (read/write via `load_config` / `save_config`)

### 8.3 Runtime State (Not Persisted)

| Data | Storage | Lifecycle |
|---|---|---|
| Managed processes | In-memory HashMap<PID, ProcessEntry> | App lifecycle only |
| Process logs | In-memory ring buffer (1000 lines/process) | App lifecycle only |
| Git status cache | In-memory with 30s TTL | App lifecycle only |
| Scan progress | Event-driven, transient | Per-scan operation |
| Port watches | In-memory | App lifecycle only |

### 8.4 File System Locations

| File/Directory | Purpose |
|---|---|
| `~/.devconfig/pm-desktop.db` | SQLite database |
| `~/.devconfig/pm-config.json` | App configuration |
| `~/.devconfig/editor-icons/` | Cached editor icon PNGs (32×32) |
| `~/Library/Application Support/com.devconfig.pm-desktop/` | macOS standard app data |
| `~/Library/Caches/com.devconfig.pm-desktop/` | macOS standard cache |

---

## 9. Navigation & Information Architecture

### 9.1 Main Window Navigation

```
┌────────────────────────────────────────────────────────┐
│  ◉ ◉ ◉   PM Desktop                    [user] [gear]  │  ← Title Bar (overlay style, draggable)
├────────┬───────────────────────────────────────────────┤
│        │                                               │
│  TODAY │   [Page Content]                              │
│        │                                               │
│  PROJ  │                                               │
│        │                                               │
│  DISK  │                                               │
│        │                                               │
│  PORTS │                                               │
│        │                                               │
│  WORK  │                                               │
│        │                                               │
│  ────  │                                               │
│        │                                               │
│  NEW+  │                                               │
│        │                                               │
│  SETS  │                                               │
│        │                                               │
├────────┴───────────────────────────────────────────────┤
│  [Timer: my-project 1:23:45]              [Stop]       │  ← Status Bar (only when timer active)
└────────────────────────────────────────────────────────┘
```

### 9.2 Navigation Items

| Position | Label | Icon | Route | Shortcut |
|---|---|---|---|---|
| 1 | Today | `Calendar` | `today` | `Cmd+1` |
| 2 | Projects | `FolderGit2` | `projects` | `Cmd+2` |
| 3 | Disk | `HardDrive` | `disk-manager` | `Cmd+3` |
| 4 | Ports | `Network` | `port-manager` | `Cmd+4` |
| 5 | Workspaces | `LayoutGrid` | `workspaces` | `Cmd+5` |
| --- | --- | --- | --- | --- |
| 6 | New Project | `Plus` | `create-project` | `Cmd+N` |
| 7 | Settings | `Settings` | `settings` | `Cmd+,` |

### 9.3 Sidebar Behavior
- **Collapsible:** Toggle with `Cmd+B` or click collapse button
- **Collapsed state:** Shows only icons, no labels
- **Active indicator:** Highlight on current page's nav item
- **Feature flags:** Disk and Ports nav items hidden if their features are disabled in settings

### 9.4 Window Configuration
- **Default size:** 1200×800
- **Minimum size:** 900×600
- **Title bar:** Overlay style (content extends behind traffic lights)
- **Hidden title:** Title not shown in title bar (app name visible in sidebar header)

---

## 10. Design System

### 10.1 Native macOS Design Principles
- Use SF Symbols for all icons (replace Lucide React icons)
- Use system fonts (SF Pro, SF Mono for code)
- Use macOS vibrancy materials for sidebar and popover backgrounds
- Follow Human Interface Guidelines for spacing, sizing, and interaction patterns
- Support Dynamic Type for accessibility
- Respect system accent color
- Use native controls where appropriate (NSSwitch, NSSegmentedControl, NSPopUpButton)

### 10.2 Color Palette

**Automatic theme support:** Follow `NSApp.effectiveAppearance` for dark/light mode. Use semantic colors from `NSColor` / SwiftUI `Color`:

| Semantic Use | SwiftUI Color | Dark Appearance | Light Appearance |
|---|---|---|---|
| Primary background | `.background` | System dark bg | System light bg |
| Secondary background | `.secondarySystemBackground` | Elevated surface | Grouped surface |
| Primary text | `.primary` | White | Black |
| Secondary text | `.secondary` | Gray | Gray |
| Accent | `.accentColor` | System accent | System accent |
| Destructive | `.red` | System red | System red |
| Success | `.green` | System green | System green |
| Warning | `.orange` | System orange | System orange |
| Separator | `.separator` | System separator | System separator |

**Custom brand colors (sparingly, for identity):**
- Timer active accent: `#3B82F6` (blue-500)
- Git dirty indicator: `#F59E0B` (amber-500)
- Git clean indicator: `#10B981` (green-500)

### 10.3 Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| Page title | SF Pro | 28pt | Bold |
| Section header | SF Pro | 20pt | Semibold |
| Card title | SF Pro | 16pt | Medium |
| Body text | SF Pro | 14pt | Regular |
| Caption / secondary | SF Pro | 12pt | Regular |
| Code / paths / branches | SF Mono | 13pt | Regular |
| Timer display | SF Mono | 24pt | Medium |
| Tray timer | SF Mono | 12pt | Medium |

### 10.4 Spacing Scale

Follow 4px base grid:
| Token | Value |
|---|---|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 12px |
| `lg` | 16px |
| `xl` | 24px |
| `2xl` | 32px |
| `3xl` | 48px |

### 10.5 Corner Radii
- Small controls (badges, chips): 4px
- Cards and panels: 8px
- Modals and popovers: 12px
- Follow system radius for native controls

### 10.6 Elevation & Materials
- **Sidebar:** `NSVisualEffectView` with `.sidebar` material
- **Tray popup:** `NSVisualEffectView` with `.popover` material
- **Cards:** Subtle border (1px separator color) on flat background, no drop shadow
- **Modals:** `.sheet` presentation style with dimmed background
- **Hover states:** Background lightens/darkens by one step

### 10.7 Animation
- Use SwiftUI's built-in spring animations for transitions
- Page transitions: `.move(edge: .trailing)` with `.easeInOut(duration: 0.2)`
- List item insertion: `.slide` combined with `.opacity`
- Timer tick: No animation (instant update for precision feel)
- Progress indicators: Indeterminate progress bar with system animation

### 10.8 Iconography
Map current Lucide React icons to SF Symbols:

| Current (Lucide) | SF Symbol | Usage |
|---|---|---|
| `Calendar` | `calendar` | Today nav |
| `FolderGit2` | `folder.badge.gearshape` | Projects nav |
| `HardDrive` | `internaldrive` | Disk manager nav |
| `Network` | `network` | Port manager nav |
| `LayoutGrid` | `square.grid.2x2` | Workspaces nav |
| `Plus` | `plus` | New project |
| `Settings` | `gearshape` | Settings |
| `Play` | `play.fill` | Start/launch |
| `Square` | `stop.fill` | Stop |
| `Timer` | `timer` | Time tracking |
| `GitBranch` | `arrow.triangle.branch` | Git branch |
| `Trash` | `trash` | Delete |
| `Star` | `star.fill` | Pinned |
| `Search` | `magnifyingglass` | Search |
| `Terminal` | `terminal` | Open in terminal |
| `ExternalLink` | `arrow.up.forward.square` | Open external |
| `Copy` | `doc.on.doc` | Copy |
| `Eye` / `EyeOff` | `eye` / `eye.slash` | Show/hide secrets |
| `AlertTriangle` | `exclamationmark.triangle` | Warning |
| `CheckCircle` | `checkmark.circle.fill` | Success |
| `XCircle` | `xmark.circle.fill` | Error |
| `ChevronRight` | `chevron.right` | Expand |
| `ChevronDown` | `chevron.down` | Collapse |

---

## 11. Keyboard Shortcuts

### 11.1 Global (App-Wide)

| Shortcut | Action |
|---|---|
| `Cmd+K` | Open command palette |
| `Cmd+,` | Open settings |
| `Cmd+1` | Navigate to Today |
| `Cmd+2` | Navigate to Projects |
| `Cmd+3` | Navigate to Disk Manager |
| `Cmd+4` | Navigate to Port Manager |
| `Cmd+5` | Navigate to Workspaces |
| `Cmd+N` | New project |
| `Cmd+B` | Toggle sidebar |
| `Cmd+Q` | Quit app |
| `Cmd+W` | Close/hide window (app stays in tray) |
| `Cmd+M` | Minimize window |
| `Cmd+Shift+P` | Toggle tray popup (global, works when app is not focused) |
| `Cmd++` / `Cmd+-` | Zoom in / out |
| `Cmd+0` | Reset zoom to 100% |

### 11.2 Project List

| Shortcut | Action |
|---|---|
| `Cmd+F` | Focus search field |
| `Enter` | Open selected project detail |
| `Cmd+O` | Open selected project in editor |
| `Cmd+T` | Start timer for selected project |
| Arrow keys | Navigate project grid |

### 11.3 Project Detail

| Shortcut | Action |
|---|---|
| `Cmd+O` | Open in editor |
| `Cmd+Shift+T` | Open in terminal |
| `Cmd+Shift+F` | Open in Finder |
| `Cmd+T` | Start/stop timer |
| `Cmd+R` | Launch dev server |
| `Escape` | Back to project list |

### 11.4 Disk / Port Manager

| Shortcut | Action |
|---|---|
| `Cmd+R` | Refresh / re-scan |
| `Cmd+A` | Select all items |
| `Escape` | Deselect all |
| `Delete` | Execute cleanup (with confirmation) / Kill selected ports |

---

## 12. Performance Requirements

| Metric | Target | Measurement |
|---|---|---|
| App launch to interactive | < 300ms | Time from dock click to first render |
| Memory at idle | < 20MB | No projects loaded, tray running |
| Memory under load | < 80MB | 50 projects scanned, 5 processes managed |
| Project list render (50 projects) | < 100ms | From data load to full grid render |
| Git status per project | < 50ms | Single project via git2 |
| Full project scan (50 projects) | < 2s | Including git status for all |
| Disk scan (full system) | < 30s | All 8 categories |
| Port scan (full) | < 3s | All listening ports |
| Port scan (dev only) | < 500ms | Dev port ranges only |
| Tray popup open | < 50ms | From click to fully rendered |
| Timer tick overhead | < 0.1% CPU | Menu bar timer update every second |
| Database query (time entries) | < 10ms | Indexed query |
| SQLite write | < 5ms | Single row insert |

---

## 13. Security & Privacy

### 13.1 Data Privacy
- All data stored locally. Zero network telemetry or analytics.
- No cloud sync. No accounts.
- Environment variable values with secret keywords are masked in UI by default.
- Clipboard operations for secrets auto-clear after 30 seconds (macOS native clipboard management).

### 13.2 File System Access
- App requires configurable project directories (user-selected paths only)
- Full Disk Access required only for disk manager's system cache scanning
- App functions with reduced feature set without Full Disk Access

### 13.3 Process Management Security
- Kill operations require user confirmation (no silent kills)
- System processes (PID < 100 or owned by root) show extra warnings
- App only kills processes it launched or user explicitly targets

### 13.4 App Sandbox
- Consider distributing as non-sandboxed app (signed + notarized) for:
  - Access to arbitrary project directories
  - Process management capabilities
  - Full Disk Access for disk scanning
- Alternative: Sandbox with temporary exceptions (less ideal for this use case)

### 13.5 Code Signing & Notarization
- Apple Developer ID signing for distribution
- Notarization required for Gatekeeper approval
- Hardened runtime enabled

---

## 14. macOS Integration Points

### 14.1 Native Integrations (Current, Ported from Tauri)

| Integration | Mechanism | Purpose |
|---|---|---|
| Menu bar icon | `NSStatusItem` | Always-visible tray |
| System notifications | `UNUserNotificationCenter` | Crash alerts, port watch |
| Open in Finder | `NSWorkspace.open(url:)` | Reveal project in Finder |
| Open in editor | `NSWorkspace.open(url:, withApplication:)` | Launch editor at project path |
| Open in terminal | `open -a Terminal {path}` | Open terminal at path |
| Clipboard | `NSPasteboard` | Copy paths, env values |
| File dialogs | `NSOpenPanel` | Directory selection in settings |
| Global shortcut | `MASShortcut` or Shortcuts framework | `Cmd+Shift+P` for tray |
| Editor icon extraction | `NSWorkspace.icon(forFile:)` | Get app icons for editor list |
| System info | `ProcessInfo`, `sysctl` | CPU, memory, disk stats |

### 14.2 New Native Integrations (macOS-Exclusive Enhancements)

| Integration | Mechanism | Purpose |
|---|---|---|
| **Spotlight integration** | Core Spotlight (`CSSearchableItem`) | Index projects so they appear in Spotlight search |
| **Shortcuts app** | `AppIntents` framework | "Start timer for {project}", "Show project status" as Shortcuts actions |
| **Widgets** | WidgetKit | Menu bar widget showing active timer, today's hours, running processes |
| **Notification actions** | `UNNotificationAction` | "Restart" button on crash notifications |
| **Dock badge** | `NSDockTile.badgeLabel` | Show count of attention items |
| **Dock menu** | Right-click dock icon menu | Quick access to recent projects, timer controls |
| **Touch Bar** (Intel Macs) | `NSTouchBar` | Timer display and project quick-launch |
| **Handoff** | `NSUserActivity` | Continue project context between devices (if future sync) |
| **Quick Look** | Quick Look extension | Preview project README from Finder |
| **Services menu** | `NSServicesProvider` | "Open in PM Desktop" for folder selection in Finder |
| **Login Items** | `SMAppService` | Launch at login option in settings |
| **Accessibility** | VoiceOver support | Full VoiceOver labels on all interactive elements |

### 14.3 App Intents (Shortcuts Integration)

Define these intents for the Shortcuts app:

| Intent | Parameters | Returns |
|---|---|---|
| `StartTimerIntent` | `projectName: String` | Confirmation |
| `StopTimerIntent` | None | Time entry summary |
| `GetActiveTimerIntent` | None | Project name + elapsed time |
| `ListProjectsIntent` | `type?: String` | Project names |
| `OpenProjectIntent` | `projectName: String` | Opens in default editor |
| `GetTodaySummaryIntent` | None | Today's hours + attention count |
| `LaunchProjectIntent` | `projectName: String` | Confirmation |
| `StopAllProcessesIntent` | None | Count stopped |

### 14.4 Widgets (WidgetKit)

**Small Widget (Systemwide):**
- Active timer project name + elapsed time
- OR "No timer running" + today's total hours

**Medium Widget:**
- Active timer (if running)
- Today's total hours
- Top 3 attention items

**Accessory Widgets (Lock Screen / Menu Bar):**
- Circular: Timer display (H:MM)
- Rectangular: "Today: 4h 23m | 3 projects"

---

## 15. Supported Editors & Tools

### 15.1 Editor Detection

The app detects 24 editors by checking for their macOS app bundles:

#### GUI Editors
| Editor | Bundle ID Pattern | Icon Extraction |
|---|---|---|
| VS Code | `com.microsoft.VSCode` | App bundle icon |
| Cursor | `com.todesktop.cursor` | App bundle icon |
| Windsurf | `com.codeium.windsurf` | App bundle icon |
| Zed | `dev.zed.Zed` | App bundle icon |
| Sublime Text | `com.sublimetext.*` | App bundle icon |
| Nova | `com.panic.Nova` | App bundle icon |
| BBEdit | `com.barebones.bbedit` | App bundle icon |
| TextMate | `com.macromates.TextMate` | App bundle icon |
| WebStorm | `com.jetbrains.WebStorm` | App bundle icon |
| IntelliJ IDEA | `com.jetbrains.intellij` | App bundle icon |
| PyCharm | `com.jetbrains.pycharm` | App bundle icon |
| GoLand | `com.jetbrains.goland` | App bundle icon |
| RubyMine | `com.jetbrains.rubymine` | App bundle icon |
| PhpStorm | `com.jetbrains.PhpStorm` | App bundle icon |
| CLion | `com.jetbrains.CLion` | App bundle icon |
| Rider | `com.jetbrains.rider` | App bundle icon |
| Fleet | `com.jetbrains.fleet` | App bundle icon |
| Android Studio | `com.google.android.studio` | App bundle icon |
| Xcode | `com.apple.dt.Xcode` | App bundle icon |
| Lapce | `dev.lapce.Lapce` | App bundle icon |

#### Terminal Editors
| Editor | Detection | Launch |
|---|---|---|
| Neovim | `which nvim` | `open -a Terminal nvim {path}` |
| Vim | `which vim` | `open -a Terminal vim {path}` |
| Emacs | `which emacs` | `open -a Terminal emacs {path}` |
| Nano | `which nano` | `open -a Terminal nano {path}` |
| Helix | `which hx` | `open -a Terminal hx {path}` |

### 15.2 Icon Caching
- Icons extracted from app bundles using `CFBundleIconFile`
- Converted to 32×32 PNG using `sips`
- Cached at `~/.devconfig/editor-icons/{editor_id}.png`
- Cache invalidated when app version changes

### 15.3 Tool Detection for Project Creation

| Tool | Check Command | Required For |
|---|---|---|
| `git` | `which git` | All project creation, clone |
| `npm` | `which npm` | Node.js templates |
| `npx` | `which npx` | Template scaffolding |
| `pnpm` | `which pnpm` | pnpm projects |
| `yarn` | `which yarn` | yarn projects |
| `bun` | `which bun` | bun projects |
| `cargo` | `which cargo` | Rust/Tauri templates |
| `go` | `which go` | Go templates |
| `python` | `which python3` | Python templates |
| `gh` | `which gh` | GitHub repo creation |
| `docker` | `which docker` + daemon check | Docker operations |

---

## 16. Error Handling & Edge Cases

### 16.1 Project Directory Issues
| Scenario | Behavior |
|---|---|
| Active directory doesn't exist | Show settings prompt to configure |
| Active directory is empty | Show empty state: "No projects found. Create one or update your directory." |
| Project deleted externally | Remove from list on next scan, show notification |
| Permission denied on directory | Show permission prompt, link to Permissions page |

### 16.2 Git Issues
| Scenario | Behavior |
|---|---|
| Project not a git repo | Show "No git" status, hide git-related UI |
| Corrupt `.git` directory | Show error icon, "Git status unavailable" |
| No remote configured | Show "No remote" in git panel, hide push/pull indicators |
| Git not installed | Warn in settings, disable git-dependent features |

### 16.3 Process Management Issues
| Scenario | Behavior |
|---|---|
| Port already in use | Show port conflict modal: "{port} is used by {process}. Kill it and retry?" |
| Process won't stop (SIGTERM ignored) | Escalate to SIGKILL after 5 seconds |
| App crashes while processes are running | Processes continue (orphaned). Next launch: detect orphaned processes and offer to adopt or kill them. |
| Permission denied on kill | Show error: "Cannot kill process {pid}. It may require elevated privileges." |

### 16.4 Disk Manager Issues
| Scenario | Behavior |
|---|---|
| Full Disk Access not granted | Show warning banner, disable system/app cache categories |
| Disk full during scan | Show error, partial results |
| File in use during cleanup | Skip file, report in results: "{path} could not be deleted (in use)" |
| Scan takes too long | Show cancel button, auto-timeout at 5 minutes |

### 16.5 Network/Port Issues
| Scenario | Behavior |
|---|---|
| No listening ports found | Show empty state: "No active ports detected" |
| `lsof` permission denied | Show reduced results, link to permissions |
| Port watch triggers while app is closed | Queue notification, show on next launch |

---

## 17. Analytics & Telemetry

**PM Desktop collects zero analytics or telemetry.**

- No usage tracking
- No crash reporting to external services
- No network requests (except GitHub API for project creation if enabled, and update checker)
- All data stays on the user's machine

The auto-update check is the only network request, and it can be disabled.

---

## 18. Release & Distribution

### 18.1 Distribution Channels
- **Direct download:** DMG from GitHub Releases
- **Homebrew Cask:** `brew install --cask pm-desktop` (planned)
- **Mac App Store:** Not planned (sandbox restrictions incompatible with core features)

### 18.2 Build Artifacts
- `PM Desktop_{version}_aarch64.dmg` — Apple Silicon
- `PM Desktop_{version}_x64.dmg` — Intel
- Universal binary considered but deprioritized (saves build complexity)

### 18.3 Auto-Update
- Sparkle framework (industry standard for non-App Store macOS apps)
- Checks GitHub Releases API for new versions
- Download + install in background, prompt user to restart
- Can be disabled in settings

### 18.4 System Requirements
- **Minimum:** macOS 14.0 (Sonoma)
- **Recommended:** macOS 15.0 (Sequoia) for latest widget and Shortcuts features
- **Architecture:** Apple Silicon (primary), Intel x86_64 (supported)
- **Disk space:** ~30MB app, ~50MB data (varies with database size)
- **Memory:** 20–80MB typical usage

---

## 19. Future Considerations

These are not in scope for v2.0 but inform architectural decisions:

| Feature | Notes |
|---|---|
| **GitHub integration** | Show PRs, issues, checks per project. Requires OAuth flow. |
| **Cloud sync** | Sync time entries and config across machines via iCloud or custom backend. |
| **Plugin system** | Allow third-party extensions (custom project types, commands, integrations). |
| **Team features** | Shared workspaces, team time tracking. |
| **AI assistant** | Natural language commands: "What did I work on this week?" |
| **iOS companion** | Time tracking and project status on iPhone via iCloud sync. |
| **Windows/Linux** | Rust core is portable; only UI layer is macOS-specific. |
| **Custom themes** | User-defined color schemes beyond dark/light. |
| **Project notes** | Markdown notes attached to each project. |
| **Git operations** | Commit, push, pull, branch directly from PM Desktop. |
| **Dependency dashboard** | Show outdated packages across all projects (existing `check_outdated_packages`). |
| **Xcode build integration** | Monitor Xcode build times, errors. |
| **Time reports** | Exportable CSV/PDF time reports for billing. |

---

## 20. Glossary

| Term | Definition |
|---|---|
| **Active project** | A project in the configured active directory |
| **Archived project** | A project moved to the archive directory (hidden from main list) |
| **Attention item** | A project condition that may need the developer's attention (uncommitted changes, unpushed commits, stale) |
| **Managed process** | A dev server or process launched and tracked by PM Desktop |
| **Pinned project** | A project marked as favorite for quick access |
| **Safety level** | Classification of disk cleanup items: Safe (caches/logs), Moderate (build artifacts, can be rebuilt), Aggressive (Docker images, system files) |
| **Scannable item** | A file or directory identified by the disk scanner with size and safety metadata |
| **Time entry** | A recorded period of work on a project, with start/end timestamps |
| **Workspace** | A named group of projects for batch operations |
| **Tray popup** | The popover window that appears when clicking the menu bar icon |
| **Template** | A project scaffolding recipe that creates a new project from a framework boilerplate |
| **Port watch** | A subscription to be notified when a port changes availability state |

---

*This PRD is the single source of truth for PM Desktop's native macOS rebuild. All feature implementations should reference this document. For questions or clarifications, open a discussion on the project repository.*
