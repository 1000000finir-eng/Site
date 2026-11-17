<script>
  import Fields from "./Fields.svelte";
  import RichText from "./RichText.svelte";
  import ImagePicker from "./ImagePicker.svelte";
  import { fieldsOf, typeLabel, emptyFor, clone, blockTitle } from "../lib/schema.js";
  import { moveItem, removeItem, duplicateItem } from "../lib/model.js";
  import { confirmAsk } from "../lib/api.js";
  import { addInsertTo } from "../lib/actions.js";
  import { autoresize } from "../lib/autoresize.js";

  let { f, obj } = $props();

  const list = $derived(Array.isArray(obj[f.name]) ? obj[f.name] : []);
  const options = $derived.by(() => {
    if (f.kind !== "select") return [];
    const cur = obj[f.name];
    return cur && !f.options.some((o) => o.value === cur) ? [...f.options, { value: cur, label: cur }] : f.options;
  });

  const ensure = () => {
    if (!Array.isArray(obj[f.name])) obj[f.name] = [];
    return obj[f.name];
  };
  function add() {
    const arr = ensure();
    if (f.item) arr.push("Новий пункт");
    else if (f.make) arr.push(f.make());
    else arr.push(arr.length ? clone(arr[arr.length - 1]) : emptyFor(f.fields));
  }
  function addInsert() {
    ensure();
    addInsertTo(obj);
  }
  async function del(i) {
    if (await confirmAsk("Видалити?")) removeItem(ensure(), i);
  }
  const itemTitle = (it) => {
    const v = f.titleOf ? it?.[f.titleOf] : "";
    const t = Array.isArray(v) ? v.join(" · ") : String(v ?? "");
    const s = t.replace(/<[^>]+>/g, " ").replace(/[*_]/g, "").replace(/\s+/g, " ").trim();
    return s.length > 52 ? s.slice(0, 52) + "…" : s;
  };
</script>

<div class="field k-{f.kind}">
  {#if f.kind === "string"}
    <label>
      <span class="lbl">{f.label}{#if f.optional}<i> · необов’язково</i>{/if}</span>
      <input type="text" bind:value={obj[f.name]} />
      {#if f.hint}<span class="hint">{f.hint}</span>{/if}
    </label>
  {:else if f.kind === "text"}
    <label>
      <span class="lbl">{f.label}{#if f.optional}<i> · необов’язково</i>{/if}</span>
      <textarea rows="2" bind:value={obj[f.name]} use:autoresize={obj[f.name]}></textarea>
      {#if f.hint}<span class="hint">{f.hint}</span>{/if}
    </label>
  {:else if f.kind === "md" || f.kind === "body"}
    <div class="lbl">{f.label}{#if f.optional}<i> · необов’язково</i>{/if}</div>
    <RichText bind:value={obj[f.name]} mode={f.kind === "body" ? "body" : "inline"} />
    {#if f.hint}<span class="hint">{f.hint}</span>{/if}
  {:else if f.kind === "select"}
    <label>
      <span class="lbl">{f.label}</span>
      <select bind:value={obj[f.name]}>
        {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
      </select>
    </label>
  {:else if f.kind === "bool"}
    <label class="check"><input type="checkbox" bind:checked={obj[f.name]} /> <span>{f.label}</span></label>
  {:else if f.kind === "image"}
    <div class="lbl">{f.label}</div>
    <ImagePicker bind:value={obj[f.name]} />
  {:else if f.kind === "list"}
    <div class="lbl">{f.label}</div>
    <div class="list">
      {#each list as item, i (i)}
        {#if f.item}
          <div class="row-item">
            <span class="n">{i + 1}</span>
            <div class="grow">
              {#if f.item.kind === "md"}<RichText bind:value={obj[f.name][i]} mode="inline" />{:else}<input type="text" bind:value={obj[f.name][i]} />{/if}
            </div>
            <span class="tools">
              <button type="button" title="Вгору" onclick={() => moveItem(ensure(), i, -1)}>↑</button>
              <button type="button" title="Вниз" onclick={() => moveItem(ensure(), i, 1)}>↓</button>
              <button type="button" class="danger" title="Видалити" onclick={() => del(i)}>✕</button>
            </span>
          </div>
        {:else}
          <details class="item" open={list.length <= 3}>
            <summary>
              <span class="n">{i + 1}</span>
              <span class="grow">{itemTitle(item) || "без назви"}</span>
              <span class="tools">
                <button type="button" title="Вгору" onclick={(e) => { e.preventDefault(); moveItem(ensure(), i, -1); }}>↑</button>
                <button type="button" title="Вниз" onclick={(e) => { e.preventDefault(); moveItem(ensure(), i, 1); }}>↓</button>
                <button type="button" title="Дублювати" onclick={(e) => { e.preventDefault(); duplicateItem(ensure(), i); }}>⎘</button>
                <button type="button" class="danger" title="Видалити" onclick={(e) => { e.preventDefault(); del(i); }}>✕</button>
              </span>
            </summary>
            <div class="item-body"><Fields fields={f.fields} obj={obj[f.name][i]} /></div>
          </details>
        {/if}
      {/each}
      <button type="button" class="btn small add-inline" onclick={add}>+ Додати</button>
    </div>
  {:else if f.kind === "inserts"}
    <div class="lbl">{f.label}</div>
    {#if f.hint}<span class="hint">{f.hint}</span>{/if}
    <div class="list">
      {#each list as item, i (i)}
        {@const sub = fieldsOf(item.type) || []}
        <details class="item insert" open={list.length <= 2}>
          <summary>
            <span class="n">＋</span>
            <span class="grow"><b>{typeLabel(item.type)}</b> <i>{blockTitle(item)}</i></span>
            <span class="tools">
              <button type="button" title="Вгору" onclick={(e) => { e.preventDefault(); moveItem(ensure(), i, -1); }}>↑</button>
              <button type="button" title="Вниз" onclick={(e) => { e.preventDefault(); moveItem(ensure(), i, 1); }}>↓</button>
              <button type="button" class="danger" title="Видалити" onclick={(e) => { e.preventDefault(); del(i); }}>✕</button>
            </span>
          </summary>
          <div class="item-body">
            {#if sub.length}<Fields fields={sub} obj={obj[f.name][i]} />{:else}<p class="muted small">Ця вставка без налаштувань.</p>{/if}
          </div>
        </details>
      {/each}
      <button type="button" class="add-insert" onclick={addInsert}>＋ Додати вставку…</button>
    </div>
  {/if}
</div>
