// @vitest-environment jsdom

// The recent-designs note's leftovers (docs/specs/019-marketing/returning-visitor.md "The old note"): signing
// out clears an old note and its thumbnails.

import {
  RECENT_DESIGNS_KEY,
  RECENT_THUMBS_CACHE,
  RECENT_THUMBS_CACHE_LEGACY,
} from '@livedesign/api-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetRecentDesigns } from './recent-designs-snapshot';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('forgetRecentDesigns', () => {
  it('clears an old note and both thumbnail caches', async () => {
    const names = new Set([RECENT_THUMBS_CACHE, RECENT_THUMBS_CACHE_LEGACY, 'other']);
    vi.stubGlobal('caches', { delete: async (name: string) => names.delete(name) });
    localStorage.setItem(RECENT_DESIGNS_KEY, '{"v":1,"designs":[]}');

    await forgetRecentDesigns();

    expect(localStorage.getItem(RECENT_DESIGNS_KEY)).toBeNull();
    expect([...names]).toEqual(['other']);
  });

  it('clears the note where the browser has no Cache Storage', async () => {
    localStorage.setItem(RECENT_DESIGNS_KEY, '{"v":1,"designs":[]}');
    await forgetRecentDesigns();
    expect(localStorage.getItem(RECENT_DESIGNS_KEY)).toBeNull();
  });
});
