import MarkdownIt from "markdown-it";

export const md = new MarkdownIt({ html: true, breaks: true });
export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const rich = (s) => md.render(s || ""); // абзаци
export const inl = (s) => md.renderInline(String(s || "").trim()); // в рядку (жирний, курсив)
export const plain = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/[*_\\]/g, "").replace(/\s+/g, " ").trim();

const LIST_LINE = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;
export const hasList = (s) => String(s ?? "").split("\n").some((line) => LIST_LINE.test(line));

/**
 * Текстове поле з підтримкою маркованого списку.
 * Без списку — звичайний inl(), тобто наявні сторінки рендеряться як раніше.
 * Зі списком — абзаци й <ul>; перший абзац повертаємо без <p>, щоб результат
 * можна було вставляти і в <p>, і в <div>/<li> (браузер сам закриє <p> перед <ul>).
 */
export function inlWithLists(src, ulcls = "ec-check-list") {
  const s = String(src ?? "");
  if (!hasList(s)) return inl(s);
  let html = renderBody(s, ulcls);
  if (html.startsWith("<p>")) html = html.slice(3).replace(/<\/p>/, "");
  return html;
}

/**
 * Абзац із підтримкою списку. Звичайний текст лишається <p> (як і раніше),
 * а для списку використовуємо <div> з тими самими класами — <ul> не можна
 * вкладати в <p>, інакше браузер закриє абзац і список втратить стилі блоку.
 */
export function paraWithLists(src, attrs = "", ulcls = "ec-check-list") {
  return hasList(src) ? `<div${attrs}>${renderBody(src, ulcls)}</div>` : `<p${attrs}>${inl(src)}</p>`;
}

/**
 * Текст з редактора (markdown) → <p> та <ul>. Підтримує: абзаци, маркований список, **жирний**, *курсив*.
 * ulcls — CSS-клас для <ul> (напр. "ec-check-list").
 */
export function renderBody(src, ulcls = "ec-check-list") {
  const tokens = md.parse(String(src || ""), {});
  const out = [];
  const cls = ulcls ? ` class="${esc(ulcls)}"` : "";
  const text = (t) => md.renderer.renderInline(t.children || [], md.options, {});
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "paragraph_open") {
      out.push(`<p>${text(tokens[i + 1])}</p>`);
      i += 2;
    } else if (t.type === "bullet_list_open" || t.type === "ordered_list_open") {
      const items = [];
      let depth = 1;
      i++;
      while (i < tokens.length && depth > 0) {
        const x = tokens[i];
        if (x.type === "bullet_list_open" || x.type === "ordered_list_open") depth++;
        else if (x.type === "bullet_list_close" || x.type === "ordered_list_close") depth--;
        else if (x.type === "inline" && depth === 1) items.push(`<li>${text(x)}</li>`);
        i++;
      }
      i--;
      out.push(`<ul${cls}>${items.join("")}</ul>`);
    } else if (t.type === "heading_open") {
      out.push(`<p>${text(tokens[i + 1])}</p>`);
      i += 2;
    }
  }
  return out.join("\n    ");
}

/** Кнопка запису. action: "price" — форма заявки, "booking" — календар. attrs — data-атрибути продукту. */
export function cta(page, text, light = false, action = "booking", attrs = true, style = "") {
  const k = page.booking || {};
  const data = attrs
    ? `
         data-product="${esc(k.product)}"
         data-price="${esc(k.price || "")}"
         data-pay-link="${esc(k.pay_link || "")}"
         data-send-email="${k.send_email === false ? "false" : "true"}"
         data-email-template="${esc(k.email_template || "free")}"
         data-redirect="${k.redirect ? "true" : "false"}"`
    : "";
  const fn = action === "price" ? "openPricePopup(event)" : "openBookingModal(event)";
  return `<div class="ec-booking-card card"${data}${style ? ` style="${esc(style)}"` : ""}>
        <button class="ec-main-btn${light ? " ec-main-btn--light" : ""}" onclick="${fn}">
          ${esc(text || "ЗАПИСАТИСЯ")}
        </button>
      </div>`;
}
