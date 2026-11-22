// The page-wide thumbnail cache (docs/specs/006-document/document-snapshots.md): bounded, least recently
// used out first, and an evicted picture's blob URL is released.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THUMBNAIL_CACHE_MAX,
  loadThumbnail,
  peekThumbnail,
  resetThumbnailCache,
  thumbnailKey,
} from './thumbnail-cache';

vi.mock('@/lib/api-client', () => ({
  apiFetchDocumentThumbnailUrl: async (_owner: string, id: string) => ({
    url: `blob:${id}`,
    backgroundColor: null,
  }),
}));

const req = (documentId: string) => ({ ownerId: 'me', documentId, version: 1, shareCode: null });

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  resetThumbnailCache();
});

describe('thumbnail cache', () => {
  it('evicts the least recently used picture and releases its blob URL', async () => {
    for (let i = 0; i < THUMBNAIL_CACHE_MAX; i++) await loadThumbnail(req(`d${i}`));
    // Touch the oldest, so the second-oldest is now the one to go.
    await loadThumbnail(req('d0'));
    await loadThumbnail(req('overflow'));
    expect(peekThumbnail(thumbnailKey(req('d0')))).toBeDefined();
    expect(peekThumbnail(thumbnailKey(req('d1')))).toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:d1');
  });
});
