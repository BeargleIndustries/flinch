<!--
  Glossary (brief 9.6, A.1; D12). Every glossary.ts entry as a definition
  list, grouped Badges, The core loop, Studies, Models and keys; the term in
  font-medium with its definition under it. Each group and term has an
  anchor (`#glossary-{group}`, `#term-{key}`) so links can land on it; the
  side index jumps between groups. The four badge terms carry their badge
  colour.
-->
<script lang="ts">
  import { GLOSSARY_PAGE } from '$lib/copy/guide';
  import { DOT } from '../probe/styles';
  import { groupAnchor, groupGlossary, termAnchor } from './guide-pages';

  const groups = groupGlossary();
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
</script>

<article class="flex max-w-[1080px] flex-col gap-6 pb-10" data-testid="glossary-page">
  <header class="min-w-0">
    <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
      {GLOSSARY_PAGE.eyebrow}
    </p>
    <h1 class="mt-0.5 text-base font-semibold text-text">{GLOSSARY_PAGE.title}</h1>
    <p class="mt-1 font-mono text-[11px] tabular-nums text-text4">
      {GLOSSARY_PAGE.termCount(total)}
    </p>
  </header>

  <div class="grid items-start gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
    <nav aria-label={GLOSSARY_PAGE.groupsLabel} class="md:sticky md:top-0">
      <ol class="flex flex-wrap gap-1 md:flex-col md:gap-0.5 md:border-l md:border-border">
        {#each groups as g (g.group)}
          <li>
            <a
              href="#{groupAnchor(g.group)}"
              class="flex items-baseline justify-between gap-3 rounded-md px-2 py-1 text-xs text-text3 transition-colors hover:bg-surface2 hover:text-text md:-ml-px md:rounded-none md:border-l md:border-transparent md:hover:border-accentHover"
            >
              <span>{GLOSSARY_PAGE.groups[g.group]}</span>
              <span class="font-mono text-[10px] tabular-nums text-text4">{g.rows.length}</span>
            </a>
          </li>
        {/each}
      </ol>
    </nav>

    <div class="flex min-w-0 flex-col gap-8">
      {#each groups as g (g.group)}
        <section
          id={groupAnchor(g.group)}
          aria-labelledby="{groupAnchor(g.group)}-h"
          class="scroll-mt-4"
          data-testid="glossary-group"
        >
          <h2
            id="{groupAnchor(g.group)}-h"
            class="mb-3 flex items-baseline gap-3 border-b border-border pb-1.5 text-sm font-semibold text-text"
          >
            {GLOSSARY_PAGE.groups[g.group]}
          </h2>
          <dl class="grid gap-x-8 gap-y-4 lg:grid-cols-2">
            {#each g.rows as r (r.key)}
              <div
                id={termAnchor(r.key)}
                class="scroll-mt-4 rounded-md px-2 py-1 -mx-2 transition-colors target:bg-accentSoft/40"
                data-testid="glossary-entry"
              >
                <dt class="flex items-center gap-2 text-sm font-medium text-text">
                  {#if g.group === 'badges' && DOT[r.key]}
                    <span class="h-2 w-2 shrink-0 rounded-full {DOT[r.key]}" aria-hidden="true"
                    ></span>
                  {/if}
                  {r.term}
                </dt>
                <dd class="mt-0.5 text-sm leading-relaxed text-text2">{r.definition}</dd>
              </div>
            {/each}
          </dl>
        </section>
      {/each}
    </div>
  </div>
</article>
