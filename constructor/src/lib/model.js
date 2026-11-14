import { clone, newBlock } from "./schema.js";

const UK = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ы: "y", э: "e", ё: "io", ъ: "" };
export function slugify(title) {
  return String(title || "").toLowerCase().split("").map((c) => (UK[c] !== undefined ? UK[c] : c)).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "nova-storinka";
}

export function newPageData({ title, slug, product }) {
  return {
    slug, title: `${title} | Ірина Стецуріна`, description: "", og_title: "", og_description: "", og_image: "",
    css: "/css/new-pages.css",
    hero: { image: "/assets/images/hero.jpg", alt: "", title: title.toUpperCase(), headline: "", headline_tag: "h1", sub: "", br: true },
    breadcrumb: title,
    booking: { product: product || title, price: "", pay_link: "", email_template: "free", send_email: true, redirect: false },
    cta: { action: "price", attrs: true },
    jsonld_head: [], 
    blocks: ["intro", "text", "faq", "final"].map((t) => newBlock(t)),
  };
}

export function moveItem(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return i;
  const [x] = arr.splice(i, 1);
  arr.splice(j, 0, x);
  return j;
}
export const removeItem = (arr, i) => arr.splice(i, 1);
export const insertAt = (arr, i, item) => arr.splice(i, 0, item);
export const duplicateItem = (arr, i) => arr.splice(i + 1, 0, clone(arr[i]));

/** Нова картка/пункт: копія останнього (щоб одразу була видна структура). */
export function newListItem(list, empty) {
  return list.length ? clone(list[list.length - 1]) : empty;
}

export function newHomeCard() {
  return { title: "Нова послуга", image: "/assets/images/hero.jpg", description: "Короткий опис послуги.", link: "", button_action: "price", button_label: "Записатися", price: "", pay_link: "", email_template: "free", send_email: true, redirect: false };
}
export function newHomeSection() {
  return { id: "new-section", title: "Новий розділ", subtitle: "", cards: [newHomeCard()] };
}
