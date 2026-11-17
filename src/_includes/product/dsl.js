// Рушій блоків: один опис (catalog.json) → HTML сайту, форма CMS і попередній перегляд.
// Вузол опису: { tag, cls, kids, md|text (поле), each (список), opt (необов'язковий), body, cta, btn, af, index }
import { esc, inl, inlWithLists, hasList, renderBody, cta } from "./lib.js";

const VOID = new Set(["img", "br", "hr", "input"]);
const tpl = (c, sc, spec) =>
  String(c ?? "")
    .replace(/\{(\w+)\}/g, (_, k) => sc[k] ?? spec.selects?.[k]?.[0]?.[0] ?? "")
    .replace(/^_plain$/, "");
const val = (sc, k) => (k === "_" ? sc._ : sc[k]);
const filled = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");
// opt може бути одним полем або списком: вузол показується, якщо заповнене хоч одне.
const shown = (sc, opt) => (Array.isArray(opt) ? opt.some((k) => filled(sc[k])) : filled(sc[opt]));

function node(n, sc, ctx, i = 0, root = sc) {
  if (n.each) {
    const list = sc[n.each] || [];
    const sep = n.sepCls
      ? `\n<span class="${esc(n.sepCls)}">${esc(n.sep || "→")}</span>\n`
      : "\n";
    return list
      .map((it, idx) => one(n, typeof it === "object" && it !== null ? it : { _: it }, ctx, idx, root))
      .join(sep);
  }
  if (n.opt && !shown(sc, n.opt)) return "";
  if (n.inserts && !(sc[n.inserts] || []).length) return "";
  return one(n, sc, ctx, i, root);
}

function one(n, sc, ctx, i, root = sc) {
  const page = ctx.page;
  if (n.inserts) {
    return (sc[n.inserts] || [])
      .map((it) => (ctx.byName?.[it.type] ? (globalThis.__insMark ? globalThis.__insMark(it) : "") + renderSpec(ctx.byName[it.type], it, page, ctx.byName) : ""))
      .filter(Boolean)
      .join("\n");
  }
  if (n.flow) {
    const nodes = sc[n.flow] || [];
    if (!nodes.length) return "";
    const sep = esc(sc[n.flow + "_sep"] || "→");
    const parts = nodes.map((t, k) => `${k ? `<span class="fl-block__sep">${sep}</span>` : ""}<span class="fl-block__node">${esc(t)}</span>`);
    const extra = n.style ? ` style="${esc(tpl(n.style, sc, ctx.spec))}"` : "";
    return `<div class="fl-block"${extra}><div class="fl-block__track">${parts.join("")}</div></div>`;
  }
  if (n.table) {
    const head = sc.head || [], rows = sc.rows || [];
    const th = head.map((h) => `<th>${inl(h)}</th>`).join("");
    const tr = rows.map((r) => `<tr>${(r.cells || r || []).map((c) => `<td>${inl(c)}</td>`).join("")}</tr>`).join("");
    return `<div class="${esc(n.wrap)}"><table class="${esc(n.tcls)}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }
  if (n.body) return renderBody(sc[n.body], n.ulcls || "");
  if (n.cta) return filled(sc[n.cta]) ? cta(page, sc[n.cta], !!n.light, page.cta?.action || "price", page.cta?.attrs !== false) : "";
  if (n.btn) {
    const fn = (page.cta?.action || "price") === "price" ? "openPricePopup(event)" : "openBookingModal(event)";
    return `<button class="ec-main-btn" onclick="${fn}">${esc(sc[n.btn] || "ЗАПИСАТИСЯ")}</button>`;
  }
  const cls = tpl(n.cls, sc, ctx.spec);
  let attrs = cls ? ` class="${esc(cls)}"` : "";
  if (n.style) attrs += ` style="${esc(tpl(n.style, sc, ctx.spec))}"`;
  for (const [a, f] of Object.entries(n.af || {})) attrs += ` ${a}="${esc(sc[f] || "")}"`;
  for (const [a, f] of Object.entries(n.oaf || {})) if (filled(sc[f])) attrs += ` ${a}="${esc(sc[f])}"`;
  for (const [a, v] of Object.entries(n.sattr || {})) attrs += ` ${a}="${esc(v)}"`;
  if (VOID.has(n.tag)) return `<${n.tag}${attrs}>`;
  // список у <p> виносимо в <div> з тим самим класом — інакше браузер закриє <p> і стилі зникнуть
  const mdValue = n.md ? val(sc, n.md) : "";
  const listPara = n.tag === "p" && !!n.md && hasList(mdValue);
  let inner = "";
  if (n.md) {
    // у заголовках список не передбачений — лишаємо звичайний inline-рендер
    const renderMd = /^h[1-6]$/i.test(n.tag || "") ? inl : inlWithLists;
    const body = listPara ? renderBody(mdValue, n.ulcls || "") : renderMd(mdValue);
    inner = (n.lead ? `<span>${esc(n.lead)}</span> ` : "") + body + (n.tail && filled(sc[n.tail]) ? ` <span>${esc(sc[n.tail])}</span>` : "");
  }
  else if (n.text) inner = esc(val(sc, n.text) ?? "");
  else if (n.static) inner = esc(n.static);
  else if (n.index) {
    const start = n.start ? Number(root[n.start]) : NaN;
    const num = i + (Number.isFinite(start) ? start : 1);
    inner = n.index === "pad2" ? String(num).padStart(2, "0") : String(num);
  }
  else if (n.kids) inner = "\n" + n.kids.map((k) => node(k, sc, ctx, i, root)).filter(Boolean).join("\n") + "\n";
  const tag = listPara ? "div" : n.tag;
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

export function renderSpec(spec, data, page, byName) {
  return node(spec.root, data, { page, spec, byName });
}
