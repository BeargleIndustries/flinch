// Forbidden patterns (AC18, brief 10.1 rules and 13.2): greps every file under
// `ui/src`. No `{@html}`, no `innerHTML`, no browser dialogs (`window.confirm`,
// `window.alert`, `window.prompt` or bare `confirm(`, `alert(`, `prompt(`),
// `fetch(` only in the API client, the stream reader and the Tauri bridge, and
// no em dash anywhere (brief 5.7 rule 1). Test files are skipped for the code
// patterns, since they name them; the em dash check reads every file.
import { describe, expect, it } from 'vitest';
import { allFiles, read } from './copy-files';

/** The em dash, built from its code point so this file never holds one. */
const EM_DASH = String.fromCharCode(0x2014);

const CODE_PATTERNS: [name: string, re: RegExp][] = [
  ['{@html}', /\{@html/],
  ['innerHTML', /innerHTML/],
  ['window dialog', /window\.(alert|confirm|prompt)\b/],
  ['bare dialog call', /(^|[^\w.$])(alert|confirm|prompt)\(/m],
];

/** The only files that may call `fetch(` (brief 10.1). */
const FETCH_FILES = new Set(['lib/api/client.ts', 'lib/api/streams.ts', 'lib/tauri.ts']);

const TEXT_EXT = /\.(ts|js|svelte|html|css|json|md)$/;
const files = allFiles().filter((f) => TEXT_EXT.test(f));
const codeFiles = files.filter((f) => !/\.test\.ts$/.test(f));

/** `file:line: text` for every line of `file` matching `re`. */
function hits(file: string, re: RegExp): string[] {
  return read(file)
    .split(/\r?\n/)
    .flatMap((line, i) => (re.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : []));
}

describe('forbidden patterns in ui/src', () => {
  it('reads the source tree', () => {
    expect(codeFiles.length).toBeGreaterThan(20);
    expect(files).toContain('lib/copy/forbidden.test.ts');
  });

  for (const [name, re] of CODE_PATTERNS) {
    it(`no ${name}`, () => {
      expect(codeFiles.flatMap((f) => hits(f, re))).toEqual([]);
    });
  }

  it('calls fetch( only in the API client, the stream reader and the Tauri bridge', () => {
    const re = /(^|[^\w.$])fetch\(|window\.fetch\(/;
    expect(codeFiles.filter((f) => !FETCH_FILES.has(f)).flatMap((f) => hits(f, re))).toEqual([]);
  });

  it('has no em dash in any file', () => {
    expect(files.flatMap((f) => hits(f, new RegExp(EM_DASH)))).toEqual([]);
  });

  it('catches each pattern', () => {
    const samples = ['{@html x}', 'el.innerHTML = s', 'window.confirm("x")', 'if (confirm("x"))'];
    samples.forEach((s, i) => expect(CODE_PATTERNS[i][1].test(s), s).toBe(true));
    expect(CODE_PATTERNS[3][1].test('ctx.confirm(x)')).toBe(false);
    expect(CODE_PATTERNS[3][1].test('onConfirm(x)')).toBe(false);
  });
});
