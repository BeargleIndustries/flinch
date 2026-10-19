// First run (brief 9.8, 4.3, D26): the five welcome steps, where `/` sends
// the app, and where `/welcome` resumes. Pure functions over the prefs and the
// shell's runtime status, so the rules are unit tested.
import type { RuntimeStatus } from './tauri';

export type WelcomeSlug = 'welcome' | 'python' | 'key' | 'probes' | 'done';

export interface WelcomeStepDef {
  slug: WelcomeSlug;
  path: string;
  /** The dot's name (9.8: Welcome, Python, Key, Probes, Done). */
  label: string;
}

export const WELCOME_STEPS: readonly WelcomeStepDef[] = [
  { slug: 'welcome', path: '/welcome', label: 'Welcome' },
  { slug: 'python', path: '/welcome/python', label: 'Python' },
  { slug: 'key', path: '/welcome/key', label: 'Key' },
  { slug: 'probes', path: '/welcome/probes', label: 'Probes' },
  { slug: 'done', path: '/welcome/done', label: 'Done' },
];

/** Index of the step a path shows (0 for anything unknown). */
export function stepIndex(pathname: string): number {
  const path = pathname.replace(/\/+$/, '') || '/';
  const i = WELCOME_STEPS.findIndex((s) => s.path === path);
  return i === -1 ? 0 : i;
}

/** The path after a step. */
export function nextPath(slug: WelcomeSlug): string {
  const i = WELCOME_STEPS.findIndex((s) => s.slug === slug);
  return WELCOME_STEPS[Math.min(i + 1, WELCOME_STEPS.length - 1)].path;
}

/** The values `flinch:onboarding_step` may hold (4.3): the step just left. */
const LEFT: readonly WelcomeSlug[] = ['welcome', 'python', 'key', 'probes'];

/** Where `/welcome` resumes, from `flinch:onboarding_step`; null to stay on step 1. */
export function resumePath(stored: string | null): string | null {
  if (!stored || !(LEFT as readonly string[]).includes(stored)) return null;
  return nextPath(stored as WelcomeSlug);
}

/**
 * Where `/` goes (brief 4.2): `/welcome` until `flinch:onboarding_done` is
 * "true", else `/probe`. In the desktop app a runtime the shell reports as
 * missing or out of date (P01 `installed`/`current`) sends a set-up user to
 * the Python step, which installs it again (brief 12.3, R3). Fields the shell
 * does not report yet count as fine.
 */
export function startPath(onboardingDone: string | null, runtime: RuntimeStatus | null): string {
  if (onboardingDone !== 'true') return '/welcome';
  if (runtime && !runtime.ready && (runtime.installed === false || runtime.current === false))
    return '/welcome/python';
  return '/probe';
}
