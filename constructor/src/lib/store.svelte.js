// Єдиний стан застосунку (Svelte 5 runes).
import { readText, writeText, listDir, exists, join, copyFile, removeFile } from "./api.js";
import { clone } from "./schema.js";
import { aheadCount, changedFiles, describeChange } from "./git.js";
import { clearCache } from "./preview-assets.js";
import { backupPages, newBackupDir, writeManifest } from "./backup.js";

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
  ahead: 0, // локальні коміти, ще не відправлені на GitHub
  gotoTarget: null,
  gotoTick: 0,
  picker: null, // { mode: "block" | "insert", target }
  sub: null, // вставка, що редагується окремо
  focusCard: null,
  phone: false,
  changeList: [], // [{ code, path, label }] — що саме буде опубліковано
  lastDeleted: null, // { slug, title, backup, removedCards } — для кнопки «Повернути»
  lastMigration: null, // { total, backup, pages } — для скасування масової міграції
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
    const [lines, ahead] = await Promise.all([
      changedFiles(app.repo),
      aheadCount(app.repo),
    ]);
    app.changes = lines.length;
    app.changeList = lines.map(describeChange);
    app.ahead = ahead;
  } catch {
    app.changes = 0;
    app.changeList = [];
    app.ahead = 0;
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

/**
 * Видаляє сторінку, її «низ» (якщо є) і картки на головній, що на неї вели.
 * Спочатку робить резервну копію в .constructor-backup, тож сторінку можна повернути.
 * Повертає кількість прибраних карток.
 */
export async function deletePage(slug) {
  await flush();
  const page = JSON.parse(await readText(pagePath(slug)));
  const home = JSON.parse(await readText(homePath()));
  const dir = newBackupDir(app.repo, "delete", slug);
  await backupPages(app.repo, dir, [slug]);
  await copyFile(homePath(), join(dir, "home.json"));

  const bottom = page.bottom_file ? join(app.repo, "src/_content/bottoms", page.bottom_file) : null;
  const hasBottom = bottom ? await exists(bottom) : false;
  if (hasBottom) await copyFile(bottom, join(dir, "bottoms", page.bottom_file));

  // Запам’ятовуємо, звідки які картки прибрали, щоб повернути їх на ті самі місця.
  const removedCards = [];
  home.sections.forEach((s, si) => {
    (s.cards || []).forEach((card, ci) => {
      if (card.link === `/${slug}/`) removedCards.push({ si, ci, card });
    });
  });
  if (removedCards.length) {
    for (const s of home.sections) s.cards = (s.cards || []).filter((c) => c.link !== `/${slug}/`);
    await writeText(homePath(), fmt(home));
  }

  await writeManifest(dir, {
    created: new Date().toISOString(),
    kind: "delete-page",
    slug,
    title: page.breadcrumb || page.title || slug,
    bottom_file: hasBottom ? page.bottom_file : null,
    removedHomeCards: removedCards.length,
    note: "Щоб повернути сторінку вручну: скопіюйте pages/*.json у src/_content/pages, bottoms/* — у src/_content/bottoms, home.json — у src/_data.",
  });

  if (hasBottom) await removeFile(bottom);
  await removeFile(pagePath(slug));

  app.lastDeleted = {
    slug,
    title: page.breadcrumb || page.title || slug,
    backup: dir,
    bottom_file: hasBottom ? page.bottom_file : null,
    removedCards,
  };

  await loadPages();
  await openHome();
  await refreshChanges();
  return removedCards.length;
}

/** Повертає останню видалену сторінку разом з її «низом» і картками на головній. */
export async function undoDeletePage() {
  const d = app.lastDeleted;
  if (!d) return false;
  await flush();

  await copyFile(join(d.backup, "pages", `${d.slug}.json`), pagePath(d.slug));
  if (d.bottom_file) {
    await copyFile(
      join(d.backup, "bottoms", d.bottom_file),
      join(app.repo, "src/_content/bottoms", d.bottom_file)
    );
  }
  if (d.removedCards?.length) {
    const home = JSON.parse(await readText(homePath()));
    for (const r of d.removedCards) {
      const s = home.sections[r.si];
      if (!s) continue;
      s.cards ||= [];
      s.cards.splice(Math.min(r.ci, s.cards.length), 0, r.card);
    }
    await writeText(homePath(), fmt(home));
  }

  app.lastDeleted = null;
  await loadPages();
  await openPage(d.slug);
  await refreshChanges();
  return true;
}
