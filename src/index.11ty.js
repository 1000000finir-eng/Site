import fs from "node:fs";
import { renderSections } from "./_includes/home-render.js";

export default class {
  data() {
    return { permalink: "/index.html" };
  }
  render(data) {
    const tpl = fs.readFileSync("src/_includes/home.tpl", "utf-8");
    return tpl.replace("<!--@@SECTIONS@@-->", renderSections(data.home));
  }
}
