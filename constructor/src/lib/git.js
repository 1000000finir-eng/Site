import { exists, join, runGit } from "./api.js";

const out = (r) => `${r.stdout || ""}${r.stderr || ""}`.trim();

// Публікуємо лише вміст сайту, а не код конструктора, тести чи службові файли.
export const CONTENT_PATHS = ["src/_content", "src/_data", "src/assets"];

/** Рядок `git status --porcelain` → зрозумілий опис для списку файлів. */
export function describeChange(line) {
  const code = line.slice(0, 2).trim();
  let path = line.slice(3).trim();
  if (path.includes(" -> ")) path = path.split(" -> ").pop();
  let label = "Змінено";
  if (code === "??") label = "Новий";
  else if (code.includes("D")) label = "Видалено";
  else if (code.includes("R")) label = "Перейменовано";
  else if (code.includes("A")) label = "Додано";
  return { code, path, label };
}

export async function gitVersion() {
  try {
    const r = await runGit(".", ["--version"]);
    return r.code === 0 ? out(r) : null;
  } catch {
    return null;
  }
}

export async function ensureIdentity(repo, name = "Конструктор сайту", email = "constructor@site.local") {
  const n = await runGit(repo, ["config", "user.name"]);
  if (!n.stdout.trim()) await runGit(repo, ["config", "user.name", name]);
  const e = await runGit(repo, ["config", "user.email"]);
  if (!e.stdout.trim()) await runGit(repo, ["config", "user.email", email]);
}

/** Зміни лише в теках вмісту сайту (за замовчуванням), а не весь репозиторій. */
export async function changedFiles(repo, paths = CONTENT_PATHS) {
  const r = await runGit(repo, ["status", "--porcelain", "--", ...paths]);
  return r.stdout
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter(Boolean);
}

/** Скільки локальних комітів ще не відправлено на GitHub. */
export async function aheadCount(repo) {
  const r = await runGit(repo, ["rev-list", "--count", "@{upstream}..HEAD"]);
  if (r.code !== 0) return 0;
  return Number(r.stdout.trim()) || 0;
}

export async function clone(parent, url, folder) {
  const r = await runGit(parent, ["clone", url, folder]);
  if (r.code !== 0) throw new Error(friendly(out(r)));
}

export async function pull(repo) {
  const r = await runGit(repo, ["pull", "--rebase", "--autostash"]);
  if (r.code !== 0) {
    await runGit(repo, ["rebase", "--abort"]);
    throw new Error(friendly(out(r)));
  }
  return out(r);
}

/** Зберегти вміст сайту в git і відправити на GitHub. Повертає протокол кроків. */
export async function publish(repo, message, log = () => {}) {
  await ensureIdentity(repo);
  const pending = await aheadCount(repo);
  if (pending) log(`Локальних версій, ще не відправлених на GitHub: ${pending}.`);
  const paths = [];
  for (const p of CONTENT_PATHS) if (await exists(join(repo, p))) paths.push(p);
  if (!paths.length) throw new Error("У цій папці не знайдено вмісту сайту (src/_content, src/_data, src/assets).");

  log("Готуємо зміни…");
  let r = await runGit(repo, ["add", "--", ...paths]);
  if (r.code !== 0) throw new Error(friendly(out(r)));
  const changes = await changedFiles(repo, paths);
  if (changes.length) {
    log(`Зберігаємо версію (${changes.length} файл.)…`);
    // Обмежуємо коміт тими самими теками, щоб випадково не опублікувати код чи службові файли.
    r = await runGit(repo, ["commit", "-m", message, "--", ...paths]);
    if (r.code !== 0) throw new Error(friendly(out(r)));
  } else {
    log("Нових змін немає — перевіряємо, чи все відправлено.");
  }
  log("Отримуємо останні зміни з GitHub…");
  try {
    await pull(repo);
  } catch (e) {
    throw new Error(
      "Локальну версію вже збережено в git, але синхронізація з GitHub не завершилася. Натисніть «Опублікувати» ще раз.\n\n" +
        (e?.message || e)
    );
  }
  log("Відправляємо на GitHub (може відкритися вікно входу)…");
  r = await runGit(repo, ["push"]);
  if (r.code !== 0)
    throw new Error(
      "Локальну версію вже збережено в git, але відправити на GitHub не вдалося. Натисніть «Опублікувати» ще раз.\n\n" +
        friendly(out(r))
    );
  log("Готово. Сайт оновиться за 1–2 хвилини.");
}

export function friendly(text) {
  const t = String(text || "");
  if (/could not read Username|terminal prompts disabled|Authentication failed|403|401/i.test(t))
    return "GitHub не пустив: потрібно увійти в акаунт. Встановіть Git for Windows із Git Credential Manager і повторіть — відкриється вікно входу.\n\n" + t;
  if (/CONFLICT|could not apply|Merge conflict/i.test(t))
    return "Зміни на GitHub перетнулися з вашими. Нічого не втрачено локально — зверніться до розробника.\n\n" + t;
  if (/not a git repository/i.test(t)) return "Ця папка не є репозиторієм сайту.\n\n" + t;
  if (/Could not resolve host|unable to access|Failed to connect/i.test(t)) return "Немає з’єднання з інтернетом або GitHub недоступний.\n\n" + t;
  return t;
}
