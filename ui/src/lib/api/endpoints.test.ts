// The contract (plan I3): ROUTES equals the committed endpoints.paths.json,
// which tests/test_api_contract.py checks against the sidecar.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPath, contractRows, contractText, ROUTES, type RouteDef } from './endpoints';
import committed from './endpoints.paths.json';

const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

describe('ROUTES', () => {
  it('has the same {method, path} set as endpoints.paths.json, no extras, none missing', () => {
    const ours = new Set(contractRows().map(key));
    const theirs = new Set(committed.map(key));
    expect([...ours].filter((k) => !theirs.has(k))).toEqual([]);
    expect([...theirs].filter((k) => !ours.has(k))).toEqual([]);
    expect(contractRows()).toEqual(committed);
  });

  it('has one entry per {method, path}', () => {
    const keys = Object.values(ROUTES as Record<string, RouteDef>).map(key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(committed.length);
  });

  it('matches the committed file byte for byte (npm run endpoints:snapshot)', () => {
    const file = fileURLToPath(new URL('./endpoints.paths.json', import.meta.url));
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    expect(text).toBe(contractText());
  });

  it('marks only POST routes as streams', () => {
    const streams = Object.values(ROUTES as Record<string, RouteDef>).filter((r) => r.stream);
    expect(streams.length).toBeGreaterThan(0);
    expect(streams.every((r) => r.method === 'POST')).toBe(true);
  });
});

describe('buildPath', () => {
  it('fills and encodes path parameters', () => {
    expect(buildPath(ROUTES.getSession, { session_id: 7 })).toBe('/api/sessions/7');
    expect(buildPath(ROUTES.unlinkProbeClaim, { probe_id: 1, claim_id: 2 })).toBe(
      '/api/probes/1/claims/2',
    );
    expect(buildPath(ROUTES.getVariantFile, { group_id: 'a b/c' })).toBe(
      '/api/variants/files/a%20b%2Fc',
    );
  });

  it('returns a path without parameters unchanged', () => {
    expect(buildPath(ROUTES.listSessions)).toBe('/api/sessions');
    expect(buildPath(ROUTES.health)).toBe('/health');
  });

  it('throws on a missing parameter', () => {
    expect(() => buildPath(ROUTES.getRun, {} as { run_id: number })).toThrow(/run_id/);
  });
});
