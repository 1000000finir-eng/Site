<script>
  import { app, openPage, openHome, select, deletePage, undoDeletePage, countHomeCards } from "../lib/store.svelte.js";
  import { typeLabel, blockTitle } from "../lib/schema.js";
  import { moveItem, removeItem, duplicateItem, newHomeSection } from "../lib/model.js";
  import { confirmAsk } from "../lib/api.js";
  import { addBlockAt, hasSpecial, convertSpecial, migrateAllSpecial, undoMigration } from "../lib/actions.js";

  const items = $derived(app.kind === "home" ? app.data?.sections || [] : app.data?.blocks || []);
  const current = $derived(app.kind === "home" ? "__home" : app.slug);

  async function onPage(e) {
    const v = e.target.value;
    if (v === "__home") await openHome();
    else await openPage(v);
  }
  function up(i) {
    const j = moveItem(items, i, -1);
    if (j !== i) select(j);
  }
  function down(i) {
    const j = moveItem(items, i, 1);
    if (j !== i) select(j);
  }
  function dup(i) {
    duplicateItem(items, i);
    select(i + 1);
  }
  async function del(i) {
    if (!(await confirmAsk("Видалити цей " + (app.kind === "home" ? "розділ" : "блок") + "?"))) return;
    removeItem(items, i);
    select(items.length ? Math.min(i, items.length - 1) : null, false);
  }
  function addBlock() {
    addBlockAt(typeof app.selected === "number" ? app.selected + 1 : items.length);
  }
  function addSection() {
    items.push(newHomeSection());
    select(items.length - 1);
  }
  async function removePage() {
    const slug = app.slug;
    const n = await countHomeCards(slug);
    const extra = n ? `\n\nТакож буде прибрано ${n} ${n === 1 ? "картку" : "карток"} на головній, що веде на цю сторінку.` : "";
    if (!(await confirmAsk(`Видалити сторінку «${app.data?.breadcrumb || slug}»?\n\nКопію буде збережено в .constructor-backup — сторінку можна повернути кнопкою в бічній панелі.${extra}`))) return;
    try {
      await deletePage(slug);
    } catch (e) {
      app.error = "Не вдалося видалити: " + (e?.message || e);
    }
  }
  const special = $derived(app.kind === "page" ? hasSpecial(app.data) : 0);
  let migrating = $state(false);
  async function convertHere() {
    convertSpecial(app.data);
  }
  async function convertAll() {
    migrating = true;
    try {
      const r = await migrateAllSpecial();
      app.error = "";
      if (!r.total) app.lastMigration = null;
    } catch (e) {
      app.error = "Не вдалося розібрати: " + (e?.message || e);
    } finally {
      migrating = false;
    }
  }
  async function undoDelete() {
    try {
      await undoDeletePage();
    } catch (e) {
      app.error = "Не вдалося повернути сторінку: " + (e?.message || e);
    }
  }
  async function undoMigrate() {
    try {
      await undoMigration();
      app.error = "";
    } catch (e) {
      app.error = "Не вдалося скасувати міграцію: " + (e?.message || e);
    }
  }
  const label = (b) => (app.kind === "home" ? "Розділ" : typeLabel(b.type));
  const sub = (b) => (app.kind === "home" ? b.title : blockTitle(b));
</script>

<aside class="sidebar">
  <div class="side-head">
    <label class="lbl" for="pagesel">Сторінка</label>
    <select id="pagesel" value={current} onchange={onPage}>
      <option value="__home">🏠 Головна</option>
      {#each app.pages as p (p.slug)}
        <option value={p.slug}>{p.title}</option>
      {/each}
    </select>
    <div class="row">
      <button class="btn small grow" onclick={() => (app.modal = "newpage")}>+ Нова сторінка</button>
      {#if app.kind === "page"}<button class="btn small danger" title="Видалити цю сторінку" onclick={removePage}>🗑 Видалити</button>{/if}
    </div>
  </div>

  {#if app.lastDeleted}
    <div class="notice ok side-note">
      <b>Сторінку «{app.lastDeleted.title}» видалено.</b>
      Копію збережено в .constructor-backup.
      <div class="row">
        <button class="btn small" onclick={undoDelete}>Повернути</button>
        <button class="btn small ghost" onclick={() => (app.lastDeleted = null)}>Закрити</button>
      </div>
    </div>
  {/if}
  {#if app.lastMigration}
    <div class="notice ok side-note">
      <b>Розібрано блоків: {app.lastMigration.total}.</b>
      Копії сторінок збережено в .constructor-backup.
      <div class="row">
        <button class="btn small" onclick={undoMigrate}>Скасувати міграцію</button>
        <button class="btn small ghost" onclick={() => (app.lastMigration = null)}>Закрити</button>
      </div>
    </div>
  {/if}

  {#if app.kind === "page"}
    <button class="side-item settings" class:active={app.selected === "hero"} onclick={() => select("hero")}>
      <span class="gear">⚙</span>
      <span class="txt"><span class="t">Налаштування сторінки</span><span class="s">верхній екран, SEO, дані заявки</span></span>
    </button>
  {/if}

  <div class="side-title">{app.kind === "home" ? "Розділи" : "Блоки сторінки"}</div>
  <div class="blocklist">
    {#each items as b, i (i)}
      <div class="side-item" class:active={app.selected === i} role="button" tabindex="0" onclick={() => select(i)} onkeydown={(e) => e.key === "Enter" && select(i)}>
        <span class="idx">{i + 1}</span>
        <span class="txt"><span class="t">{label(b)}</span><span class="s">{sub(b)}</span></span>
        <span class="tools">
          <button title="Вгору" onclick={(e) => { e.stopPropagation(); up(i); }}>↑</button>
          <button title="Вниз" onclick={(e) => { e.stopPropagation(); down(i); }}>↓</button>
          <button title="Дублювати" onclick={(e) => { e.stopPropagation(); dup(i); }}>⎘</button>
          <button title="Видалити" class="danger" onclick={(e) => { e.stopPropagation(); del(i); }}>✕</button>
        </span>
      </div>
    {/each}
  </div>
  {#if special}
    <div class="notice warn side-note">
      <b>Особливих блоків: {special}.</b> Їх можна розібрати на елементи й редагувати повністю.
      <div class="row"><button class="btn small" onclick={convertHere}>Розібрати тут</button><button class="btn small" disabled={migrating} onclick={convertAll}>У всіх сторінках</button></div>
    </div>
  {/if}
  {#if app.kind === "page"}
    <button class="btn add" onclick={addBlock}>+ Додати блок</button>
  {:else}
    <button class="btn add" onclick={addSection}>+ Додати розділ</button>
  {/if}
</aside>
