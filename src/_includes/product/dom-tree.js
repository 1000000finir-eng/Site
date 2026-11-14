// Розбір HTML у дерево елементів (для вільного редагування блоків) та впізнавання вставок з каталогу.
// Працює з будь-яким DOM (браузер / jsdom): приймає готові DOM-елементи.
import catalog from "./catalog.json" with { type: "json" };

const INSERT_SPECS = catalog.filter((s) => s.group === "insert");
const INLINE = new Set(["b", "strong", "i", "em", "br", "a", "span"]);
const VOID = new Set(["img", "br", "hr", "input", "meta", "link"]);
export const VOID_TAGS = VOID;

const tag = (el) => el.tagName.toLowerCase();
const kidsOf = (el) => Array.from(el.children);
const clsOf = (el) => (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).join(" ");
const attrNames = (el) => Array.from(el.attributes).map((a) => a.name);
const text1 = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
const escMd = (t) => t.replace(/([\\*_`\[\]<>~])/g, "\\$1");

export function onlyInline(el) {
  return Array.from(el.childNodes).every((c) => c.nodeType === 3 || c.nodeType === 8 || (c.nodeType === 1 && INLINE.has(tag(c))));
}
const hasStrayText = (el) => Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.data.trim());

/** Вміст елемента → markdown (жирний, курсив, перенос рядка; решта — як є). */
export function inlineMd(node) {
  let out = "";
  const list = Array.from(node.childNodes);
  list.forEach((ch, idx) => {
    if (ch.nodeType === 3) out += escMd(ch.data.replace(/\s+/g, " "));
    else if (ch.nodeType !== 1) return;
    else {
      const t = tag(ch);
      if (t === "b" || t === "strong") {
        const inner = inlineMd(ch).trim();
        out += inner ? `**${inner}**` : "";
      } else if (t === "i" || t === "em") out += `*${inlineMd(ch).trim()}*`;
      else if (t === "br") {
        const trailing = list.slice(idx + 1).every((x) => x.nodeType === 8 || (x.nodeType === 3 && !x.data.trim()));
        out += trailing ? "<br>" : "  \n";
      } else out += ch.outerHTML;
    }
  });
  return out.replace(/[ ]*(  \n)[ ]*/g, "$1").trim();
}

// ---------------- зіставлення з описом каталогу (як tools/dsl_match.py) ----------------
const isCta = (el) => tag(el) === "div" && (el.getAttribute("class") || "").split(/\s+/).includes("ec-booking-card");
export function ctaInfo(card) {
  const b = card.querySelector("button");
  return {
    text: text1(b),
    action: (b.getAttribute("onclick") || "").includes("openPricePopup") ? "price" : "booking",
    attrs: card.hasAttribute("data-product"),
    light: (b.getAttribute("class") || "").split(/\s+/).includes("ec-main-btn--light"),
    ...(card.getAttribute("style") ? { card_style: card.getAttribute("style") } : {}),
  };
}

function bodyItem(el, n) {
  if (el.getAttribute("style")) return false;
  const t = tag(el);
  if (t === "p") return clsOf(el) === "" && onlyInline(el) && attrNames(el).every((a) => a === "class");
  if (t === "ul") return clsOf(el) === (n.ulcls || "") && kidsOf(el).every((li) => tag(li) === "li" && onlyInline(li) && attrNames(li).length === 0);
  return false;
}
const bodyMd = (els) => els.map((el) => (tag(el) === "p" ? inlineMd(el) : kidsOf(el).map((li) => "- " + inlineMd(li)).join("\n"))).join("\n\n");

function matchChildren(nodes, kids, sc, spec, ctx) {
  let i = 0;
  for (const n of nodes) {
    if (n.body !== undefined) {
      let j = i;
      while (j < kids.length && bodyItem(kids[j], n)) j++;
      if (j === i) {
        if (n.opt) continue;
        return false;
      }
      sc[n.body] = bodyMd(kids.slice(i, j));
      i = j;
      continue;
    }
    if (n.inserts) {
      const items = [];
      while (i < kids.length) {
        const hit = matchInsert(kids[i], ctx);
        if (!hit) break;
        items.push(hit);
        i++;
      }
      if (items.length) sc[n.inserts] = items;
      continue;
    }
    if (n.each) {
      const items = [];
      while (i < kids.length) {
        const isc = {};
        ctx.idx = items.length;
        if (!matchOne(n, kids[i], isc, spec, ctx)) break;
        items.push(Object.keys(isc).length === 1 && "_" in isc ? isc._ : isc);
        i++;
      }
      if (!items.length) return false;
      sc[n.each] = items;
      continue;
    }
    if (n.opt) {
      const tmp = {};
      if (i < kids.length && matchOne(n, kids[i], tmp, spec, ctx)) {
        Object.assign(sc, tmp);
        i++;
      }
      continue;
    }
    if (i >= kids.length || !matchOne(n, kids[i], sc, spec, ctx)) return false;
    i++;
  }
  return i === kids.length;
}

function matchOne(n, el, sc, spec, ctx) {
  const pc = ctx.cta || { action: "price", attrs: true };
  const t = tag(el);
  if (n.cta) {
    if (!isCta(el)) return false;
    if (attrNames(el).some((k) => !(k === "class" || k.startsWith("data-") || (k === "style" && ctx.ignoreStyle)))) return false;
    const b = el.querySelector("button");
    if (!b || kidsOf(el).length !== 1 || hasStrayText(el)) return false;
    const act = (b.getAttribute("onclick") || "").includes("openPricePopup") ? "price" : "booking";
    if (act !== pc.action || el.hasAttribute("data-product") !== pc.attrs) return false;
    if ((b.getAttribute("class") || "").split(/\s+/).includes("ec-main-btn--light") !== !!n.light) return false;
    sc[n.cta] = text1(b);
    return true;
  }
  if (n.btn) {
    if (t !== "button" || clsOf(el) !== "ec-main-btn") return false;
    const act = (el.getAttribute("onclick") || "").includes("openPricePopup") ? "price" : "booking";
    if (act !== pc.action) return false;
    sc[n.btn] = text1(el);
    return true;
  }
  if (n.table) {
    if (t !== "div" || clsOf(el) !== n.wrap || attrNames(el).some((a) => a !== "class")) return false;
    const tb = kidsOf(el);
    if (tb.length !== 1 || tag(tb[0]) !== "table" || clsOf(tb[0]) !== n.tcls || attrNames(tb[0]).some((a) => a !== "class")) return false;
    const parts = kidsOf(tb[0]);
    if (parts.map(tag).join() !== "thead,tbody" || parts.some((x) => attrNames(x).length)) return false;
    const hr = kidsOf(parts[0]);
    if (hr.length !== 1 || tag(hr[0]) !== "tr" || attrNames(hr[0]).length) return false;
    const head = [];
    for (const c of kidsOf(hr[0])) {
      if (tag(c) !== "th" || attrNames(c).length || (kidsOf(c).length && !onlyInline(c))) return false;
      head.push(inlineMd(c));
    }
    const rows = [];
    for (const r of kidsOf(parts[1])) {
      if (tag(r) !== "tr" || attrNames(r).length) return false;
      const cells = [];
      for (const c of kidsOf(r)) {
        if (tag(c) !== "td" || attrNames(c).length || (kidsOf(c).length && !onlyInline(c))) return false;
        cells.push(inlineMd(c));
      }
      rows.push({ cells });
    }
    if (!head.length || !rows.length) return false;
    sc.head = head;
    sc.rows = rows;
    return true;
  }
  if (n.flow) {
    const extra = attrNames(el).filter((a) => a !== "class" && !(a === "style" && ctx.ignoreStyle));
    if (t !== "div" || clsOf(el) !== "fl-block" || extra.length) return false;
    const tr = kidsOf(el);
    if (tr.length !== 1 || tag(tr[0]) !== "div" || clsOf(tr[0]) !== "fl-block__track") return false;
    const sp = kidsOf(tr[0]);
    const nodes = [];
    const seps = new Set();
    for (let i2 = 0; i2 < sp.length; i2++) {
      const x = sp[i2];
      const want = i2 % 2 === 0 ? "fl-block__node" : "fl-block__sep";
      if (tag(x) !== "span" || clsOf(x) !== want || kidsOf(x).length || attrNames(x).some((a) => a !== "class")) return false;
      if (i2 % 2 === 0) nodes.push(text1(x));
      else seps.add(text1(x));
    }
    if (!nodes.length || sp.length % 2 === 0 || seps.size > 1) return false;
    sc[n.flow] = nodes;
    const sep = [...seps][0];
    if (sep && sep !== "→") sc[n.flow + "_sep"] = sep;
    return true;
  }
  if (t !== n.tag) return false;
  const want = n.cls || "";
  let got = clsOf(el);
  const m = /^\{(\w+)\}$/.exec(want);
  if (m) {
    const opts = spec.selects[m[1]].map((o) => o[0]);
    if (got === "" && opts.includes("_plain")) got = "_plain";
    if (!opts.includes(got)) return false;
    sc[m[1]] = got;
  } else if (got !== want) return false;
  const allowed = new Set(["class", ...Object.keys(n.af || {}), ...Object.keys(n.oaf || {}), ...Object.keys(n.sattr || {}), ...(n.ign || []), ...(ctx.ignoreStyle ? ["style"] : [])]);
  if (attrNames(el).some((a) => !allowed.has(a))) return false;
  for (const [a, f] of Object.entries(n.oaf || {})) if (el.getAttribute(a)) sc[f] = el.getAttribute(a);
  for (const [a, v] of Object.entries(n.sattr || {})) {
    const cur = el.getAttribute(a);
    if (cur !== null && cur !== v) return false;
  }
  for (const [a, f] of Object.entries(n.af || {})) sc[f] = el.getAttribute(a) || "";
  if (n.void) return !kidsOf(el).length;
  if (n.md) {
    let node = el;
    if (n.lead || n.tail) {
      node = el.cloneNode(true);
      let ks = kidsOf(node);
      if (n.lead) {
        if (!ks.length || tag(ks[0]) !== "span" || text1(ks[0]) !== n.lead || attrNames(ks[0]).length) return false;
        ks[0].remove();
        ks = kidsOf(node);
      }
      if (n.tail && ks.length && tag(ks[ks.length - 1]) === "span" && !attrNames(ks[ks.length - 1]).length) {
        const last = ks[ks.length - 1];
        let after = last.nextSibling;
        let stray = false;
        while (after) {
          if (after.nodeType === 3 && after.data.trim()) stray = true;
          after = after.nextSibling;
        }
        if (!stray) {
          sc[n.tail] = text1(last);
          last.remove();
        }
      }
    }
    if (kidsOf(node).length && !onlyInline(node)) return false;
    sc[n.md] = inlineMd(node);
    return !!sc[n.md];
  }
  if (n.text) {
    if (kidsOf(el).length) return false;
    sc[n.text] = text1(el);
    return !!sc[n.text];
  }
  if (n.index) {
    const want2 = String(ctx.idx + 1).padStart(n.index === "pad2" ? 2 : 1, "0");
    return !kidsOf(el).length && text1(el) === want2;
  }
  if (n.kids) {
    if (hasStrayText(el)) return false;
    return matchChildren(n.kids, kidsOf(el), sc, spec, ctx);
  }
  if (n.static) return !kidsOf(el).length && !text1(el);
  return false;
}

/** Чи є елемент вставкою з каталогу → { type, ...дані } або null. */
export function matchInsert(el, ctx = {}) {
  const c = { cta: { action: "price", attrs: true }, ignoreStyle: true, idx: 0, ...ctx };
  for (const sp of INSERT_SPECS) {
    const sc = {};
    try {
      if (matchOne(sp.root, el, sc, sp, c)) return { type: sp.name, ...sc };
    } catch {
      /* пропускаємо */
    }
  }
  return null;
}

// ---------------- HTML → дерево елементів ----------------
function attrsOf(el) {
  const a = {};
  for (const at of Array.from(el.attributes)) if (at.name !== "class") a[at.name] = at.value;
  return a;
}

export function elementFromNode(el, ctx = {}) {
  const t = tag(el);
  const kids = kidsOf(el);
  const c = clsOf(el);
  const names = attrNames(el);
  if (isCta(el)) return { t: "cta", inline: false, ...ctaInfo(el) };
  if (t === "div" && c === "ec-inline-cta" && kids.length === 1 && isCta(kids[0]) && names.every((a) => a === "class" || a === "style")) {
    return { t: "cta", inline: true, ...ctaInfo(kids[0]), ...(el.getAttribute("style") ? { style: el.getAttribute("style") } : {}) };
  }
  const ins = matchInsert(el, ctx);
  if (ins) return { t: "ins", ...ins };
  if (t === "p" && names.every((a) => a === "class" || a === "style") && onlyInline(el) && el.textContent.trim()) {
    return { t: "p", md: inlineMd(el), ...(c ? { cls: c } : {}), ...(el.getAttribute("style") ? { style: el.getAttribute("style") } : {}) };
  }
  if (t === "ul" && names.every((a) => a === "class" || a === "style") && kids.length && kids.every((li) => tag(li) === "li" && onlyInline(li) && attrNames(li).length === 0)) {
    return { t: "ul", items: kids.map(inlineMd), ...(c ? { cls: c } : {}), ...(el.getAttribute("style") ? { style: el.getAttribute("style") } : {}) };
  }
  const base = { t: "el", tag: t, ...(c ? { cls: c } : {}) };
  const attrs = attrsOf(el);
  if (Object.keys(attrs).length) base.attrs = attrs;
  if (VOID.has(t)) return base;
  if (t === "script" || t === "style") return { t: "raw", html: el.outerHTML };
  if (!el.childNodes.length) return base;
  if (onlyInline(el)) {
    const md = inlineMd(el);
    return md ? { ...base, md } : base;
  }
  return { ...base, kids: toElements(el, ctx) };
}

export function toElements(parent, ctx = {}) {
  const out = [];
  for (const n of Array.from(parent.childNodes)) {
    if (n.nodeType === 3) {
      const tx = n.data.replace(/\s+/g, " ").trim();
      if (tx) out.push({ t: "txt", md: escMd(tx) });
    } else if (n.nodeType === 1) out.push(elementFromNode(n, ctx));
  }
  return out;
}

/** Корінь блоку (HTML-елемент) → вільний блок. */
export function freeFromRoot(root, ctx = {}) {
  const a = attrsOf(root);
  const c = clsOf(root);
  return { type: "free", tag: tag(root), ...(c ? { cls: c } : {}), ...(Object.keys(a).length ? { attrs: a } : {}), elements: toElements(root, ctx) };
}
