// Панелі керування у перегляді та перенесення карток між розділами (без Tauri).
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { buildDoc, pageBody, homeBody, lastInserts } from "../src/lib/render.js";
import { decoratePage, decorateHome, markSelected } from "../src/lib/decorate.js";
import { newBlock, newInsert } from "../src/lib/schema.js";
import { newPageData } from "../src/lib/model.js";
import { moveCard } from "../src/lib/actions.js";

const root = path.resolve(__dirname, "../..");
const parse = (body) => new DOMParser().parseFromString(buildDoc({ body, css: "" }), "text/html");

describe("панелі у перегляді сторінки", () => {
  it("кнопки над блоками, «додати тут», вставки", () => {
    const page = newPageData({ title: "Тест", slug: "t" });
    const text = page.blocks.find((b) => b.type === "text");
    text.inserts = [newInsert("chips"), newInsert("call_out")];
    const doc = parse(pageBody(page));
    const calls = {};
    const spy = (n) => (...a) => ((calls[n] ||= []).push(a));
    const ctx = {
      inserts: lastInserts(), label: () => "Блок", hasInserts: (i) => page.blocks[i].type === "text",
      onSelect: spy("sel"), onMove: spy("mv"), onDup: spy("dup"), onDel: spy("del"), onAddAt: spy("add"), onAddInsert: spy("ai"),
      insertLabel: (it) => it.type, onEditInsert: spy("ei"), onMoveInsert: spy("mi"), onDelInsert: spy("di"),
    };
    decoratePage(doc, ctx);
    const n = page.blocks.length;
    expect(doc.querySelectorAll(".__bw > .__tb").length).toBe(n + 1); // блоки + hero
    expect(doc.querySelectorAll(".__add").length).toBe(n + 1);
    // «＋ Вставка» є лише у блоку з вставками
    const textIdx = page.blocks.indexOf(text);
    const tb = doc.querySelector(`.__bw[data-i="${textIdx}"] > .__tb`);
    const labels = [...tb.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels.some((l) => l.includes("Вставка"))).toBe(true);
    tb.querySelectorAll("button")[1].click();
    expect(calls.ai[0][0]).toBe(textIdx);
    // клік по кнопці «🗑» і «⧉»
    [...tb.querySelectorAll("button")].find((b) => b.textContent === "🗑").click();
    [...tb.querySelectorAll("button")].find((b) => b.textContent === "⧉").click();
    expect(calls.del[0][0]).toBe(textIdx);
    expect(calls.dup[0][0]).toBe(textIdx);
    // «додати блок тут» перед першим блоком
    doc.querySelectorAll(".__add")[0].click();
    expect(calls.add[0][0]).toBe(0);
    // клік по блоку → вибір
    doc.querySelector(`.__bw[data-i="${textIdx}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calls.sel.some((a) => a[0] === textIdx)).toBe(true);
    // вставки розпізнані й привʼязані до даних
    const ins = [...doc.querySelectorAll(".__ins")];
    expect(ins.length).toBe(2);
    expect(ins[0]._it).toBe(text.inserts[0]);
    // наведення на вставку показує панель
    ins[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const ft = doc.body.lastElementChild;
    expect(ft.style.display).toBe("flex");
    [...ft.querySelectorAll("button")][0].click();
    expect(calls.ei[0][0]).toBe(text.inserts[0]);
    expect(calls.ei[0][1]).toBe(textIdx);
    // виділення
    markSelected(doc, textIdx);
    expect(doc.querySelector(".__bw.sel").getAttribute("data-i")).toBe(String(textIdx));
  });
});

describe("головна: перетягування карток між розділами", () => {
  const home = () => JSON.parse(fs.readFileSync(path.join(root, "src/_data/home.json"), "utf-8"));

  it("moveCard: між розділами, в кінець, всередині розділу", () => {
    const h = home();
    const names = (i) => h.sections[i].cards.map((c) => c.title);
    const c0 = h.sections[0].cards[0].title;
    const total = h.sections.reduce((n, s) => n + s.cards.length, 0);
    const p = moveCard(h.sections, { si: 0, ci: 0 }, { si: 1, ci: null });
    expect(p).toEqual({ si: 1, ci: h.sections[1].cards.length - 1 });
    expect(names(1).at(-1)).toBe(c0);
    expect(h.sections.reduce((n, s) => n + s.cards.length, 0)).toBe(total);
    // перед конкретною карткою іншого розділу
    const moved = h.sections[1].cards[h.sections[1].cards.length - 1];
    moveCard(h.sections, { si: 1, ci: h.sections[1].cards.length - 1 }, { si: 0, ci: 0 });
    expect(h.sections[0].cards[0]).toBe(moved);
    // зміна порядку всередині розділу: 0 → перед 2 = позиція 1
    const arr = h.sections[0].cards;
    if (arr.length > 2) {
      const first = arr[0];
      moveCard(h.sections, { si: 0, ci: 0 }, { si: 0, ci: 2 });
      expect(h.sections[0].cards[1]).toBe(first);
    }
  });

  it("DOM: dragstart → dragover → drop викликає onMoveCard", () => {
    const h = home();
    const doc = parse(homeBody(h));
    const calls = [];
    decorateHome(doc, {
      onSelect() {}, onMoveSection() {}, onDelSection() {}, onEditCard() {}, onDelCard() {}, onAddCard() {},
      onMoveCard: (from, to) => calls.push([from, to]),
    });
    expect(doc.querySelectorAll(".card[draggable=true]").length).toBe(h.sections.reduce((n, s) => n + s.cards.length, 0));
    expect(doc.querySelectorAll(".__add").length).toBe(h.sections.length);
    const card = doc.querySelector('.__bw[data-i="0"] .card');
    const target = doc.querySelector('.__bw[data-i="1"] .card');
    const ev = (type, el) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    ev("dragstart", card);
    ev("dragover", target);
    expect(doc.querySelector(".__over")).toBeTruthy();
    ev("drop", target);
    expect(calls[0][0]).toEqual({ si: 0, ci: 0 });
    expect(calls[0][1]).toEqual({ si: 1, ci: 0 });
    // скидання на порожнє місце розділу — у кінець
    ev("dragstart", card);
    ev("drop", doc.querySelector('.__bw[data-i="1"] .__add'));
    expect(calls[1][1]).toEqual({ si: 1, ci: null });
  });
});
