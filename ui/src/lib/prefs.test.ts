import { describe, expect, it } from 'vitest';
import {
  PREFIX,
  read,
  readBool,
  readNumber,
  remove,
  write,
  writeBool,
  writeNumber,
  type KV,
} from './prefs';

function memory(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const broken: KV = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('prefs', () => {
  it('stores every key under the flinch: prefix', () => {
    const kv = memory();
    write('session_id', '12', kv);
    write('tip_seen:pushback', 'true', kv);
    expect(kv.data.get('flinch:session_id')).toBe('12');
    expect(kv.data.get(`${PREFIX}tip_seen:pushback`)).toBe('true');
    expect(read('session_id', kv)).toBe('12');
  });

  it('returns null for a missing key and after remove', () => {
    const kv = memory();
    expect(read('export_theme', kv)).toBeNull();
    write('export_theme', 'paper', kv);
    remove('export_theme', kv);
    expect(read('export_theme', kv)).toBeNull();
  });

  it('never throws when storage throws or is missing', () => {
    expect(() => write('rail_open', 'true', broken)).not.toThrow();
    expect(() => remove('rail_open', broken)).not.toThrow();
    expect(read('rail_open', broken)).toBeNull();
    expect(read('rail_open', undefined)).toBeNull();
    expect(readBool('rail_open', true, broken)).toBe(true);
    expect(readNumber('split_ratio', broken)).toBeNull();
  });

  it('reads booleans strictly with a fallback', () => {
    const kv = memory();
    expect(readBool('rail_open', true, kv)).toBe(true);
    writeBool('rail_open', false, kv);
    expect(kv.data.get('flinch:rail_open')).toBe('false');
    expect(readBool('rail_open', true, kv)).toBe(false);
    write('rail_open', 'yes', kv);
    expect(readBool('rail_open', false, kv)).toBe(false);
  });

  it('reads numbers and rejects junk', () => {
    const kv = memory();
    writeNumber('split_ratio', 0.42, kv);
    expect(readNumber('split_ratio', kv)).toBe(0.42);
    write('split_ratio', 'wide', kv);
    expect(readNumber('split_ratio', kv)).toBeNull();
    write('split_ratio', '', kv);
    expect(readNumber('split_ratio', kv)).toBeNull();
  });
});
