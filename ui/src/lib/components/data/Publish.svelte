<!--
  Publish (brief 9.3, 9.9; D16, formerly Publication Export; I10, I13, B24).
  No rail (D15). Opens with its research question, then:
  - Make a document: template, format (PDF disabled with the B24 sentence
    when capabilities.pdf is false), models and domains (none picked means
    all), an optional date range, and for HTML and PDF a theme with its
    description and a sample table in a sandboxed blob frame. "Make the
    document" saves it and shows it in the preview.
  - Preview (PublishPreview): text for Markdown and CSV, a sandboxed blob
    frame for HTML and PDF; Download and Copy.
  - Past documents (PublishDocs): every saved document, with Preview and
    Download.
  Fields stay disabled until the reads land.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { FileOutput } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { PUBLISH } from '$lib/copy/data';
  import { SCREENS } from '$lib/copy/screens';
  import { read, write } from '$lib/prefs';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { DEFAULT_THEME, pickTheme } from '../dialogs/export-paths';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    DEFAULT_FORMAT,
    DEFAULT_TEMPLATE,
    FORMATS,
    TEMPLATES,
    exportBody,
    formProblems,
    isFormat,
    isTemplate,
    themeSampleHtml,
    themeSwatches,
    toggled,
    usesTheme,
    type Format,
    type Template,
  } from './publish';
  import { publish } from './publish-store.svelte';
  import PublishDocs from './PublishDocs.svelte';
  import PublishPreview from './PublishPreview.svelte';

  const uid = $props.id();

  let template = $state<Template>(DEFAULT_TEMPLATE);
  let format = $state<Format>(DEFAULT_FORMAT);
  let models = $state<Set<string>>(new Set());
  let domains = $state<Set<string>>(new Set());
  let from = $state('');
  let to = $state('');
  let theme = $state(read('export_theme') ?? DEFAULT_THEME);

  const pdf = $derived(capabilities.caps?.pdf);
  const pdfReady = $derived(pdf === true);
  const ready = $derived(publish.sourcesLoaded);
  const locked = $derived(!ready || publish.making);
  const form = $derived({ template, format, models, domains, from, to, theme });
  const problems = $derived(formProblems(form, pdfReady));
  const themed = $derived(usesTheme(format));
  const themeRow = $derived(publish.themes.find((t) => t.name === theme));
  const look = $derived(publish.looks[theme]);
  const themeDescription = $derived(
    (typeof look?.detail?.description === 'string' && look.detail.description) ||
      themeRow?.description ||
      PUBLISH.themeHint,
  );
  const swatches = $derived(themeSwatches(look?.detail));
  const themeName = $derived(themeRow?.display_name ?? theme);

  // Each visit reads the sources, the saved documents and the capabilities.
  $effect(() => {
    untrack(() => {
      void capabilities.loadCapabilities();
      void publish.loadDocs();
      void publish.loadSources().then(() => {
        theme = pickTheme(theme, publish.themes);
      });
    });
  });

  // The theme's description and preview, read when a themed format is picked.
  $effect(() => {
    const name = theme;
    if (!themed || !ready) return;
    untrack(() => void publish.loadLook(name));
  });

  // The theme preview frame: a blob page, revoked when the theme changes.
  let themeUrl = $state<string | null>(null);
  $effect(() => {
    const css = look?.css;
    if (!themed || !css) {
      themeUrl = null;
      return;
    }
    const url = URL.createObjectURL(
      new Blob([themeSampleHtml(css, PUBLISH.sample)], { type: 'text/html;charset=utf-8' }),
    );
    themeUrl = url;
    return () => URL.revokeObjectURL(url);
  });

  function setTemplate(v: string) {
    if (isTemplate(v)) template = v;
  }
  function setFormat(v: string) {
    if (isFormat(v)) format = v;
  }
  function setTheme(v: string) {
    theme = v;
    write('export_theme', v);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (locked || problems.length > 0) return;
    await publish.make(exportBody(form, new Date()));
  }

  const CHIP =
    'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accentHover';
  const MINI =
    'rounded px-1.5 py-0.5 text-[11px] font-medium text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-50';
</script>

{#snippet chips(
  what: string,
  hint: string,
  none: string,
  list: string[],
  picked: Set<string>,
  pick: (v: string) => void,
  clear: () => void,
  testid: string,
)}
  <div>
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <span class={LABEL} id="pub-{testid}-{uid}">{what}</span>
      <span class="flex items-center gap-1">
        {#if picked.size > 0}
          <span class="font-mono text-[11px] tabular-nums text-text4"
            >{picked.size}/{list.length}</span
          >
        {/if}
        <button
          type="button"
          class={MINI}
          onclick={clear}
          aria-label={PUBLISH.clearPicksOf(what.toLowerCase())}
          disabled={locked || picked.size === 0}>{PUBLISH.clearPicks}</button
        >
      </span>
    </div>
    {#if ready && list.length === 0}
      <p class={HINT}>{none}</p>
    {:else}
      <div
        class="flex flex-wrap gap-1.5"
        role="group"
        aria-labelledby="pub-{testid}-{uid}"
        aria-describedby="pub-{testid}-hint-{uid}"
        data-testid={testid}
      >
        {#each list as v (v)}
          {@const on = picked.has(v)}
          <label
            class="{CHIP} {on
              ? 'border-accent/60 bg-accentSoft/40 text-accentText'
              : 'border-borderStrong text-text3 hover:text-text2'}"
          >
            <input
              type="checkbox"
              class="h-3 w-3 accent-accent"
              checked={on}
              onchange={() => pick(v)}
            />
            {v}
          </label>
        {/each}
      </div>
    {/if}
    <p id="pub-{testid}-hint-{uid}" class="{HINT} mt-1.5">{hint}</p>
  </div>
{/snippet}

<section class="flex max-w-[1180px] flex-col gap-4 pb-6" data-testid="publish-screen">
  <header class="min-w-0">
    <h1 class="text-base font-semibold text-text">{PUBLISH.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.publish}
    </p>
  </header>

  <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div class="flex min-w-0 flex-col gap-4">
      <Panel eyebrow={PUBLISH.makeEyebrow} title={PUBLISH.makeTitle}>
        <form
          class="flex flex-col gap-4"
          onsubmit={submit}
          data-testid="publish-form"
          aria-busy={!ready}
        >
          <fieldset class="contents" disabled={locked}>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="min-w-0">
                <label for="pub-template-{uid}" class={LABEL}>{PUBLISH.template}</label>
                <select
                  id="pub-template-{uid}"
                  class={FIELD}
                  value={template}
                  onchange={(e) => setTemplate(e.currentTarget.value)}
                  aria-describedby="pub-template-hint-{uid}"
                  data-testid="publish-template"
                >
                  {#each TEMPLATES as t (t)}
                    <option value={t}>{PUBLISH.templates[t]}</option>
                  {/each}
                </select>
                <p id="pub-template-hint-{uid}" class="{HINT} mt-1">
                  {PUBLISH.templateWhy[template]}
                </p>
              </div>

              <div class="min-w-0">
                <label for="pub-format-{uid}" class={LABEL}>{PUBLISH.format}</label>
                <select
                  id="pub-format-{uid}"
                  class={FIELD}
                  value={format}
                  onchange={(e) => setFormat(e.currentTarget.value)}
                  aria-describedby="pub-format-hint-{uid}"
                  data-testid="publish-format"
                >
                  {#each FORMATS as f (f)}
                    <option
                      value={f}
                      disabled={f === 'pdf' && !pdfReady}
                      title={f === 'pdf' && pdf === false ? PUBLISH.pdfUnavailable : undefined}
                      >{PUBLISH.formats[f]}</option
                    >
                  {/each}
                </select>
                <p id="pub-format-hint-{uid}" class="{HINT} mt-1" data-testid="publish-format-hint">
                  {#if pdf === false}
                    {PUBLISH.pdfUnavailable}
                  {:else}
                    {PUBLISH.downloadWhy[format]}
                  {/if}
                </p>
              </div>
            </div>

            {@render chips(
              PUBLISH.models,
              PUBLISH.modelsHint,
              PUBLISH.modelsNone,
              publish.models,
              models,
              (v) => (models = toggled(models, v)),
              () => (models = new Set()),
              'publish-models',
            )}

            {@render chips(
              PUBLISH.domains,
              PUBLISH.domainsHint,
              PUBLISH.domainsNone,
              publish.domains,
              domains,
              (v) => (domains = toggled(domains, v)),
              () => (domains = new Set()),
              'publish-domains',
            )}

            <fieldset class="min-w-0">
              <legend class={LABEL}>{PUBLISH.dateRange}</legend>
              <div class="flex flex-wrap items-center gap-2">
                <label class="flex items-center gap-2 text-xs text-text3">
                  {PUBLISH.dateFrom}
                  <input
                    type="date"
                    class="{FIELD} w-auto font-mono text-xs [color-scheme:dark]"
                    bind:value={from}
                    max={to || undefined}
                    data-testid="publish-from"
                  />
                </label>
                <label class="flex items-center gap-2 text-xs text-text3">
                  {PUBLISH.dateTo}
                  <input
                    type="date"
                    class="{FIELD} w-auto font-mono text-xs [color-scheme:dark]"
                    bind:value={to}
                    min={from || undefined}
                    data-testid="publish-to"
                  />
                </label>
              </div>
              <p class="{HINT} mt-1.5 {problems.includes('dates') ? 'text-warn' : ''}">
                {problems.includes('dates') ? PUBLISH.datesBackwards : PUBLISH.dateHint}
              </p>
            </fieldset>

            {#if themed}
              <div
                class="grid gap-3 rounded-md border border-border bg-bg/40 p-3 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
                data-testid="publish-theme-row"
              >
                <div class="min-w-0">
                  <label for="pub-theme-{uid}" class={LABEL}>{PUBLISH.theme}</label>
                  <select
                    id="pub-theme-{uid}"
                    class={FIELD}
                    value={theme}
                    onchange={(e) => setTheme(e.currentTarget.value)}
                    aria-describedby="pub-theme-hint-{uid}"
                    data-testid="publish-theme"
                  >
                    {#if publish.themes.length === 0}
                      <option value={theme}>{theme}</option>
                    {/if}
                    {#each publish.themes as t (t.name)}
                      <option value={t.name}>{t.display_name}</option>
                    {/each}
                  </select>
                  <p
                    id="pub-theme-hint-{uid}"
                    class="{HINT} mt-1"
                    data-testid="publish-theme-description"
                  >
                    {themeDescription}
                  </p>
                  {#if swatches.length > 0}
                    <ul
                      class="mt-2 flex flex-wrap gap-1"
                      aria-label={PUBLISH.themeSwatches}
                      data-testid="publish-theme-swatches"
                    >
                      {#each swatches as s (s.field)}
                        <li
                          class="h-3.5 w-3.5 rounded-sm border border-borderStrong"
                          style:background={s.color}
                          title={s.field}
                        ></li>
                      {/each}
                    </ul>
                  {/if}
                </div>
                <div
                  class="min-h-[9.75rem] overflow-hidden rounded-md border border-borderStrong bg-surface2/40"
                >
                  {#if themeUrl}
                    <iframe
                      sandbox=""
                      src={themeUrl}
                      title={PUBLISH.themePreviewTitle(themeName)}
                      class="block h-[9.75rem] w-full border-0"
                      data-testid="publish-theme-frame"
                    ></iframe>
                  {/if}
                </div>
              </div>
            {/if}
          </fieldset>

          <div class="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <button
              type="submit"
              class={BTN.primary}
              disabled={locked || problems.length > 0}
              data-testid="publish-make"
            >
              <FileOutput class="h-3.5 w-3.5" aria-hidden="true" />
              {publish.making ? PUBLISH.making : PUBLISH.make}
            </button>
            {#if !ready}
              <p class="text-xs text-text4">{PUBLISH.loadingSources}</p>
            {/if}
          </div>
        </form>
      </Panel>

      <PublishPreview />
    </div>

    <aside class="flex flex-col gap-4 lg:sticky lg:top-0">
      <PublishDocs />
    </aside>
  </div>
</section>
