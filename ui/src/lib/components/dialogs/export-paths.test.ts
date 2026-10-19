// Export dialog paths (brief 9.5, I21, 9.9): the routes and query flags each row sends.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../is-tauri', () => ({ isTauri: () => false }));
vi.mock('../../tauri', () => ({
  sidecarUrl: vi.fn(async () => 'http://127.0.0.1:1'),
  onSidecarCrashed: vi.fn(async () => () => {}),
  onSidecarRestarted: vi.fn(async () => () => {}),
  tauriError: (e: unknown) => new Error(String(e)),
}));

import { EXPORT } from '../../copy/export';
import {
  DEFAULT_INCLUDE,
  DEFAULT_THEME,
  compareExportPath,
  compareIds,
  compareQuery,
  fallbackName,
  pickTheme,
  rawExportPath,
  reportExportPath,
  themedExportPath,
  type ThemeOption,
} from './export-paths';

const theme = (name: string): ThemeOption => ({
  name,
  display_name: name,
  description: '',
  is_builtin: true,
});

describe('export paths', () => {
  it('raw rows carry the four include flags (I21 defaults)', () => {
    expect(DEFAULT_INCLUDE).toEqual({
      turns: false,
      annotations: true,
      policy: false,
      variants: false,
    });
    expect(rawExportPath(7, 'json', DEFAULT_INCLUDE)).toBe(
      '/api/sessions/7/export?format=json&include_turns=false&include_annotations=true&include_policy=false&include_variants=false',
    );
    expect(
      rawExportPath(7, 'csv', { turns: true, annotations: false, policy: true, variants: true }),
    ).toBe(
      '/api/sessions/7/export?format=csv&include_turns=true&include_annotations=false&include_policy=true&include_variants=true',
    );
  });

  it('report rows send only the format; themed rows add the theme', () => {
    expect(reportExportPath(3, 'findings')).toBe('/api/sessions/3/export?format=findings');
    expect(reportExportPath(3, 'report')).toBe('/api/sessions/3/export?format=report');
    expect(reportExportPath(3, 'agent')).toBe('/api/sessions/3/export?format=agent');
    expect(themedExportPath(3, 'html', 'paper')).toBe(
      '/api/sessions/3/export?format=html&theme=paper',
    );
    expect(themedExportPath(3, 'pdf', DEFAULT_THEME)).toBe(
      '/api/sessions/3/export?format=pdf&theme=beargle-dark',
    );
  });

  it('compare puts the current session first, without repeats', () => {
    const ids = compareIds(5, [9, 5, 2, 9]);
    expect(ids).toEqual([5, 9, 2]);
    expect(compareExportPath(ids, 'json')).toBe(
      '/api/export/compare?session_ids=5%2C9%2C2&format=json',
    );
    expect(compareExportPath(ids, 'csv')).toBe(
      '/api/export/compare?session_ids=5%2C9%2C2&format=csv',
    );
    expect(compareQuery(ids)).toEqual({ session_ids: '5,9,2' });
  });

  it('picks the saved theme only when the sidecar lists it', () => {
    const list = [theme('paper'), theme(DEFAULT_THEME)];
    expect(pickTheme('paper', list)).toBe('paper');
    expect(pickTheme('gone', list)).toBe(DEFAULT_THEME);
    expect(pickTheme(null, [theme('paper')])).toBe('paper');
    expect(pickTheme('paper', [])).toBe(DEFAULT_THEME);
  });

  it('names a fallback file and words the compare summary', () => {
    expect(fallbackName('session-4', 'csv')).toBe('flinch-session-4.csv');
    expect(EXPORT.compareSummary(3, 66.6667)).toBe(
      '3 probes ran in every chosen session; 67% got the same badge.',
    );
    expect(EXPORT.compareSummary(1, 100)).toBe(
      '1 probe ran in every chosen session; 100% got the same badge.',
    );
  });
});
