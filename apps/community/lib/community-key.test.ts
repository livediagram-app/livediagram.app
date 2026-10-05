import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMUNITY_KEY_STORAGE, isCommunityKey } from '@livediagram/api-schema';
import { getCommunityKey, resetCommunityKeyForTests } from './community-key';

// The community key (blueprint §5, §6 "Storage blocked", §13): read or minted, kept in localStorage,
// held in memory when storage throws, and never the guest owner id.

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}

function withWindow(storage: Storage) {
  vi.stubGlobal('window', { localStorage: storage });
}

beforeEach(() => resetCommunityKeyForTests());
afterEach(() => vi.unstubAllGlobals());

describe('getCommunityKey', () => {
  it('has no key on the server', () => {
    expect(getCommunityKey()).toBeNull();
  });

  it('mints a UUID v4 key and stores it', () => {
    const storage = memoryStorage();
    withWindow(storage);
    const key = getCommunityKey();
    expect(isCommunityKey(key)).toBe(true);
    expect(storage.getItem(COMMUNITY_KEY_STORAGE)).toBe(key);
  });

  it('reuses the stored key', () => {
    const storage = memoryStorage();
    const stored = '0f8fad5b-d9cb-469f-a165-70867728950e';
    storage.setItem(COMMUNITY_KEY_STORAGE, stored);
    withWindow(storage);
    expect(getCommunityKey()).toBe(stored);
  });

  it('replaces a malformed stored key', () => {
    const storage = memoryStorage();
    storage.setItem(COMMUNITY_KEY_STORAGE, 'not-a-key');
    withWindow(storage);
    const key = getCommunityKey();
    expect(isCommunityKey(key)).toBe(true);
    expect(storage.getItem(COMMUNITY_KEY_STORAGE)).toBe(key);
  });

  it('falls back to one in-memory key for the page when storage throws', () => {
    withWindow(throwingStorage());
    const first = getCommunityKey();
    expect(isCommunityKey(first)).toBe(true);
    expect(getCommunityKey()).toBe(first);
  });

  it('never reads the guest owner id', () => {
    const storage = memoryStorage();
    storage.setItem('livediagram:v2:self-id', '11111111-1111-4111-8111-111111111111');
    const getItem = vi.spyOn(storage, 'getItem');
    withWindow(storage);
    expect(getCommunityKey()).not.toBe('11111111-1111-4111-8111-111111111111');
    expect(getItem.mock.calls.every(([k]) => k === COMMUNITY_KEY_STORAGE)).toBe(true);
  });
});
