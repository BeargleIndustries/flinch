// Turn sidecar and provider error text into a plain-language sentence for the
// UI. Known messages map to a friendly line; anything else keeps the server
// text. `details` carries the raw text for a "Details" disclosure.
//
// Flinch port (brief 5.5): Pry's shape and fallback, with Pry's rules and its
// `hf-gate` check replaced by the rules of brief A.5, in that order, plus the
// F14 rule. The lines themselves live in copy/errors-copy.ts.
import { ERROR_COPY } from './copy/errors-copy';

export interface FriendlyError {
  /** What to show the user. */
  message: string;
  /** Raw server text, for a "Details" disclosure. Null when it adds nothing. */
  details: string | null;
}

/** Shown when the error has no text at all. */
export const GENERIC_ERROR = ERROR_COPY.generic;

/** A rule whose message is null keeps the server text as it is. */
interface Rule {
  test: RegExp;
  message: string | null;
}

const RULES: Rule[] = [
  {
    test: /Anthropic API key required|ANTHROPIC_API_KEY required|No LLM backend available/i,
    message: ERROR_COPY.noKey,
  },
  { test: /Unknown model prefix/i, message: ERROR_COPY.unknownModel },
  {
    test: /package required|package not installed|pip install/i,
    message: ERROR_COPY.missingPackage,
  },
  { test: /weasyprint/i, message: ERROR_COPY.pdfUnavailable },
  { test: /Missing experiment dependencies/i, message: ERROR_COPY.experimentExtras },
  {
    // Already written for people (B18, B20): keep the server's words.
    test: /Probe has \d+ run|Probe is used by|A probe with that name exists/i,
    message: null,
  },
  { test: /No runs in session to snapshot/i, message: ERROR_COPY.noRunsForBaseline },
  { test: /No active run for this sequence/i, message: ERROR_COPY.noSequenceTurn },
  { test: /Batch already/i, message: ERROR_COPY.batchStarted },
  // F14: start or resume while the study's run is still held (409, B03). The
  // client keeps Resume enabled; the server guards the double run.
  { test: /already running/i, message: ERROR_COPY.studyRunning },
  {
    test: /failed to fetch|networkerror|load failed|econnrefused|not reachable/i,
    message: ERROR_COPY.sidecarUnreachable,
  },
  {
    test: /\b401\b|authentication|invalid x-api-key|incorrect api key/i,
    message: ERROR_COPY.keyRejected,
  },
  { test: /\b429\b|rate limit|quota/i, message: ERROR_COPY.rateLimited },
  { test: /not found/i, message: ERROR_COPY.notFound },
];

export function friendlyError(raw: unknown): FriendlyError {
  const text = (raw instanceof Error ? raw.message : String(raw ?? '')).trim();
  if (!text) return { message: GENERIC_ERROR, details: null };
  for (const rule of RULES) {
    if (rule.test.test(text)) {
      if (rule.message === null) return { message: text, details: null };
      return { message: rule.message, details: text === rule.message ? null : text };
    }
  }
  // Unknown: keep the server's words, with the full text under "Details".
  const message = text.length > 160 ? `${text.slice(0, 157)}…` : text;
  return { message, details: text };
}
