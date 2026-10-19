// Plain-language glossary (brief A.1). Each definition is one short sentence or
// two, at most 140 characters. <Term key="..."> looks entries up here, by key or
// by any alias.
//
// Pry's shape and lookup (`glossary.ts`, without `introducedIn`) plus `group`;
// the entries are brief A.1, verbatim.

export type GlossaryGroup = 'badges' | 'loop' | 'studies' | 'models';

export interface GlossaryEntry {
  /** Display name, used when <Term> has no child text. */
  term: string;
  /** At most 140 characters. */
  definition: string;
  /** Other words a newcomer might meet for the same idea (matched case-insensitively). */
  aliases: string[];
  /** Heading the entry sits under on /guide/glossary. */
  group: GlossaryGroup;
}

export const MAX_DEFINITION_LENGTH = 140;

export const glossary: Record<string, GlossaryEntry> = {
  refused: {
    term: 'Refused',
    definition: 'The model declined the request: an apology, a redirect, or a flat no.',
    aliases: ['refuse', 'refusal'],
    group: 'badges',
  },
  collapsed: {
    term: 'Collapsed',
    definition: 'The model refused first, then gave in after pushback. The flinch-then-fold.',
    aliases: ['collapse', 'fold'],
    group: 'badges',
  },
  negotiated: {
    term: 'Negotiated',
    definition:
      'A partial or hedged answer: some of the request, with caveats, conditions or a watered-down version.',
    aliases: ['negotiate', 'partial'],
    group: 'badges',
  },
  complied: {
    term: 'Complied',
    definition: 'The model did what was asked, with no refusal and no conditions.',
    aliases: ['comply', 'compliance'],
    group: 'badges',
  },
  classification: {
    term: 'classification',
    definition:
      'The badge a response gets. A keyword scan decides clear cases; a model judges the rest. You can correct it.',
    aliases: ['badge', 'classifier'],
    group: 'badges',
  },
  probe: {
    term: 'probe',
    definition:
      'A test prompt chosen to sit near a content rule. Probes have a domain, tags and sometimes a story opening.',
    aliases: ['probes'],
    group: 'loop',
  },
  session: {
    term: 'session',
    definition:
      'A named set of runs against one model with one system prompt. Each probe starts a fresh conversation.',
    aliases: ['sessions'],
    group: 'loop',
  },
  run: {
    term: 'run',
    definition: 'One probe sent once in a session, with any pushback that followed.',
    aliases: ['runs'],
    group: 'loop',
  },
  pushback: {
    term: 'pushback',
    definition:
      'Your reply after a refusal, written to test whether the refusal holds. The coach drafts it; you decide.',
    aliases: ['push back'],
    group: 'loop',
  },
  coach: {
    term: 'coach',
    definition:
      'A model that reads a refusal and drafts a pushback, using one of seven moves and the examples you taught it.',
    aliases: ['pushback coach'],
    group: 'loop',
  },
  move: {
    term: 'move',
    definition:
      "One of the coach's seven pushback tactics, such as asking what specifically the problem is.",
    aliases: ['moves'],
    group: 'loop',
  },
  override: {
    term: 'override',
    definition:
      "A pushback you edited or wrote yourself instead of sending the coach's draft. Overrides teach the coach.",
    aliases: ['overrides'],
    group: 'loop',
  },
  'flinch-then-fold': {
    term: 'flinch-then-fold',
    definition: 'A refusal that gives way under light pushback. The pattern Flinch is named for.',
    aliases: [],
    group: 'loop',
  },
  'system-prompt': {
    term: 'system prompt',
    definition:
      'Instructions given to the model before the conversation. Sessions and conditions each set their own.',
    aliases: ['system prompts'],
    group: 'loop',
  },
  domain: {
    term: 'domain',
    definition:
      "A probe's subject area, such as violence or sexuality. Used to group probes and filter reports.",
    aliases: ['domains'],
    group: 'loop',
  },
  framing: {
    term: 'framing',
    definition:
      'The same request written another way: as fiction, as research, as satire. A framing group holds several.',
    aliases: ['framings', 'framing group', 'variant'],
    group: 'studies',
  },
  condition: {
    term: 'condition',
    definition:
      'One system prompt in a conditions study. The control is the condition with no system prompt.',
    aliases: ['conditions', 'control'],
    group: 'studies',
  },
  'conditions-study': {
    term: 'conditions study',
    definition:
      'Every prompt run under every condition for one or more models, so the answers can be compared.',
    aliases: ['study', 'experiment'],
    group: 'studies',
  },
  cell: {
    term: 'cell',
    definition:
      'One prompt, condition, model and repeat in a conditions study: one model call, one response.',
    aliases: ['cells'],
    group: 'studies',
  },
  'repeat-run': {
    term: 'repeat run',
    definition:
      'The same probe sent many times, each in a fresh conversation, to see how often each badge comes up.',
    aliases: ['repeat runs', 'stat run'],
    group: 'studies',
  },
  sequence: {
    term: 'sequence',
    definition:
      'Several turns of story built by the coach before the probe arrives, to test whether context changes the answer.',
    aliases: ['sequences', 'narrative momentum'],
    group: 'studies',
  },
  whittle: {
    term: 'whittle',
    definition:
      'Running a sequence with fewer and fewer warmup turns until the model refuses, to find the fewest that get through.',
    aliases: ['whittling', 'threshold'],
    group: 'studies',
  },
  strategy: {
    term: 'strategy',
    definition:
      'The kind of story a sequence builds, such as a fiction workshop or a character study.',
    aliases: ['strategies'],
    group: 'studies',
  },
  baseline: {
    term: 'baseline',
    definition:
      "A saved copy of a session's results, kept so a later run of the same probes can be compared with it.",
    aliases: ['baselines', 'snapshot'],
    group: 'studies',
  },
  'model-compare': {
    term: 'model compare',
    definition:
      'The same probes sent to several models at once, shown side by side with their badges.',
    aliases: ['comparison'],
    group: 'studies',
  },
  'policy-claim': {
    term: 'policy claim',
    definition:
      "One testable sentence from a provider's published content policy. Link it to the probes that test it.",
    aliases: ['claim', 'claims', 'policy'],
    group: 'studies',
  },
  scorecard: {
    term: 'scorecard',
    definition:
      'For each model, whether it enforced each linked policy claim as written, more than written, or less.',
    aliases: ['scorecards'],
    group: 'studies',
  },
  'text-metrics': {
    term: 'text metrics',
    definition:
      "Measures of a response's wording: length, reading level, hedging and confidence words, vocabulary richness.",
    aliases: ['metrics'],
    group: 'studies',
  },
  rater: {
    term: 'rater',
    definition:
      'A model, or a person on Prolific, who ranks several responses to one prompt without knowing their conditions.',
    aliases: ['raters', 'ai rater'],
    group: 'studies',
  },
  sidecar: {
    term: 'sidecar',
    definition:
      'The Python server that talks to the model providers and keeps the database. The app starts it for you.',
    aliases: [],
    group: 'models',
  },
  'api-key': {
    term: 'API key',
    definition:
      'The credential a provider gives you. Flinch keeps it on this computer and sends it only to that provider.',
    aliases: ['key', 'keys'],
    group: 'models',
  },
};

const index: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, entry] of Object.entries(glossary)) {
    m.set(key.toLowerCase(), key);
    m.set(entry.term.toLowerCase(), key);
    for (const a of entry.aliases) m.set(a.toLowerCase(), key);
  }
  return m;
})();

/** Canonical key for a key, display term or alias, or null if unknown. */
export function resolveTerm(name: string): string | null {
  return index.get(name.trim().toLowerCase()) ?? null;
}

/** Entry for a key, display term or alias, or null if unknown. */
export function lookupTerm(name: string): GlossaryEntry | null {
  const key = resolveTerm(name);
  return key ? glossary[key] : null;
}
