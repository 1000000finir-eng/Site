import { esc, inl, inlWithLists, paraWithLists, rich, plain, cta, renderBody } from "./lib.js";
import { renderSpec } from "./dsl.js";
import catalog from "./catalog.json" with { type: "json" };

export { esc };

function heading(b) {
  if (!b.kicker && !b.title) return "";
  return `<div class="ec-section-heading">
      ${b.kicker ? `<p class="ec-kicker">${esc(b.kicker)}</p>` : ""}
      ${b.title ? `<h2>${inl(b.title)}</h2>` : ""}
    </div>`;
}

// Кнопка запису. Атрибути data-* беруться зі сторінки — бекенд отримує ті самі дані, що й раніше.


// ---------- Універсальні елементи всередині секцій ----------
const clsAttr = (c) => (c ? ` class="${esc(c)}"` : "");
const VOID_TAGS = new Set(["img", "br", "hr", "input", "meta", "link"]);
const attrsHtml = (a) => Object.entries(a || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
const styleAttr = (st) => (st ? ` style="${esc(st)}"` : "");

const BY_NAME = Object.fromEntries(catalog.map((s) => [s.name, s]));

export function renderElements(list, page) {
  return (list || []).map((e) => renderElement(e, page)).join("\n    ");
}

function renderElement(e, page) {
  switch (e.t) {
    case "p":
      return paraWithLists(e.md, clsAttr(e.cls) + styleAttr(e.style));
    case "ul":
      return `<ul${clsAttr(e.cls)}${styleAttr(e.style)}>${(e.items || []).map((i) => `\n      <li>${inl(i)}</li>`).join("")}\n    </ul>`;
    case "note":
      return `<div${clsAttr(e.cls || "soft-box")}${styleAttr(e.style)}>${inlWithLists(e.md)}</div>`;
    case "cta":
      return e.inline
        ? `<div class="ec-inline-cta"${styleAttr(e.style)}>${cta(page, e.text, e.light, e.action, e.attrs !== false, e.card_style)}</div>`
        : cta(page, e.text, e.light, e.action, e.attrs !== false, e.card_style);
    case "steps":
      return `<div class="ec-steps">${(e.items || []).map((it, i) => `
      <article class="ec-step">
        <div class="ec-step__num">${i + 1}</div>
        <h3>${inl(it.title)}</h3>
        ${paraWithLists(it.text)}
      </article>`).join("")}
    </div>`;
    case "how":
      return `<div class="ec-how__grid">${(e.items || []).map((it, i) => `
      <div><span>${i + 1}</span>${paraWithLists(it)}</div>`).join("")}
    </div>`;
    case "cards":
      return `<div${clsAttr(e.cls)}${styleAttr(e.style)}>${(e.cards || []).map((c) => `
      <article${clsAttr(c.cls)}>
        <h3>${inl(c.title)}</h3>
        ${renderElements(c.elements, page)}
      </article>`).join("")}
    </div>`;
    case "txt":
      return inlWithLists(e.md);
    case "el": {
      const open = `<${e.tag}${clsAttr(e.cls)}${attrsHtml(e.attrs)}>`;
      if (VOID_TAGS.has(e.tag)) return open;
      if (e.tag === "p" && !Array.isArray(e.kids) && e.md) return paraWithLists(e.md, clsAttr(e.cls) + attrsHtml(e.attrs));
      const inner = Array.isArray(e.kids) ? renderElements(e.kids, page) : e.md ? (/^h[1-6]$/i.test(e.tag) ? inl(e.md) : inlWithLists(e.md)) : "";
      return `${open}${inner}</${e.tag}>`;
    }
    case "raw":
      return e.html;
    case "ins": {
      // Вставка з бібліотеки всередині elements (лего)
      const spec = BY_NAME[e.type];
      if (!spec) return `<!-- unknown insert ${esc(e.type)} -->`;
      const mark = globalThis.__insMark ? globalThis.__insMark(e) : "";
      return mark + renderSpec(spec, e, page, BY_NAME);
    }
    default:
      // Якщо t збігається з іменем вставки з каталогу — теж рендеримо як вставку
      if (BY_NAME[e.t] && BY_NAME[e.t].group === "insert") {
        const mark = globalThis.__insMark ? globalThis.__insMark(e) : "";
        return mark + renderSpec(BY_NAME[e.t], e, page, BY_NAME);
      }
      throw new Error(`Невідомий елемент "${e.t}"`);
  }
}

function sectionHeading(b) {
  if (!b.kicker && !b.title) return "";
  const k = b.kicker ? `<p class="ec-kicker">${esc(b.kicker)}</p>` : "";
  const t = b.title ? `<h2${styleAttr(b.title_style)}>${inl(b.title)}</h2>` : "";
  return b.heading === "inline" ? `${k}\n    ${t}` : `<div class="ec-section-heading"${styleAttr(b.heading_style)}>\n      ${k}\n      ${t}\n    </div>`;
}

function renderSection(b, page) {
  const id = b.id ? ` id="${esc(b.id)}"` : "";
  const body = `${sectionHeading(b)}\n    ${renderElements(b.elements, page)}`;
  let inner;
  if (b.wrap === "expertise") {
    inner = `<div class="ec-detail__expertise">
    <div class="${esc(b.single_cls || "ec-detail__single")}">
    ${body}
    </div>
    <div class="ec-detail__photo"><img src="${esc(b.photo)}" alt="${esc(b.photo_alt || "")}"></div>
  </div>`;
  } else if (b.wrap) {
    inner = `<div class="${esc(b.wrap)}">\n    ${body}\n  </div>`;
  } else {
    inner = body;
  }
  return `<section${id} class="${esc(b.cls)}">\n  ${inner}\n</section>`;
}

export const renderers = {
  intro: (b, page) => `<section class="ec-intro ec-animate">
  <div class="ec-intro__grid">
    <div class="ec-intro__media">
      <img src="${esc(b.image)}" alt="${esc(b.image_alt || "")}">
    </div>
    <div class="ec-intro__content">
      ${b.kicker ? `<p class="ec-kicker">${esc(b.kicker)}</p>` : ""}
      ${b.title ? `<h2>${inl(b.title)}</h2>` : ""}
      ${b.body ? renderBody(b.body, "ec-check-list") : b.elements ? renderElements(b.elements, page) : rich(b.text)}
      ${(b.meta || []).length ? `<div class="ec-product-meta">${b.meta.map((m) => `
        <div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join("")}
      </div>` : ""}
      ${b.cta_text ? cta(page, b.cta_text, false, (b.cta_action ?? page.cta?.action ?? "price"), (b.cta_attrs ?? page.cta?.attrs ?? true), b.cta_style) : ""}
      ${b.after ? renderElements(b.after, page) : ""}
    </div>
  </div>
</section>`,

  faq: (b, page, ctx) => {
    const id = ctx.faqUsed ? "" : ' id="faq"';
    ctx.faqUsed = true;
    return `<section${id} class="ec-animate">
  ${heading(b)}
  <div class="faq-list">${(b.items || []).map((it) => `
    <div class="faq-item">
      <div class="faq-question">
        ${esc(it.question)}
        <img class="faq-icon" src="/assets/icons/faq-arrow.png" alt="розгорнути">
      </div>
      <div class="faq-answer">
        ${inlWithLists(it.answer)}
      </div>
    </div>`).join("")}
  </div>
</section>`;
  },

  section: (b, page) => renderSection(b, page),

  raw: (b) => b.html,

  // Вільний блок: довільне дерево елементів
  free: (b, page) => {
    const inner = renderElements(b.elements, page);
    return b.tag ? `<${b.tag}${clsAttr(b.cls)}${attrsHtml(b.attrs)}>\n    ${inner}\n</${b.tag}>` : inner;
  },

  final: (b, page) => `<section class="ec-final ec-animate">
  <div class="ec-final__box">
    <h2>${inl(b.title)}</h2>
    ${b.body ? renderBody(b.body, "") : b.elements ? renderElements(b.elements, page) : b.text ? `<p>${inl(b.text)}</p>` : ""}
    ${b.cta_text ? cta(page, b.cta_text, true, (b.cta_action ?? page.cta?.action ?? "price"), (b.cta_attrs ?? page.cta?.attrs ?? true), b.cta_style) : ""}
  </div>
</section>`,
};

for (const spec of catalog) {
  if (spec.group === "insert") continue;
  renderers[spec.name] = (b, page) => renderSpec(spec, b, page, BY_NAME);
}
export const CATALOG = catalog;

export function renderBlocks(page) {
  const ctx = { faqUsed: false };
  return (page.blocks || [])
    .map((b) => {
      const fn = renderers[b.type];
      if (!fn) throw new Error(`Невідомий тип блоку "${b.type}" на сторінці ${page.slug}`);
      return fn(b, page, ctx);
    })
    .join("\n\n");
}

export function faqSchema(page) {
  const items = (page.blocks || []).filter((b) => b.type === "faq").flatMap((b) => b.items || []);
  if (!items.length) return "";
  return `<script type="application/ld+json">\n${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: plain(it.question),
      acceptedAnswer: { "@type": "Answer", text: plain(it.answer) },
    })),
  }, null, 2)}\n</script>`;
}

export function serviceSchema(page, origin) {
  const sv = page.service || {};
  const url = `${origin}/${page.slug}/`;
  const obj = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.booking?.product || page.title,
    description: sv.description || page.description,
    url,
    ...(sv.image ? { image: origin + sv.image } : {}),
    provider: { "@type": "Person", name: "Ірина Стецуріна", url: origin + "/" },
    areaServed: "UA",
    ...(sv.service_type ? { serviceType: sv.service_type } : {}),
    ...(sv.price_number ? { offers: { "@type": "Offer", price: String(sv.price_number), priceCurrency: "UAH", url } } : {}),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}
