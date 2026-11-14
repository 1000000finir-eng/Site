<script>
  import { app, select } from "../lib/store.svelte.js";
  import { arr } from "../lib/ensure.js";
  import { galleryGroups, newBlock, newInsert, typeLabel, INSERTS } from "../lib/schema.js";
  import { singleBody, insertTile, buildDoc } from "../lib/render.js";
  import { cssBlobUrl, inlineAssets } from "../lib/preview-assets.js";
  import { newPageData } from "../lib/model.js";

  const mode = app.picker?.mode || "block";
  const isIns = mode === "insert";
  const page = app.kind === "page" && app.data ? app.data : newPageData({ title: "Приклад", slug: "example" });

  let q = $state("");
  let cssHref = $state("");
  let docs = $state({});

  const groups = isIns
    ? [{ title: "Вставки", items: INSERTS.map((s) => ({ type: s.name, label: typeLabel(s.name) })) }]
    : galleryGroups();

  const filtered = $derived(
    groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())) }))
      .filter((g) => g.items.length),
  );

  const cssReady = cssBlobUrl(app.repo, page.css).then((u) => (cssHref = u));

  // Перегляд плитки будуємо за потреби (коли вона з'являється у списку)
  async function docFor(type) {
    if (docs[type]) return;
    await cssReady;
    const body = isIns ? insertTile(type, page) : singleBody(newBlock(type), page);
    const html = await inlineAssets(app.repo, buildDoc({ body, cssHref, interactive: false }));
    docs[type] = html;
  }
  function visible(node, type) {
    if (typeof IntersectionObserver === "undefined") {
      docFor(type);
      return {};
    }
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) {
        docFor(type);
        io.disconnect();
      }
    }, { rootMargin: "300px" });
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  function pick(type) {
    if (isIns) {
      const target = app.picker.target;
      const ins = newInsert(type);
      if (Array.isArray(target)) {
        target.push({ t: "ins", ...ins });
      } else {
        const list = arr(target, "inserts");
        list.push(ins);
        app.sub = list[list.length - 1];
      }
    } else {
      const at = app.insertAt ?? app.data.blocks.length;
      app.data.blocks.splice(at, 0, newBlock(type));
      select(at);
    }
    close();
  }
  function close() {
    app.modal = null;
    app.picker = null;
  }
  const onKey = (e) => e.key === "Escape" && close();
</script>

<svelte:window onkeydown={onKey} />
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-back" role="presentation" onclick={close}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div class="modal gallery" role="dialog" onclick={(e) => e.stopPropagation()}>
    <div class="modal-head">
      <div class="grow">
        <h3>{isIns ? "Яку вставку додати?" : "Який блок додати?"}</h3>
        <div class="muted small">Так це виглядатиме на сайті. Текст — приклад, його можна змінити. Esc — закрити.</div>
      </div>
      <input class="search" type="search" placeholder="Пошук…" bind:value={q} />
      <button class="btn ghost" onclick={close}>✕</button>
    </div>
    <div class="tiles-wrap">
      {#each filtered as g (g.title)}
        <div class="g-title">{g.title}</div>
        <div class="tiles" class:ins={isIns}>
          {#each g.items as it (it.type)}
            <button class="tile" data-n={it.type} onclick={() => pick(it.type)}>
              <div class="pv" use:visible={it.type}>
                {#if docs[it.type]}
                  <iframe sandbox="allow-same-origin" tabindex="-1" title={it.label} srcdoc={docs[it.type]}></iframe>
                {:else}
                  <span class="muted small">…</span>
                {/if}
              </div>
              <b>{it.label}</b>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
