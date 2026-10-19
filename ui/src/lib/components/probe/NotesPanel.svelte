<!--
  Notes (brief 7.7 item 3): "Research notes" and "Key finding" save on blur
  (PUT /api/runs/{id}/annotations with only the field that changed); pattern
  tags are added with Enter or a comma, suggested from every tag used so far,
  and saved as the whole list. "Saved" shows for 1.5 s after each save.
  Mounted once per run (the workspace keys it by run id).
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { X } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import type { Annotation, AnnotationBody } from '$lib/api/types';
  import { PROBE } from '$lib/copy/probe';
  import { FIELD, HINT, LABEL } from './styles';
  import { addTag } from './thread';

  interface Props {
    annotation: Annotation | null;
    onSave: (body: AnnotationBody) => Promise<boolean>;
    loadTags: () => Promise<string[]>;
  }

  let { annotation, onSave, loadTags }: Props = $props();

  const uid = $props.id();
  const SAVED_MS = 1500;
  const MAX = 2000;

  // Seeded once from the run's annotation; the panel is remounted per run.
  const start = untrack(() => annotation);
  let note = $state(start?.note_text ?? '');
  let finding = $state(start?.finding ?? '');
  let tags = $state<string[]>([...(start?.pattern_tags ?? [])]);
  let tagDraft = $state('');
  let suggestions = $state<string[]>([]);
  let saved = $state(false);
  let lastNote = start?.note_text ?? '';
  let lastFinding = start?.finding ?? '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    void loadTags().then((t) => (suggestions = t));
    return () => {
      if (timer) clearTimeout(timer);
    };
  });

  async function save(body: AnnotationBody) {
    if (!(await onSave(body))) return;
    saved = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => (saved = false), SAVED_MS);
  }

  function saveNote() {
    if (note === lastNote) return;
    lastNote = note;
    void save({ note_text: note });
  }

  function saveFinding() {
    if (finding === lastFinding) return;
    lastFinding = finding;
    void save({ finding });
  }

  function commitTag() {
    const next = addTag(tags, tagDraft);
    tagDraft = '';
    if (next.length === tags.length) return;
    tags = next;
    void save({ pattern_tags: tags });
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
    void save({ pattern_tags: tags });
  }

  function onTagKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag();
    } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }
</script>

<div data-tour="notes" data-testid="notes-panel">
  <Panel eyebrow={PROBE.notesEyebrow} title={PROBE.notesTitle} readout={PROBE.notesWhy}>
    {#snippet actions()}
      <span
        role="status"
        aria-live="polite"
        data-testid="notes-saved"
        class="text-xs text-ok transition-opacity duration-300 {saved
          ? 'opacity-100'
          : 'opacity-0'}">{saved ? PROBE.saved : ''}</span
      >
    {/snippet}

    <div>
      <label for="notes-{uid}" class={LABEL}>{PROBE.notesLabel}</label>
      <textarea
        id="notes-{uid}"
        rows="3"
        maxlength={MAX}
        bind:value={note}
        onblur={saveNote}
        class="{FIELD} resize-y"
      ></textarea>
    </div>

    <div>
      <label for="tags-{uid}" class={LABEL}>{PROBE.tagsLabel}</label>
      <div
        class="flex flex-wrap items-center gap-1.5 rounded-md border border-borderStrong bg-bg px-2 py-1.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
      >
        {#each tags as tag (tag)}
          <span
            class="inline-flex items-center gap-1 rounded border border-accent/40 bg-accentSoft/30 py-px pl-1.5 pr-0.5 text-[11px] text-accentText"
            data-testid="tag-chip"
          >
            {tag}
            <button
              type="button"
              onclick={() => removeTag(tag)}
              aria-label={PROBE.removeTag(tag)}
              class="rounded p-px text-accentText/70 hover:bg-accent/30 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
            >
              <X class="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        {/each}
        <input
          id="tags-{uid}"
          type="text"
          list="tag-list-{uid}"
          maxlength="80"
          bind:value={tagDraft}
          onkeydown={onTagKey}
          onblur={() => tagDraft.trim() && commitTag()}
          aria-describedby="tags-hint-{uid}"
          class="min-w-[8rem] flex-1 bg-transparent text-sm text-text placeholder:text-text4 focus:outline-none"
        />
        <datalist id="tag-list-{uid}">
          {#each suggestions.filter((s) => !tags.includes(s)) as s (s)}
            <option value={s}></option>
          {/each}
        </datalist>
      </div>
      <p id="tags-hint-{uid}" class="{HINT} mt-1">{PROBE.tagsHint}</p>
    </div>

    <div>
      <label for="finding-{uid}" class={LABEL}>{PROBE.findingLabel}</label>
      <textarea
        id="finding-{uid}"
        rows="2"
        maxlength={MAX}
        placeholder={PROBE.findingPlaceholder}
        bind:value={finding}
        onblur={saveFinding}
        class="{FIELD} resize-y"
      ></textarea>
    </div>
  </Panel>
</div>
