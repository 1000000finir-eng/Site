<script>
  import Field from "./Field.svelte";
  let { fields, obj } = $props();
  const main = $derived(fields.filter((f) => !f.advanced));
  const adv = $derived(fields.filter((f) => f.advanced));
</script>

{#each main as f (f.name)}
  <Field {f} {obj} />
{/each}
{#if adv.length}
  <details class="adv">
    <summary>Додатково</summary>
    {#each adv as f (f.name)}
      <Field {f} {obj} />
    {/each}
  </details>
{/if}
