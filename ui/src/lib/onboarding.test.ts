import { describe, expect, it } from 'vitest';
import { WELCOME_STEPS, nextPath, resumePath, startPath, stepIndex } from './onboarding';

describe('welcome steps', () => {
  it('has the five steps of brief 9.8 in order', () => {
    expect(WELCOME_STEPS.map((s) => s.label)).toEqual([
      'Welcome',
      'Python',
      'Key',
      'Probes',
      'Done',
    ]);
  });

  it('finds the step a path shows', () => {
    expect(stepIndex('/welcome')).toBe(0);
    expect(stepIndex('/welcome/')).toBe(0);
    expect(stepIndex('/welcome/python')).toBe(1);
    expect(stepIndex('/welcome/key/')).toBe(2);
    expect(stepIndex('/welcome/probes')).toBe(3);
    expect(stepIndex('/welcome/done')).toBe(4);
    expect(stepIndex('/elsewhere')).toBe(0);
  });

  it('goes to the next step, and stays on the last', () => {
    expect(nextPath('welcome')).toBe('/welcome/python');
    expect(nextPath('probes')).toBe('/welcome/done');
    expect(nextPath('done')).toBe('/welcome/done');
  });

  it('resumes after the step last left', () => {
    expect(resumePath(null)).toBeNull();
    expect(resumePath('')).toBeNull();
    expect(resumePath('done')).toBeNull();
    expect(resumePath('nonsense')).toBeNull();
    expect(resumePath('welcome')).toBe('/welcome/python');
    expect(resumePath('key')).toBe('/welcome/probes');
    expect(resumePath('probes')).toBe('/welcome/done');
  });
});

describe('where / goes', () => {
  it('opens the welcome steps until onboarding is done', () => {
    expect(startPath(null, null)).toBe('/welcome');
    expect(startPath('false', { ready: true })).toBe('/welcome');
    expect(startPath('true', null)).toBe('/probe');
    expect(startPath('true', { ready: true, installed: true, current: true })).toBe('/probe');
  });

  it('sends a set-up desktop user with a stale or missing runtime to the Python step', () => {
    expect(startPath('true', { ready: false, installed: true, current: false })).toBe(
      '/welcome/python',
    );
    expect(startPath('true', { ready: false, installed: false, current: false })).toBe(
      '/welcome/python',
    );
    // The shell is launching a current runtime, or does not report the fields yet.
    expect(startPath('true', { ready: false, installed: true, current: true })).toBe('/probe');
    expect(startPath('true', { ready: false })).toBe('/probe');
  });
});
