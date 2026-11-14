<script>
  import { app, createPage, openPage, addCardToHome, readHome, pageExists } from "../lib/store.svelte.js";
  import { newPageData, slugify, newHomeCard } from "../lib/model.js";

  let title = $state("");
  let slug = $state("");
  let slugTouched = $state(false);
  let addCard = $state(true);
  let sectionIdx = $state(0);
  let sections = $state([]);
  let error = $state("");
  let busy = $state(false);

  $effect(() => {
    if (!slugTouched) slug = slugify(title);
  });
  $effect(() => {
    readHome().then((h) => (sections = h.sections.map((s, i) => ({ i, title: s.title }))));
  });

  async function create() {
    error = "";
    if (!title.trim()) { error = "Введіть назву послуги."; return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { error = "Адреса — лише латиниця, цифри та дефіс."; return; }
    if (await pageExists(slug)) { error = "Сторінка з такою адресою вже є."; return; }
    try {
      busy = true;
      await createPage(newPageData({ title: title.trim(), slug }));
      if (addCard && sections.length) await addCardToHome(sectionIdx, { ...newHomeCard(), title: title.trim(), link: `/${slug}/` });
      await openPage(slug);
      app.modal = null;
    } catch (e) {
      error = e?.message || String(e);
    } finally {
      busy = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-back" role="presentation" onclick={() => (app.modal = null)}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div class="modal" role="dialog" onclick={(e) => e.stopPropagation()}>
    <div class="modal-head"><h3>Нова сторінка послуги</h3><button class="btn ghost" onclick={() => (app.modal = null)}>✕</button></div>
    <div class="modal-body">
      <label class="f">Назва послуги<input type="text" bind:value={title} placeholder="Наприклад: Консультація для власників" /></label>
      <label class="f">Адреса сторінки<input type="text" bind:value={slug} oninput={() => (slugTouched = true)} />
        <span class="hint">сайт/{slug || "…"}/ — латиниця, вона підставляється автоматично</span></label>
      <label class="check"><input type="checkbox" bind:checked={addCard} /> <span>Одразу додати картку на головну</span></label>
      {#if addCard && sections.length}
        <label class="f">У розділ
          <select bind:value={sectionIdx}>{#each sections as s (s.i)}<option value={s.i}>{s.title}</option>{/each}</select>
        </label>
      {/if}
      <p class="muted small">Сторінка створиться з типовим набором блоків (вступ, текст, питання, завершення) — далі змінюйте й додавайте блоки.</p>
      {#if error}<div class="notice err">{error}</div>{/if}
    </div>
    <div class="modal-foot"><button class="btn" onclick={() => (app.modal = null)}>Скасувати</button><button class="btn primary" disabled={busy} onclick={create}>{busy ? "Створюємо…" : "Створити"}</button></div>
  </div>
</div>
