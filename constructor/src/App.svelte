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

  // Розміри панелей (px) + згортання структури — зберігаємо в localStorage.
  // Панель редагування не зберігаємо: вона відкривається на вибір елемента й ховається "Готово".
  const ls = (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v != null ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  };
  let leftW = $state(ls("ui.leftW", 260));
  let rightW = $state(ls("ui.editorW", 460));
  let leftCollapsed = $state(ls("ui.leftCollapsed", false));
  let rightCollapsed = $state(true);
  let zoom = $state(ls("ui.zoom", 100));

  $effect(() => {
    localStorage.setItem("ui.leftW", JSON.stringify(leftW));
    localStorage.setItem("ui.editorW", JSON.stringify(rightW));
    localStorage.setItem("ui.leftCollapsed", JSON.stringify(leftCollapsed));
    localStorage.setItem("ui.zoom", JSON.stringify(zoom));
  });

  const leftPx = $derived(leftCollapsed ? 0 : Math.max(180, Math.min(420, leftW)));
  // Редактор — накладка поверх перегляду, тому може бути ширшим за стару колонку.
  const rightPx = $derived(rightCollapsed ? 0 : Math.max(320, Math.min(900, rightW)));

  // Панель редагування сама з'являється, коли щось обрано, і згортається,
  // коли вибір зник (напр. перейшли на іншу сторінку). Ручне "Готово" поважаємо:
  // поки вибір не зміниться, панель не відкривається знову.
  let lastEditKey = null;
  $effect(() => {
    const key =
      app.selected === null && !app.sub
        ? ""
        : `${app.kind}:${app.slug}:${app.selected ?? ""}:${app.editTick}:${app.sub ? "sub" : ""}`;
    if (key === lastEditKey) return;
    const had = lastEditKey;
    lastEditKey = key;
    if (key) rightCollapsed = false;
    else if (had) rightCollapsed = true;
  });

  const cols = $derived(
    [
      `${leftCollapsed ? 0 : leftPx}px`,
      `${leftCollapsed ? 0 : 5}px`,
      "minmax(280px, 1fr)",
    ].join(" "),
  );

  function startResize(side, ev) {
    ev.preventDefault();
    const startX = ev.clientX;
    const startL = leftW;
    const startR = rightW;
    const onMove = (e) => {
      const dx = e.clientX - startX;
      if (side === "left") leftW = Math.max(180, Math.min(420, startL + dx));
      else rightW = Math.max(320, Math.min(900, startR - dx));
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

      // Закриття вікна: спершу зберігаємо, потім закриваємо самі.
      // event.preventDefault() беремо одразу — інакше Tauri може закрити вікно
      // до завершення збереження, а якщо обробник упаде, вікно «зависне».
      try {
        const win = getCurrentWindow();
        const un = await win.onCloseRequested(async (event) => {
          event.preventDefault();
          try {
            await flush();
          } catch (e) {
            app.error = "Не вдалося зберегти: " + (e?.message || e);
          }
          if (app.dirty) {
            let closeAnyway = false;
            try {
              closeAnyway = await confirmAsk("Не вдалося зберегти останні зміни. Закрити без збереження?");
            } catch {
              closeAnyway = false;
            }
            if (!closeAnyway) return; // лишаємо вікно відкритим
          }
          try {
            await win.destroy();
          } catch (e) {
            app.error = "Не вдалося закрити вікно: " + (e?.message || e);
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
    if (e.key === "Escape") {
      if (app.modal) return;
      if (isTyping(e)) e.target.blur();
      if (!rightCollapsed) {
        e.preventDefault();
        rightCollapsed = true;
      }
      return;
    }
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
      <div class="device-toggle" role="group" aria-label="Вигляд перегляду">
        <button
          class="btn ghost icon-btn"
          class:active={!app.phone}
          title="Комп’ютер"
          aria-label="Комп’ютер"
          aria-pressed={!app.phone}
          onclick={() => (app.phone = false)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
              <path stroke-dasharray="8" d="M12 21h5M12 21h-5M12 21v-4">
                <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.4s" values="8;0"></animate>
              </path>
              <path stroke-dasharray="62" stroke-dashoffset="62" d="M12 17h-9v-12h18v12Z">
                <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.4s" dur="0.6s" to="0"></animate>
              </path>
            </g>
          </svg>
        </button>
        <button
          class="btn ghost icon-btn"
          class:active={app.phone}
          title="Телефон"
          aria-label="Телефон"
          aria-pressed={app.phone}
          onclick={() => (app.phone = true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3m-2 20h-4v-1h4zm3.25-3H6.75V4h10.5z"></path>
          </svg>
        </button>
      </div>
      <div class="page-title">{title}</div>
      <div class="top-actions">
        <label class="zoom-ctl" title="Масштаб попереднього перегляду (подвійний клік — 100%)">
          <span class="zoom-lbl">Масштаб</span>
          <input
            type="range"
            min="50"
            max="150"
            step="5"
            value={zoom}
            aria-label="Масштаб попереднього перегляду"
            oninput={(e) => (zoom = Number(e.currentTarget.value))}
            ondblclick={() => (zoom = 100)}
          />
          <span class="zoom-val">{zoom}%</span>
        </label>
        <button
          class="btn ghost icon-btn"
          class:active={!leftCollapsed}
          title={leftCollapsed ? "Показати структуру (Ctrl+Shift+B)" : "Сховати структуру"}
          aria-label={leftCollapsed ? "Показати структуру" : "Сховати структуру"}
          aria-pressed={!leftCollapsed}
          onclick={() => (leftCollapsed = !leftCollapsed)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
            <path fill="currentColor" d="M23 9.005h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v1H11v-1a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h4v20a2 2 0 0 0 2 2h4v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v1h-4v-9h4v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v1h-4v-9h4v1a2 2 0 0 0 2 2m0-6h6v4h-6Zm-14 4H3v-4h6Zm14 18h6v4h-6Zm0-11h6v4h-6Z"></path>
          </svg>
        </button>
        <button
          class="btn ghost icon-btn"
          class:active={!rightCollapsed}
          title={rightCollapsed ? "Показати редактор (Ctrl+Shift+E)" : "Сховати редактор (Esc)"}
          aria-label={rightCollapsed ? "Показати редактор" : "Сховати редактор"}
          aria-pressed={!rightCollapsed}
          onclick={() => (rightCollapsed = !rightCollapsed)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M4 13.885V8.769h7.5v5.116zm0-6.116V5.616q0-.667.475-1.141T5.615 4h12.77q.666 0 1.14.475T20 5.615V7.77zM14.039 21q-.344 0-.576-.232t-.232-.576v-.73q0-.332.133-.633q.134-.3.351-.518l4.848-4.828q.148-.13.306-.19t.315-.062q.172 0 .337.064t.302.193l.925.945q.123.148.187.307q.065.16.065.32t-.052.322t-.2.31l-4.829 4.83q-.217.217-.518.347q-.3.131-.632.131zm5.152-4.985l.925-.956l-.925-.943l-.95.95zM5.616 20q-.667 0-1.141-.475T4 18.386v-3.5h7.5V20zm6.884-6.115V8.769H20v2.935q-.72-.214-1.477-.039q-.758.176-1.327.745l-1.494 1.474z"></path>
          </svg>
        </button>
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
    <div class="workspace" style="grid-template-columns: {cols}">
      <div class="pane side" class:collapsed={leftCollapsed}>
        {#if !leftCollapsed}<Sidebar />{/if}
      </div>
      <div
        class="splitter"
        class:off={leftCollapsed}
        role="separator"
        aria-orientation="vertical"
        onpointerdown={(e) => !leftCollapsed && startResize("left", e)}
      ></div>
      <Preview {zoom} />
      {#if !rightCollapsed}
        <div class="pane form overlay open" style="width: {rightPx}px">
          <div
            class="panel-grip"
            role="separator"
            aria-orientation="vertical"
            title="Потягніть, щоб змінити ширину панелі"
            onpointerdown={(e) => startResize("right", e)}
          ></div>
          <FormPanel onclose={() => (rightCollapsed = true)} />
        </div>
      {/if}
    </div>
  </div>
  {#if app.modal === "picker"}<TilePicker />{/if}
  {#if app.modal === "newpage"}<NewPage />{/if}
  {#if app.modal === "publish"}<PublishDialog />{/if}
{/if}
