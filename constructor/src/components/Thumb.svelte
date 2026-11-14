<script>
  import { app } from "../lib/store.svelte.js";
  import { assetUrl } from "../lib/preview-assets.js";
  let { path } = $props();
  let url = $state("");
  $effect(() => {
    const p = path;
    url = "";
    if (p) assetUrl(app.repo, p).then((u) => { if (path === p) url = u || ""; });
  });
</script>

{#if url}<img src={url} alt="" />{:else}<span class="noimg">немає</span>{/if}
