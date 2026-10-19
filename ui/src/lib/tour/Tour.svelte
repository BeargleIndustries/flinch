<!--
  The tour (brief A.3, D12): ten steps in Probe with the current session. The
  card uses the first-time tip's style, placed beside each step's
  `[data-tour]` anchor with placePopup, with Pointer's ring and arrow. It says
  "Step {n} of 10" and offers Back, Next (or the step's own action, or Done
  on the last step) and Close. While a step's `requires` is unmet the card
  shows `missing` instead of the body, and Next skips ahead. Finishing or
  closing writes `flinch:tour_seen` (state.svelte.ts).

  Starting: "Take the tour" in the Guide menu calls `shell.onTour`, set here;
  it opens Probe first. `/probe?tour=1` (welcome step 5) opens the New session
  dialog first when there is no session and starts once one exists.

  Step 3's action ("Send it") sends the active probe, or picks the first
  visible one, and moves on when the run returns.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Pointer from '$lib/components/Pointer.svelte';
  import { workspace } from '$lib/components/probe/workspace.svelte';
  import { shell } from '$lib/components/shell/shell.svelte';
  import { TOUR } from '$lib/copy/onboarding';
  import { arrowShown, placePopup, type Placement, type Point } from '$lib/popup/place';
  import { focusPoint, placementAttrs, rectOf, viewportSize } from '$lib/popup/measure';
  import { occupied, OCCUPIED, tipHold } from '$lib/popup/occupied.svelte';
  import { probes } from '$lib/stores/probe.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { findAnchor } from '$lib/tutorial/anchors';
  import { forwardKind, preferredSide, requirementMet, stepText } from './logic';
  import { tour } from './state.svelte';

  const CARD_W = 320;
  const CARD_EST_H = 160;
  const CARD_MIN_W = 240;
  const PLACE_MS = 250;
  /** Anchors that are big panels: the card may sit inside them. */
  const LARGE = new Set(['pushback-panel', 'response-readout']);

  let cardEl = $state<HTMLDivElement | null>(null);
  let target = $state<HTMLElement | null>(null);
  let position = $state<Placement | null>(null);
  let focus = $state<Point | null>(null);

  const step = $derived(tour.step);
  const met = $derived(requirementMet(step.requires, probes.machine.phase));
  const text = $derived(stepText(step, met));
  const kind = $derived(forwardKind(step, tour.index, tour.total));
  const arrow = $derived(arrowShown(position) ? position : null);
  const forwardLabel = $derived(
    kind === 'action' ? (step.action ?? TOUR.next) : kind === 'done' ? TOUR.done : TOUR.next,
  );

  function onProbe(): boolean {
    const p = page.url.pathname;
    return p === '/probe' || p.startsWith('/probe/');
  }

  /** "Take the tour": Probe first, then step 1. */
  async function begin(): Promise<void> {
    if (!onProbe()) await goto('/probe');
    tour.start();
  }

  function place(): void {
    if (!tour.open) return;
    const el = findAnchor(tour.step.anchor);
    target = el;
    tipHold.set(el ? [el] : []);
    const t = rectOf(el);
    focus = t ? focusPoint(t) : null;
    const w = cardEl?.offsetWidth || CARD_W;
    const h = cardEl?.offsetHeight || CARD_EST_H;
    position = placePopup({
      target: t,
      focus: focus ?? undefined,
      size: { w: CARD_W, h: Math.ceil((h * w) / CARD_W) },
      minW: CARD_MIN_W,
      viewport: viewportSize(),
      preferred: preferredSide(tour.step.anchor),
      previousSide: position?.side,
      previousMode: position?.mode,
      avoid: occupied.rects([OCCUPIED.tourCard]),
      large: LARGE.has(tour.step.anchor),
    });
  }

  /** Step 3: send the active probe (or the first visible one), then move on. */
  async function act(): Promise<void> {
    if (tour.acting) return;
    if (!probes.can('SEND')) {
      const id = probes.activeId ?? probes.visible[0]?.id ?? null;
      if (id === null) {
        tour.next();
        return;
      }
      probes.pick(id);
    }
    tour.acting = true;
    try {
      await workspace.send();
    } finally {
      tour.acting = false;
    }
    if (tour.open && tour.step.action && probes.machine.run) tour.next();
  }

  function forward(): void {
    if (kind === 'action' && met) void act();
    else tour.next();
  }

  function onKey(e: KeyboardEvent): void {
    if (!tour.open || e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    tour.finish();
  }

  onMount(() => {
    shell.onTour = () => void begin();
    return () => {
      shell.onTour = null;
      tipHold.set([]);
    };
  });

  // Step 3 points at Send: with nothing picked yet, pick the first visible probe.
  $effect(() => {
    if (!tour.open || !tour.step.action) return;
    const phase = probes.machine.phase;
    const first = probes.visible[0]?.id;
    if (phase === 'idle' && first !== undefined && session.current) {
      untrack(() => probes.pick(first));
    }
  });

  // Re-place while open: anchors appear, move and disappear as screens change.
  $effect(() => {
    if (!tour.open) {
      untrack(() => {
        target = null;
        position = null;
        focus = null;
        tipHold.set([]);
      });
      return;
    }
    void tour.index;
    untrack(place);
    const timer = setInterval(place, PLACE_MS);
    window.addEventListener('resize', place);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', place);
    };
  });

  // The card is an occupied area for other popups while it is up.
  $effect(() => {
    if (!cardEl) return;
    return occupied.registerElement(OCCUPIED.tourCard, cardEl);
  });

  // /probe?tour=1 (welcome step 5): a session first, then the tour.
  let askedForSession = false;
  $effect(() => {
    const url = page.url;
    if (url.pathname !== '/probe' || url.searchParams.get('tour') !== '1') return;
    if (!session.loaded) return;
    const current = session.current;
    untrack(() => {
      if (current) {
        void goto('/probe', { replaceState: true, keepFocus: true, noScroll: true });
        tour.start();
      } else if (!askedForSession) {
        askedForSession = true;
        shell.openNewSession();
      }
    });
  });
</script>

<svelte:window onkeydown={onKey} />

{#if tour.open && position}
  {#if target}
    <Pointer
      {target}
      arrowFrom={arrow?.arrowFrom}
      arrowTo={arrow?.arrowTo}
      focusRing={position.mode === 'inset' && !position.arrowExempt}
      z={54}
    />
  {/if}
  <div
    bind:this={cardEl}
    role="dialog"
    aria-modal="false"
    aria-labelledby="flinch-tour-title"
    aria-describedby="flinch-tour-body"
    class="fixed z-50 rounded-lg border border-accent/60 bg-surface p-4 shadow-xl"
    style:top={`${position.top}px`}
    style:left={`${position.left}px`}
    style:width={`${position.width}px`}
    data-popup="tour"
    data-testid="tour-card"
    data-step={step.id}
    data-met={met ? 'true' : 'false'}
    {...placementAttrs(position, focus)}
  >
    <p
      class="font-mono text-[10px] uppercase tracking-widest text-text4"
      data-testid="tour-progress"
    >
      {TOUR.progress(tour.index + 1, tour.total)}
    </p>
    <p id="flinch-tour-title" class="mt-1 text-sm font-semibold text-text" data-testid="tour-title">
      {step.title}
    </p>
    <p
      id="flinch-tour-body"
      class="mt-2 text-xs leading-relaxed {met ? 'text-text2' : 'text-warn'}"
      data-testid="tour-body"
    >
      {text}
    </p>
    <div class="mt-3 h-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
      <div
        class="h-full rounded-full bg-accent transition-[width] duration-300"
        style:width={`${((tour.index + 1) / tour.total) * 100}%`}
      ></div>
    </div>
    <div class="mt-3 flex items-center gap-2">
      <button
        type="button"
        onclick={() => tour.back()}
        disabled={tour.index === 0 || tour.acting}
        class="rounded-md px-2.5 py-1 text-xs text-text3 hover:bg-surface2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {TOUR.back}
      </button>
      <button
        type="button"
        onclick={() => tour.finish()}
        class="rounded-md px-2.5 py-1 text-xs text-text3 hover:bg-surface2 hover:text-text"
      >
        {TOUR.close}
      </button>
      <button
        type="button"
        onclick={forward}
        disabled={tour.acting}
        aria-busy={tour.acting}
        class="ml-auto rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:cursor-wait disabled:opacity-60"
        data-testid="tour-forward"
      >
        {forwardLabel}
      </button>
    </div>
  </div>
{/if}
