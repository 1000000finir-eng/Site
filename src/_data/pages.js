import fs from "node:fs";
import path from "node:path";

// Читає всі сторінки продуктів із src/_content/pages/*.json (їх редагує CMS)
export default function () {
  const dir = path.join("src", "_content", "pages");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const page = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
      page.slug = page.slug || f.replace(/\.json$/, "");
      if (fs.existsSync(path.join("src", page.slug))) {
        throw new Error(
          `Конфлікт: папка src/${page.slug}/ уже існує як статична сторінка. Видаліть її або змініть slug у CMS.`
        );
      }
      return page;
    });
}
