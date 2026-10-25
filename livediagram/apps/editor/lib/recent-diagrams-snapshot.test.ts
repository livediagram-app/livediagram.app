// @vitest-environment jsdom

// Sign-out clears what the retired returning-visitor note left in the browser
// (docs/specs/019-marketing/returning-visitor.md).

import {
  RECENT_DIAGRAMS_KEY,
  RECENT_THUMBS_CACHE,
  RECENT_THUMBS_CACHE_LEGACY,
} from '@livediagram/api-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetRecentDiagrams } from './recent-diagrams-snapshot';

let deleted: string[];

beforeEach(() => {
  localStorage.clear();
  deleted = [];
  vi.stubGlobal('caches', {
    delete: async (name: string) => {
      deleted.push(name);
      return true;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('forgetRecentDiagrams', () => {
  it('removes the old note and both thumbnail caches', async () => {
    localStorage.setItem(RECENT_DIAGRAMS_KEY, '{"v":1,"diagrams":[]}');
    await forgetRecentDiagrams();
    expect(localStorage.getItem(RECENT_DIAGRAMS_KEY)).toBeNull();
    expect(deleted).toEqual([RECENT_THUMBS_CACHE, RECENT_THUMBS_CACHE_LEGACY]);
  });

  it('still clears the note when Cache Storage refuses', async () => {
    vi.stubGlobal('caches', { delete: async () => Promise.reject(new Error('denied')) });
    localStorage.setItem(RECENT_DIAGRAMS_KEY, 'x');
    await expect(forgetRecentDiagrams()).resolves.toBeUndefined();
    expect(localStorage.getItem(RECENT_DIAGRAMS_KEY)).toBeNull();
  });
});
