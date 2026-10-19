// First-time tips (brief A.2, AC17): every tip's anchor is set in a `.svelte`
// file under ui/src (greped at test time), ids are unique, titles and blurbs
// are short, and `tutorialStepId` names a real tour step.
import { describe, expect, it } from 'vitest';
import {
  filesWithAnchor,
  forwardingComponents,
  parseTarget,
  svelteFiles,
} from '$lib/tutorial/anchor-scan';
import { tourSteps } from '$lib/tour/steps';
import { tipsRegistry } from './tips-registry';

/** Same limits as the tour card (A.3): a tip is the same size of popup. */
const TITLE_MAX = 40;
const TEXT_MAX = 240;

describe('first-time tips registry', () => {
  it('has the fourteen tips of brief A.2', () => {
    expect(tipsRegistry).toHaveLength(14);
  });

  it('has unique ids', () => {
    const ids = tipsRegistry.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps titles under 40 characters and blurbs and whys under 240', () => {
    for (const t of tipsRegistry) {
      expect(t.title.length, t.id).toBeLessThan(TITLE_MAX);
      expect(t.blurb.length, t.id).toBeLessThan(TEXT_MAX);
      if (t.why) expect(t.why.length, t.id).toBeLessThan(TEXT_MAX);
    }
  });

  it('names only real tour steps in tutorialStepId', () => {
    const ids = new Set(tourSteps.map((s) => s.id));
    for (const t of tipsRegistry)
      if (t.tutorialStepId) expect(ids, t.id).toContain(t.tutorialStepId);
  });

  it('targets a [data-tour] or [data-tip] anchor', () => {
    for (const t of tipsRegistry) expect(parseTarget(t.target), t.id).not.toBeNull();
  });

  it('finds every tip anchor in a .svelte file', () => {
    expect(svelteFiles().length).toBeGreaterThan(40);
    const missing = tipsRegistry
      .map((t) => ({ id: t.id, target: parseTarget(t.target)! }))
      .filter(({ target }) => filesWithAnchor(target.attr, target.name).length === 0)
      .map(({ id, target }) => `${id}: ${target.attr}="${target.name}"`);
    expect(missing).toEqual([]);
  });

  it('does not find an anchor no .svelte file sets', () => {
    expect(filesWithAnchor('data-tour', 'no-such-anchor')).toEqual([]);
    expect(filesWithAnchor('data-tip', 'session-switcher')).toEqual([]);
  });

  it('finds every tour step anchor in a .svelte file', () => {
    const missing = tourSteps
      .filter((s) => filesWithAnchor('data-tour', s.anchor).length === 0)
      .map((s) => `${s.id}: ${s.anchor}`);
    expect(missing).toEqual([]);
  });

  it('only counts forwarded anchors because components render them as data-tour', () => {
    const forwarding = forwardingComponents();
    for (const f of [
      'lib/components/Panel.svelte',
      'lib/components/probe/ActionButton.svelte',
      'lib/components/shell/TabStrip.svelte',
      'lib/components/settings/SettingsSection.svelte',
    ])
      expect(forwarding, f).toContain(f);
  });
});
