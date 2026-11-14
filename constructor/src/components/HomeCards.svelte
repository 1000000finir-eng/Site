<script>
  import Fields from "./Fields.svelte";
  import { app } from "../lib/store.svelte.js";
  import { arr } from "../lib/ensure.js";
  import { cardFields } from "../lib/homeFields.js";
  import { moveItem, duplicateItem, removeItem, newHomeCard } from "../lib/model.js";
  import { moveCard } from "../lib/actions.js";
  import { confirmAsk } from "../lib/api.js";

  let { section, si } = $props();
  const fields = $derived(cardFields(app.pages));
  const cards = $derived(Array.isArray(section.cards) ? section.cards : []);
  const others = $derived(app.data.sections.map((s, i) => ({ i, title: s.title })).filter((x) => x.i !== si));

  function add() {
    const list = arr(section, "cards");
    list.push(newHomeCard());
    app.focusCard = list.length - 1;
  }
  async function del(i) {
    if (await confirmAsk("Видалити цю картку?")) removeItem(section.cards, i);
  }
  function toSection(ci, e) {
    const to = Number(e.target.value);
    e.target.value = "";
    if (Number.isNaN(to)) return;
    moveCard(app.data.sections, { si, ci }, { si: to, ci: null });
  }
  const title = (c) => String(c?.title || "без назви").slice(0, 52);

  // прокрутити до картки, яку відкрили з перегляду
  let wrap = $state();
  $effect(() => {
    const f = app.focusCard;
    if (f === null || !wrap) return;
    queueMicrotask(() => wrap.querySelectorAll(":scope > details.item")[f]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }));
  });
</script>

<div class="field">
  <div class="lbl">Картки в розділі</div>
  <div class="list" bind:this={wrap}>
    {#each cards as c, i (i)}
      <details class="item" open={cards.length <= 3 || app.focusCard === i}>
        <summary>
          <span class="n">{i + 1}</span>
          <span class="grow">{title(c)}</span>
          <span class="tools">
            <button type="button" title="Вгору" onclick={(e) => { e.preventDefault(); moveItem(section.cards, i, -1); }}>↑</button>
            <button type="button" title="Вниз" onclick={(e) => { e.preventDefault(); moveItem(section.cards, i, 1); }}>↓</button>
            <button type="button" title="Дублювати" onclick={(e) => { e.preventDefault(); duplicateItem(section.cards, i); }}>⎘</button>
            <button type="button" class="danger" title="Видалити" onclick={(e) => { e.preventDefault(); del(i); }}>✕</button>
          </span>
        </summary>
        <div class="item-body">
          {#if others.length}
            <label class="field move">
              <span class="lbl">Перенести в інший розділ</span>
              <select onchange={(e) => toSection(i, e)}>
                <option value="">— залишити тут —</option>
                {#each others as o (o.i)}<option value={o.i}>{o.title}</option>{/each}
              </select>
            </label>
          {/if}
          <Fields {fields} obj={section.cards[i]} />
        </div>
      </details>
    {/each}
    <button type="button" class="btn small add-inline" onclick={add}>+ Додати картку</button>
  </div>
</div>
