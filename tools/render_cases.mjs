import fs from "node:fs";
import { renderSpec } from "../src/_includes/product/dsl.js";
import catalog from "../src/_includes/product/catalog.json" with { type: "json" };
const { cases, page, extra } = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
const all = [...catalog, ...(extra || [])];
const by = Object.fromEntries(all.map((s) => [s.name, s]));
console.log(JSON.stringify(cases.map((c) => renderSpec(c.spec || by[c.name], c.data, page, by))));
