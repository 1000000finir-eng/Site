// Єдиний стан застосунку (Svelte 5 runes).
import { readText, writeText, listDir, exists, join, removeFile } from "./api.js";
import { clone } from "./schema.js";
import { changedFiles } from "./git.js";
import { clearCache } from "./preview-assets.js";

export const app = $state({
  repo: localStorage.getItem("repo") || "",
  screen: "welcome", // welcome | editor
  pages: [], // [{ slug, title }]
  kind: "page", // page | home
  slug: "",
  data: null,
  selected: null, // null | "hero" | число (індекс блоку / розділу)
  dirty: false,
  savedAt: null,
  error: "",
  modal: null, // gallery | newpage | publish | images
  insertAt: null,
  canUndo: false,
  canRedo: false,
  changes: 0,
  gotoTarget: null,
  gotoTick: 0,
  picker: null, // { mode: "block" | "insert", target }
  sub: null, // вставка, що редагується окремо
  focusCard: null,
  phone: false,
});

export function select(i, scroll = true) {
  if (i !== app.selected) {
    app.sub = null;
    app.focusCard = null;
  }
  app.selected = i;
  if (scroll && i !== null) {
    app.gotoTarget = i;
    app.gotoTick++;
  }
}

const pagesDir = () => join(app.repo, "src/_content/pages");
const pagePath = (slug) => join(pagesDir(), `${slug}.json`);
const homePath = () => join(app.repo, "src/_data/home.json");

let lastSnap = "";
let undoStack = [];
let redoStack = [];
let saveTimer = null;
let restoring = false;

const fmt = (data) => JSON.stringify(data, null, 2) + "\n";

export async function isRepo(path) {
  return (await exists(join(path, "src/_content/pages"))) && (await exists(join(path, "src/_data/home.json")));
}

export async function openRepo(path) {
  if (!(await isRepo(path))) throw new Error("У цій папці немає сайту (не знайдено src/_content/pages).");
  app.repo = path;
  localStorage.setItem("repo", path);
  clearCache();
  await loadPages();
  app.screen = "editor";
  await openHome();
  await refreshChanges();
}

export async function loadPages() {
  const names = (await listDir(pagesDir())).filter((n) => n.endsWith(".json"));
  const out = [];
  for (const n of names) {
    try {
      const d = JSON.parse(await readText(join(pagesDir(), n)));
      out.push({ slug: n.replace(/\.json$/, ""), title: d.breadcrumb || d.title || n });
    } catch {
      out.push({ slug: n.replace(/\.json$/, ""), title: n });
    }
  }
  app.pages = out.sort((a, b) => a.title.localeCompare(b.title, "uk"));
}

function resetHistory(data) {
  lastSnap = JSON.stringify(data);
  undoStack = [];
  redoStack = [];
  app.canUndo = false;
  app.canRedo = false;
  app.dirty = false;
}

export async function openPage(slug) {
  await flush();
  const data = JSON.parse(await readText(pagePath(slug)));
  app.kind = "page";
  app.slug = slug;
  app.selected = null;
  app.data = data;
  app.sub = null;
  resetHistory(data);
}

export async function openHome() {
  await flush();
  const data = JSON.parse(await readText(homePath()));
  app.kind = "home";
  app.slug = "";
  app.selected = null;
  app.data = data;
  resetHistory(data);
}

/** Викликається з $effect при будь-якій зміні даних. */
export function onChange(snap) {
  if (snap === lastSnap) return;
  if (!restoring) {
    undoStack.push(lastSnap);
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  }
  lastSnap = snap;
  app.canUndo = undoStack.length > 0;
  app.canRedo = redoStack.length > 0;
  app.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 900);
}

export async function flush() {
  clearTimeout(saveTimer);
  if (!app.dirty || !app.data) return;
  try {
    await writeText(app.kind === "home" ? homePath() : pagePath(app.slug), fmt(app.data));
    app.dirty = false;
    app.savedAt = new Date();
    app.error = "";
    if (app.kind === "page") {
      const p = app.pages.find((x) => x.slug === app.slug);
      if (p) p.title = app.data.breadcrumb || app.data.title || p.title;
    }
    refreshChanges();
  } catch (e) {
    app.error = "Не вдалося зберегти: " + (e?.message || e);
  }
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(lastSnap);
  applySnapshot(undoStack.pop());
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(lastSnap);
  applySnapshot(redoStack.pop());
}
function applySnapshot(snap) {
  restoring = true;
  app.sub = null;
  lastSnap = snap;
  app.data = JSON.parse(snap);
  app.canUndo = undoStack.length > 0;
  app.canRedo = redoStack.length > 0;
  app.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 900);
  queueMicrotask(() => (restoring = false));
}

export async function refreshChanges() {
  try {
    app.changes = (await changedFiles(app.repo)).length;
  } catch {
    app.changes = 0;
  }
}

export async function createPage(data) {
  await writeText(pagePath(data.slug), fmt(data));
  await loadPages();
}

export async function addCardToHome(sectionIndex, card) {
  const h = JSON.parse(await readText(homePath()));
  (h.sections[sectionIndex].cards ||= []).push(card);
  await writeText(homePath(), fmt(h));
}
export async function readHome() {
  return JSON.parse(await readText(homePath()));
}
export async function pageExists(slug) {
  return exists(pagePath(slug));
}

/** Скільки карток на головній веде на цю сторінку. */
export async function countHomeCards(slug) {
  const h = JSON.parse(await readText(homePath()));
  return h.sections.reduce((n, s) => n + (s.cards || []).filter((c) => c.link === `/${slug}/`).length, 0);
}

/** Видаляє сторінку, її «низ» (якщо є) і картки на головній, що на неї вели. Повертає кількість прибраних карток. */
export async function deletePage(slug) {
  await flush();
  const page = JSON.parse(await readText(pagePath(slug)));
  const home = JSON.parse(await readText(homePath()));
  let removed = 0;
  for (const s of home.sections) {
    const before = (s.cards || []).length;
    s.cards = (s.cards || []).filter((c) => c.link !== `/${slug}/`);
    removed += before - s.cards.length;
  }
  if (removed) await writeText(homePath(), fmt(home));
  if (page.bottom_file) {
    const b = join(app.repo, "src/_content/bottoms", page.bottom_file);
    if (await exists(b)) await removeFile(b);
  }
  await removeFile(pagePath(slug));
  await loadPages();
  await openHome();
  await refreshChanges();
  return removed;
}
