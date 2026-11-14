// Стилі бібліотеки блоків і вставок (з blocks.css) окремим файлом — для сторінок із власним CSS.
import fs from "node:fs";
import postcss from "postcss";

const catalog = JSON.parse(fs.readFileSync("src/_includes/product/catalog.json", "utf-8"));
const tokens = new Set();
const addCls = (c) => String(c || "").split(/\s+/).forEach((t) => t && !t.startsWith("{") && !t.startsWith("ec-") && t !== "card" && t !== "_plain" && tokens.add(t));
const walk = (n) => { addCls(n.cls); (n.kids || []).forEach(walk); };
for (const s of catalog) {
  if (s.group === "page") continue;
  walk(s.root);
  Object.values(s.selects || {}).forEach((opts) => opts.forEach(([v]) => addCls(v)));
}
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const itokens = new Set();
const walkI = (n) => { String(n.cls || "").split(/\s+/).forEach((t) => t && !t.startsWith("{") && !t.startsWith("ec-") && itokens.add(t)); (n.kids || []).forEach(walkI); };
for (const s of catalog) if (s.group === "insert") walkI(s.root);
const ire = new RegExp([...itokens].map((t) => `\\.${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).join("|"));
const re = new RegExp([...tokens].map((t) => `\\.${esc(t)}(?![\\w-])`).join("|"));

const root = postcss.parse(fs.readFileSync("src/css/blocks.css", "utf-8"));
const keep = postcss.root();
const names = new Set();
const filter = (container, target) => {
  container.each((node) => {
    if (node.type === "rule") {
      if (node.selectors.some((s) => re.test(s))) {
        target.append(node.clone());
        node.walkDecls(/^animation(-name)?$/, (d) => d.value.split(/[\s,]+/).forEach((w) => names.add(w)));
      }
    } else if (node.type === "atrule" && /^(media|supports)$/.test(node.name)) {
      const holder = node.clone({ nodes: [] });
      filter(node, holder);
      if (holder.nodes.length) target.append(holder);
    }
  });
};
filter(root, keep);
root.walkAtRules("keyframes", (k) => { if (names.has(k.params)) keep.append(k.clone()); });
// Вставки лежать усередині блоків із власними стилями (напр. «.ec-detail__single p») — підсилюємо специфічність
const boost = postcss.root();
const boostWalk = (container, target) => container.each((node) => {
  if (node.type === "rule") {
    const sel = node.selectors.filter((x) => ire.test(x) && !/^(html|body|:root)/.test(x));
    if (sel.length) target.append(node.clone({ selectors: sel.map((x) => ":root " + x) }));
  } else if (node.type === "atrule" && /^(media|supports)$/.test(node.name)) {
    const h = node.clone({ nodes: [] });
    boostWalk(node, h);
    if (h.nodes.length) target.append(h);
  }
});
boostWalk(keep, boost);

// Вставки-ряди (flex) не центруються самі, навіть коли текст блоку по центру — додаємо правила для центрованих блоків
const FLEX_INSERTS = ["chips", "pill_meta", "label_row", "split_inline", "note_line", "step_num", "metric_pill_row", "avatar_row", "link_row", "divider_label"];
const flexRoots = [];
for (const s of catalog) if (s.group === "insert" && FLEX_INSERTS.includes(s.name)) {
  const c = String(s.root.cls || "").split(/\s+/)[0];
  if (c && !c.startsWith("{")) flexRoots.push("." + c);
}
const files = ["src/style.css", ...fs.readdirSync("src/css").filter((f) => f.endsWith(".css") && f !== "library.css").map((f) => "src/css/" + f)];
const centered = new Set([".tx-block--center", ".ec-final__box", ".qz-block__inner", ".st-block__cta", ".hero-mini__inner", ".fn-burgundy__box"]);
for (const f of files) {
  const css = fs.readFileSync(f, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!/text-align\s*:\s*center/.test(m[2])) continue;
    for (const sel of m[1].split(",")) {
      const x = sel.trim();
      if (/^\.[\w-]+(__box|__inner|__cta|__content|--center)$/.test(x) && !/modal|popup|offer|contacts|payment|exit/.test(x)) centered.add(x);
    }
  }
}
if (flexRoots.length && centered.size) {
  const sels = [];
  for (const c of centered) for (const r of flexRoots) sels.push(`:root ${c} ${r}`);
  boost.append(postcss.parse(`${sels.join(",\n")}{justify-content:center}`));
}
keep.append(postcss.comment({ text: " підсилені правила для вставок " }));
boost.each((n) => keep.append(n.clone()));
fs.writeFileSync("src/css/library.css", "/* Згенеровано tools/build-library-css.mjs з blocks.css: стилі блоків і вставок бібліотеки */\n" + keep.toString());
console.log(`library.css: ${keep.nodes.length} правил, класів бібліотеки ${tokens.size}`);
