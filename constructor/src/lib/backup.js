// Резервні копії перед небезпечними діями (видалення сторінки, масова міграція).
// Копії лежать у прихованій теці сайту й не публікуються на GitHub.
import { copyFile, exists, join, listDir, readText, writeText } from "./api.js";

export const BACKUP_FOLDER = ".constructor-backup";

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

export function newBackupDir(repo, kind, tag = "") {
  const name = `${stamp()}-${kind}${tag ? "-" + tag : ""}`;
  return join(repo, BACKUP_FOLDER, name);
}

export async function writeManifest(dir, data) {
  await writeText(join(dir, "manifest.json"), JSON.stringify(data, null, 2) + "\n");
}

/** Копіює JSON-файли сторінок у backup-теку. Повертає список збережених slug. */
export async function backupPages(repo, dir, slugs) {
  const saved = [];
  for (const slug of slugs) {
    const src = join(repo, "src/_content/pages", `${slug}.json`);
    if (!(await exists(src))) continue;
    await copyFile(src, join(dir, "pages", `${slug}.json`));
    saved.push(slug);
  }
  return saved;
}

/** Повертає сторінки з backup-теки на місце. Повертає кількість відновлених файлів. */
export async function restorePages(repo, dir, slugs) {
  let n = 0;
  for (const slug of slugs) {
    const src = join(dir, "pages", `${slug}.json`);
    if (!(await exists(src))) continue;
    await copyFile(src, join(repo, "src/_content/pages", `${slug}.json`));
    n++;
  }
  return n;
}

/** Читає manifest резервної копії (для ручного відновлення чи діагностики). */
export async function readManifest(dir) {
  return JSON.parse(await readText(join(dir, "manifest.json")));
}

/** Список сторінок у резервній копії. */
export async function listBackupPages(dir) {
  const pages = join(dir, "pages");
  if (!(await exists(pages))) return [];
  return (await listDir(pages))
    .filter((n) => n.endsWith(".json"))
    .map((n) => n.replace(/\.json$/, ""));
}
