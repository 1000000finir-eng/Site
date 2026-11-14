// Попередній перегляд у CMS: ті самі шаблони, що й на сайті.
import { renderBlocks } from "../src/_includes/product/blocks.js";
import { renderHero } from "../src/_includes/product/hero.js";
import { renderSections } from "../src/_includes/home-render.js";
import { FIX_CSS } from "./preview-fix.generated.js";

const FIX = `<style>${FIX_CSS}</style>`;
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">`;
const css = (href) => `<link rel="stylesheet" href="${href}">`;

const toData = (entry) => {
  const raw = entry && typeof entry.toJS === "function" ? entry.toJS() : entry || {};
  return raw.data ?? raw;
};
const view = (html) => {
  const h = window.h || window.createElement;
  return h("div", { dangerouslySetInnerHTML: { __html: html } });
};
const safe = (fn) => {
  try {
    return fn();
  } catch (e) {
    return `<p style="font:14px sans-serif;color:#a00;padding:16px">Заповніть поля блоку — попередній перегляд з’явиться автоматично.<br><small>${String(e.message || e)}</small></p>`;
  }
};

const PagePreview = ({ entry }) => {
  const p = toData(entry);
  const body = safe(() => renderHero(p) + renderBlocks(p));
  return view(`${FONTS}${css("/style.css")}${css("/css/library.css")}${css("/booking/booking.css")}${css(p.css || "/css/new-pages.css")}${FIX}${body}`);
};
const HomePreview = ({ entry }) => {
  const d = toData(entry);
  return view(`${FONTS}${css("/style.css")}${FIX}${safe(() => renderSections(d))}`);
};

if (window.CMS) {
  window.CMS.registerPreviewTemplate("pages", PagePreview);
  window.CMS.registerPreviewTemplate("sections", HomePreview);
}
