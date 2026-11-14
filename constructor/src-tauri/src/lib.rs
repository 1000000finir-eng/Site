use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
struct GitOut {
    code: i32,
    stdout: String,
    stderr: String,
}

fn err<E: std::fmt::Display>(path: &str, e: E) -> String {
    format!("{}: {}", path, e)
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| err(&path, e))
}

#[tauri::command]
fn write_text(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| err(&path, e))?;
    }
    std::fs::write(&path, content).map_err(|e| err(&path, e))
}

#[tauri::command]
fn read_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| err(&path, e))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<String>, String> {
    let mut names: Vec<String> = Vec::new();
    for entry in std::fs::read_dir(&path).map_err(|e| err(&path, e))? {
        let entry = entry.map_err(|e| err(&path, e))?;
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn copy_file(from: String, to: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to).parent() {
        std::fs::create_dir_all(parent).map_err(|e| err(&to, e))?;
    }
    std::fs::copy(&from, &to).map(|_| ()).map_err(|e| err(&from, e))
}

#[tauri::command]
fn remove_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| err(&path, e))
}

/// Виконує `git` у папці cwd. Повертає код виходу та вивід (помилки git — не помилка команди).
#[tauri::command]
async fn run_git(cwd: String, args: Vec<String>) -> Result<GitOut, String> {
    let mut cmd = Command::new("git");
    cmd.args(&args)
        .current_dir(&cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd
        .output()
        .map_err(|e| format!("Не вдалося запустити git ({}). Встановіть Git for Windows.", e))?;
    Ok(GitOut {
        code: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out.stdout).to_string(),
        stderr: String::from_utf8_lossy(&out.stderr).to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text,
            write_text,
            read_bytes,
            list_dir,
            path_exists,
            copy_file,
            remove_file,
            run_git
        ])
        .run(tauri::generate_context!())
        .expect("помилка запуску застосунку");
}
