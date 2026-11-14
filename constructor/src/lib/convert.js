// Перетворення будь-якого блоку у «вільний» (дерево елементів) та HTML → елементи.
import { freeFromRoot, toElements } from "../../../src/_includes/product/dom-tree.js";
import { renderBlockHtml } from "./render.js";

const parse = (html) => new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
const ctxOf = (page) => ({ cta: page?.cta || { action: "price", attrs: true }, ignoreStyle: false });

export function htmlToFree(html, page) {
  const doc = parse(html);
  const roots = Array.from(doc.body.children);
  if (roots.length === 1 && Array.from(doc.body.childNodes).every((n) => n === roots[0] || (n.nodeType === 3 && !n.data.trim()) || n.nodeType === 8)) {
    return freeFromRoot(roots[0], ctxOf(page));
  }
  return { type: "free", tag: "", elements: toElements(doc.body, ctxOf(page)) };
}

export function htmlToElements(html, page) {
  return toElements(parse(html).body, ctxOf(page));
}

export function blockToFree(block, page) {
  const html = block.type === "raw" ? block.html : renderBlockHtml(block, page, { faqUsed: true });
  return htmlToFree(html, page);
}

/** Які блоки можна розібрати на елементи (FAQ має власний редактор і дані для Google). */
export const canFree = (b) => b && b.type !== "faq" && b.type !== "free";
