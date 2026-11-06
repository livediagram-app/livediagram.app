import { describe, expect, it, vi } from 'vitest';
import { IMAGE_REF_ID_MAX_LENGTH, isGalleryImageId } from './gallery-id';
import {
  createImageClaims,
  IMAGE_GRANT_IDS_MAX,
  parseImageGrantIds,
  placedImageIds,
} from './placement-claims';

const image = (imageId: unknown) => ({ id: 'e', type: 'image', imageId });

describe('isGalleryImageId', () => {
  it('takes a gallery id and refuses a data URI, an empty or overlong string and a non-string', () => {
    expect(isGalleryImageId('img-1')).toBe(true);
    expect(isGalleryImageId('data:image/png;base64,AAAA')).toBe(false);
    expect(isGalleryImageId('')).toBe(false);
    expect(isGalleryImageId('x'.repeat(IMAGE_REF_ID_MAX_LENGTH + 1))).toBe(false);
    expect(isGalleryImageId(7)).toBe(false);
  });
});

describe('placedImageIds', () => {
  it('answers the gallery pictures of added and updated image elements, once each, in order', () => {
    const ops = [
      { kind: 'add', element: image('a'), at: 0 },
      { kind: 'update', element: image('b') },
      { kind: 'update', element: image('a') },
      { kind: 'add', element: image('data:image/png;base64,AAAA'), at: 1 },
      { kind: 'add', element: image(null), at: 2 },
      { kind: 'add', element: { id: 's', type: 'sticky', imageId: 'c' }, at: 3 },
      { kind: 'remove', id: 'e' },
      { kind: 'reorder', ids: ['e'] },
      { kind: 'add', element: null },
      null,
      'op',
    ];
    expect(placedImageIds(ops)).toEqual(['a', 'b']);
  });
});

describe('parseImageGrantIds', () => {
  it('takes 1 to IMAGE_GRANT_IDS_MAX gallery ids, distinct', () => {
    expect(parseImageGrantIds({ ids: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
    const most = Array.from({ length: IMAGE_GRANT_IDS_MAX }, (_, i) => `i${i}`);
    expect(parseImageGrantIds({ ids: most })).toHaveLength(IMAGE_GRANT_IDS_MAX);
  });

  it('refuses anything else', () => {
    for (const body of [
      null,
      'ids',
      {},
      { ids: 'a' },
      { ids: [] },
      { ids: ['a', 7] },
      { ids: ['data:image/png;base64,AAAA'] },
      { ids: Array.from({ length: IMAGE_GRANT_IDS_MAX + 1 }, (_, i) => `i${i}`) },
    ]) {
      expect(parseImageGrantIds(body)).toBeNull();
    }
  });
});

describe('createImageClaims', () => {
  it('sends each image once per item, in chunks of IMAGE_GRANT_IDS_MAX', async () => {
    const claims = createImageClaims();
    const send = vi.fn(async (_ids: string[]) => undefined);
    const many = Array.from({ length: IMAGE_GRANT_IDS_MAX + 1 }, (_, i) => `i${i}`);
    await claims.claim('d1', many, send);
    expect(send.mock.calls.map(([ids]) => ids.length)).toEqual([IMAGE_GRANT_IDS_MAX, 1]);
    send.mockClear();
    await claims.claim('d1', ['i0', 'i0', 'new'], send);
    expect(send.mock.calls).toEqual([[['new']]]);
    send.mockClear();
    await claims.claim('d2', ['i0'], send);
    expect(send.mock.calls).toEqual([[['i0']]]);
  });

  it('sends nothing for nothing, and keeps a failed claim open for the next save', async () => {
    const claims = createImageClaims();
    const send = vi.fn(async (_ids: string[]) => undefined);
    await claims.claim('d1', [], send);
    expect(send).not.toHaveBeenCalled();
    send.mockRejectedValueOnce(new Error('offline'));
    await expect(claims.claim('d1', ['a'], send)).resolves.toBeUndefined();
    await claims.claim('d1', ['a'], send);
    await claims.claim('d1', ['a'], send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('forgets everything rather than grow past its bound', async () => {
    const claims = createImageClaims(2);
    const send = vi.fn(async (_ids: string[]) => undefined);
    await claims.claim('d1', ['a', 'b'], send);
    await claims.claim('d1', ['c'], send);
    send.mockClear();
    await claims.claim('d1', ['a', 'c'], send);
    expect(send.mock.calls).toEqual([[['a']]]);
  });
});
