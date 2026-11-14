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

/// Виконує блокуючу операцію (файли, git) у пулі фонових потоків,
/// щоб головний потік Tauri не «замерзав» на час читання/запису.
async fn blocking<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(f).await {
        Ok(result) => result,
        Err(e) => Err(format!("Фонова операція не завершилася: {}", e)),
    }
}

#[tauri::command]
async fn read_text(path: String) -> Result<String, String> {
    blocking(move || std::fs::read_to_string(&path).map_err(|e| err(&path, e))).await
}

#[tauri::command]
async fn write_text(path: String, content: String) -> Result<(), String> {
    blocking(move || {
        if let Some(parent) = Path::new(&path).parent() {
            std::fs::create_dir_all(parent).map_err(|e| err(&path, e))?;
        }
        std::fs::write(&path, content).map_err(|e| err(&path, e))
    })
    .await
}

#[tauri::command]
async fn read_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    blocking(move || {
        let bytes = std::fs::read(&path).map_err(|e| err(&path, e))?;
        Ok(tauri::ipc::Response::new(bytes))
    })
    .await
}

#[tauri::command]
async fn list_dir(path: String) -> Result<Vec<String>, String> {
    blocking(move || {
        let mut names: Vec<String> = Vec::new();
        for entry in std::fs::read_dir(&path).map_err(|e| err(&path, e))? {
            let entry = entry.map_err(|e| err(&path, e))?;
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_string());
            }
        }
        names.sort();
        Ok(names)
    })
    .await
}

#[tauri::command]
async fn path_exists(path: String) -> bool {
    blocking(move || Ok(Path::new(&path).exists()))
        .await
        .unwrap_or(false)
}

#[tauri::command]
async fn copy_file(from: String, to: String) -> Result<(), String> {
    blocking(move || {
        if let Some(parent) = Path::new(&to).parent() {
            std::fs::create_dir_all(parent).map_err(|e| err(&to, e))?;
        }
        std::fs::copy(&from, &to)
            .map(|_| ())
            .map_err(|e| err(&from, e))
    })
    .await
}

#[tauri::command]
async fn remove_file(path: String) -> Result<(), String> {
    blocking(move || std::fs::remove_file(&path).map_err(|e| err(&path, e))).await
}

/// Виконує `git` у папці cwd. Повертає код виходу та вивід (помилки git — не помилка команди).
#[tauri::command]
async fn run_git(cwd: String, args: Vec<String>) -> Result<GitOut, String> {
    blocking(move || {
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
        let out = cmd.output().map_err(|e| {
            format!(
                "Не вдалося запустити git ({}). Встановіть Git for Windows.",
                e
            )
        })?;
        Ok(GitOut {
            code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        })
    })
    .await
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
