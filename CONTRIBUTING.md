# Contributing to PM Desktop

First off, thank you for considering contributing to PM Desktop! It's people like you that make PM Desktop such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Provide specific examples to demonstrate the steps**.
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include screenshots or animated GIFs** if possible.
- **Include your environment details**: macOS version, PM Desktop version, etc.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps** or point out the part of PM Desktop where the suggestion is related to.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
- **Explain why this enhancement would be useful** to most PM Desktop users.

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Follow the coding style used throughout the project
- Include thoughtfully-worded, well-structured tests if applicable
- Document new code
- End all files with a newline

## Development Setup

### Prerequisites

- Node.js 18+
- Rust 1.70+
- pnpm 8+

### Getting Started

1. Fork the repo and clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/pm-desktop.git
cd pm-desktop
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a branch for your changes:

```bash
git checkout -b feature/my-feature
```

4. Start the development server:

```bash
pnpm tauri dev
```

### Project Structure

```
pm-desktop/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand stores
│   ├── lib/                # Utilities
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   ├── services/       # Business logic
│   │   └── models/         # Data models
│   └── Cargo.toml
└── package.json
```

### Coding Guidelines

#### TypeScript/React

- Use functional components with hooks
- Use TypeScript strict mode
- Prefer named exports over default exports
- Use meaningful variable and function names
- Keep components small and focused

#### Rust

- Follow Rust naming conventions
- Use `Result` for error handling
- Document public functions
- Keep functions focused and small
- Use `tokio::spawn_blocking` for blocking operations

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### Testing

Before submitting a pull request:

1. Run the TypeScript type checker:
```bash
pnpm tsc --noEmit
```

2. Run the Rust linter:
```bash
cargo clippy --manifest-path src-tauri/Cargo.toml
```

3. Test your changes manually in the app

## Release Process

Releases are handled by maintainers. The process is:

1. Update version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
2. Update `CHANGELOG.md`
3. Create a git tag: `git tag v0.x.x`
4. Push the tag: `git push origin v0.x.x`
5. GitHub Actions will build and publish the release

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing!
