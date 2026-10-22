// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readCachedSharePassword, writeCachedSharePassword } from './core';

// The visitor's share-password cache (docs/specs/013-workspace/share-password.md,
// "Password cache"): one plain-text entry per share code, emptied when the
// server refuses it.

beforeEach(() => window.localStorage.clear());

describe('the share-password cache', () => {
  it('keeps one entry per share code', () => {
    writeCachedSharePassword('CODE1', 'otter');
    writeCachedSharePassword('CODE2', 'badger');
    expect(readCachedSharePassword('CODE1')).toBe('otter');
    expect(readCachedSharePassword('CODE2')).toBe('badger');
    expect(window.localStorage.getItem('livediagram:share-password:CODE1')).toBe('otter');
  });

  it('reads nothing for a code it has never seen', () => {
    expect(readCachedSharePassword('NEVER')).toBeNull();
  });

  it('empties an entry when cleared, which then reads as nothing', () => {
    writeCachedSharePassword('CODE1', 'otter');
    writeCachedSharePassword('CODE1', null);
    expect(readCachedSharePassword('CODE1')).toBeNull();
    expect(readCachedSharePassword('CODE2')).toBeNull();
  });

  it('treats an empty password as a clear', () => {
    writeCachedSharePassword('CODE1', 'otter');
    writeCachedSharePassword('CODE1', '');
    expect(readCachedSharePassword('CODE1')).toBeNull();
  });
});
