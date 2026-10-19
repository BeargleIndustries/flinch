// Test-only helpers shared by the copy tests (copy-lint, and T12's forbidden).
// Not imported by the app.
//
// Flinch port (brief 5.5): Pry's lanes (`PENDING_LANES`, `FILE_OWNER`) and
// lesson files are gone; COPY_FILES lists Flinch's copy modules (brief 13.2).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { visibleStrings } from './visible-strings';

/** `ui/src`. */
export const SRC = resolve(__dirname, '../..');

const cache = new Map<string, string>();

/** File text, path relative to `ui/src`. */
export function read(file: string): string {
  let s = cache.get(file);
  if (s === undefined) {
    s = readFileSync(resolve(SRC, file), 'utf8');
    cache.set(file, s);
  }
  return s;
}

/** Visible strings of a file, path relative to `ui/src`. */
export function visible(file: string): string[] {
  return visibleStrings(read(file), file);
}

/** Every file under `ui/src`, as paths relative to it with forward slashes. */
export function allFiles(): string[] {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  return walk(SRC).map((p) => relative(SRC, p).replace(/\\/g, '/'));
}

/** The `.ts` files that hold user-facing copy (brief 13.2). */
export const COPY_FILES = [
  'lib/glossary.ts',
  'lib/tips/tips-registry.ts',
  'lib/tour/steps.ts',
  'lib/copy/moves.ts',
  'lib/copy/screens.ts',
  'lib/copy/errors-copy.ts',
  'lib/errors.ts',
  'lib/guide/methodology.ts',
  'lib/copy/shell.ts',
  'lib/copy/rail.ts',
  'lib/copy/probe.ts',
  'lib/copy/settings.ts',
];
