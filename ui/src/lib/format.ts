/**
 * Text and number formatting (brief 10.7). Model text is split into plain
 * blocks that components render with {#each}; it is never parsed as HTML.
 */

export type BlockType = 'p' | 'ul' | 'ol' | 'quote' | 'code';

export interface Block {
  type: BlockType;
  lines: string[];
}

const FENCE = /^\s*```/;
const UL = /^[-*] /;
const OL = /^\d+\. /;
const QUOTE = /^>( |$)/;

function lineType(line: string): Exclude<BlockType, 'code'> {
  if (UL.test(line)) return 'ul';
  if (OL.test(line)) return 'ol';
  if (QUOTE.test(line)) return 'quote';
  return 'p';
}

function stripMarker(type: BlockType, line: string): string {
  switch (type) {
    case 'ul':
      return line.replace(UL, '');
    case 'ol':
      return line.replace(OL, '');
    case 'quote':
      return line.replace(QUOTE, '');
    default:
      return line;
  }
}

/**
 * Splits a response into blocks: blank lines end a block; `- ` or `* ` lines
 * make `ul`, `1. ` lines make `ol`, `> ` lines make `quote`, triple-backtick
 * fences make `code` (blank lines kept inside); everything else is `p`.
 * List and quote markers are removed from the lines.
 */
export function formatResponse(text: string | null | undefined): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let inCode = false;

  for (const line of (text ?? '').split(/\r?\n/)) {
    if (inCode) {
      if (FENCE.test(line)) {
        inCode = false;
        current = null;
      } else {
        current!.lines.push(line);
      }
      continue;
    }
    if (FENCE.test(line)) {
      inCode = true;
      current = { type: 'code', lines: [] };
      blocks.push(current);
      continue;
    }
    if (line.trim() === '') {
      current = null;
      continue;
    }
    const type = lineType(line);
    if (!current || current.type !== type) {
      current = { type, lines: [] };
      blocks.push(current);
    }
    current.lines.push(stripMarker(type, line));
  }
  return blocks;
}

/**
 * A fraction as a percentage. Values above 1 are taken as already a
 * percentage (agreement_rate, consistency_score). null or NaN gives "n/a".
 */
export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return 'n/a';
  const value = Math.abs(x) > 1 ? x : x * 100;
  return `${value.toFixed(digits)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Local date and time, "Oct 18, 14:05". Timestamps without a zone (the
 * sidecar's `YYYY-MM-DD HH:MM:SS` and naive ISO strings) are read as UTC.
 * An empty value gives ""; an unreadable one is returned unchanged.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  let s = iso.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(s)) s += 'Z';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}`;
}

/** A Date as the local "YYYY-MM-DD". */
export function localDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** `s` cut to `n` characters, with "…" added when anything was cut. */
export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
