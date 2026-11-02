// The page-wide thumbnail cache (docs/specs/006-document/document-snapshots.md): bounded, least recently
// used out first, and an evicted picture's blob URL is released.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appearance } from '@livehuddle/document';
import {
  THUMBNAIL_CACHE_MAX,
  loadThumbnail,
  peekThumbnail,
  resetThumbnailCache,
  thumbnailKey,
} from './thumbnail-cache';

const fetchUrl = vi.hoisted(() =>
  vi.fn(async (_owner: string, id: string, opts: { appearance?: string }) => ({
    url: opts.appearance === 'dark' ? `blob:${id}:dark` : `blob:${id}`,
    backgroundColor: null,
  })),
);
vi.mock('@/lib/api-client', () => ({ apiFetchDocumentThumbnailUrl: fetchUrl }));

const req = (documentId: string, appearance: Appearance = 'light') => ({
  ownerId: 'me',
  documentId,
  version: 1,
  shareCode: null,
  appearance,
});

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

  it('keeps each appearance’s picture apart, asking the api for the half it wants', async () => {
    expect(thumbnailKey(req('d1', 'light'))).not.toBe(thumbnailKey(req('d1', 'dark')));
    expect(await loadThumbnail(req('d1', 'dark'))).toMatchObject({ src: 'blob:d1:dark' });
    expect(fetchUrl).toHaveBeenLastCalledWith('me', 'd1', {
      version: 1,
      shareCode: null,
      appearance: 'dark',
    });
  });
});
