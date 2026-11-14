// Форми блоків: з каталогу (той самий, що будує сайт) отримуємо поля для редактора.
import catalog from "../../../src/_includes/product/catalog.json" with { type: "json" };

export const CATALOG = catalog;
export const SPEC = Object.fromEntries(catalog.map((s) => [s.name, s]));
export const INSERTS = catalog.filter((s) => s.group === "insert");

export const clone = (o) => JSON.parse(JSON.stringify(o ?? null));

const LABELS = {
  title: "Заголовок", text: "Текст", body: "Текст", intro: "Вступ", kicker: "Надзаголовок (малий напис над заголовком)",
  items: "Пункти", cards: "Картки", cta_text: "Текст кнопки", note: "Примітка", label: "Підпис", value: "Значення",
  num: "Номер", quote: "Цитата", author: "Автор", role: "Роль", photo: "Фото", photo_alt: "Підпис до фото (для Google)",
  name: "Назва", desc: "Опис", sub: "Підзаголовок", tag: "Мітка", link: "Посилання", mark: "Значок", variant: "Вигляд",
  key: "Назва", val: "Значення", n: "Номер", l: "Підпис", sep: "Роздільник", step: "Крок", time: "Час",
};

function label(spec, name) {
  if (name === "_") return "Текст";
  if (spec.labels?.[name]) return spec.labels[name];
  if (LABELS[name]) return LABELS[name];
  const m = /^([a-z_]+?)(\d+)$/.exec(name);
  if (m && LABELS[m[1]]) return `${LABELS[m[1]]} ${m[2]}`;
  return "Текст (" + name.replace(/_/g, " ") + ")";
}

const optLabel = (l) => (l.startsWith("-") ? "Варіант " + l.replace(/^-+/, "") : l);

function add(out, seen, f) {
  if (seen.has(f.name)) return;
  seen.add(f.name);
  out.push(f);
}

function walk(n, spec, out, seen) {
  if (n.inserts) return add(out, seen, { kind: "inserts", name: n.inserts, label: "Вставки (додаткові елементи в цьому блоці)", hint: "Чіпи, примітки, цифри, таблиця, схема кроків…" });
  if (n.body) return add(out, seen, { kind: "body", name: n.body, label: label(spec, n.body), hint: "Виділіть слово і натисніть Ж — буде жирним." });
  if (n.cta || n.btn) {
    const f = n.cta || n.btn;
    return add(out, seen, { kind: "string", name: f, label: label(spec, f), optional: true });
  }
  if (n.table) {
    add(out, seen, { kind: "list", name: "head", label: "Заголовки стовпців", item: { kind: "string" } });
    return add(out, seen, { kind: "list", name: "rows", label: "Рядки таблиці", fields: [{ kind: "list", name: "cells", label: "Клітинки (по порядку стовпців)", item: { kind: "string" } }], titleOf: "cells" });
  }
  if (n.flow) {
    add(out, seen, { kind: "list", name: n.flow, label: label(spec, n.flow), item: { kind: "string" }, optional: true });
    return add(out, seen, { kind: "string", name: n.flow + "_sep", label: "Знак між пунктами схеми (за замовчуванням →)", optional: true, advanced: true });
  }
  if (n.each) {
    const sub = [];
    walkChildren(n, spec, sub, new Set());
    if (sub.length === 1 && sub[0].name === "_") {
      return add(out, seen, { kind: "list", name: n.each, label: label(spec, n.each), item: { kind: sub[0].kind === "string" ? "string" : "md" } });
    }
    return add(out, seen, { kind: "list", name: n.each, label: label(spec, n.each), fields: sub, titleOf: sub.find((f) => f.kind === "string" || f.kind === "md")?.name });
  }
  walkChildren(n, spec, out, seen);
}

function walkChildren(n, spec, out, seen) {
  const m = /^\{(\w+)\}$/.exec(n.cls || "");
  if (m && spec.selects?.[m[1]]) {
    const opts = spec.selects[m[1]];
    add(out, seen, { kind: "select", name: m[1], label: spec.labels?.[m[1]] || "Вигляд", options: opts.map(([value, l]) => ({ value, label: optLabel(l) })) });
  }
  if (n.md) {
    const name = n.md;
    add(out, seen, name === "title"
      ? { kind: "string", name, label: label(spec, name), hint: "Для переносу рядка напишіть <br>" }
      : { kind: "md", name, label: label(spec, name), optional: true });
  }
  if (n.text) add(out, seen, { kind: "string", name: n.text, label: label(spec, n.text), optional: true });
  for (const [a, f] of Object.entries(n.oaf || {})) add(out, seen, { kind: "string", name: f, label: label(spec, f), optional: true, advanced: true });
  if (n.tail) add(out, seen, { kind: "string", name: n.tail, label: label(spec, n.tail), optional: true });
  for (const [a, f] of Object.entries(n.af || {})) add(out, seen, { kind: a === "src" ? "image" : "string", name: f, label: label(spec, f), optional: a !== "src" });
  for (const k of n.kids || []) walk(k, spec, out, seen);
}

const cache = new Map();
/** Поля блоку за типом (з каталогу або вбудовані). */
export function fieldsOf(type) {
  if (CUSTOM[type]) return CUSTOM[type].fields;
  if (cache.has(type)) return cache.get(type);
  const spec = SPEC[type];
  if (!spec) return null;
  const out = [];
  walk(spec.root, spec, out, new Set());
  cache.set(type, out);
  return out;
}

// ---- Вбудовані типи (поза каталогом) ----
const S = (name, label, extra = {}) => ({ kind: "string", name, label, ...extra });
export const CUSTOM = {
  intro: {
    label: "Вступ (фото + текст + кнопка)", group: "Основні",
    sample: { type: "intro", image: "/assets/images/hero.jpg", image_alt: "", kicker: "ПРО ПОСЛУГУ", title: "Назва послуги", body: "Коротко про те, що отримає клієнт.", meta: [{ label: "Формат", value: "онлайн" }, { label: "Тривалість", value: "60 хвилин" }], cta_text: "ЗАПИСАТИСЯ" },
    fields: [
      { kind: "image", name: "image", label: "Фото" }, S("image_alt", "Підпис до фото (для Google)", { optional: true, advanced: true }),
      S("kicker", "Надзаголовок", { optional: true }), S("title", "Заголовок", { hint: "Для переносу рядка напишіть <br>" }),
      { kind: "body", name: "body", label: "Текст", hint: "Виділіть слово і натисніть Ж — буде жирним." },
      { kind: "list", name: "meta", label: "Дані під текстом (формат, тривалість…)", fields: [S("label", "Назва"), S("value", "Значення")], titleOf: "label", optional: true },
      S("cta_text", "Текст кнопки", { optional: true }),
    ],
  },
  faq: {
    label: "Питання і відповіді (FAQ)", group: "Основні",
    sample: { type: "faq", kicker: "FAQ", title: "Часті питання", items: [{ question: "Перше питання?", answer: "Відповідь. Важливе слово можна виділити **жирним**." }, { question: "Друге питання?", answer: "Відповідь." }] },
    fields: [S("kicker", "Надзаголовок", { optional: true }), S("title", "Заголовок"),
      { kind: "list", name: "items", label: "Питання", fields: [S("question", "Питання"), { kind: "md", name: "answer", label: "Відповідь" }], titleOf: "question" }],
  },
  final: {
    label: "Завершення (заклик + кнопка)", group: "Основні",
    sample: {
      type: "final",
      title: "Готові почати?",
      cta_text: "ЗАПИСАТИСЯ",
      elements: [
        { t: "p", md: "Запишіться — і разом знайдемо рішення." },
        { t: "p", md: "Короткий додатковий текст дрібнішим шрифтом.", cls: "diagnostic-final-small" },
      ],
    },
    // Поля показуються у FormPanel окремо + ElementsEditor для elements
    fields: [
      S("title", "Заголовок", { hint: "Для переносу рядка напишіть <br>" }),
      S("cta_text", "Текст кнопки", { optional: true }),
    ],
  },
  free: {
    label: "Вільний блок (будь-який вміст: текст, вставки, фото, кнопки)", group: "Основні", fields: [],
    sample: {
      type: "free", tag: "section", cls: "ec-detail ec-animate",
      elements: [{ t: "el", tag: "div", cls: "ec-detail__single", kids: [
        { t: "el", tag: "div", cls: "ec-section-heading", kids: [{ t: "el", tag: "p", cls: "ec-kicker", md: "НАДЗАГОЛОВОК" }, { t: "el", tag: "h2", md: "Заголовок блоку" }] },
        { t: "p", md: "Текст блоку. Додавайте абзаци, списки, фото, кнопки та вставки — і міняйте їх місцями." },
      ] }],
    },
  },
  section: {
    hidden: true,
    label: "Особливий блок (секція)", group: "Основні",
    sample: {
      type: "section",
      cls: "st-block ec-animate",
      id: "",
      heading: "block",
      kicker: "НАДЗАГОЛОВОК",
      title: "Заголовок секції",
      elements: [{ t: "p", md: "Текст секції." }],
    },
    fields: [
      S("id", "Якір (id) для посилання /#id", { optional: true, advanced: true }),
      S("cls", "CSS-класи секції", { optional: true, advanced: true }),
      S("kicker", "Надзаголовок", { optional: true }),
      S("title", "Заголовок", { optional: true, hint: "Для переносу рядка напишіть <br>" }),
      {
        kind: "select",
        name: "heading",
        label: "Як показувати заголовок",
        options: [
          { value: "block", label: "Окремим блоком" },
          { value: "inline", label: "В рядок" },
          { value: "none", label: "Без заголовка (тільки вміст)" },
        ],
        optional: true,
      },
    ],
  },
};

const INSERT_NAMES = {
  chips: "Мітки-чіпи", pill_meta: "Короткі факти (капсули)", label_row: "Ряд міток", split_inline: "Рядок через роздільник", call_out: "Виноска",
  note_line: "Рядок-примітка", soft_box: "М’яка плашка", highlight_line: "Виділений рядок", star_list: "Список із зірочками", arrow_list: "Список зі стрілками",
  bullet_tight: "Щільний список", icon_list: "Список з іконками", kv_list: "Пари «назва — значення»", price_tag: "Ціна", step_num: "Нумерований крок",
  metric_pill_row: "Цифри-капсули", avatar_row: "Ряд з аватарами", link_row: "Посилання", text_cols: "Текст у колонках", caption: "Підпис",
  badge_title: "Заголовок із бейджем", divider_label: "Розділювач із написом", hr_soft: "М’яка лінія",
  table: "Таблиця", flow_track: "Схема кроків (А → Б → В)", formula_line: "Формула", note_para: "Примітка-абзац", result_line: "Рядок «Результат: …»",
};
export function typeLabel(type) {
  return INSERT_NAMES[type] || CUSTOM[type]?.label || SPEC[type]?.label || (type === "section" ? "Особливий блок" : type === "raw" ? "Свій HTML" : type);
}

/** Групи для вікна «Додати блок». */
export function galleryGroups() {
  const pick = (g) => catalog.filter((s) => s.group === g).map((s) => ({ type: s.name, label: s.label }));
  return [
    { title: "Основні", items: Object.entries(CUSTOM).filter(([, c]) => !c.hidden).map(([type, c]) => ({ type, label: c.label })) },
    { title: "Бібліотека прикладів", items: pick("example") },
    { title: "Блоки зі сторінок сайту", items: pick("page") },
  ];
}

/** Порожнє значення для поля. */
export function emptyFor(fields) {
  const o = {};
  for (const f of fields) {
    if (f.kind === "list") o[f.name] = [];
    else if (f.kind === "select") o[f.name] = f.options[0].value;
    else if (f.kind === "inserts") continue;
    else o[f.name] = "";
  }
  return o;
}

/** Новий блок із прикладом тексту, щоб одразу було видно, як виглядає. */
export function newBlock(type) {
  if (CUSTOM[type]) return clone(CUSTOM[type].sample);
  const spec = SPEC[type];
  const b = { type, ...clone(spec?.sample || {}) };
  for (const f of fieldsOf(type) || []) if (b[f.name] === undefined && f.kind !== "inserts") Object.assign(b, { [f.name]: emptyFor([f])[f.name] });
  return b;
}

export function newInsert(type) {
  const spec = SPEC[type];
  const it = { type, ...clone(spec?.sample || {}) };
  for (const f of fieldsOf(type) || []) if (it[f.name] === undefined && f.kind !== "inserts") Object.assign(it, { [f.name]: emptyFor([f])[f.name] });
  return it;
}

const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/[*_\\]/g, "").replace(/\s+/g, " ").trim();
/** Короткий підпис блоку для списку структури. */
export function blockTitle(b) {
  for (const k of ["title", "text", "quote", "intro", "intro_title", "kicker", "label", "body", "html"]) {
    const v = typeof b[k] === "string" ? strip(b[k]) : "";
    if (v) return v.length > 46 ? v.slice(0, 46) + "…" : v;
  }
  return "";
}
