# PM Desktop

A native macOS desktop application for managing development projects. Built with Tauri v2, React, and TypeScript.

## Features

**Phase 1 (MVP) - Implemented:**
- Dashboard with system metrics (CPU, memory, disk, Docker status)
- Project listing with git status indicators
- Project detail view with file detection
- Settings management (synced with `~/.devconfig/pm.conf`)
- Open projects in editor, terminal, or Finder
- Time tracking with start/stop timer
- Dark theme with native macOS title bar

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Rust (installed via rustup)
- Xcode Command Line Tools

### Setup

```bash
cd ~/Developer/.devconfig/pm-desktop
pnpm install
```

### Run in Development

```bash
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## Project Structure

```
pm-desktop/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React Query hooks
│   ├── stores/             # Zustand stores
│   └── lib/                # Tauri API wrappers
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri commands
│       ├── services/       # Business logic
│       └── models/         # Data structures
└── package.json
```

## Configuration

The app shares configuration with the CLI at `~/.devconfig/pm.conf`:

- `PM_ACTIVE_DIR` - Directory for active projects
- `PM_ARCHIVE_DIR` - Directory for archived projects
- `PM_DEFAULT_EDITOR` - Default code editor (cursor, code, etc.)
- `PM_DEFAULT_TEMPLATE` - Default project template
- `PM_AUTO_GIT_INIT` - Auto-initialize git repositories
- `PM_AUTO_INSTALL_DEPS` - Auto-install dependencies after project creation
- `PM_TIME_TRACKING` - Enable time tracking

## Roadmap

- [ ] Phase 2: Project CRUD (create, archive, restore, delete)
- [ ] Phase 3: Time tracking statistics & charts
- [ ] Phase 4: Docker container management
- [ ] Phase 5: Database management
- [ ] Phase 6: Deployment integration
- [ ] Phase 7: Environment variable management
- [ ] Phase 8: Polish & auto-updates
