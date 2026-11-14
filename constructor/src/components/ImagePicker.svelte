<script>
  import { app } from "../lib/store.svelte.js";
  import { listDir, pickImage, copyFile, exists, join, baseName } from "../lib/api.js";
  import Thumb from "./Thumb.svelte";

  let { value = $bindable(), oninput = null } = $props();
  let open = $state(false);
  let images = $state([]);
  let error = $state("");

  async function openModal() {
    error = "";
    try {
      images = (await listDir(join(app.repo, "src/assets/images"))).filter((n) => /\.(jpe?g|png|webp|gif|svg)$/i.test(n));
    } catch {
      images = [];
    }
    open = true;
  }
  async function upload() {
    error = "";
    try {
      const p = await pickImage();
      if (!p) return;
      let name = baseName(p).replace(/\s+/g, "-");
      const dir = join(app.repo, "src/assets/images");
      if (await exists(join(dir, name))) name = Date.now() + "-" + name;
      await copyFile(p, join(dir, name));
      value = "/assets/images/" + name;
      oninput?.(value);
      open = false;
    } catch (e) {
      error = e?.message || String(e);
    }
  }
  const choose = (n) => {
    value = "/assets/images/" + n;
    oninput?.(value);
    open = false;
  };
</script>

<div class="imgpick">
  <div class="thumb"><Thumb path={value} /></div>
  <div class="info">
    <div class="path">{value || "картинку не обрано"}</div>
    <button type="button" class="btn small" onclick={openModal}>Змінити…</button>
  </div>
</div>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-back" role="presentation" onclick={() => (open = false)}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="modal wide" role="dialog" onclick={(e) => e.stopPropagation()}>
      <div class="modal-head">
        <h3>Оберіть картинку</h3>
        <button class="btn small" onclick={upload}>⬆ Завантажити нову…</button>
        <button class="btn ghost" onclick={() => (open = false)}>✕</button>
      </div>
      {#if error}<div class="notice err">{error}</div>{/if}
      <div class="imggrid">
        {#each images as n (n)}
          <button class="imgcell" class:cur={value === "/assets/images/" + n} onclick={() => choose(n)} title={n}>
            <Thumb path={"/assets/images/" + n} />
            <span>{n}</span>
          </button>
        {:else}
          <p class="muted">У папці assets/images поки немає картинок — завантажте нову.</p>
        {/each}
      </div>
    </div>
  </div>
{/if}
