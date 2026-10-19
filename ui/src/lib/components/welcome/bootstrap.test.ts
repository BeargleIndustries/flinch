import { describe, expect, it } from 'vitest';
import {
  LOG_LINES,
  STAGE_ORDER,
  appendLog,
  errorDetails,
  fmtBytes,
  stageLabel,
  stagePercent,
} from './bootstrap';

describe('bootstrap progress', () => {
  it('labels every stage of events.rs', () => {
    expect(STAGE_ORDER.map(stageLabel)).toEqual([
      'Checking',
      'Cleaning up an earlier install',
      'Unpacking Python',
      'Creating the environment',
      'Installing Flinch',
      'Ready',
    ]);
    expect(stageLabel('something_new')).toBe('something_new');
  });

  it('fills by stage index, and by progress inside a stage', () => {
    expect(stagePercent('probing', -1)).toBe(0);
    expect(stagePercent('cleaning', -1)).toBe(20);
    expect(stagePercent('extracting_pbs', 0.5)).toBe(50);
    expect(stagePercent('installing_deps', 0)).toBe(80);
    expect(stagePercent('installing_deps', 1)).toBe(80);
    expect(stagePercent('ready', -1)).toBe(100);
    expect(stagePercent('unknown', 0.5)).toBe(0);
  });

  it('keeps the newest log lines', () => {
    let lines: string[] = [];
    for (let i = 0; i < LOG_LINES + 5; i++) lines = appendLog(lines, `line ${i}`);
    expect(lines).toHaveLength(LOG_LINES);
    expect(lines[0]).toBe('line 5');
    expect(lines.at(-1)).toBe(`line ${LOG_LINES + 4}`);
  });

  it('puts the diagnostic after the error', () => {
    expect(errorDetails('boom', null)).toBe('boom');
    expect(errorDetails('boom', 'diag')).toBe('boom\n\ndiag');
  });
});

describe('fmtBytes', () => {
  it('reads like a download counter', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(1536)).toBe('1.5 KB');
    expect(fmtBytes(41 * 1024 * 1024)).toBe('41 MB');
    expect(fmtBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});
