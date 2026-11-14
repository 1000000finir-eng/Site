// Тонкий шар над Tauri: файли та git. Уся логіка — у JS, Rust лише виконує прості команди.
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, ask } from "@tauri-apps/plugin-dialog";

export const readText = (path) => invoke("read_text", { path });
export const writeText = (path, content) => invoke("write_text", { path, content });
export const listDir = (path) => invoke("list_dir", { path });
export const exists = (path) => invoke("path_exists", { path });
export const copyFile = (from, to) => invoke("copy_file", { from, to });
export const removeFile = (path) => invoke("remove_file", { path });
export const readBytes = (path) => invoke("read_bytes", { path }); // ArrayBuffer
export const runGit = (cwd, args) => invoke("run_git", { cwd, args });

export async function pickFolder(title = "Оберіть папку") {
  const r = await openDialog({ directory: true, multiple: false, title });
  return typeof r === "string" ? r : null;
}
export async function pickImage() {
  const r = await openDialog({
    multiple: false,
    title: "Оберіть картинку",
    filters: [{ name: "Картинки", extensions: ["jpg", "jpeg", "png", "webp", "svg", "gif"] }],
  });
  return typeof r === "string" ? r : null;
}

export const join = (...p) => p.join("/").replace(/[\\/]+/g, "/").replace(/^([A-Za-z]):\//, "$1:/");
export const baseName = (p) => String(p).replace(/\\/g, "/").split("/").pop();

export const confirmAsk = (message) => ask(message, { title: "Підтвердження", kind: "warning", okLabel: "Так", cancelLabel: "Ні" });
