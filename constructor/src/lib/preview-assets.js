// Підвантаження стилів і картинок із локальної копії сайту для попереднього перегляду.
import { readText, readBytes, exists, join } from "./api.js";

const cssCache = new Map();
const cssBlobCache = new Map();
const blobCache = new Map();
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon" };

async function cssFile(repo, rel) {
  const path = join(repo, "src", rel.replace(/^\//, ""));
  if (cssCache.has(path)) return cssCache.get(path);
  let text = "";
  try {
    text = await readText(path);
  } catch {}
  // відносні url() у CSS сторінки → кореневі, бо стилі вставляються в один документ
  text = text.replace(/url\(\s*(['"]?)(?:\.\.\/|\.\/)?assets\//g, "url($1/assets/");
  cssCache.set(path, text);
  return text;
}

export function clearCache() {
  cssCache.clear();
  cssBlobCache.clear();
}

export async function loadCss(repo, pageCss) {
  const lib = (await exists(join(repo, "src/css/library.css"))) ? "css/library.css" : "css/blocks.css";
  const names = ["style.css", lib];
  if (pageCss) names.push(pageCss);
  return (await Promise.all(names.map((n) => cssFile(repo, n)))).join("\n");
}

async function blobFor(repo, assetPath) {
  if (blobCache.has(assetPath)) return blobCache.get(assetPath);
  try {
    const buf = await readBytes(join(repo, "src", assetPath));
    const ext = assetPath.split(".").pop().toLowerCase();
    const url = URL.createObjectURL(new Blob([buf], { type: MIME[ext] || "application/octet-stream" }));
    blobCache.set(assetPath, url);
    return url;
  } catch {
    blobCache.set(assetPath, null);
    return null;
  }
}

/** Замінює /assets/... на локальні blob-посилання. */
export async function inlineAssets(repo, html) {
  const paths = [...new Set(html.match(/\/assets\/[^\s"'()<>\\]+/g) || [])];
  let out = html;
  await Promise.all(
    paths.map(async (p) => {
      const url = await blobFor(repo, decodeURI(p));
      if (url) out = out.split(p).join(url);
    }),
  );
  return out;
}

export function forgetBlob(assetPath) {
  blobCache.delete(assetPath);
}

export const assetUrl = (repo, assetPath) => blobFor(repo, assetPath);

/** Один спільний blob зі стилями сторінки: плитки й перегляд підключають його через <link>. */
export async function cssBlobUrl(repo, pageCss) {
  const key = `${repo}|${pageCss || ""}`;
  if (cssBlobCache.has(key)) return cssBlobCache.get(key);
  const text = await inlineAssets(repo, await loadCss(repo, pageCss));
  const url = URL.createObjectURL(new Blob([text], { type: "text/css" }));
  cssBlobCache.set(key, url);
  return url;
}
export function dropCssBlobs() {
  cssBlobCache.clear();
}
