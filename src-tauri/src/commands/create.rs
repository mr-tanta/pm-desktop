use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::commands::config::load_config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub command: Option<String>,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectOptions {
    pub name: String,
    pub template: String,
    pub init_git: bool,
    pub open_in_editor: bool,
    pub create_github_repo: bool,
    pub github_visibility: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectResult {
    pub success: bool,
    pub path: String,
    pub message: String,
    pub github_url: Option<String>,
}

pub fn get_templates() -> Vec<ProjectTemplate> {
    vec![
        // JavaScript/TypeScript
        ProjectTemplate {
            id: "nextjs".to_string(),
            name: "Next.js".to_string(),
            description: "React framework with App Router, TypeScript, Tailwind".to_string(),
            category: "JavaScript/TypeScript".to_string(),
            command: Some("pnpm create next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias '@/*' --use-pnpm".to_string()),
            icon: "nextjs".to_string(),
        },
        ProjectTemplate {
            id: "vite-react".to_string(),
            name: "Vite + React".to_string(),
            description: "Fast React setup with TypeScript and Vite".to_string(),
            category: "JavaScript/TypeScript".to_string(),
            command: Some("pnpm create vite@latest . --template react-ts && pnpm install".to_string()),
            icon: "react".to_string(),
        },
        ProjectTemplate {
            id: "nestjs".to_string(),
            name: "NestJS".to_string(),
            description: "Progressive Node.js backend framework".to_string(),
            category: "JavaScript/TypeScript".to_string(),
            command: Some("pnpm dlx @nestjs/cli@latest new . --package-manager pnpm --skip-git".to_string()),
            icon: "nestjs".to_string(),
        },
        ProjectTemplate {
            id: "expo".to_string(),
            name: "Expo".to_string(),
            description: "React Native with Expo SDK".to_string(),
            category: "JavaScript/TypeScript".to_string(),
            command: Some("pnpm create expo-app@latest . --template blank-typescript --no-install && pnpm install".to_string()),
            icon: "expo".to_string(),
        },
        ProjectTemplate {
            id: "t3".to_string(),
            name: "T3 Stack".to_string(),
            description: "Next.js + tRPC + Prisma + Tailwind".to_string(),
            category: "JavaScript/TypeScript".to_string(),
            command: Some("pnpm dlx create-t3-app@latest . --noGit --CI --trpc --prisma --tailwind --nextAuth --envVariables".to_string()),
            icon: "typescript".to_string(),
        },
        ProjectTemplate {
            id: "astro".to_string(),
            name: "Astro".to_string(),
            description: "Static site generator with islands".to_string(),
            category: "JavaScript/TypeScript".to_string(),
            command: Some("pnpm create astro@latest . --template minimal --typescript strict --no-git --skip-houston --install".to_string()),
            icon: "astro".to_string(),
        },
        ProjectTemplate {
            id: "sveltekit".to_string(),
            name: "SvelteKit".to_string(),
            description: "Svelte app framework".to_string(),
            category: "JavaScript/TypeScript".to_string(),
            command: Some("pnpm create svelte@latest . --template skeleton --types typescript --no-git && pnpm install".to_string()),
            icon: "svelte".to_string(),
        },
        // Other Languages
        ProjectTemplate {
            id: "tauri".to_string(),
            name: "Tauri".to_string(),
            description: "Rust + Web desktop app".to_string(),
            category: "Other".to_string(),
            command: Some("pnpm create tauri-app@latest .".to_string()),
            icon: "tauri".to_string(),
        },
        ProjectTemplate {
            id: "fastapi".to_string(),
            name: "Python FastAPI".to_string(),
            description: "Modern Python web framework".to_string(),
            category: "Other".to_string(),
            command: None,
            icon: "python".to_string(),
        },
        ProjectTemplate {
            id: "go-gin".to_string(),
            name: "Go Gin".to_string(),
            description: "Go HTTP web framework".to_string(),
            category: "Other".to_string(),
            command: None,
            icon: "go".to_string(),
        },
        ProjectTemplate {
            id: "empty".to_string(),
            name: "Empty Project".to_string(),
            description: "Blank project with just README and .gitignore".to_string(),
            category: "Other".to_string(),
            command: None,
            icon: "folder".to_string(),
        },
    ]
}

#[tauri::command]
pub fn list_templates() -> Vec<ProjectTemplate> {
    get_templates()
}

#[tauri::command]
pub async fn create_project(options: CreateProjectOptions) -> Result<CreateProjectResult, String> {
    let config = load_config()?;

    // Sanitize project name
    let name = options
        .name
        .trim()
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    if name.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }

    let project_path = PathBuf::from(&config.active_dir).join(&name);

    if project_path.exists() {
        return Err(format!("Project '{}' already exists", name));
    }

    // Create directory
    fs::create_dir_all(&project_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    let templates = get_templates();
    let template = templates
        .iter()
        .find(|t| t.id == options.template)
        .ok_or_else(|| format!("Template '{}' not found", options.template))?;

    // Execute template command or create files
    if let Some(cmd) = &template.command {
        let output = Command::new("sh")
            .arg("-c")
            .arg(cmd)
            .current_dir(&project_path)
            .output()
            .map_err(|e| format!("Failed to execute template command: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Clean up on failure
            let _ = fs::remove_dir_all(&project_path);
            return Err(format!("Template setup failed: {}", stderr));
        }
    } else {
        // Handle templates without commands
        match options.template.as_str() {
            "fastapi" => create_fastapi_project(&project_path, &name)?,
            "go-gin" => create_go_project(&project_path, &name)?,
            _ => create_empty_project(&project_path, &name)?,
        }
    }

    // Initialize git if requested
    if options.init_git {
        init_git_repo(&project_path)?;
    }

    // Create standard files if they don't exist
    ensure_standard_files(&project_path, &name)?;

    // Create GitHub repo if requested
    let github_url = if options.create_github_repo {
        create_github_repo(&project_path, &name, options.github_visibility.as_deref())?
    } else {
        None
    };

    // Open in editor if requested
    if options.open_in_editor {
        let editor = &config.default_editor;
        let _ = Command::new(editor)
            .arg(project_path.to_str().unwrap_or("."))
            .spawn();
    }

    Ok(CreateProjectResult {
        success: true,
        path: project_path.to_string_lossy().to_string(),
        message: format!("Project '{}' created successfully", name),
        github_url,
    })
}

fn create_fastapi_project(path: &Path, _name: &str) -> Result<(), String> {
    let requirements = r#"fastapi
uvicorn[standard]
pydantic
python-dotenv
"#;

    let main_py = r#"from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
"#;

    fs::write(path.join("requirements.txt"), requirements)
        .map_err(|e| format!("Failed to create requirements.txt: {}", e))?;
    fs::write(path.join("main.py"), main_py)
        .map_err(|e| format!("Failed to create main.py: {}", e))?;

    Ok(())
}

fn create_go_project(path: &Path, name: &str) -> Result<(), String> {
    let main_go = r#"package main

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    r.GET("/", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "message": "Hello World",
        })
    })

    r.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "status": "healthy",
        })
    })

    r.Run(":8080")
}
"#;

    fs::write(path.join("main.go"), main_go)
        .map_err(|e| format!("Failed to create main.go: {}", e))?;

    // Initialize go module
    let output = Command::new("go")
        .args(["mod", "init", name])
        .current_dir(path)
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            // Get gin dependency
            let _ = Command::new("go")
                .args(["get", "github.com/gin-gonic/gin"])
                .current_dir(path)
                .output();
        }
    }

    Ok(())
}

fn create_empty_project(path: &Path, name: &str) -> Result<(), String> {
    let readme = format!("# {}\n\nA new project.\n", name);
    fs::write(path.join("README.md"), readme)
        .map_err(|e| format!("Failed to create README.md: {}", e))?;

    Ok(())
}

fn init_git_repo(path: &Path) -> Result<(), String> {
    // Check if already a git repo
    if path.join(".git").exists() {
        return Ok(());
    }

    let output = Command::new("git")
        .args(["init"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to init git: {}", e))?;

    if !output.status.success() {
        return Err("Failed to initialize git repository".to_string());
    }

    // Create initial commit
    let _ = Command::new("git")
        .args(["add", "."])
        .current_dir(path)
        .output();

    let _ = Command::new("git")
        .args(["commit", "-m", "Initial commit"])
        .current_dir(path)
        .output();

    Ok(())
}

fn ensure_standard_files(path: &Path, name: &str) -> Result<(), String> {
    // .gitignore
    if !path.join(".gitignore").exists() {
        let gitignore = r#"node_modules/
.env
.env.local
.env.*.local
dist/
build/
.next/
*.log
.DS_Store
"#;
        fs::write(path.join(".gitignore"), gitignore)
            .map_err(|e| format!("Failed to create .gitignore: {}", e))?;
    }

    // README.md
    if !path.join("README.md").exists() {
        let readme = format!("# {}\n", name);
        fs::write(path.join("README.md"), readme)
            .map_err(|e| format!("Failed to create README.md: {}", e))?;
    }

    // .env.example
    if !path.join(".env.example").exists() {
        fs::write(path.join(".env.example"), "# Environment variables\n")
            .map_err(|e| format!("Failed to create .env.example: {}", e))?;
    }

    // VS Code settings
    let vscode_dir = path.join(".vscode");
    if !vscode_dir.exists() {
        fs::create_dir_all(&vscode_dir).ok();
        let settings = r#"{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
"#;
        fs::write(vscode_dir.join("settings.json"), settings).ok();
    }

    Ok(())
}

fn create_github_repo(
    path: &Path,
    name: &str,
    visibility: Option<&str>,
) -> Result<Option<String>, String> {
    // Check if gh is available
    let gh_check = Command::new("gh").args(["auth", "status"]).output();

    if gh_check.is_err() || !gh_check.unwrap().status.success() {
        return Ok(None);
    }

    let vis = visibility.unwrap_or("private");
    let vis_flag = format!("--{}", vis);

    let output = Command::new("gh")
        .args([
            "repo",
            "create",
            name,
            &vis_flag,
            "--source=.",
            "--remote=origin",
            "--push",
        ])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to create GitHub repo: {}", e))?;

    if output.status.success() {
        // Get repo URL
        let url_output = Command::new("gh")
            .args(["repo", "view", "--json", "url", "-q", ".url"])
            .current_dir(path)
            .output();

        if let Ok(url_out) = url_output {
            let url = String::from_utf8_lossy(&url_out.stdout).trim().to_string();
            if !url.is_empty() {
                return Ok(Some(url));
            }
        }

        Ok(Some(format!("https://github.com/{}", name)))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn check_tool_installed(tool: String) -> bool {
    Command::new("which")
        .arg(&tool)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneOptions {
    pub url: String,
    pub name: Option<String>,
    pub shallow: bool,
    pub open_in_editor: bool,
}

#[tauri::command]
pub async fn clone_repository(options: CloneOptions) -> Result<CreateProjectResult, String> {
    let config = load_config()?;

    // Parse URL to get repo name
    let repo_url = if !options.url.starts_with("http") && !options.url.starts_with("git@") {
        // Assume GitHub username/repo format
        format!("https://github.com/{}.git", options.url)
    } else {
        options.url.clone()
    };

    // Extract project name from URL
    let name = options.name.unwrap_or_else(|| {
        repo_url
            .trim_end_matches(".git")
            .rsplit('/')
            .next()
            .unwrap_or("project")
            .to_string()
    });

    let project_path = PathBuf::from(&config.active_dir).join(&name);

    if project_path.exists() {
        return Err(format!("Project '{}' already exists", name));
    }

    // Clone the repository
    let mut args = vec!["clone"];
    if options.shallow {
        args.push("--depth");
        args.push("1");
    }
    args.push(&repo_url);
    args.push(project_path.to_str().unwrap());

    let output = Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to clone repository: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Clone failed: {}", stderr));
    }

    // Install dependencies if package.json exists
    if project_path.join("package.json").exists() {
        let _ = Command::new("pnpm")
            .args(["install"])
            .current_dir(&project_path)
            .output();
    }

    // Open in editor if requested
    if options.open_in_editor {
        let editor = &config.default_editor;
        let _ = Command::new(editor)
            .arg(project_path.to_str().unwrap_or("."))
            .spawn();
    }

    Ok(CreateProjectResult {
        success: true,
        path: project_path.to_string_lossy().to_string(),
        message: format!("Repository '{}' cloned successfully", name),
        github_url: Some(repo_url),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaygroundOptions {
    pub name: Option<String>,
    pub open_in_editor: bool,
}

#[tauri::command]
pub async fn create_playground(options: PlaygroundOptions) -> Result<CreateProjectResult, String> {
    let config = load_config()?;

    // Generate name if not provided
    let name = options.name.unwrap_or_else(|| {
        format!("exp-{}", Utc::now().format("%Y%m%d-%H%M%S"))
    });

    // Use playground directory (one level up from active in Developer folder)
    let dev_root = PathBuf::from(&config.active_dir)
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from(&config.active_dir));
    let playground_dir = dev_root.join("playground");
    let playground_path = playground_dir.join(&name);

    if playground_path.exists() {
        return Err(format!("Playground '{}' already exists", name));
    }

    // Create playground directory
    fs::create_dir_all(&playground_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // Create basic files
    let readme = format!("# {}\n\nPlayground created: {}\n", name, Utc::now().format("%Y-%m-%d %H:%M"));
    fs::write(playground_path.join("README.md"), readme)
        .map_err(|e| format!("Failed to create README: {}", e))?;

    let gitignore = "node_modules/\n.env\ndist/\n";
    fs::write(playground_path.join(".gitignore"), gitignore)
        .map_err(|e| format!("Failed to create .gitignore: {}", e))?;

    // Initialize package.json
    let _ = Command::new("pnpm")
        .args(["init"])
        .current_dir(&playground_path)
        .output();

    // Initialize git
    let _ = Command::new("git")
        .args(["init"])
        .current_dir(&playground_path)
        .output();

    // Open in editor if requested
    if options.open_in_editor {
        let editor = &config.default_editor;
        let _ = Command::new(editor)
            .arg(playground_path.to_str().unwrap_or("."))
            .spawn();
    }

    Ok(CreateProjectResult {
        success: true,
        path: playground_path.to_string_lossy().to_string(),
        message: format!("Playground '{}' created successfully", name),
        github_url: None,
    })
}
