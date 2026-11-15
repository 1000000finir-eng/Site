// Попередній перегляд: ті самі шаблони, що й на сайті (спільний код з ../../src/_includes).
import { renderers } from "../../../src/_includes/product/blocks.js";
import { renderHero } from "../../../src/_includes/product/hero.js";
import { renderSection } from "../../../src/_includes/home-render.js";
import { renderSpec } from "../../../src/_includes/product/dsl.js";
import { FIX_CSS } from "../../../tools/preview-fix.generated.js";
import { CATALOG, newInsert } from "./schema.js";

const BY = Object.fromEntries(CATALOG.map((s) => [s.name, s]));

const err = (msg) => `<div style="padding:18px 24px;margin:10px 24px;border:1px dashed #b33;border-radius:10px;font:14px sans-serif;color:#933;background:#fff7f7">Блок поки неможливо показати: ${String(msg).replace(/</g, "&lt;")}</div>`;
const wrap = (i, html) => `<div class="__bw" data-i="${i}">${html}</div>`;
const safe = (fn) => {
  try {
    return fn();
  } catch (e) {
    return err(e.message || e);
  }
};

// Вставки, що відрендерились останнім разом (для панелі над вставкою у перегляді)
let INS = [];
export const lastInserts = () => INS;
function withMarks(fn) {
  INS = [];
  globalThis.__insMark = (it) => {
    INS.push(it);
    return `<!--ins:${INS.length - 1}-->`;
  };
  try {
    return fn();
  } finally {
    globalThis.__insMark = undefined;
  }
}

export function renderBlockHtml(block, page, ctx = { faqUsed: true }) {
  const r = renderers[block.type];
  if (!r) return err(`невідомий тип «${block.type}»`);
  return r(block, page, ctx);
}

export function pageBody(page) {
  return withMarks(() => {
    const parts = [wrap("hero", safe(() => renderHero(page)))];
    const ctx = { faqUsed: false };
    (page.blocks || []).forEach((b, i) => parts.push(wrap(i, safe(() => renderBlockHtml(b, page, ctx)))));
    return parts.join("\n");
  });
}

export function homeBody(home) {
  return (home.sections || []).map((s, i) => wrap(i, safe(() => renderSection(s)))).join("\n");
}

/** Один блок без обгортки (плитки вибору). */
export function singleBody(block, page) {
  return safe(() => renderBlockHtml(block, page));
}

/** Приклад вставки в контексті текстового блоку (плитки вибору вставки). */
export function insertTile(type, page) {
  return safe(() => `<section class="ec-detail ec-animate"><div class="ec-detail__single">${renderSpec(BY[type], newInsert(type), page, BY)}</div></section>`);
}

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">`;

const OV = `html{scrollbar-width:thin;scrollbar-color:#bdb5ad transparent}
html::-webkit-scrollbar{width:7px;height:7px}html::-webkit-scrollbar-button{display:none}html::-webkit-scrollbar-track{background:transparent}html::-webkit-scrollbar-thumb{background:#bdb5ad;border-radius:6px}
.__bw{position:relative}
.__tb{position:absolute;top:8px;right:8px;z-index:99999;display:none;gap:4px;font:13px system-ui,sans-serif}
.__bw:hover>.__tb,.__b:hover>.__tb{display:flex}
.__tb button{background:#8e1b3a;color:#fff;border:0;border-radius:6px;padding:5px 9px;cursor:pointer;font:inherit;line-height:1.2}
.__tb button:hover{background:#6f1230}
.__bw:hover{outline:2px dashed rgba(142,27,58,.55);outline-offset:-2px}
.__bw.sel{outline:3px solid #8e1b3a!important;outline-offset:-3px}
.__add{display:block;width:100%;grid-column:1/-1;flex:0 0 100%;border:0;background:rgba(142,27,58,.08);color:#8e1b3a;padding:7px;font:600 13px system-ui,sans-serif;cursor:pointer;opacity:.35}
.__add:hover{opacity:1;background:rgba(142,27,58,.2)}
.card{cursor:grab;user-select:none;-webkit-user-drag:element}
.card.__b{position:relative}
.card.__b:hover{outline:2px dashed rgba(142,27,58,.55);outline-offset:-2px}
.card.__dragging{opacity:.45;outline:2px solid #8e1b3a!important}
.card.__card-over{outline:3px solid #8e1b3a!important;outline-offset:-3px;background:rgba(142,27,58,.06)}
.__over{outline:3px dashed #8e1b3a!important;outline-offset:-3px;background:rgba(142,27,58,.04)}
.__ins{cursor:pointer;position:relative}
.__ins:hover,.__ins-active{outline:2px dashed #b8860b;outline-offset:3px;background:rgba(184,134,11,.06)}
.__ins-tb{box-shadow:0 2px 10px rgba(0,0,0,.18)}
img,button,a{-webkit-user-drag:none;user-drag:none}`;

/** Повний HTML для iframe. css — текст стилів, cssHref — посилання на спільний blob зі стилями. */
export function buildDoc({ body, css = "", cssHref = "", selected = null, interactive = true }) {
  const sel = selected === null || selected === undefined ? "" : `[data-i="${selected}"]`;
  const link = cssHref ? `<link rel="stylesheet" href="${cssHref}">` : "";
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8">${FONTS}${link}<style>${css}</style><style>${FIX_CSS}
${interactive ? OV : ""}
</style></head><body data-sel="${sel ? selected : ""}">${body}</body></html>`;
}
