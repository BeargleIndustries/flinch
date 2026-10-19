<!--
  One conditions study (brief 8.2.3): header with name, status and
  description, the research question, "Delete this study", then the tabs Run,
  Results, Raters and Export. Results, Raters and Export arrive in T23.

  The study's data loads here so the header and the Run tab agree; it reloads
  whenever the study's run asks (`run.version`: throttled while streaming,
  and once when the stream ends).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft } from 'lucide-svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { ExperimentDetail, StudyProgress } from '$lib/api/types';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import TabbedPanel from '$lib/components/TabbedPanel.svelte';
  import PromptSourcesDialog from '$lib/components/dialogs/PromptSourcesDialog.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { CONDITIONS } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { status } from '$lib/stores/status.svelte';
  import ConditionRun from './ConditionRun.svelte';
  import type { StudyEstimate, StudyPrompt, StudyResponse } from './conditions';
  import { studyRuns } from './conditions.svelte';

  interface Props {
    id: number;
  }

  let { id }: Props = $props();

  // The page keys this component on the id, so it never changes here.
  const run = untrack(() => studyRuns.of(id));

  let detail = $state<ExperimentDetail | null>(null);
  let prompts = $state<StudyPrompt[]>([]);
  let progress = $state<StudyProgress | null>(null);
  let responses = $state<StudyResponse[]>([]);
  let estimate = $state<StudyEstimate | null>(null);
  let loadError = $state<string | null>(null);
  let sourcesOpen = $state(false);
  let deleting = $state(false);

  const tabs = [
    { id: 'run', label: CONDITIONS.tabRun, title: CONDITIONS.tabRunWhy },
    { id: 'results', label: CONDITIONS.tabResults, title: CONDITIONS.tabResultsWhy },
    { id: 'raters', label: CONDITIONS.tabRaters, title: CONDITIONS.tabRatersWhy },
    { id: 'export', label: CONDITIONS.tabExport, title: CONDITIONS.tabExportWhy },
  ];
  let tab = $state('run');

  let seq = 0;

  /** GET the study, its prompts, its progress (with `active`) and its cells. */
  async function load() {
    const mine = ++seq;
    const params = { experiment_id: id };
    try {
      const [d, p, pr, r] = await status.track(
        Promise.all([
          request<ExperimentDetail>(ROUTES.getExperiment, { params }),
          request<{ prompts: StudyPrompt[] }>(ROUTES.listExperimentPrompts, { params }),
          request<StudyProgress>(ROUTES.getExperimentProgress, { params }),
          request<{ responses: StudyResponse[] }>(ROUTES.listExperimentResponses, { params }),
        ]),
      );
      if (mine !== seq) return;
      detail = d;
      prompts = p.prompts;
      progress = pr;
      responses = r.responses;
      loadError = null;
    } catch (e) {
      if (mine !== seq) return;
      const f = friendlyError(e);
      loadError = f.message;
      if (!detail) status.error(f.message, f.details);
    }
  }

  /** POST /estimate (B02: nested, multiplied by repeats). */
  async function loadEstimate() {
    try {
      estimate = await status.track(
        request<StudyEstimate>(ROUTES.estimateExperiment, { params: { experiment_id: id } }),
      );
    } catch {
      estimate = null;
    }
  }

  // First load, then every time the run asks for fresh data.
  $effect(() => {
    void run.version;
    untrack(() => void load());
  });

  $effect(() => {
    untrack(() => void loadEstimate());
  });

  async function remove() {
    if (!detail) return;
    deleting = true;
    const name = detail.experiment.name;
    try {
      await status.track(request(ROUTES.deleteExperiment, { params: { experiment_id: id } }));
      status.note(CONDITIONS.deletedNotice(name));
      await goto('/studies/conditions');
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    } finally {
      deleting = false;
    }
  }

  const tabLabel = (t: string) => tabs.find((x) => x.id === t)?.label ?? t;
</script>

<section
  class="flex max-w-[960px] flex-col gap-4 pb-6"
  data-testid="condition-study"
  data-study-id={id}
>
  <a
    href="/studies/conditions"
    class="inline-flex w-fit items-center gap-1 text-xs text-text3 hover:text-text focus:outline-none focus-visible:underline"
  >
    <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
    {CONDITIONS.backToList}
  </a>

  {#if detail && progress}
    {@const exp = detail.experiment}
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex min-w-0 items-center gap-2">
          <h1 class="truncate text-base font-semibold text-text">{exp.name}</h1>
          <span data-testid="study-status"><StatusChip status={exp.status} /></span>
        </div>
        {#if exp.description}
          <p class="max-w-[68ch] text-sm text-text2">{exp.description}</p>
        {/if}
        <p class="max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
          {SCREENS['conditions.list']}
        </p>
      </div>
      <ConfirmButton
        label={CONDITIONS.deleteStudy}
        confirmLabel={CONDITIONS.deleteConfirm}
        danger
        disabled={deleting || run.live}
        onConfirm={remove}
      />
    </header>

    <TabbedPanel {tabs} bind:activeTab={tab}>
      {#snippet children(current)}
        <div class="pt-4">
          {#if current === 'run'}
            <ConditionRun
              experiment={exp}
              conditions={detail?.conditions ?? []}
              {prompts}
              progress={progress!}
              {responses}
              {estimate}
              {run}
              onAddPrompts={() => (sourcesOpen = true)}
            />
          {:else}
            <div class="rounded-xl border border-dashed border-border" data-testid="tab-later">
              <EmptyState
                title={CONDITIONS.tabLaterTitle}
                body={CONDITIONS.tabLaterBody(tabLabel(current))}
              />
            </div>
          {/if}
        </div>
      {/snippet}
    </TabbedPanel>

    <PromptSourcesDialog
      open={sourcesOpen}
      studyId={id}
      existing={prompts.length}
      onClose={() => (sourcesOpen = false)}
      onAdded={() => {
        void load();
        void loadEstimate();
      }}
    />
  {:else if loadError}
    <div class="rounded-xl border border-dashed border-border">
      <EmptyState title={CONDITIONS.loadFailed} body={loadError} />
    </div>
  {/if}
</section>
