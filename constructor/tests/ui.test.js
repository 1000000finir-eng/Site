// Смоук-тест інтерфейсу у jsdom: файлова система й git імітуються, Tauri замінено заглушками.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeAll } from "vitest";

const SRC = path.resolve(__dirname, "../..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
const calls = [];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd, a) => {
    calls.push([cmd, a]);
    switch (cmd) {
      case "read_text": return fs.readFileSync(a.path, "utf-8");
      case "write_text": fs.mkdirSync(path.dirname(a.path), { recursive: true }); fs.writeFileSync(a.path, a.content); return null;
      case "list_dir": return fs.readdirSync(a.path).sort();
      case "path_exists": return fs.existsSync(a.path);
      case "copy_file": fs.copyFileSync(a.from, a.to); return null;
      case "remove_file": fs.unlinkSync(a.path); return null;
      case "read_bytes": { const b = fs.readFileSync(a.path); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
      case "run_git":
        if (a.args[0] === "status") return { code: 0, stdout: " M src/_content/pages/x.json\n", stderr: "" };
        return { code: 0, stdout: "git version 2.45", stderr: "" };
      default: throw new Error("unknown command " + cmd);
    }
  },
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: async () => null, ask: async () => true }));

beforeAll(() => {
  // мінімальна копія сайту у тимчасовій папці
  for (const d of ["src/_content/pages", "src/_data", "src/css", "src/assets/images"]) fs.mkdirSync(path.join(tmp, d), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, "src/_content/pages"))) fs.copyFileSync(path.join(SRC, "src/_content/pages", f), path.join(tmp, "src/_content/pages", f));
  fs.copyFileSync(path.join(SRC, "src/_data/home.json"), path.join(tmp, "src/_data/home.json"));
  fs.copyFileSync(path.join(SRC, "src/style.css"), path.join(tmp, "src/style.css"));
  fs.copyFileSync(path.join(SRC, "src/css/library.css"), path.join(tmp, "src/css/library.css"));
  for (const f of fs.readdirSync(path.join(SRC, "src/css"))) if (f.endsWith(".css")) fs.copyFileSync(path.join(SRC, "src/css", f), path.join(tmp, "src/css", f));
  localStorage.setItem("repo", tmp.replace(/\\/g, "/"));
  globalThis.IntersectionObserver = undefined;
  URL.createObjectURL = () => "blob:test";
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 5000) {
  const t = Date.now();
  while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch {} await wait(30); }
  throw new Error("умова не виконалась: " + fn.toString().slice(0, 120));
}

describe("конструктор", () => {
  it("відкриває сайт, редагує блок, зберігає, скасовує, додає блок", async () => {
    const { render, fireEvent, screen } = await import("@testing-library/svelte");
    const { default: App } = await import("../src/App.svelte");
    const store = await import("../src/lib/store.svelte.js");
    const { container } = render(App);

    // 1. Редактор відкрився, головна завантажена, у списку є сторінки
    await until(() => container.querySelector(".sidebar"));
    await until(() => container.querySelectorAll("#pagesel option").length > 5);
    expect(container.querySelectorAll(".blocklist .side-item").length).toBeGreaterThan(2);

    // 2. Переходимо на сторінку
    const sel = container.querySelector("#pagesel");
    sel.value = "diagnostychna-konsultatsiya";
    await fireEvent.change(sel);
    await until(() => store.app.kind === "page" && store.app.data?.blocks?.length > 5);

    // 3. Обираємо блок, форма з'являється
    const items = container.querySelectorAll(".blocklist .side-item");
    await fireEvent.click(items[1]);
    await until(() => container.querySelector(".form-panel .form-head h2"));
    const fieldCount = container.querySelectorAll(".form-body .field").length;
    expect(fieldCount).toBeGreaterThan(1);

    // 4. Правимо перше текстове поле — дані змінюються, файл зберігається автоматично
    const input = container.querySelector(".form-body input[type=text]");
    const before = store.app.data.blocks[1].title ?? store.app.data.blocks[1].kicker;
    await fireEvent.input(input, { target: { value: "ТЕСТОВИЙ ЗАГОЛОВОК" } });
    await until(() => JSON.stringify(store.app.data).includes("ТЕСТОВИЙ ЗАГОЛОВОК"));
    await until(() => !store.app.dirty, 4000);
    const saved = fs.readFileSync(path.join(tmp, "src/_content/pages/diagnostychna-konsultatsiya.json"), "utf-8");
    expect(saved).toContain("ТЕСТОВИЙ ЗАГОЛОВОК");
    expect(saved.endsWith("\n")).toBe(true);

    // 5. Попередній перегляд побудувався і містить зміну
    const frame = container.querySelector(".preview iframe");
    await until(() => (frame.srcdoc || "").includes("ТЕСТОВИЙ ЗАГОЛОВОК"), 5000);

    // 6. Скасувати повертає старе значення
    store.undo();
    await until(() => !JSON.stringify(store.app.data).includes("ТЕСТОВИЙ ЗАГОЛОВОК"));

    // 7. Додавання блоку: плитки з переглядом
    const nBefore = store.app.data.blocks.length;
    await fireEvent.click(container.querySelector(".btn.add"));
    await until(() => document.querySelectorAll(".tile").length > 20);
    const tile = [...document.querySelectorAll(".tile")].find((b) => b.textContent.includes("Акцентна смуга"));
    await until(() => tile.querySelector("iframe"), 4000); // перегляд плитки побудувався
    await fireEvent.click(tile);
    await until(() => store.app.data.blocks.length === nBefore + 1);
    expect(store.app.data.blocks.some((b) => b.type === "hl")).toBe(true);

    // 8. Публікація відкривається
    await fireEvent.click(container.querySelector(".top-actions .btn.primary"));
    await until(() => document.querySelector(".modal .modal-foot .btn.primary"));
  });
});

describe("головна, налаштування, вставки, нова сторінка", () => {
  it("працюють основні сценарії", async () => {
    const { render, fireEvent } = await import("@testing-library/svelte");
    const { default: App } = await import("../src/App.svelte");
    const store = await import("../src/lib/store.svelte.js");
    const { container } = render(App);
    await until(() => container.querySelectorAll("#pagesel option").length > 5);

    // Головна: розділ → картки → додати картку
    await until(() => store.app.kind === "home" && store.app.data?.sections?.length);
    await fireEvent.click(container.querySelectorAll(".blocklist .side-item")[0]);
    await until(() => container.querySelector(".form-body .add-inline"));
    const cards0 = store.app.data.sections[0].cards.length;
    await fireEvent.click([...container.querySelectorAll(".form-body .add-inline")].pop());
    await until(() => store.app.data.sections[0].cards.length === cards0 + 1);
    // попередній перегляд головної містить усі картки
    const frame = container.querySelector(".preview iframe");
    await until(() => (frame.srcdoc.match(/class="card /g) || []).length >= cards0 + 1);

    // Сторінка → налаштування сторінки
    const sel = container.querySelector("#pagesel");
    sel.value = "diagnostychna-konsultatsiya";
    await fireEvent.change(sel);
    await until(() => store.app.kind === "page" && store.app.data?.blocks?.length);
    await fireEvent.click(container.querySelector(".side-item.settings"));
    await until(() => container.querySelector(".form-body .imgpick"));
    expect(container.querySelectorAll(".form-body .field").length).toBeGreaterThan(8);

    // Вибір картинки: вікно відкривається
    await fireEvent.click(container.querySelector(".imgpick .btn"));
    await until(() => document.querySelector(".imggrid"));
    await fireEvent.click(document.querySelector(".modal.wide .modal-head .btn.ghost"));

    // Блок «Текст» → додати вставку
    const idx = store.app.data.blocks.findIndex((b) => b.type === "text");
    await fireEvent.click(container.querySelectorAll(".blocklist .side-item")[idx]);
    await until(() => container.querySelector(".add-insert"));
    await fireEvent.click(container.querySelector(".add-insert"));
    await until(() => document.querySelector(".tile[data-n=chips]"));
    await until(() => document.querySelector(".tile[data-n=chips] iframe"), 4000); // є перегляд вставки
    await fireEvent.click(document.querySelector(".tile[data-n=chips]"));
    await until(() => store.app.data.blocks[idx].inserts?.length === 1);
    expect(store.app.sub?.type).toBe("chips"); // одразу відкрилось редагування вставки
    await until(() => container.querySelector(".form-head .btn")?.textContent.includes("До блоку"));
    const pv = container.querySelector(".preview iframe");
    await until(() => pv.srcdoc.includes('class="chips"'), 6000);
    await fireEvent.click(container.querySelector(".form-head .btn")); // назад до блоку

    // Жирний шрифт: кнопка Ж обгортає виділене слово
    const ta = container.querySelector(".form-body .rich textarea");
    ta.value = "один два три";
    await fireEvent.input(ta);
    await wait(80);
    ta.setSelectionRange(5, 8);
    await fireEvent.click(container.querySelector(".rich-bar .b"));
    await until(() => ta.value.includes("**два**"));

    // Нова сторінка
    await fireEvent.click([...container.querySelectorAll(".side-head .btn")].find((b) => b.textContent.includes("Нова")));
    await until(() => document.querySelector(".modal input[type=text]"));
    const t = document.querySelector(".modal input[type=text]");
    await fireEvent.input(t, { target: { value: "Нова послуга для тесту" } });
    await until(() => document.querySelectorAll(".modal input[type=text]")[1].value === "nova-posluha-dlia-testu".replace("poslu", "poslu") || document.querySelectorAll(".modal input[type=text]")[1].value.startsWith("nova-"));
    await fireEvent.click([...document.querySelectorAll(".modal-foot .btn.primary")][0]);
    await until(() => store.app.slug.startsWith("nova-") && store.app.data?.blocks?.length === 4, 6000);
    expect(fs.existsSync(path.join(tmp, "src/_content/pages", store.app.slug + ".json"))).toBe(true);
    const home = JSON.parse(fs.readFileSync(path.join(tmp, "src/_data/home.json"), "utf-8"));
    expect(JSON.stringify(home)).toContain("/" + store.app.slug + "/");
    // нова сторінка відображається у перегляді (hero + 4 блоки)
    const f2 = container.querySelector(".preview iframe");
    await until(() => f2.srcdoc.includes('data-i="3"') && f2.srcdoc.includes("НОВА ПОСЛУГА"), 6000);
  });
});

describe("кнопка списку в текстових полях", () => {
  it("є в звичайних текстових полях і відсутня в заголовках", async () => {
    const { render } = await import("@testing-library/svelte");
    const { default: RichText } = await import("../src/components/RichText.svelte");
    const normal = render(RichText, { value: "Текст" });
    expect(normal.container.querySelector('.rich-bar button[title="Список"]')).toBeTruthy();
    normal.unmount();
    const heading = render(RichText, { value: "Заголовок", list: false });
    expect(heading.container.querySelector('.rich-bar button[title="Список"]')).toBeFalsy();
    heading.unmount();
  });
});
