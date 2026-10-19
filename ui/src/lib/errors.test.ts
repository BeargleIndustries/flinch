import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR, friendlyError } from './errors';

// One sample per brief A.5 rule, written the way the sidecar or the provider
// SDK words it (sources cited in A.5).
const CASES: [sample: string, expected: RegExp][] = [
  ['Anthropic API key required for the coach', /No provider key is set/],
  ['ANTHROPIC_API_KEY required', /No provider key is set/],
  ['No LLM backend available. Set a key or start Ollama.', /No provider key is set/],
  ["Unknown model prefix for 'mistral-large'", /does not know that model id/],
  ['openai package required: pip install openai', /library is not installed/],
  ['google-genai package not installed', /library is not installed/],
  ['PDF export needs weasyprint on the sidecar.', /needs weasyprint on the sidecar\. Choose HTML/],
  ['Missing experiment dependencies: scipy', /experiment extras/],
  ['No runs in session to snapshot', /Run at least one probe before saving a baseline/],
  ['No active run for this sequence', /no turn waiting/],
  ['Batch already started', /already started\. Estimate a new batch/],
  // F14: the 409 detail from /start and /resume (B03).
  ['This study is already running.', /^This study is still running or stopping\. Try again/],
  ['Failed to fetch', /sidecar is not reachable/],
  ['NetworkError when attempting to fetch resource.', /sidecar is not reachable/],
  ['Load failed', /sidecar is not reachable/],
  ['connect ECONNREFUSED 127.0.0.1:8000', /sidecar is not reachable/],
  ['Error code: 401 - invalid x-api-key', /rejected the key/],
  ['AuthenticationError: Incorrect API key provided', /rejected the key/],
  ['Error code: 429 - rate limit exceeded', /limiting requests/],
  ['You exceeded your current quota', /limiting requests/],
  ['Session not found', /no longer exists/],
];

describe('friendlyError', () => {
  for (const [sample, expected] of CASES) {
    it(`maps "${sample}"`, () => {
      const r = friendlyError(sample);
      expect(r.message).toMatch(expected);
      expect(r.details).toBe(sample);
    });
  }

  it('keeps messages already written for people as they are', () => {
    for (const text of [
      'Probe has 3 run(s). Delete those first.',
      'Probe is used by 2 condition stud(ies). Delete those first.',
      'A probe with that name exists in this session.',
    ]) {
      expect(friendlyError(text)).toEqual({ message: text, details: null });
    }
  });

  it('reads the message of an Error', () => {
    expect(friendlyError(new TypeError('Failed to fetch')).message).toMatch(/not reachable/);
  });

  it('applies the rules in order', () => {
    // A missing key that also says "not found" is a key problem, not a deleted item.
    expect(friendlyError('ANTHROPIC_API_KEY required: key not found').message).toMatch(
      /No provider key is set/,
    );
  });

  it('falls back to the server text with details', () => {
    const r = friendlyError('Sequence turn timed out after 120 s');
    expect(r.message).toBe('Sequence turn timed out after 120 s');
    expect(r.details).toBe('Sequence turn timed out after 120 s');
  });

  it('truncates very long unknown messages at 160 but keeps them in details', () => {
    const long = 'x'.repeat(400);
    const r = friendlyError(long);
    expect(r.message.length).toBeLessThanOrEqual(160);
    expect(r.message.endsWith('…')).toBe(true);
    expect(r.details).toBe(long);
  });

  it('handles empty input', () => {
    expect(friendlyError('')).toEqual({ message: GENERIC_ERROR, details: null });
    expect(friendlyError(null).message).toBe(GENERIC_ERROR);
  });
});
