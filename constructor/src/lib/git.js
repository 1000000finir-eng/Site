import { runGit } from "./api.js";

const out = (r) => `${r.stdout || ""}${r.stderr || ""}`.trim();

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

export async function changedFiles(repo) {
  const r = await runGit(repo, ["status", "--porcelain"]);
  return r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
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

/** Зберегти все у git і відправити на GitHub. Повертає протокол кроків. */
export async function publish(repo, message, log = () => {}) {
  await ensureIdentity(repo);
  log("Готуємо зміни…");
  let r = await runGit(repo, ["add", "-A"]);
  if (r.code !== 0) throw new Error(friendly(out(r)));
  const changes = await changedFiles(repo);
  if (changes.length) {
    log(`Зберігаємо версію (${changes.length} файл.)…`);
    r = await runGit(repo, ["commit", "-m", message]);
    if (r.code !== 0) throw new Error(friendly(out(r)));
  } else {
    log("Нових змін немає — перевіряємо, чи все відправлено.");
  }
  log("Отримуємо останні зміни з GitHub…");
  await pull(repo);
  log("Відправляємо на GitHub (може відкритися вікно входу)…");
  r = await runGit(repo, ["push"]);
  if (r.code !== 0) throw new Error(friendly(out(r)));
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
