// Turn sidecar and provider error text into a plain-language sentence for the
// UI. Known messages map to a friendly line; anything else keeps the server
// text. `details` carries the raw text for a "Details" disclosure.
//
// Flinch port (brief 5.5): Pry's shape and fallback, with Pry's rules and its
// `hf-gate` check replaced by the rules of brief A.5, in that order.

export interface FriendlyError {
  /** What to show the user. */
  message: string;
  /** Raw server text, for a "Details" disclosure. Null when it adds nothing. */
  details: string | null;
}

/** Shown when the error has no text at all. */
export const GENERIC_ERROR =
  'Something went wrong in Flinch. Try again, or restart the sidecar from the chip at the top.';

/** A rule whose message is null keeps the server text as it is. */
interface Rule {
  test: RegExp;
  message: string | null;
}

const RULES: Rule[] = [
  {
    test: /Anthropic API key required|ANTHROPIC_API_KEY required|No LLM backend available/i,
    message: 'No provider key is set for this. Add one in Settings, then try again.',
  },
  {
    test: /Unknown model prefix/i,
    message:
      'Flinch does not know that model id. Use one from the list, or an id starting with claude-, gpt-, o3-, o4-, gemini-, grok-, meta-llama/ or ollama:.',
  },
  {
    test: /package required|package not installed|pip install/i,
    message:
      "That provider's library is not installed on the sidecar. Reinstall Flinch with the multi-model extras.",
  },
  {
    test: /weasyprint/i,
    message: 'PDF export needs weasyprint on the sidecar. Choose HTML instead.',
  },
  {
    test: /Missing experiment dependencies/i,
    message: 'Statistics need the experiment extras (numpy, scipy, krippendorff) on the sidecar.',
  },
  {
    // Already written for people (B18, B20): keep the server's words.
    test: /Probe has \d+ run|Probe is used by|A probe with that name exists/i,
    message: null,
  },
  {
    test: /No runs in session to snapshot/i,
    message: 'Run at least one probe before saving a baseline.',
  },
  {
    test: /No active run for this sequence/i,
    message: 'This sequence has no turn waiting. Make a new sequence to run it again.',
  },
  {
    test: /Batch already/i,
    message: 'This batch has already started. Estimate a new batch to run again.',
  },
  {
    test: /failed to fetch|networkerror|load failed|econnrefused|not reachable/i,
    message: "Flinch's sidecar is not reachable. Restart it from the chip at the top.",
  },
  {
    test: /\b401\b|authentication|invalid x-api-key|incorrect api key/i,
    message: 'The provider rejected the key. Check it in Settings.',
  },
  {
    test: /\b429\b|rate limit|quota/i,
    message:
      'The provider is limiting requests. Wait a minute and try again, or lengthen the pause between probes.',
  },
  {
    test: /not found/i,
    message: 'That item no longer exists. It may have been deleted in another window.',
  },
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
