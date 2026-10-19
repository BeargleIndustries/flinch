// Test-only (AC17): where a tour or tip anchor is set in the `.svelte` source.
// Not imported by the app.
//
// An anchor counts when a `.svelte` file sets it:
// - literally: `data-tour="x"` or `data-tip="x"`;
// - in an expression: `data-tour={first ? 'x' : undefined}`;
// - through a component that forwards it to `data-tour`: `anchor="x"`,
//   `tour="x"` or `stripAnchor="x"` (Panel, ActionButton, TabStrip,
//   TabbedPanel, SettingsSection render `data-tour={anchor}` and the like).
import { allFiles, read } from '$lib/copy/copy-files';

export type AnchorAttr = 'data-tour' | 'data-tip';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Props that components forward to `data-tour`. */
export const FORWARDING_PROPS = ['anchor', 'tour', 'stripAnchor'] as const;

let svelteCache: string[] | null = null;

/** Every `.svelte` file under `ui/src`, relative to it. */
export function svelteFiles(): string[] {
  svelteCache ??= allFiles().filter((f) => f.endsWith('.svelte'));
  return svelteCache;
}

/** The patterns that set anchor `name` on attribute `attr`. */
export function anchorPatterns(attr: AnchorAttr, name: string): RegExp[] {
  const n = esc(name);
  const out = [new RegExp(`${attr}="${n}"`), new RegExp(`${attr}=\\{[^}]*['"\`]${n}['"\`]`)];
  if (attr === 'data-tour') {
    for (const p of FORWARDING_PROPS) out.push(new RegExp(`\\s${p}="${n}"`));
  }
  return out;
}

/** `.svelte` files that set the anchor. */
export function filesWithAnchor(attr: AnchorAttr, name: string): string[] {
  const res = anchorPatterns(attr, name);
  return svelteFiles().filter((f) => {
    const src = read(f);
    return res.some((re) => re.test(src));
  });
}

/** `[data-tour="x"]` or `[data-tip="x"]` as an attribute and a name, else null. */
export function parseTarget(target: string): { attr: AnchorAttr; name: string } | null {
  const m = /^\[(data-tour|data-tip)="([^"]+)"\]$/.exec(target.trim());
  return m ? { attr: m[1] as AnchorAttr, name: m[2] } : null;
}

/** `.svelte` files whose root renders a forwarded prop as `data-tour`. */
export function forwardingComponents(): string[] {
  const re = new RegExp(`data-tour=\\{(${FORWARDING_PROPS.join('|')})\\}`);
  return svelteFiles().filter((f) => re.test(read(f)));
}
