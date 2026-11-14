import fs from "node:fs";
import { esc, renderBlocks, faqSchema, serviceSchema } from "./_includes/product/blocks.js";
import { renderHero } from "./_includes/product/hero.js";

const ORIGIN = "https://i-s-business-consulting.pp.ua";
const ld = (list) => list.map((o) => o && o.raw !== undefined ? `<script type="application/ld+json">${o.raw}</script>` : `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join("\n");
const jsEsc = (v) => JSON.stringify(String(v ?? "")).slice(1, -1);
const fillForm = (t, p) => {
  const k = p.booking || {};
  return t
    .replace("{{PRODUCT}}", jsEsc(k.product))
    .replace("{{PRICE}}", jsEsc(k.price))
    .replace("{{PAY_LINK}}", jsEsc(k.pay_link))
    .replace("{{SEND_EMAIL}}", k.send_email === false ? "false" : "true")
    .replace("{{EMAIL_TEMPLATE}}", jsEsc(k.email_template || "free"))
    .replace("{{REDIRECT}}", k.redirect ? "true" : "false");
};
const readBottom = (f) => fs.readFileSync(`src/_content/bottoms/${f}`, "utf-8");
const read = (f) => fs.readFileSync(`src/_includes/product/${f}`, "utf-8");

export default class {
  data() {
    return {
      pagination: { data: "pages", size: 1, alias: "page" },
      permalink: (d) => `/${d.page.slug}/index.html`,
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const p = data.page;
    const url = `${ORIGIN}/${p.slug}/`;
    const h = p.hero || {};
    const hasFaq = (p.blocks || []).some((b) => b.type === "faq");
    const top = hasFaq
      ? read("top.tpl")
      : read("top.tpl").replace(/\s*<a href="#faq"[^>]*>FAQ<\/a>/, "");

    return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(p.og_title || p.title)}" />
  <meta property="og:description" content="${esc(p.og_description || p.description)}" />
  <meta property="og:image" content="${ORIGIN}${esc(p.og_image || h.image || "")}" />
  <meta property="og:locale" content="uk_UA" />

  <link rel="stylesheet" href="/style.css">
${p.booking_css === false ? "" : '  <link rel="stylesheet" href="/booking/booking.css">'}
  <link rel="stylesheet" href="/css/library.css">
  <link rel="stylesheet" href="${esc(p.css || "/css/new-pages.css")}">

  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/favicon-180.png">
  <link rel="manifest" href="/site.webmanifest">

${p.jsonld_head ? ld(p.jsonld_head) : faqSchema(p) + "\n" + serviceSchema(p, ORIGIN)}
</head>

<body>

${top}
<!-- =========================================================
     HERO
========================================================= -->
${renderHero(p)}

<!-- =========================================================
     BREADCRUMB
========================================================= -->
<nav class="ec-breadcrumb" aria-label="Хлібні крихти">
  <a href="/">Головна</a>
  <span>→</span>
  <span>${esc(p.breadcrumb || p.booking?.product || p.title)}</span>
</nav>

${renderBlocks(p)}

${p.bottom_file ? readBottom(p.bottom_file) : p.cta?.action === "booking" ? read("bottom.tpl") : fillForm(read("bottom-form.tpl"), p)}

</body>
</html>
`;
  }
}
