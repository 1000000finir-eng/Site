// Міграція особливих блоків на всіх сторінках → сайт збирається і виглядає так само (повний ланцюг).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { it, expect } from "vitest";
import { convertSpecial } from "../src/lib/actions.js";

const root = path.resolve(__dirname, "../..");
it("міграція не змінює зібраний сайт", () => {
  const tmp = "/tmp/mig-site";
  execSync(`rm -rf ${tmp} && mkdir -p ${tmp} && cd ${root} && tar --exclude=node_modules --exclude=_site --exclude=constructor --exclude=.git -cf - . | tar -xf - -C ${tmp} && ln -s ${root}/node_modules ${tmp}/node_modules`);
  execSync(`cd ${root} && npx eleventy --output=/tmp/mig-before >/dev/null 2>&1`, { stdio: "ignore" });
  const dir = path.join(tmp, "src/_content/pages");
  let total = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
    const n = convertSpecial(p);
    total += n;
    fs.writeFileSync(path.join(dir, f), JSON.stringify(p, null, 2) + "\n");
  }
  expect(total).toBeGreaterThan(5);
  execSync(`cd ${tmp} && npx eleventy --output=/tmp/mig-after 2>&1 | tail -2`, { stdio: "pipe" });
  const norm = (h) => h.replace(/<(\/?)b>/g, "<$1strong>").replace(/\s+/g, " ").replace(/> </g, "><");
  const bad = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const slug = f.replace(".json", "");
    const a = fs.readFileSync(`/tmp/mig-before/${slug}/index.html`, "utf-8");
    const b = fs.readFileSync(`/tmp/mig-after/${slug}/index.html`, "utf-8");
    // порівнюємо через DOM, щоб не залежати від пробілів і порядку атрибутів
    const ser = (html) => {
      const d = new DOMParser().parseFromString(norm(html), "text/html");
      const w = (n) => (n.nodeType === 3 ? n.data.replace(/\s+/g, " ").trim() : n.nodeType === 1 ? `<${n.tagName} ${Array.from(n.attributes).map((x) => `${x.name}=${x.value}`).sort().join(" ")}>${Array.from(n.childNodes).map(w).filter(Boolean).join("|")}</>` : "");
      return w(d.body) + w(d.head);
    };
    if (ser(a) !== ser(b)) bad.push(slug);
  }
  expect(bad).toEqual([]);
}, 120000);
