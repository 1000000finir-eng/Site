import fs from "node:fs";
import path from "node:path";

export default function (eleventyConfig) {
  // Статичні файли копіюються як є (бекенд-скрипти, CSS, картинки — без змін)
  const skip = new Set(["_data", "_includes", "_content", "admin"]);
  for (const name of fs.readdirSync("src")) {
    if (skip.has(name)) continue;
    if (fs.statSync(path.join("src", name)).isDirectory() || !/\.11ty\.js$/.test(name)) {
      eleventyConfig.addPassthroughCopy(`src/${name}`);
    }
  }
  // Адмінка: config.yml + локальна копія Sveltia CMS (версія зафіксована в package-lock)
  eleventyConfig.addPassthroughCopy("src/admin/index.html");
  eleventyConfig.addPassthroughCopy("src/admin/config.yml");
  eleventyConfig.addPassthroughCopy("src/admin/preview.js");
  eleventyConfig.addPassthroughCopy({
    "node_modules/@sveltia/cms/dist/sveltia-cms.js": "admin/sveltia-cms.js",
  });

  return {
    templateFormats: ["11ty.js"],
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
  };
}
