<script>
  import { onMount, untrack } from "svelte";
  import { app, select } from "../lib/store.svelte.js";
  import { arr } from "../lib/ensure.js";
  import { pageBody, homeBody, buildDoc, lastInserts } from "../lib/render.js";
  import { loadCss, inlineAssets } from "../lib/preview-assets.js";
  import { decoratePage, decorateHome, markSelected } from "../lib/decorate.js";
  import * as A from "../lib/actions.js";
  import { fieldsOf, typeLabel } from "../lib/schema.js";
  import { moveItem, removeItem, newHomeCard, newHomeSection } from "../lib/model.js";
  import { confirmAsk } from "../lib/api.js";

  let frame = $state();
  let scrollY = 0;
  let timer;
  let version = 0;

  async function rebuild(kind) {
    const my = ++version;
    const data = app.data;
    if (!data) return;
    const body = kind === "home" ? homeBody(data) : pageBody(data);
    const css = await loadCss(app.repo, kind === "home" ? null : data.css);
    const html = await inlineAssets(app.repo, buildDoc({ body, css, selected: app.selected }));
    if (my !== version || !frame) return;
    frame.srcdoc = html;
  }

  // Будь-яка зміна даних → оновити перегляд (з невеликою затримкою)
  $effect(() => {
    if (!app.data) return;
    JSON.stringify(app.data);
    const kind = app.kind;
    app.slug;
    clearTimeout(timer);
    timer = setTimeout(() => untrack(() => rebuild(kind)), 180);
  });

  // Виділення блоку
  $effect(() => {
    const s = app.selected;
    const doc = frame?.contentDocument;
    if (doc?.body) markSelected(doc, s);
  });
  // Прокрутка до блоку (вибір зі списку ліворуч)
  $effect(() => {
    app.gotoTick;
    const t = untrack(() => app.gotoTarget);
    const doc = frame?.contentDocument;
    if (t === null || !doc?.body) return;
    doc.querySelector(`[data-i="${t}"]`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });

  const pageCtx = () => ({
    inserts: lastInserts(),
    label: (i) => typeLabel(app.data.blocks[i]?.type),
    hasInserts: (i) => !!app.data.blocks[i] && app.data.blocks[i].type !== "faq",
    onSelect: (i) => select(i, false),
    onMove: (i, d) => A.moveBlock(i, d),
    onDup: (i) => A.dupBlock(i),
    onDel: (i) => A.delBlock(i),
    onAddAt: (i) => A.addBlockAt(i),
    onAddInsert: (i) => A.addInsertToBlock(i),
    insertLabel: (it) => typeLabel(it.type),
    onEditInsert: (it, bi) => {
      if (bi >= 0) select(bi, false);
      app.sub = it;
    },
    onMoveInsert: (it, d) => {
      const arr = findArr(app.data.blocks, it);
      if (arr) moveItem(arr, arr.indexOf(it), d);
    },
    onDelInsert: async (it) => {
      const arr = findArr(app.data.blocks, it);
      if (arr && (await confirmAsk("Видалити цю вставку?"))) {
        removeItem(arr, arr.indexOf(it));
        app.sub = null;
      }
    },
  });
  function findArr(node, it) {
    if (Array.isArray(node)) {
      if (node.includes(it)) return node;
      for (const x of node) {
        const r = findArr(x, it);
        if (r) return r;
      }
    } else if (node && typeof node === "object") {
      for (const k of Object.keys(node)) {
        const r = findArr(node[k], it);
        if (r) return r;
      }
    }
    return null;
  }

  const homeCtx = () => ({
    onSelect: (si) => select(si, false),
    onMoveSection: (si, d) => A.moveSection(si, d),
    onDelSection: (si) => A.delSection(si),
    onEditCard: (si, ci) => {
      select(si, false);
      app.focusCard = ci;
    },
    onDelCard: (si, ci) => A.delCard(si, ci),
    onAddCard: (si) => {
      const cards = arr(app.data.sections[si], "cards");
      cards.push(newHomeCard());
      select(si, false);
      app.focusCard = cards.length - 1;
    },
    onMoveCard: (from, to) => {
      const p = A.moveCard(app.data.sections, from, to);
      select(p.si, false);
      app.focusCard = p.ci;
    },
  });

  function onload() {
    const doc = frame?.contentDocument;
    if (!doc?.body) return;
    try {
      if (app.kind === "home") decorateHome(doc, homeCtx());
      else decoratePage(doc, pageCtx());
      markSelected(doc, app.selected);
    } catch (e) {
      console.error("Помилка панелей перегляду", e);
    }
    const win = doc.defaultView;
    win.scrollTo(0, scrollY);
    win.addEventListener("scroll", () => (scrollY = win.scrollY));
  }
</script>

<section class="preview">
  <div class="preview-bar">
    <span title="На головній картку можна тягнути за тіло (не за картинку) між розділами">Наведіть на блок — з’являться кнопки. Картки на головній можна тягнути між розділами.</span>
    <span class="grow"></span>
    <button class="btn small" class:active={!app.phone} onclick={() => (app.phone = false)} title="Комп’ютер">🖥</button>
    <button class="btn small" class:active={app.phone} onclick={() => (app.phone = true)} title="Телефон">📱</button>
  </div>
  <div class="frame-wrap">
    <iframe bind:this={frame} class:phone={app.phone} sandbox="allow-same-origin" title="Попередній перегляд" onload={onload}></iframe>
  </div>
</section>
