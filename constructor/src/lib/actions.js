// Дії над сторінкою — спільні для бічної панелі й кнопок у перегляді.
import { app, select, flush, refreshChanges } from "./store.svelte.js";
import { moveItem, removeItem, duplicateItem } from "./model.js";
import { confirmAsk, readText, writeText, join } from "./api.js";
import { fieldsOf } from "./schema.js";
import { arr } from "./ensure.js";
import { blockToFree, canFree } from "./convert.js";

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

/** Розібрати особливі блоки в усіх сторінках. Повертає кількість розібраних блоків. */
export async function migrateAllSpecial() {
  await flush();
  let total = 0;
  for (const p of app.pages) {
    if (app.kind === "page" && app.slug === p.slug && app.data) {
      total += convertSpecial(app.data);
      continue;
    }
    const path = join(app.repo, "src/_content/pages", p.slug + ".json");
    const d = JSON.parse(await readText(path));
    const n = convertSpecial(d);
    if (n) {
      await writeText(path, JSON.stringify(d, null, 2) + "\n");
      total += n;
    }
  }
  await flush();
  await refreshChanges();
  return total;
}
