import { describe, expect, it } from 'vitest';
import { parseUnusedImageIds, UNUSED_IMAGE_IDS_MAX, unusedImageIdsParam } from './unused';

const many = (n: number) => Array.from({ length: n }, (_, i) => `img-${i}`);

describe('unusedImageIdsParam', () => {
  it('joins distinct gallery ids, leaving out data URIs, empty and comma-holding ids', () => {
    expect(unusedImageIdsParam(['a', 'b', 'a', '', 'data:image/png;base64,AA', 'c,d'])).toBe('a,b');
  });

  it('stops at the cap', () => {
    expect(unusedImageIdsParam(many(UNUSED_IMAGE_IDS_MAX + 5)).split(',')).toHaveLength(
      UNUSED_IMAGE_IDS_MAX,
    );
  });
});

describe('parseUnusedImageIds', () => {
  it('answers the distinct ids', () => {
    expect(parseUnusedImageIds('a,b,a')).toEqual(['a', 'b']);
  });

  it('refuses nothing, an empty id, a data URI or more than the cap', () => {
    expect(parseUnusedImageIds(null)).toBeNull();
    expect(parseUnusedImageIds('')).toBeNull();
    expect(parseUnusedImageIds('a,,b')).toBeNull();
    expect(parseUnusedImageIds('data:image/png;base64,AA')).toBeNull();
    expect(parseUnusedImageIds(many(UNUSED_IMAGE_IDS_MAX + 1).join(','))).toBeNull();
    expect(parseUnusedImageIds(many(UNUSED_IMAGE_IDS_MAX).join(','))).toHaveLength(
      UNUSED_IMAGE_IDS_MAX,
    );
  });
});
