<script>
  import { onMount } from "svelte";
  import { app, openRepo } from "../lib/store.svelte.js";
  import { pickFolder, join } from "../lib/api.js";
  import { gitVersion, clone } from "../lib/git.js";

  let git = $state(undefined);
  let busy = $state(false);
  let error = $state("");
  let url = $state("");
  let parent = $state("");
  let folder = $state("");

  onMount(async () => (git = await gitVersion()));

  async function chooseExisting() {
    error = "";
    const p = await pickFolder("Оберіть папку з сайтом (де лежить src і package.json)");
    if (!p) return;
    try {
      busy = true;
      await openRepo(p);
    } catch (e) {
      error = e.message || String(e);
    } finally {
      busy = false;
    }
  }
  async function chooseParent() {
    const p = await pickFolder("Куди завантажити сайт?");
    if (p) parent = p;
  }
  $effect(() => {
    const m = /\/([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
    if (m && !folder) folder = m[1];
  });
  async function doClone() {
    error = "";
    if (!url.trim() || !parent || !folder.trim()) { error = "Вкажіть адресу, папку і назву."; return; }
    try {
      busy = true;
      await clone(parent, url.trim(), folder.trim());
      await openRepo(join(parent, folder.trim()));
    } catch (e) {
      error = e.message || String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="welcome">
  <div class="welcome-card">
    <div class="logo big"></div>
    <h1>Конструктор сайту</h1>
    <p class="muted">Редагуйте сторінки, додавайте блоки та публікуйте на сайт одним кліком.</p>

    {#if git === null}
      <div class="notice warn">
        <b>Не знайдено Git.</b> Він потрібен, щоб відправляти зміни на сайт. Встановіть «Git for Windows» (git-scm.com), залишивши всі параметри за замовчуванням, і перезапустіть програму.
      </div>
    {/if}

    <h3>Уже є папка з сайтом</h3>
    <button class="btn primary" disabled={busy} onclick={chooseExisting}>Обрати папку…</button>

    <h3>Завантажити сайт із GitHub</h3>
    <label class="f">Адреса репозиторію
      <input type="text" placeholder="https://github.com/логін/назва.git" bind:value={url} />
    </label>
    <div class="row">
      <button class="btn" onclick={chooseParent}>Куди зберегти…</button>
      <span class="muted small">{parent || "папку ще не обрано"}</span>
    </div>
    <label class="f">Назва папки
      <input type="text" bind:value={folder} />
    </label>
    <button class="btn" disabled={busy || git === null} onclick={doClone}>{busy ? "Завантажуємо…" : "Завантажити"}</button>

    {#if error}<pre class="notice err">{error}</pre>{/if}
  </div>
</div>
