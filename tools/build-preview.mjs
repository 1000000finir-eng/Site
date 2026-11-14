import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

// Правила сайту «ховають» блоки (opacity:0) до анімації при скролі. У превʼю скрипта немає —
// тому з усіх CSS автоматично збираємо ці селектори й примусово показуємо блоки.
const files = ["src/style.css", ...fs.readdirSync("src/css").filter((f) => f.endsWith(".css")).map((f) => path.join("src/css", f))];
const KEY = /ec-animate|fade-up|fade-left|scroll-animate|hero-line|ec-intro|ec-content|ec-visible|fade-in/;
const SKIP = /modal|popup|hover|shrink|#cardModal|\.faq-/i;
const splitTop = (s) => {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
};
const selectors = new Set();
for (const f of files) {
  const css = fs.readFileSync(f, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/opacity\s*:\s*0(?![.\d])/.test(m[2])) continue;
    for (const sel of splitTop(m[1].replace(/@media[^{]*$/, ""))) {
      if (KEY.test(sel) && !SKIP.test(sel) && !/^(\d+%|from|to)$/.test(sel) && !sel.includes("::")) selectors.add(sel.replace(/\s+/g, " "));
    }
  }
}
const SHOW = "opacity:1!important;transform:none!important;filter:none!important;transition:none!important;animation:none!important;visibility:visible!important";
const list = [...selectors];
const fix = `${list.map((s) => `${s}{${SHOW}}`).join("\n")}
.faq-answer{height:auto!important;opacity:1!important;transform:none!important}
body{margin:0}
#hero{margin-top:0!important}`;
fs.writeFileSync("tools/preview-fix.generated.js", `export const FIX_CSS = ${JSON.stringify(fix)};\n`);
console.log(`preview-fix: ${list.length} селекторів`);

await build({
  entryPoints: ["tools/preview.src.js"],
  outfile: "src/admin/preview.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  logLevel: "info",
});
