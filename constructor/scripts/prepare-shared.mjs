// Готує спільні файли для конструктора (стилі бібліотеки, CSS для превʼю).
// Якщо залежності сайту в корені репозиторію ще не встановлені — ставить їх сам (один раз).
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });

const need = ["postcss", "esbuild", "markdown-it"].filter((p) => !existsSync(path.join(root, "node_modules", p)));
if (need.length) {
  console.log(`Встановлюю залежності сайту в ${root} (один раз)…`);
  const lock = existsSync(path.join(root, "package-lock.json"));
  const r = run("npm", [lock ? "ci" : "install", "--no-audit", "--no-fund"], { shell: true });
  if (r.status !== 0) {
    console.error(`\nНе вдалося встановити залежності. Виконайте вручну:\n  cd ${root}\n  npm ci\n`);
    process.exit(r.status || 1);
  }
}
for (const f of ["tools/build-library-css.mjs", "tools/build-preview.mjs"]) {
  const r = run(process.execPath, [f]);
  if (r.status !== 0) process.exit(r.status || 1);
}
