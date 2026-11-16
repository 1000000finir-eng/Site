<script>
  import Fields from "./Fields.svelte";
  import ElementsEditor from "./ElementsEditor.svelte";
  import { rec } from "../lib/ensure.js";
  import { blockToFree, canFree } from "../lib/convert.js";
  import { confirmAsk } from "../lib/api.js";
  import { app, select } from "../lib/store.svelte.js";
  import { fieldsOf, typeLabel } from "../lib/schema.js";
  import HomeCards from "./HomeCards.svelte";
  import { SECTION_FIELDS } from "../lib/homeFields.js";

  let { onclose = () => {} } = $props();

  let formBody = $state();
  // Новий блок — форма починається з початку, а не з місця, де був скрол.
  $effect(() => {
    app.selected;
    app.sub;
    app.focusCard;
    if (formBody) formBody.scrollTop = 0;
  });

  const idx = $derived(typeof app.selected === "number" ? app.selected : null);
  const block = $derived(app.kind === "page" && idx !== null ? app.data?.blocks?.[idx] : null);
  const section = $derived(app.kind === "home" && idx !== null ? app.data?.sections?.[idx] : null);
  const blockFields = $derived(block ? fieldsOf(block.type) : null);

  // Блоки, у яких основний вміст — масив elements (не body)
  const hasElements = $derived(
    !!block && Array.isArray(block.elements) && (block.type === "final" || block.type === "section" || block.type === "intro"),
  );

  // --- вільні блоки ---
  const FREE_TOP = [
    { kind: "string", name: "tag", label: "HTML-тег блоку", advanced: true },
    { kind: "string", name: "cls", label: "CSS-класи блоку (його стиль)", advanced: true, optional: true },
  ];
  $effect(() => {
    if (block && block.type === "free" && !block.attrs) block.attrs = {};
  });
  async function makeFree() {
    if (!(await confirmAsk("Розібрати цей блок на окремі елементи? Увесь вміст збережеться, але готова форма цього блоку зникне. Скасувати можна через Ctrl+Z."))) return;
    app.data.blocks[idx] = blockToFree(block, app.data);
  }

  // --- налаштування сторінки ---
  const S = (name, label, extra = {}) => ({ kind: "string", name, label, ...extra });
  const HERO = [
    { kind: "image", name: "image", label: "Фото верхнього екрана" },
    S("title", "Головний напис (великими літерами)"),
    S("headline", "Другий рядок", { optional: true }),
    S("sub", "Підзаголовок", { optional: true }),
  ];
  const BOOKING = [
    S("product", "Назва для заявки (її бачите ви в листі й Telegram)"),
    S("price", "Ціна (напр. 1500 ₴; порожньо — домовна)", { optional: true }),
    S("pay_link", "Посилання на оплату WayForPay", { optional: true }),
    { kind: "select", name: "email_template", label: "Лист клієнту", options: [{ value: "free", label: "Безкоштовна послуга" }, { value: "paid", label: "Платна послуга" }] },
    { kind: "bool", name: "send_email", label: "Надсилати лист клієнту" },
    { kind: "bool", name: "redirect", label: "Після заявки переходити на оплату" },
  ];
  const SEO = [
    S("breadcrumb", "Назва сторінки в навігації"),
    S("title", "Заголовок для Google", { hint: "Показується у вкладці браузера і в результатах пошуку" }),
    { kind: "text", name: "description", label: "Опис для Google" },
    S("og_title", "Заголовок для соцмереж", { optional: true }),
    { kind: "text", name: "og_description", label: "Опис для соцмереж", optional: true },
    { kind: "image", name: "og_image", label: "Картинка для соцмереж", optional: true },
  ];

  // Поля final без body (бо контент у elements)
  const FINAL_FIELDS = [
    S("title", "Заголовок", { hint: "Для переносу рядка напишіть <br>" }),
    S("cta_text", "Текст кнопки", { optional: true }),
  ];

  // Поля section (заголовок) — elements окремо
  const SECTION_TOP = [
    S("id", "Якір (id) для посилання /#id", { optional: true, advanced: true }),
    S("cls", "CSS-класи секції", { optional: true, advanced: true }),
    S("kicker", "Надзаголовок", { optional: true }),
    S("title", "Заголовок", { optional: true, hint: "Для переносу рядка напишіть <br>" }),
    {
      kind: "select",
      name: "heading",
      label: "Як показувати заголовок",
      options: [
        { value: "block", label: "Окремим блоком" },
        { value: "inline", label: "В рядок" },
        { value: "none", label: "Без заголовка (тільки вміст)" },
      ],
      optional: true,
    },
  ];

  let jsonText = $state("");
  let jsonErr = $state("");
  $effect(() => {
    if (block && !blockFields && block.type !== "raw" && !hasElements) {
      jsonText = JSON.stringify(block, null, 2);
      jsonErr = "";
    }
  });
  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      app.data.blocks[idx] = parsed;
      jsonErr = "";
    } catch (e) {
      jsonErr = "Помилка в тексті: " + e.message;
    }
  }

  // Якщо в final був старий body — один раз перенести в elements
  $effect(() => {
    if (!block || block.type !== "final") return;
    if (Array.isArray(block.elements) && block.elements.length) return;
    if (typeof block.body === "string" && block.body.trim()) {
      block.elements = [{ t: "p", md: block.body }];
      block.body = "";
    } else if (!Array.isArray(block.elements)) {
      block.elements = [];
    }
  });
</script>

<aside class="form-panel">
  {#snippet closeBtn()}
    <button class="icon-close" title="Згорнути панель (Esc)" aria-label="Згорнути панель" onclick={onclose}>→</button>
  {/snippet}
  {#if app.kind === "page" && app.selected === "hero" && app.data}
    <div class="form-head"><h2>Налаштування сторінки</h2><span class="muted small">/{app.slug}/</span>{@render closeBtn()}</div>
    <div class="form-body" bind:this={formBody}>
      <h4>Верхній екран</h4>
      <Fields fields={HERO} obj={app.data.hero} />
      <h4>Заявка (йде на бекенд)</h4>
      <Fields fields={BOOKING} obj={app.data.booking} />
      <h4>Назва та пошук (SEO)</h4>
      <Fields fields={SEO} obj={app.data} />
    </div>
  {:else if block && app.sub}
    {@const subFields = fieldsOf(app.sub.type) || []}
    <div class="form-head">
      <h2>Вставка: {typeLabel(app.sub.type)}</h2>
      <button class="btn small" onclick={() => (app.sub = null)}>← До блоку</button>
      {@render closeBtn()}
    </div>
    <div class="form-body" bind:this={formBody}>
      <div class="notice" style="margin-bottom:12px">
        Це вставка всередині блоку. Зміни видно одразу в перегляді зліва.
      </div>
      {#if subFields.length}
        <Fields fields={subFields} obj={app.sub} />
      {:else}
        <p class="muted">Ця вставка без налаштувань.</p>
      {/if}
    </div>
  {:else if block}
    <div class="form-head">
      <h2>{typeLabel(block.type)}</h2>
      <span class="muted small">блок {idx + 1}</span>
      {@render closeBtn()}
    </div>
    <div class="form-body" bind:this={formBody}>
      {#if block.type === "section" || block.type === "raw"}
        <div class="notice warn" style="margin-bottom:12px">
          Особливий блок. Розберіть його на елементи — і можна буде змінювати все: тексти, порядок, вставки.
          <div style="margin-top:8px"><button class="btn small primary" onclick={makeFree}>Розібрати на елементи</button></div>
        </div>
      {/if}
      {#if block.type === "free"}
        <Fields fields={FREE_TOP} obj={block} />
        <label class="field"><span class="lbl">Якір (id) для посилання /#id <i>· необов’язково</i></span>
          <input type="text" value={block.attrs?.id ?? ""} oninput={(e) => { const v = e.target.value.trim(); if (v) rec(block, "attrs").id = v; else if (block.attrs) delete block.attrs.id; }} />
        </label>
        <ElementsEditor bind:elements={block.elements} />
      {:else if block.type === "final"}
        <Fields fields={FINAL_FIELDS} obj={block} />
        <ElementsEditor bind:elements={block.elements} />
      {:else if block.type === "section"}
        <Fields fields={SECTION_TOP} obj={block} />
        <ElementsEditor bind:elements={block.elements} />
      {:else if blockFields}
        <Fields fields={blockFields} obj={block} />
      {:else if block.type === "raw"}
        <div class="notice warn">Це власний HTML. Змінюйте обережно.</div>
        <textarea class="code" rows="16" bind:value={block.html}></textarea>
      {:else}
        <div class="notice warn">Складний блок без готової форми. Змінюйте лише текст у лапках.</div>
        <textarea class="code" rows="18" bind:value={jsonText}></textarea>
        {#if jsonErr}<div class="notice err">{jsonErr}</div>{/if}
        <button class="btn" onclick={applyJson}>Застосувати зміни</button>
      {/if}
      {#if canFree(block) && block.type !== "section" && block.type !== "raw"}
        <div class="free-bar">
          <span>Потрібна повна свобода — міняти елементи місцями, додавати будь-що?</span>
          <button class="btn small" onclick={makeFree}>Розібрати на елементи</button>
        </div>
      {/if}
    </div>
  {:else if section}
    <div class="form-head"><h2>Розділ</h2><span class="muted small">розділ {idx + 1}</span>{@render closeBtn()}</div>
    <div class="form-body" bind:this={formBody}>
      <Fields fields={SECTION_FIELDS} obj={section} />
      <HomeCards {section} si={idx} />
    </div>
  {:else}
    <div class="form-head"><h2>Редактор</h2>{@render closeBtn()}</div>
    <div class="empty">
      <div class="big-ico">👆</div>
      <h3>Оберіть, що редагувати</h3>
      <p>Клацніть на будь-який блок у попередньому перегляді або виберіть його у списку ліворуч.</p>
      {#if app.kind === "page"}<button class="btn" onclick={() => select("hero")}>Налаштування сторінки</button>{/if}
    </div>
  {/if}
</aside>
