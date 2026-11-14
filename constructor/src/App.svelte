<script>
  import { onMount, untrack } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { app, onChange, openRepo, undo, redo, flush, refreshChanges } from "./lib/store.svelte.js";
  import { confirmAsk } from "./lib/api.js";
  import Welcome from "./components/Welcome.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import Preview from "./components/Preview.svelte";
  import FormPanel from "./components/FormPanel.svelte";
  import TilePicker from "./components/TilePicker.svelte";
  import NewPage from "./components/NewPage.svelte";
  import PublishDialog from "./components/PublishDialog.svelte";

  let booting = $state(true);

  // Розміри панелей (px) + згортання — зберігаємо в localStorage
  const ls = (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v != null ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  };
  let leftW = $state(ls("ui.leftW", 260));
  let rightW = $state(ls("ui.rightW", 360));
  let leftCollapsed = $state(ls("ui.leftCollapsed", false));
  let rightCollapsed = $state(ls("ui.rightCollapsed", false));

  $effect(() => {
    localStorage.setItem("ui.leftW", JSON.stringify(leftW));
    localStorage.setItem("ui.rightW", JSON.stringify(rightW));
    localStorage.setItem("ui.leftCollapsed", JSON.stringify(leftCollapsed));
    localStorage.setItem("ui.rightCollapsed", JSON.stringify(rightCollapsed));
  });

  const leftPx = $derived(leftCollapsed ? 0 : Math.max(180, Math.min(420, leftW)));
  const rightPx = $derived(rightCollapsed ? 0 : Math.max(260, Math.min(520, rightW)));

  function startResize(side, ev) {
    ev.preventDefault();
    const startX = ev.clientX;
    const startL = leftW;
    const startR = rightW;
    const onMove = (e) => {
      const dx = e.clientX - startX;
      if (side === "left") leftW = Math.max(180, Math.min(420, startL + dx));
      else rightW = Math.max(260, Math.min(520, startR - dx));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  onMount(() => {
    let alive = true;
    let unlistenClose;
    const beforeUnload = () => flush();

    (async () => {
      if (app.repo) {
        try {
          await openRepo(app.repo);
        } catch {
          app.screen = "welcome";
        }
      }
      if (!alive) return;
      booting = false;

      // Гарантоване збереження перед закриттям вікна: Tauri чекає на цей обробник.
      try {
        const win = getCurrentWindow();
        const un = await win.onCloseRequested(async (event) => {
          await flush();
          if (app.dirty && !(await confirmAsk("Не вдалося зберегти останні зміни. Закрити без збереження?"))) {
            event.preventDefault();
          }
        });
        if (alive) unlistenClose = un;
        else un();
      } catch {
        // У звичайному браузері (vite dev) Tauri-вікна немає — лишається beforeunload.
      }
    })();

    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", beforeUnload);
      unlistenClose?.();
    };
  });

  $effect(() => {
    if (!app.data) return;
    const snap = JSON.stringify(app.data);
    untrack(() => onChange(snap));
  });

  function onKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey && !isTyping(e)) {
      e.preventDefault();
      undo();
    } else if ((k === "y" || (k === "z" && e.shiftKey)) && !isTyping(e)) {
      e.preventDefault();
      redo();
    } else if (k === "s") {
      e.preventDefault();
      flush();
    } else if (k === "b" && e.shiftKey) {
      // Ctrl+Shift+B — згорнути/розгорнути ліву
      e.preventDefault();
      leftCollapsed = !leftCollapsed;
    } else if (k === "e" && e.shiftKey) {
      // Ctrl+Shift+E — згорнути/розгорнути праву (editor)
      e.preventDefault();
      rightCollapsed = !rightCollapsed;
    }
  }
  const isTyping = (e) => ["INPUT", "TEXTAREA"].includes(e.target?.tagName);

  const title = $derived(app.kind === "home" ? "Головна сторінка" : app.data?.breadcrumb || app.data?.title || "");
  const saveLabel = $derived(app.error ? "Помилка збереження" : app.dirty ? "Зберігаємо…" : app.savedAt ? "Збережено на комп’ютері" : "");
</script>

{#if booting}
  <div class="center muted">Завантаження…</div>
{:else if app.screen === "welcome"}
  <Welcome />
{:else}
  <div class="shell">
    <header class="topbar">
      <div class="brand"><span class="logo"></span> Конструктор сайту</div>
      <div class="page-title">{title}</div>
      <div class="top-actions">
        <button
          class="btn ghost"
          title={leftCollapsed ? "Показати структуру (Ctrl+Shift+B)" : "Сховати структуру"}
          onclick={() => (leftCollapsed = !leftCollapsed)}
        >{leftCollapsed ? "▶" : "◀"}</button>
        <button
          class="btn ghost"
          title={rightCollapsed ? "Показати форму (Ctrl+Shift+E)" : "Сховати форму"}
          onclick={() => (rightCollapsed = !rightCollapsed)}
        >{rightCollapsed ? "◀" : "▶"}</button>
        <button class="btn ghost" title="Скасувати (Ctrl+Z)" disabled={!app.canUndo} onclick={undo}>↶</button>
        <button class="btn ghost" title="Повернути (Ctrl+Y)" disabled={!app.canRedo} onclick={redo}>↷</button>
        <span class="save-state" class:err={app.error} title={app.error}>{saveLabel}</span>
        <button
          class="btn primary"
          onclick={async () => {
            await flush();
            await refreshChanges();
            app.modal = "publish";
          }}
        >
          Опублікувати на сайт{#if app.changes}<span class="badge">{app.changes}</span>{:else if app.ahead}<span class="badge" title="Є локальні версії, не відправлені на GitHub">↑{app.ahead}</span>{/if}
        </button>
      </div>
    </header>
    <div
      class="workspace"
      style="grid-template-columns: {leftPx}px 5px minmax(280px, 1fr) 5px {rightPx}px"
    >
      <div class="pane side" class:collapsed={leftCollapsed}>
        {#if !leftCollapsed}<Sidebar />{/if}
      </div>
      <div
        class="splitter"
        role="separator"
        aria-orientation="vertical"
        onpointerdown={(e) => !leftCollapsed && startResize("left", e)}
      ></div>
      <Preview />
      <div
        class="splitter"
        role="separator"
        aria-orientation="vertical"
        onpointerdown={(e) => !rightCollapsed && startResize("right", e)}
      ></div>
      <div class="pane form" class:collapsed={rightCollapsed}>
        {#if !rightCollapsed}<FormPanel />{/if}
      </div>
    </div>
  </div>
  {#if app.modal === "picker"}<TilePicker />{/if}
  {#if app.modal === "newpage"}<NewPage />{/if}
  {#if app.modal === "publish"}<PublishDialog />{/if}
{/if}
