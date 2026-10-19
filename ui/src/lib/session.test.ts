import { describe, expect, it } from 'vitest';
import {
  COMPARE_SESSION_PREFIX,
  DEFAULT_TARGET_MODEL,
  asCoachBackend,
  bareOllamaName,
  coachBackendLabel,
  createSessionBody,
  defaultTargetModel,
  isCompareSession,
  newSessionProblems,
  pickSession,
  profileOptions,
  truncate,
  visibleSessions,
  type NewSessionForm,
} from './session';

const s = (id: number, notes: string | null = null) => ({ id, notes });

describe('session list rules (brief 4.4, D29)', () => {
  it('spots Model compare sessions by the notes prefix', () => {
    expect(isCompareSession(`${COMPARE_SESSION_PREFIX} with 2 models, 3 probes`)).toBe(true);
    expect(isCompareSession(`  ${COMPARE_SESSION_PREFIX}`)).toBe(true);
    expect(isCompareSession('My notes')).toBe(false);
    expect(isCompareSession(`Mentions ${COMPARE_SESSION_PREFIX} later`)).toBe(false);
    expect(isCompareSession(null)).toBe(false);
    expect(isCompareSession(undefined)).toBe(false);
  });

  it('lists the visible sessions newest first', () => {
    const list = [s(1), s(3, COMPARE_SESSION_PREFIX), s(2, '')];
    expect(visibleSessions(list).map((x) => x.id)).toEqual([2, 1]);
  });

  it('picks the stored session, else the newest, else null', () => {
    const list = [s(2), s(5), s(4)];
    expect(pickSession(list, 4)?.id).toBe(4);
    expect(pickSession(list, 9)?.id).toBe(5);
    expect(pickSession(list, null)?.id).toBe(5);
    expect(pickSession([], 4)).toBeNull();
  });

  it('truncates with an ellipsis', () => {
    expect(truncate('short', 28)).toBe('short');
    expect(truncate('a'.repeat(30), 28)).toBe(`${'a'.repeat(27)}…`);
  });
});

describe('R13: compare sessions never reach the switcher', () => {
  it('drops every notes variant that starts with the prefix, keeps the rest', () => {
    const list = [
      s(1, `${COMPARE_SESSION_PREFIX} with 3 models, 12 probes`),
      s(
        2,
        `
${COMPARE_SESSION_PREFIX}`,
      ),
      s(3, 'auto-created by multi-model comparison'),
      s(4, null),
    ];
    expect(visibleSessions(list).map((x) => x.id)).toEqual([4, 3]);
  });

  it('never picks a compare session, even when it is the stored id', () => {
    const visible = visibleSessions([s(1), s(9, COMPARE_SESSION_PREFIX)]);
    expect(pickSession(visible, 9)?.id).toBe(1);
  });
});

const group = (provider: string, available: boolean, ids: string[]) => ({
  provider,
  available,
  models: ids.map((id) => ({ id })),
});

describe('I18: the default target model', () => {
  it('prefers claude-sonnet-4-6 when an available provider lists it', () => {
    const groups = [
      group('openai', true, ['gpt-4.1']),
      group('anthropic', true, ['claude-opus-4-20250514', DEFAULT_TARGET_MODEL]),
    ];
    expect(defaultTargetModel(groups)).toBe(DEFAULT_TARGET_MODEL);
  });

  it('else the first model of the first available provider', () => {
    expect(
      defaultTargetModel([
        group('anthropic', false, [DEFAULT_TARGET_MODEL]),
        group('openai', true, ['gpt-4.1', 'gpt-4o']),
      ]),
    ).toBe('gpt-4.1');
  });

  it('else the first listed model, else empty', () => {
    expect(defaultTargetModel([group('google', false, ['gemini-2.5-pro'])])).toBe('gemini-2.5-pro');
    expect(defaultTargetModel([])).toBe('');
  });
});

describe('I19: coach profile options', () => {
  it('is the union of profile names and session profiles, standard first', () => {
    expect(
      profileOptions(
        [{ name: 'standard' }, { name: 'aggressive' }],
        [{ coach_profile: 'my-own' }, { coach_profile: 'aggressive' }, { coach_profile: ' ' }],
      ),
    ).toEqual(['standard', 'aggressive', 'my-own']);
  });

  it('always offers standard', () => {
    expect(profileOptions([], [])).toEqual(['standard']);
  });
});

describe('coach backends', () => {
  it('labels and narrows backend values', () => {
    expect(coachBackendLabel('local')).toBe('Local (Ollama)');
    expect(coachBackendLabel('xai')).toBe('xAI');
    expect(asCoachBackend('together')).toBe('together');
    expect(asCoachBackend('nonsense')).toBe('anthropic');
    expect(asCoachBackend(null)).toBe('anthropic');
  });

  it('sends the bare Ollama name', () => {
    expect(bareOllamaName('ollama:llama3:8b')).toBe('llama3:8b');
    expect(bareOllamaName('qwen2')).toBe('qwen2');
  });
});

function form(over: Partial<NewSessionForm> = {}): NewSessionForm {
  return {
    name: 'Sonnet baseline',
    targetModel: DEFAULT_TARGET_MODEL,
    systemPrompt: '',
    coachBackend: 'anthropic',
    coachModel: '',
    coachProfile: 'standard',
    notes: '',
    probeIds: new Set([1, 2, 3]),
    ...over,
  };
}

describe('the New session body (brief 6.6 Submit)', () => {
  const all = [1, 2, 3];

  it('leaves probe_ids out when every probe is picked, coach_model null unless local', () => {
    expect(createSessionBody(form(), all)).toEqual({
      name: 'Sonnet baseline',
      target_model: DEFAULT_TARGET_MODEL,
      coach_profile: 'standard',
      system_prompt: '',
      coach_backend: 'anthropic',
      coach_model: null,
    });
  });

  it('sends the picked subset, the bare local model and written notes', () => {
    const body = createSessionBody(
      form({
        probeIds: new Set([3, 1, 99]),
        coachBackend: 'local',
        coachModel: 'ollama:llama3',
        notes: '  first pass ',
        name: '  Trimmed  ',
      }),
      all,
    );
    expect(body.probe_ids).toEqual([1, 3]);
    expect(body.coach_model).toBe('llama3');
    expect(body.notes).toBe('first pass');
    expect(body.name).toBe('Trimmed');
  });

  it('keeps an empty system prompt as a control condition (B08)', () => {
    expect(createSessionBody(form({ systemPrompt: '' }), all).system_prompt).toBe('');
  });

  it('lists what blocks submit', () => {
    expect(newSessionProblems(form(), all)).toEqual([]);
    expect(
      newSessionProblems(
        form({ name: ' ', targetModel: '', coachProfile: '', probeIds: new Set() }),
        all,
      ),
    ).toEqual(['name', 'model', 'profile', 'probes']);
    expect(newSessionProblems(form({ coachBackend: 'local' }), all)).toEqual(['localModel']);
    // No probes in the library: nothing to pick, nothing to block.
    expect(newSessionProblems(form({ probeIds: new Set() }), [])).toEqual([]);
  });
});
