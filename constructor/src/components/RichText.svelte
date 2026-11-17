<script>
  import { tick } from "svelte";
  import { autoresize } from "../lib/autoresize.js";
  let { value = $bindable(), mode = "inline", list = true } = $props();
  let ta = $state();

  const rows = $derived(mode === "body" ? 3 : 2);

  async function apply(next, s, e) {
    value = next;
    await tick();
    ta?.focus();
    ta?.setSelectionRange(s, e);
  }

  function wrap(mark) {
    const v = value ?? "";
    let s = ta.selectionStart;
    let e = ta.selectionEnd;
    const m = mark.length;
    if (s === e) {
      const word = /[\p{L}\p{N}'’-]/u;
      while (s > 0 && word.test(v[s - 1])) s--;
      while (e < v.length && word.test(v[e])) e++;
    }
    const sel = v.slice(s, e);
    if (v.slice(s - m, s) === mark && v.slice(e, e + m) === mark) return apply(v.slice(0, s - m) + sel + v.slice(e + m), s - m, e - m);
    if (sel.length >= 2 * m && sel.startsWith(mark) && sel.endsWith(mark)) return apply(v.slice(0, s) + sel.slice(m, -m) + v.slice(e), s, e - 2 * m);
    if (!sel) return apply(v.slice(0, s) + mark + "текст" + mark + v.slice(e), s + m, s + m + 5);
    return apply(v.slice(0, s) + mark + sel + mark + v.slice(e), s + m, e + m);
  }

  function bullets() {
    const v = value ?? "";
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const start = v.lastIndexOf("\n", s - 1) + 1;
    let end = v.indexOf("\n", e);
    if (end === -1) end = v.length;
    const lines = v.slice(start, end).split("\n");
    const all = lines.every((l) => l.startsWith("- "));
    const out = lines.map((l) => (all ? l.slice(2) : l.startsWith("- ") ? l : "- " + l)).join("\n");
    apply(v.slice(0, start) + out + v.slice(end), start, start + out.length);
  }

  function keydown(e) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
    if (e.code === "KeyB") { e.preventDefault(); wrap("**"); }
    else if (e.code === "KeyI") { e.preventDefault(); wrap("*"); }
  }
</script>

<div class="rich">
  <div class="rich-bar">
    <button type="button" class="b" title="Жирний (Ctrl+B)" onclick={() => wrap("**")}>Ж</button>
    <button type="button" class="i" title="Курсив (Ctrl+I)" onclick={() => wrap("*")}>К</button>
    {#if list}<button type="button" title="Список" onclick={bullets}>• Список</button>{/if}
    <span class="hint">Виділіть слово → Ж</span>
  </div>
  <textarea bind:this={ta} bind:value {rows} onkeydown={keydown} use:autoresize={value}></textarea>
</div>
