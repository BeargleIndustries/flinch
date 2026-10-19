<!--
  Methodology (brief 9.6, A.4; I5). Renders the typed structure in
  $lib/guide/methodology with Svelte blocks: no Markdown renderer, no raw
  HTML. max-w-[720px]; headings text-sm font-semibold text-text, paragraphs
  text-sm text-text2. Each section has an anchor (its heading as a slug) and
  a contents line links to them.
-->
<script lang="ts">
  import { METHODOLOGY_PAGE } from '$lib/copy/guide';
  import { methodology } from '$lib/guide/methodology';
  import { slug } from './guide-pages';
</script>

<article class="flex max-w-[720px] flex-col gap-6 pb-10" data-testid="methodology-page">
  <header class="flex flex-col gap-2">
    <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
      {METHODOLOGY_PAGE.eyebrow}
    </p>
    <h1 class="text-base font-semibold text-text">{methodology.title}</h1>
    {#each methodology.lead as line, i (i)}
      <p class="text-sm leading-relaxed {i === 0 ? 'text-text' : 'text-text2'}">{line}</p>
    {/each}
  </header>

  <nav aria-label={METHODOLOGY_PAGE.contentsLabel} class="border-y border-border py-2">
    <ol class="flex flex-wrap gap-x-1 gap-y-1">
      {#each methodology.sections as s, i (s.heading)}
        <li>
          <a
            href="#{slug(s.heading)}"
            class="inline-flex items-baseline gap-1.5 rounded px-1.5 py-0.5 text-xs text-text3 transition-colors hover:bg-surface2 hover:text-text"
            ><span class="font-mono text-[10px] tabular-nums text-text4">{i + 1}</span
            >{s.heading}</a
          >
        </li>
      {/each}
    </ol>
  </nav>

  {#each methodology.sections as s, i (s.heading)}
    <section
      id={slug(s.heading)}
      aria-labelledby="{slug(s.heading)}-h"
      class="scroll-mt-4 flex flex-col gap-2"
      data-testid="methodology-section"
    >
      <h2
        id="{slug(s.heading)}-h"
        class="flex items-baseline gap-2 text-sm font-semibold text-text"
      >
        <span class="font-mono text-[11px] font-normal tabular-nums text-text4" aria-hidden="true"
          >{String(i + 1).padStart(2, '0')}</span
        >
        {s.heading}
      </h2>
      {#each s.paragraphs as p, j (j)}
        <p class="text-sm leading-relaxed text-text2">{p}</p>
      {/each}
      {#if s.items && s.items.length > 0}
        <dl class="mt-1 flex flex-col divide-y divide-border rounded-md border border-border">
          {#each s.items as item (item.name)}
            <div class="grid gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[200px_minmax(0,1fr)]">
              <dt class="text-sm font-medium text-text">{item.name}</dt>
              <dd class="text-sm leading-relaxed text-text2">{item.text}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    </section>
  {/each}
</article>
