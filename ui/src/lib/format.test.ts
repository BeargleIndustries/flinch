// Read every local time as UTC so formatDate is checkable (Vitest runs each
// test file in its own process).
process.env.TZ = 'UTC';

import { describe, expect, it } from 'vitest';
import { formatDate, formatResponse, localDay, pct, truncate } from './format';

describe('formatResponse', () => {
  it('splits paragraphs on blank lines and keeps line breaks inside one', () => {
    expect(formatResponse('First line\nsecond line\n\nNext paragraph')).toEqual([
      { type: 'p', lines: ['First line', 'second line'] },
      { type: 'p', lines: ['Next paragraph'] },
    ]);
  });

  it('reads both bullet markers as one unordered list', () => {
    expect(formatResponse('Intro\n- one\n* two\n- three')).toEqual([
      { type: 'p', lines: ['Intro'] },
      { type: 'ul', lines: ['one', 'two', 'three'] },
    ]);
  });

  it('reads numbered lines as an ordered list', () => {
    expect(formatResponse('1. first\n2. second\n10. tenth')).toEqual([
      { type: 'ol', lines: ['first', 'second', 'tenth'] },
    ]);
  });

  it('reads quotes', () => {
    expect(formatResponse('> quoted\n>\n> more\n\nafter')).toEqual([
      { type: 'quote', lines: ['quoted', '', 'more'] },
      { type: 'p', lines: ['after'] },
    ]);
  });

  it('keeps fenced code verbatim, blank lines and markers included', () => {
    const text = 'Run this:\n```python\n- not a list\n\n  x = 1\n```\nDone.';
    expect(formatResponse(text)).toEqual([
      { type: 'p', lines: ['Run this:'] },
      { type: 'code', lines: ['- not a list', '', '  x = 1'] },
      { type: 'p', lines: ['Done.'] },
    ]);
  });

  it('treats an unclosed fence as code to the end', () => {
    expect(formatResponse('```\na\nb')).toEqual([{ type: 'code', lines: ['a', 'b'] }]);
  });

  it('handles CRLF, empty and missing text', () => {
    expect(formatResponse('a\r\nb')).toEqual([{ type: 'p', lines: ['a', 'b'] }]);
    expect(formatResponse('')).toEqual([]);
    expect(formatResponse(null)).toEqual([]);
  });

  it('never turns markup into anything but text', () => {
    expect(formatResponse('<b>bold</b>')).toEqual([{ type: 'p', lines: ['<b>bold</b>'] }]);
  });
});

describe('pct', () => {
  it('formats fractions', () => {
    expect(pct(0.5)).toBe('50%');
    expect(pct(0.1234, 1)).toBe('12.3%');
    expect(pct(0)).toBe('0%');
    expect(pct(1)).toBe('100%');
  });

  it('treats values above 1 as already a percentage', () => {
    expect(pct(50)).toBe('50%');
    expect(pct(87.5, 1)).toBe('87.5%');
  });

  it('gives n/a for null, undefined and NaN', () => {
    expect(pct(null)).toBe('n/a');
    expect(pct(undefined)).toBe('n/a');
    expect(pct(Number.NaN)).toBe('n/a');
  });
});

describe('formatDate', () => {
  it('reads the sidecar format as UTC', () => {
    expect(formatDate('2026-10-18 14:05:00')).toBe('Oct 18, 14:05');
    expect(formatDate('2026-10-18 14:05:00')).toBe(formatDate('2026-10-18T14:05:00Z'));
  });

  it('reads naive ISO as UTC and honours an explicit offset', () => {
    expect(formatDate('2026-01-02T03:04:05.123456')).toBe('Jan 2, 03:04');
    expect(formatDate('2026-01-02T03:04:05+02:00')).toBe('Jan 2, 01:04');
  });

  it('returns empty for nothing and the input for junk', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('yesterday')).toBe('yesterday');
  });
});

describe('truncate', () => {
  it('cuts long text and adds an ellipsis', () => {
    expect(truncate('abcdef', 3)).toBe('abc…');
  });

  it('leaves short text alone', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('', 3)).toBe('');
  });
});

describe('localDay', () => {
  it('formats a local day with zero padding', () => {
    expect(localDay(new Date(2026, 9, 7, 23, 30))).toBe('2026-10-07');
    expect(localDay(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});
