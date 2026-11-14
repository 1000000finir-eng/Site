import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeAll } from "vitest";

const SRC = path.resolve(__dirname, "../..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd, a) => {
    switch (cmd) {
      case "read_text": return fs.readFileSync(a.path, "utf-8");
      case "write_text": fs.mkdirSync(path.dirname(a.path), { recursive: true }); fs.writeFileSync(a.path, a.content); return null;
      case "list_dir": return fs.readdirSync(a.path).sort();
      case "path_exists": return fs.existsSync(a.path);
      case "remove_file": fs.unlinkSync(a.path); return null;
      case "read_bytes": { const b = fs.readFileSync(a.path); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
      case "run_git": return { code: 0, stdout: a.args[0] === "status" ? "" : "git version 2", stderr: "" };
      default: return null;
    }
  },
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: async () => null, ask: async () => true }));

beforeAll(() => {
  for (const d of ["src/_content/pages", "src/_data", "src/css", "src/assets/images"]) fs.mkdirSync(path.join(tmp, d), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, "src/_content/pages"))) fs.copyFileSync(path.join(SRC, "src/_content/pages", f), path.join(tmp, "src/_content/pages", f));
  fs.copyFileSync(path.join(SRC, "src/_data/home.json"), path.join(tmp, "src/_data/home.json"));
  fs.copyFileSync(path.join(SRC, "src/style.css"), path.join(tmp, "src/style.css"));
  for (const f of fs.readdirSync(path.join(SRC, "src/css"))) if (f.endsWith(".css")) fs.copyFileSync(path.join(SRC, "src/css", f), path.join(tmp, "src/css", f));
  localStorage.setItem("repo", tmp.replace(/\\/g, "/"));
  URL.createObjectURL = () => "blob:test";
  globalThis.IntersectionObserver = undefined;
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) {
  const t = Date.now();
  while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch {} await wait(30); }
  throw new Error("умова не виконалась: " + fn.toString().slice(0, 140));
}

describe("вставка з кнопки над блоком у перегляді (та сама дія, що й кнопка)", () => {
  it("працює для блоків зі вставками, вільних блоків і блоків без вставок; видалення сторінки", async () => {
    const { render, fireEvent } = await import("@testing-library/svelte");
    const { default: App } = await import("../src/App.svelte");
    const store = await import("../src/lib/store.svelte.js");
    const A = await import("../src/lib/actions.js");
    const { container } = render(App);
    await until(() => container.querySelectorAll("#pagesel option").length > 5);
    const sel = container.querySelector("#pagesel");
    sel.value = "diagnostychna-konsultatsiya";
    await fireEvent.change(sel);
    await until(() => store.app.kind === "page" && store.app.data?.blocks?.length);
    store.select(null, false);
    const pickChips = async () => {
      await until(() => document.querySelector(".tile[data-n=chips]"));
      await fireEvent.click(document.querySelector(".tile[data-n=chips]"));
    };

    // 1. блок зі вставками (text)
    const t = store.app.data.blocks.findIndex((b) => b.type === "text");
    await A.addInsertToBlock(t);
    await pickChips();
    await until(() => store.app.data.blocks[t].inserts?.length === 1, 3000);

    // 2. блок з елементами (final): вставка йде у elements як {t:"ins"}
    const f = store.app.data.blocks.findIndex((b) => b.type === "final");
    await A.addInsertToBlock(f);
    await pickChips();
    await until(() => store.app.data.blocks[f].elements?.some((e) => e.t === "ins" && e.type === "chips"), 3000);

    // 3. блок без вставок (hl): розбирається на елементи, далі вставка
    store.app.data.blocks.push({ type: "hl", text: "Важливе **слово**" });
    const h = store.app.data.blocks.length - 1;
    await A.addInsertToBlock(h);
    await pickChips();
    await until(() => store.app.data.blocks[h].type === "free" && store.app.data.blocks[h].elements.some((e) => e.t === "ins"), 3000);

    // 4. видалення сторінки: файл зникає, картки на головній, що вели на неї, прибираються
    const home0 = JSON.parse(fs.readFileSync(path.join(tmp, "src/_data/home.json"), "utf-8"));
    const linked = home0.sections.flatMap((s) => s.cards).filter((c) => c.link === "/diagnostychna-konsultatsiya/").length;
    expect(await store.countHomeCards("diagnostychna-konsultatsiya")).toBe(linked);
    store.app.dirty = false;
    const removed = await store.deletePage("diagnostychna-konsultatsiya");
    expect(removed).toBe(linked);
    expect(fs.existsSync(path.join(tmp, "src/_content/pages/diagnostychna-konsultatsiya.json"))).toBe(false);
    expect(store.app.pages.some((p) => p.slug === "diagnostychna-konsultatsiya")).toBe(false);
    const home1 = JSON.parse(fs.readFileSync(path.join(tmp, "src/_data/home.json"), "utf-8"));
    expect(JSON.stringify(home1)).not.toContain("/diagnostychna-konsultatsiya/");
    expect(store.app.kind).toBe("home");
  });
});

describe("повне редагування блоку та міграція особливих блоків", () => {
  it("розібрати на елементи, додати/переставити/вставка; міграція в усіх сторінках", async () => {
    const { render, fireEvent } = await import("@testing-library/svelte");
    const { default: App } = await import("../src/App.svelte");
    const store = await import("../src/lib/store.svelte.js");
    const { container } = render(App);
    await until(() => container.querySelectorAll("#pagesel option").length > 5);

    // сторінка з особливими блоками → є плашка «Особливих блоків»
    const sel = container.querySelector("#pagesel");
    sel.value = "strategichne-planuvannya-biznesu";
    await fireEvent.change(sel);
    await until(() => store.app.kind === "page" && store.app.data?.blocks?.length);
    await until(() => container.querySelector(".side-note"));

    // звичайний блок → «Розібрати на елементи» → вільний блок з редактором елементів
    const t = store.app.data.blocks.findIndex((b) => b.type === "text");
    await fireEvent.click(container.querySelectorAll(".blocklist .side-item")[t]);
    await until(() => container.querySelector(".free-bar .btn"));
    await fireEvent.click(container.querySelector(".free-bar .btn"));
    await until(() => store.app.data.blocks[t].type === "free");
    await until(() => container.querySelector(".elements-ed"));
    const n0 = store.app.data.blocks[t].elements.length;
    const addBtn = (txt) => [...container.querySelectorAll(".elements-ed:not(.nested) > .add-row .btn")].find((b) => b.textContent.includes(txt));

    // + Абзац, + Блок, + Фото
    const root = () => store.app.data.blocks[t].elements[0]; // ec-detail__single (контейнер)
    expect(root().kids).toBeTruthy();
    const kids0 = root().kids.length;
    await fireEvent.click(container.querySelector(".elements-ed:not(.nested) > .add-row .btn")); // + Абзац у кореневому редакторі
    await until(() => store.app.data.blocks[t].elements.length === n0 + 1);

    // вставка у вільний блок через плитки
    await fireEvent.click(addBtn("Вставка"));
    await until(() => document.querySelector(".tile[data-n=chips]"));
    await fireEvent.click(document.querySelector(".tile[data-n=chips]"));
    await until(() => store.app.data.blocks[t].elements.some((e) => e.t === "ins" && e.type === "chips"), 3000);

    // переставлення елементів: перший ↓
    const first = store.app.data.blocks[t].elements[0];
    const down = container.querySelector(".elements-ed:not(.nested) > .list > details > summary .tools button:nth-child(2)");
    await fireEvent.click(down);
    await until(() => store.app.data.blocks[t].elements[1] === first || JSON.stringify(store.app.data.blocks[t].elements[1]) === JSON.stringify(first), 3000);

    // міграція особливих блоків у всіх сторінках
    await fireEvent.click([...container.querySelectorAll(".side-note .btn")].find((b) => b.textContent.includes("У всіх")));
    await until(() => {
      const dir = path.join(tmp, "src/_content/pages");
      const bad = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).filter((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")).blocks.some((b) => b.type === "section" || b.type === "raw"));
      return bad.length === 0;
    }, 8000);
  });
});
