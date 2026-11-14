<script>
  import { app, flush, refreshChanges } from "../lib/store.svelte.js";
  import { publish, pull } from "../lib/git.js";

  let message = $state("Оновлення сайту");
  let log = $state([]);
  let busy = $state(false);
  let done = $state(false);
  let error = $state("");

  async function run() {
    error = "";
    done = false;
    log = [];
    busy = true;
    try {
      await flush();
      await publish(app.repo, message.trim() || "Оновлення сайту", (m) => (log = [...log, m]));
      done = true;
    } catch (e) {
      error = e?.message || String(e);
    } finally {
      busy = false;
      refreshChanges();
    }
  }
  async function doPull() {
    error = "";
    busy = true;
    try {
      log = [...log, "Завантажуємо зміни з GitHub…"];
      await pull(app.repo);
      log = [...log, "Готово. Щоб побачити зміни, перевідкрийте сторінку зі списку."];
    } catch (e) {
      error = e?.message || String(e);
    } finally {
      busy = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-back" role="presentation" onclick={() => !busy && (app.modal = null)}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div class="modal" role="dialog" onclick={(e) => e.stopPropagation()}>
    <div class="modal-head"><h3>Опублікувати на сайт</h3><button class="btn ghost" disabled={busy} onclick={() => (app.modal = null)}>✕</button></div>
    <div class="modal-body">
      <p>Змін, ще не відправлених на сайт: <b>{app.changes}</b>. Після публікації сайт оновиться за 1–2 хвилини.</p>
      {#if app.ahead}
        <div class="notice warn">
          Уже збережених локально, але ще не відправлених версій: <b>{app.ahead}</b>.
          Натисніть «Опублікувати», щоб відправити їх на GitHub.
        </div>
      {/if}
      {#if app.changeList?.length}
        <div class="filelist">
          <div class="filelist-title">Буде опубліковано лише ці файли сайту:</div>
          <ul>
            {#each app.changeList as c (c.path)}
              <li>
                <span class="filetag" class:new={c.label === "Новий" || c.label === "Додано"} class:del={c.label === "Видалено"}>{c.label}</span>
                <span class="filepath">{c.path}</span>
              </li>
            {/each}
          </ul>
        </div>
      {:else if !busy && !done && !app.ahead}
        <div class="notice warn">Немає змін у вмісті сайту. Можна опублікувати, щоб перевірити синхронізацію з GitHub.</div>
      {/if}
      <label class="f">Короткий опис змін (необов’язково)<input type="text" bind:value={message} /></label>
      {#if log.length}<ul class="log">{#each log as l}<li>{l}</li>{/each}</ul>{/if}
      {#if done}<div class="notice ok">✔ Опубліковано. Сайт оновиться за 1–2 хвилини.</div>{/if}
      {#if error}<pre class="notice err">{error}</pre>{/if}
    </div>
    <div class="modal-foot">
      <button class="btn" disabled={busy} onclick={doPull} title="Завантажити зміни, які зробив хтось інший">Оновити з GitHub</button>
      <button class="btn primary" disabled={busy} onclick={run}>{busy ? "Публікуємо…" : "Опублікувати"}</button>
    </div>
  </div>
</div>
