// Кожен блок усіх сторінок → вільний блок (дерево елементів) → HTML має збігатися з оригіналом.
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { blockToFree, canFree, htmlToFree } from "../src/lib/convert.js";
import { renderBlockHtml } from "../src/lib/render.js";
import { CATALOG, newBlock } from "../src/lib/schema.js";
import { newPageData } from "../src/lib/model.js";

const root = path.resolve(__dirname, "../..");
const norm = (html) => {
  html = html.replace(/<(\/?)b>/g, "<$1strong>").replace(/<(\/?)i>/g, "<$1em>");
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const ser = (n) => {
    if (n.nodeType === 3) return n.data.replace(/\s+/g, " ").trim().replace(/\u00a0/g, " ");
    if (n.nodeType !== 1) return "";
    const a = Array.from(n.attributes).map((x) => `${x.name}="${x.value.replace(/\s+/g, " ").trim()}"`).sort().join(" ");
    const kids = Array.from(n.childNodes).map(ser).filter(Boolean).join("|");
    return `<${n.tagName.toLowerCase()} ${a}>${kids}</>`;
  };
  return Array.from(doc.body.childNodes).map(ser).filter(Boolean).join("");
};

describe("розбір блоків на елементи", () => {
  const dir = path.join(root, "src/_content/pages");
  const pages = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")));

  it("усі блоки реальних сторінок відтворюються без втрат", () => {
    let n = 0;
    const bad = [];
    for (const p of pages) {
      p.blocks.forEach((b, i) => {
        if (!canFree(b)) return;
        const a = renderBlockHtml(b, p, { faqUsed: true });
        const free = blockToFree(b, p);
        const c = renderBlockHtml(free, p, { faqUsed: true });
        n++;
        if (norm(a) !== norm(c)) bad.push(`${p.slug}#${i}:${b.type}`);
      });
    }
    expect(bad).toEqual([]);
    expect(n).toBeGreaterThan(100);
  });

  it("приклади всіх блоків каталогу", () => {
    const page = newPageData({ title: "Т", slug: "t" });
    const bad = [];
    for (const s of CATALOG.filter((x) => x.group !== "insert" && x.sample)) {
      const b = newBlock(s.name);
      const a = renderBlockHtml(b, page, { faqUsed: true });
      const c = renderBlockHtml(blockToFree(b, page), page, { faqUsed: true });
      if (norm(a) !== norm(c)) bad.push(s.name);
    }
    expect(bad).toEqual([]);
  });

  it("вставки розпізнаються всередині вільного блоку", () => {
    const page = newPageData({ title: "Т", slug: "t" });
    const t = newBlock("text");
    t.inserts = [{ type: "chips", items: [{ variant: "chip", _: "Один" }, { variant: "chip", _: "Два" }] }];
    const free = blockToFree(t, page);
    const flat = JSON.stringify(free);
    expect(flat).toContain('"t":"ins"');
    expect(flat).toContain('"type":"chips"');
  });

  it("сирий HTML розбирається на елементи", () => {
    const f = htmlToFree('<section class="x"><h3 class="y">Заголовок <b>жирний</b></h3><p>Текст</p><img src="/a.png" alt=""></section>', {});
    expect(f.tag).toBe("section");
    expect(f.elements.length).toBe(3);
    expect(f.elements[2].tag).toBe("img");
    expect(f.elements[2].attrs).toEqual({ src: "/a.png", alt: "" });
  });
});
