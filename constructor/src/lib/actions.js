// Дії над сторінкою — спільні для бічної панелі й кнопок у перегляді.
import { app, select, flush, refreshChanges, openPage } from "./store.svelte.js";
import { moveItem, removeItem, duplicateItem } from "./model.js";
import { confirmAsk, readText, writeText, join } from "./api.js";
import { fieldsOf } from "./schema.js";
import { arr } from "./ensure.js";
import { blockToFree, canFree } from "./convert.js";
import { backupPages, newBackupDir, restorePages, writeManifest } from "./backup.js";

export function moveBlock(i, d) {
  const j = moveItem(app.data.blocks, i, d);
  if (j !== i) select(j, false);
}
export function dupBlock(i) {
  duplicateItem(app.data.blocks, i);
  select(i + 1, false);
}
export async function delBlock(i) {
  if (!(await confirmAsk("Видалити цей блок?"))) return;
  removeItem(app.data.blocks, i);
  select(null, false);
}
export function addBlockAt(i) {
  app.insertAt = i;
  app.picker = { mode: "block" };
  app.modal = "picker";
}
/** target: блок із полем «вставки» або масив елементів (вільний блок, вміст контейнера). */
export function addInsertTo(target) {
  app.picker = { mode: "insert", target };
  app.modal = "picker";
}

/** Кнопка «＋ Вставка» над будь-яким блоком: за потреби спершу розбирає блок на елементи. */
export async function addInsertToBlock(i) {
  const b = app.data.blocks[i];
  if (!b) return;
  if ((fieldsOf(b.type) || []).some((f) => f.kind === "inserts")) return addInsertTo(b);
  if (Array.isArray(b.elements)) return addInsertTo(b.elements);
  if (!canFree(b)) return;
  if (!(await confirmAsk("Щоб додати вставку, цей блок буде розібрано на окремі елементи (весь вміст збережеться). Продовжити? Скасувати можна через Ctrl+Z."))) return;
  app.data.blocks[i] = blockToFree(b, app.data);
  select(i, false);
  addInsertTo(app.data.blocks[i].elements);
}

export function hasSpecial(data) {
  return (data?.blocks || []).filter((b) => b.type === "section" || b.type === "raw").length;
}
/** Розібрати «особливі» блоки (section/raw) на елементи у поточній сторінці. */
export function convertSpecial(page) {
  let n = 0;
  page.blocks.forEach((b, i) => {
    if (b.type === "section" || b.type === "raw") {
      try {
        page.blocks[i] = blockToFree(b, page);
        n++;
      } catch (e) {
        console.error("Не вдалося розібрати блок", i, e);
      }
    }
  });
  return n;
}

/** Перенести картку між розділами (або всередині розділу). Повертає нову позицію. */
export function moveCard(sections, from, to) {
  const src = sections[from.si].cards;
  const [c] = src.splice(from.ci, 1);
  const dst = arr(sections[to.si], "cards");
  let idx = to.ci == null ? dst.length : to.ci;
  if (from.si === to.si && from.ci < idx) idx--;
  dst.splice(idx, 0, c);
  return { si: to.si, ci: idx };
}

export function moveSection(i, d) {
  const j = moveItem(app.data.sections, i, d);
  if (j !== i) select(j, false);
}
export async function delSection(i) {
  if (!(await confirmAsk("Видалити розділ разом з усіма його картками?"))) return;
  removeItem(app.data.sections, i);
  select(null, false);
}
export async function delCard(si, ci) {
  if (!(await confirmAsk("Видалити цю картку?"))) return;
  removeItem(app.data.sections[si].cards, ci);
}

/**
 * Розібрати особливі блоки в усіх сторінках. Спершу робить резервну копію,
 * тож масову міграцію можна скасувати кнопкою в бічній панелі.
 * Повертає { total, backup, pages }.
 */
export async function migrateAllSpecial() {
  await flush();
  const current = app.kind === "page" && app.data ? app.slug : null;

  // 1. Знаходимо сторінки, які справді потребують міграції.
  const targets = [];
  for (const p of app.pages) {
    if (p.slug === current) {
      if (hasSpecial(app.data)) targets.push({ slug: p.slug, data: null, current: true });
      continue;
    }
    const d = JSON.parse(await readText(join(app.repo, "src/_content/pages", p.slug + ".json")));
    if (hasSpecial(d)) targets.push({ slug: p.slug, data: d, current: false });
  }
  if (!targets.length) {
    app.lastMigration = null;
    return { total: 0, backup: null, pages: [] };
  }

  // 2. Резервна копія ДО будь-яких змін.
  const dir = newBackupDir(app.repo, "migrate");
  const saved = await backupPages(app.repo, dir, targets.map((t) => t.slug));

  // 3. Міграція.
  let total = 0;
  for (const t of targets) {
    if (t.current) {
      total += convertSpecial(app.data);
      continue;
    }
    const n = convertSpecial(t.data);
    if (n) {
      await writeText(join(app.repo, "src/_content/pages", t.slug + ".json"), JSON.stringify(t.data, null, 2) + "\n");
      total += n;
    }
  }

  await writeManifest(dir, {
    created: new Date().toISOString(),
    kind: "migrate-special",
    pages: saved,
    convertedBlocks: total,
    note: "Щоб повернути сторінки вручну: скопіюйте pages/*.json у src/_content/pages.",
  });

  app.lastMigration = { total, backup: dir, pages: saved };
  await flush();
  await refreshChanges();
  return { total, backup: dir, pages: saved };
}

/** Скасувати останню масову міграцію: повертає сторінки з резервної копії. */
export async function undoMigration() {
  const m = app.lastMigration;
  if (!m?.backup) return 0;
  await flush();
  const n = await restorePages(app.repo, m.backup, m.pages || []);
  app.lastMigration = null;
  if (app.kind === "page" && (m.pages || []).includes(app.slug)) await openPage(app.slug);
  await refreshChanges();
  return n;
}
