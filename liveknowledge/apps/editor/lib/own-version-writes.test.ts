import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OWN_WRITE_GRACE_MS,
  beginOwnVersionWrite,
  isOwnVersionWrite,
  resetOwnVersionWrites,
} from './own-version-writes';

// This editor's restores and copies (docs/specs/006-document/version-history.md "Restore"; blueprint VH18).

afterEach(() => {
  resetOwnVersionWrites();
  vi.useRealTimers();
});

const op = (tabId: string, summary?: string) => ({ id: 'cs_1', tabId, summary });

describe('own version writes', () => {
  it('knows its own write from the moment it is marked until its grace has run', () => {
    vi.useFakeTimers();
    const done = beginOwnVersionWrite((o) => o.tabId === 't1');
    expect(isOwnVersionWrite(op('t1'))).toBe(true);
    expect(isOwnVersionWrite(op('t2'))).toBe(false);
    done();
    expect(isOwnVersionWrite(op('t1'))).toBe(true);
    vi.advanceTimersByTime(OWN_WRITE_GRACE_MS);
    expect(isOwnVersionWrite(op('t1'))).toBe(false);
  });

  it('knows nothing when nothing is marked', () => {
    expect(isOwnVersionWrite(op('t1', 'Restored a version'))).toBe(false);
  });
});
