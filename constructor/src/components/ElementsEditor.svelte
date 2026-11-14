<script>
  import ElementsEditor from "./ElementsEditor.svelte";
  import RichText from "./RichText.svelte";
  import Fields from "./Fields.svelte";
  import ImagePicker from "./ImagePicker.svelte";
  import { app } from "../lib/store.svelte.js";
  import { moveItem, removeItem, duplicateItem } from "../lib/model.js";
  import { confirmAsk } from "../lib/api.js";
  import { fieldsOf, typeLabel } from "../lib/schema.js";
  import { addInsertTo } from "../lib/actions.js";
  import { arr, rec } from "../lib/ensure.js";
  import { htmlToElements } from "../lib/convert.js";

  /** @type {{ elements: any[], depth?: number, label?: string }} */
  let { elements = $bindable([]), depth = 0, label = "Вміст (абзаци, списки, вставки, фото…)" } = $props();

  const KIND = { p: "Абзац", note: "Примітка", ul: "Список", cta: "Кнопка", steps: "Кроки", how: "Нумерований перелік", cards: "Картки", txt: "Текст", raw: "HTML", ins: "Вставка" };
  const TAGS = { h1: "Заголовок", h2: "Заголовок", h3: "Заголовок", h4: "Підзаголовок", p: "Абзац", div: "Блок", span: "Фрагмент", img: "Фото", a: "Посилання", button: "Кнопка", ul: "Список", ol: "Список", li: "Пункт", section: "Секція", article: "Картка", table: "Таблиця", hr: "Лінія", figure: "Фігура", blockquote: "Цитата", strong: "Жирний", em: "Курсив" };
  const STYLE_PRESETS = [
    { value: "", label: "Звичайний" },
    { value: "diagnostic-final-small", label: "Менший текст (як під кнопкою)" },
    { value: "ec-lead", label: "Акцентний абзац" },
  ];

  const list = $derived(Array.isArray(elements) ? elements : []);
  const ensure = () => {
    if (!Array.isArray(elements)) elements = [];
    return elements;
  };

  function add(kind) {
    const a = ensure();
    const make = {
      p: { t: "p", md: "Новий абзац. Можна виділити **жирним**." },
      h: { t: "el", tag: "h3", md: "Новий заголовок" },
      ul: { t: "ul", items: ["Перший пункт", "Другий пункт"] },
      note: { t: "note", md: "Текст примітки", cls: "soft-box" },
      cta: { t: "cta", text: "ЗАПИСАТИСЯ", inline: true },
      div: { t: "el", tag: "div", kids: [{ t: "p", md: "Текст у блоці." }] },
      img: { t: "el", tag: "img", attrs: { src: "/assets/images/hero.jpg", alt: "" } },
      raw: { t: "raw", html: "<p>HTML</p>" },
    }[kind];
    if (make) a.push(make);
  }
  const addInsert = () => addInsertTo(ensure());

  async function del(i) {
    if (await confirmAsk("Видалити цей елемент?")) removeItem(ensure(), i);
  }

  const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/[*_#`]/g, "").replace(/\s+/g, " ").trim();
  function kindLabel(el) {
    if (el.t === "ins") return typeLabel(el.type);
    if (el.t === "el") return TAGS[el.tag] || `<${el.tag}>`;
    return KIND[el.t] || el.t;
  }
  function titleOf(el) {
    if (!el) return "порожньо";
    if (el.t === "ins") return Array.isArray(el.items) ? `(${el.items.length})` : "";
    if (el.t === "ul") return `(${(el.items || []).length})`;
    if (el.t === "cta") return el.text || "";
    if (el.t === "steps" || el.t === "how") return `(${(el.items || []).length})`;
    if (el.t === "cards") return `(${(el.cards || []).length})`;
    if (el.t === "raw") return strip(el.html).slice(0, 40);
    if (el.t === "el") {
      if (Array.isArray(el.kids)) return el.cls ? `.${el.cls.split(" ")[0]}` : `(${el.kids.length})`;
      const s = strip(el.md).slice(0, 44);
      return s || (el.cls ? `.${el.cls.split(" ")[0]}` : "");
    }
    return strip(el.md).slice(0, 48);
  }
  const isContainer = (el) => el.t === "el" && Array.isArray(el.kids);
  const isVoid = (el) => el.t === "el" && ["img", "hr", "br", "input"].includes(el.tag);

  function toContainer(el) {
    el.kids = el.md ? [{ t: "p", md: el.md }] : [];
    delete el.md;
  }
  function toText(el) {
    const first = (el.kids || []).find((k) => k.md || k.items);
    el.md = first?.md || "";
    delete el.kids;
  }
  function setAttr(el, k, v) {
    rec(el, "attrs")[k] = v;
  }
  function delAttr(el, k) {
    delete el.attrs[k];
    if (!Object.keys(el.attrs).length) delete el.attrs;
  }
  let newKey = $state("");
  function addAttr(el) {
    const k = newKey.trim();
    if (!k) return;
    setAttr(el, k, "");
    newKey = "";
  }
  function parseRaw(i) {
    const html = ensure()[i].html || "";
    const parsed = htmlToElements(html, app.data);
    ensure().splice(i, 1, ...parsed);
  }
</script>

<div class="elements-ed" class:nested={depth > 0}>
  <div class="lbl">{label}</div>
  <div class="list">
    {#each list as el, i (i)}
      <details class="item" open={depth === 0 && list.length <= 4}>
        <summary>
          <span class="n">{i + 1}</span>
          <span class="grow">
            <b class="tag" class:ins={el.t === "ins"}>{kindLabel(el)}</b>
            {titleOf(el)}
          </span>
          <span class="tools">
            <button type="button" title="Вгору" onclick={(e) => { e.preventDefault(); moveItem(ensure(), i, -1); }}>↑</button>
            <button type="button" title="Вниз" onclick={(e) => { e.preventDefault(); moveItem(ensure(), i, 1); }}>↓</button>
            <button type="button" title="Дублювати" onclick={(e) => { e.preventDefault(); duplicateItem(ensure(), i); }}>⎘</button>
            <button type="button" class="danger" title="Видалити" onclick={(e) => { e.preventDefault(); del(i); }}>✕</button>
          </span>
        </summary>
        <div class="item-body">
          {#if el.t === "p" || el.t === "note"}
            <div class="field"><div class="lbl">Текст</div><RichText bind:value={el.md} mode="inline" /></div>
            <label class="field">
              <span class="lbl">Стиль</span>
              <select bind:value={el.cls}>
                {#each STYLE_PRESETS as p (p.value)}<option value={p.value}>{p.label}</option>{/each}
                {#if el.cls && !STYLE_PRESETS.some((p) => p.value === el.cls)}<option value={el.cls}>{el.cls}</option>{/if}
              </select>
            </label>
          {:else if el.t === "txt"}
            <div class="field"><div class="lbl">Текст</div><RichText bind:value={el.md} mode="inline" /></div>
          {:else if el.t === "ul"}
            <div class="lbl">Пункти</div>
            {#each el.items || [] as _, j (j)}
              <div class="row-item">
                <span class="n">{j + 1}</span>
                <input class="grow" type="text" bind:value={el.items[j]} />
                <span class="tools">
                  <button type="button" onclick={() => moveItem(el.items, j, -1)}>↑</button>
                  <button type="button" onclick={() => moveItem(el.items, j, 1)}>↓</button>
                  <button type="button" class="danger" onclick={() => removeItem(el.items, j)}>✕</button>
                </span>
              </div>
            {/each}
            <button type="button" class="btn small add-inline" onclick={() => arr(el, "items").push("Новий пункт")}>+ Пункт</button>
          {:else if el.t === "cta"}
            <label class="field"><span class="lbl">Текст кнопки</span><input type="text" bind:value={el.text} /></label>
            <label class="field">
              <span class="lbl">Що робить кнопка</span>
              <select bind:value={el.action}>
                <option value="price">Відкриває форму запису</option>
                <option value="booking">Відкриває календар бронювання</option>
              </select>
            </label>
            <label class="check"><input type="checkbox" bind:checked={el.inline} /> <span>В окремому рядку по центру</span></label>
            <label class="check"><input type="checkbox" bind:checked={el.light} /> <span>Світла кнопка (для темного фону)</span></label>
          {:else if el.t === "steps"}
            {#each el.items || [] as _, j (j)}
              <div class="sub-card">
                <div class="row-item"><span class="n">{j + 1}</span><input class="grow" type="text" placeholder="Заголовок кроку" bind:value={el.items[j].title} />
                  <span class="tools"><button type="button" onclick={() => moveItem(el.items, j, -1)}>↑</button><button type="button" onclick={() => moveItem(el.items, j, 1)}>↓</button><button type="button" class="danger" onclick={() => removeItem(el.items, j)}>✕</button></span></div>
                <RichText bind:value={el.items[j].text} mode="inline" />
              </div>
            {/each}
            <button type="button" class="btn small add-inline" onclick={() => arr(el, "items").push({ title: "Новий крок", text: "Опис кроку" })}>+ Крок</button>
          {:else if el.t === "how"}
            {#each el.items || [] as _, j (j)}
              <div class="sub-card">
                <div class="row-item"><span class="n">{j + 1}</span><span class="grow"></span>
                  <span class="tools"><button type="button" onclick={() => moveItem(el.items, j, -1)}>↑</button><button type="button" onclick={() => moveItem(el.items, j, 1)}>↓</button><button type="button" class="danger" onclick={() => removeItem(el.items, j)}>✕</button></span></div>
                <RichText bind:value={el.items[j]} mode="inline" />
              </div>
            {/each}
            <button type="button" class="btn small add-inline" onclick={() => arr(el, "items").push("Новий пункт")}>+ Пункт</button>
          {:else if el.t === "cards"}
            <label class="field"><span class="lbl">Клас сітки</span><input type="text" bind:value={el.cls} /></label>
            {#each el.cards || [] as _, j (j)}
              <details class="item" open={depth === 0}>
                <summary>
                  <span class="n">{j + 1}</span><span class="grow">{strip(el.cards[j].title) || "без назви"}</span>
                  <span class="tools"><button type="button" onclick={(e) => { e.preventDefault(); moveItem(el.cards, j, -1); }}>↑</button><button type="button" onclick={(e) => { e.preventDefault(); moveItem(el.cards, j, 1); }}>↓</button><button type="button" class="danger" onclick={(e) => { e.preventDefault(); removeItem(el.cards, j); }}>✕</button></span>
                </summary>
                <div class="item-body">
                  <label class="field"><span class="lbl">Заголовок картки</span><input type="text" bind:value={el.cards[j].title} /></label>
                  <ElementsEditor bind:elements={el.cards[j].elements} depth={depth + 1} label="Вміст картки" />
                </div>
              </details>
            {/each}
            <button type="button" class="btn small add-inline" onclick={() => arr(el, "cards").push({ title: "Нова картка", elements: [{ t: "p", md: "Текст картки" }] })}>+ Картка</button>
          {:else if el.t === "ins"}
            {@const sub = fieldsOf(el.type) || []}
            {#if sub.length}<Fields fields={sub} obj={el} />{:else}<p class="muted small">Без додаткових полів.</p>{/if}
          {:else if el.t === "raw"}
            <div class="notice warn">Сирий HTML. Кнопка нижче розбере його на елементи, які можна редагувати.</div>
            <textarea class="code" rows="5" bind:value={el.html}></textarea>
            <button type="button" class="btn small" onclick={() => parseRaw(i)}>Розібрати на елементи</button>
          {:else if el.t === "el"}
            {#if el.tag === "img"}
              <div class="field"><div class="lbl">Фото</div><ImagePicker value={el.attrs?.src} oninput={(v) => setAttr(el, "src", v)} /></div>
              <label class="field"><span class="lbl">Підпис до фото (для Google)</span><input type="text" value={el.attrs?.alt ?? ""} oninput={(e) => setAttr(el, "alt", e.target.value)} /></label>
            {:else if isContainer(el)}
              <ElementsEditor bind:elements={el.kids} depth={depth + 1} label="Вміст блоку" />
            {:else if !isVoid(el)}
              <div class="field"><div class="lbl">Текст</div><RichText bind:value={el.md} mode="inline" /></div>
            {/if}
            <details class="adv">
              <summary>Додатково (тег, клас, атрибути)</summary>
              <label class="field"><span class="lbl">Тег</span><input type="text" bind:value={el.tag} /></label>
              <label class="field"><span class="lbl">Клас стилю (CSS)</span><input type="text" bind:value={el.cls} /></label>
              {#each Object.keys(el.attrs || {}) as k (k)}
                <div class="row-item">
                  <span class="attr-k">{k}</span>
                  <input class="grow" type="text" value={el.attrs[k]} oninput={(e) => setAttr(el, k, e.target.value)} />
                  <button type="button" class="danger" onclick={() => delAttr(el, k)}>✕</button>
                </div>
              {/each}
              <div class="row-item">
                <input class="grow" type="text" placeholder="новий атрибут (напр. style)" bind:value={newKey} />
                <button type="button" class="btn small" onclick={() => addAttr(el)}>+ Атрибут</button>
              </div>
              {#if !isVoid(el)}
                {#if isContainer(el)}
                  <button type="button" class="btn small" onclick={() => toText(el)}>Зробити простим текстом</button>
                {:else}
                  <button type="button" class="btn small" onclick={() => toContainer(el)}>Зробити контейнером з елементами</button>
                {/if}
              {/if}
            </details>
          {:else}
            <div class="notice">Невідомий елемент «{el.t}».</div>
          {/if}
        </div>
      </details>
    {/each}
  </div>

  <div class="add-row">
    <span class="muted small">Додати:</span>
    <button type="button" class="btn small" onclick={() => add("p")}>+ Абзац</button>
    <button type="button" class="btn small" onclick={() => add("h")}>+ Заголовок</button>
    <button type="button" class="btn small" onclick={() => add("ul")}>+ Список</button>
    <button type="button" class="btn small" onclick={() => add("note")}>+ Примітка</button>
    <button type="button" class="btn small" onclick={() => add("cta")}>+ Кнопка</button>
    <button type="button" class="btn small" onclick={() => add("img")}>+ Фото</button>
    <button type="button" class="btn small" onclick={() => add("div")}>+ Блок</button>
    <button type="button" class="btn small accent" onclick={addInsert}>＋ Вставка…</button>
    <button type="button" class="btn small" onclick={() => add("raw")}>+ HTML</button>
  </div>
</div>

<style>
  .elements-ed .add-row { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-top: 8px; }
  .elements-ed .tag { display: inline-block; margin-right: 5px; padding: 1px 5px; border-radius: 4px; background: rgba(142, 27, 58, 0.1); color: #8e1b3a; font-size: 10.5px; font-weight: 600; }
  .elements-ed .tag.ins { background: rgba(184, 134, 11, 0.15); color: #8a6914; }
  .elements-ed .row-item { display: flex; gap: 5px; align-items: center; margin-bottom: 3px; }
  .elements-ed .row-item .grow { flex: 1; min-width: 0; }
  .elements-ed .attr-k { font-family: Consolas, monospace; font-size: 12px; color: var(--muted, #7b756e); min-width: 54px; }
  .elements-ed .sub-card { border: 1px solid var(--line, #e4e1dc); border-radius: 8px; padding: 7px; margin-bottom: 6px; background: #fff; display: grid; gap: 6px; }
  .elements-ed.nested { border-left: 3px solid #ecc9d4; padding-left: 8px; margin-top: 6px; }
  .btn.small.accent { border-color: #d4a84b; color: #8a6914; background: #fffbeb; }
</style>
