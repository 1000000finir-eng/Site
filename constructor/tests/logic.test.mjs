// Перевірка логіки без Tauri: форми з каталогу, приклади блоків, реальні сторінки сайту.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { CATALOG, SPEC, fieldsOf, newBlock, newInsert, CUSTOM, galleryGroups, blockTitle, emptyFor } from "../src/lib/schema.js";
import { pageBody, homeBody, singleBody, buildDoc } from "../src/lib/render.js";
import { slugify, newPageData, moveItem } from "../src/lib/model.js";
import { inl, inlWithLists } from "../../src/_includes/product/lib.js";

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const root = path.resolve(import.meta.dirname, "../..");

// 1. Для кожного блоку і вставки з каталогу є форма
for (const s of CATALOG) {
  const f = fieldsOf(s.name);
  ok(Array.isArray(f), `форма для ${s.name}`);
}
// 2. Приклади блоків відтворюються без помилок і не порожні
const page = newPageData({ title: "Тест", slug: "test" });
for (const s of CATALOG.filter((x) => x.group !== "insert" && x.sample)) {
  const html = singleBody(newBlock(s.name), page);
  ok(!html.includes("неможливо показати"), `рендер ${s.name}`);
  ok(html.length > 60, `непорожній ${s.name}`);
}
for (const t of Object.keys(CUSTOM)) ok(!singleBody(newBlock(t), page).includes("неможливо показати"), `рендер ${t}`);
// 3. Вставки всередині блоку
const withIns = newBlock("text");
for (const s of CATALOG.filter((x) => x.group === "insert" && x.sample)) {
  withIns.inserts = [...(withIns.inserts || []), newInsert(s.name)];
}
ok(!singleBody(withIns, page).includes("неможливо показати"), "текст з усіма вставками");
// 4. Реальні сторінки: рендеряться, а кожне поле даних має поле в формі
const dir = path.join(root, "src/_content/pages");
let blocks = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
  const body = pageBody(p);
  ok(!body.includes("неможливо показати"), `сторінка ${f} рендериться`);
  for (const b of p.blocks) {
    blocks++;
    if (["final", "intro", "section", "free", "raw"].includes(b.type)) continue; // власні редактори (поля + елементи)
    const fields = fieldsOf(b.type);
    if (!fields) { ok(["section", "raw"].includes(b.type), `невідомий тип ${b.type} у ${f}`); continue; }
    const names = new Set(fields.map((x) => x.name));
    const hiddenOk = new Set(["type", "elements", "after", "text", "cta_action", "cta_attrs", "cta_style"]);
    for (const k of Object.keys(b)) ok(names.has(k) || hiddenOk.has(k), `поле ${k} блоку ${b.type} у ${f} не має форми`);
  }
}
// 5. Головна
const home = JSON.parse(fs.readFileSync(path.join(root, "src/_data/home.json"), "utf-8"));
ok(homeBody(home).includes('class="card'), "головна: картки");
// 6. Документ превʼю та утиліти
const doc = buildDoc({ body: pageBody(page), css: "body{}", selected: 1 });
ok(doc.includes('data-i="1"') && doc.includes("outline:3px"), "документ превʼю");
ok(slugify("Діагностична консультація") === "diahnostychna-konsultatsiia", "slugify: " + slugify("Діагностична консультація"));
const a = [1, 2, 3]; moveItem(a, 0, 1); ok(a.join() === "2,1,3", "moveItem");
ok(galleryGroups().every((g) => g.items.length), "галерея");
ok(blockTitle({ title: "**Привіт** світ" }) === "Привіт світ", "blockTitle");
// 7. Списки в текстових полях; заголовки позначені окремо й списку не отримують
ok(inlWithLists("Звичайний **текст**") === inl("Звичайний **текст**"), "без списку рендер не змінюється");
const listed = inlWithLists("Вступ\n- перший\n- другий");
ok(listed.includes("<ul>") && listed.includes("<li>перший</li>") && listed.startsWith("Вступ"), "markdown-список у текстовому полі");
const stFields = fieldsOf("st");
ok(stFields.find((f) => f.name === "intro_title")?.heading === true, "h3-поле — заголовок");
ok(stFields.find((f) => f.name === "result")?.heading !== true, "звичайне текстове поле не заголовок");
const hl = newBlock("hl");
hl.text = "Вступ\n- перший\n- другий";
ok(singleBody(hl, page).includes("<li>перший</li>"), "список рендериться в блоці");
ok(singleBody(hl, page).includes('<div class="hl-block__text"><p>Вступ</p>'), "список у абзаці зберігає клас блоку");
console.log(`✓ логіка конструктора: ${n} перевірок, перевірено ${blocks} блоків реальних сторінок`);
