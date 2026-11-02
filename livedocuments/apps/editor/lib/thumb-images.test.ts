import { describe, expect, it } from 'vitest';
import { createImage, createShape, type Element } from '@livedocuments/document';
import { thumbImageHref, thumbImageIds } from './thumb-images';

// docs/specs/007-editor/pages-mode.md "Contents" "Pictures in the thumbnails".
describe('thumbImageIds', () => {
  const image = (imageId?: string): Element => ({
    ...createImage(0, 0),
    ...(imageId ? { imageId } : {}),
  });

  it("lists a page's picture fill and its image elements' pictures, and nothing else", () => {
    const ids = thumbImageIds(
      [image('g1'), createShape('square', 0, 0), image(), image('data:x')],
      {
        background: { fill: { kind: 'image', imageId: 'g0' } },
      },
    );
    expect(ids).toEqual(['g0', 'g1', 'data:x']);
  });

  it('lists none for a page with another fill, or no page', () => {
    expect(thumbImageIds([], { background: { fill: { kind: 'solid', color: '#fff' } } })).toEqual(
      [],
    );
    expect(thumbImageIds([image('g1')], undefined)).toEqual(['g1']);
  });
});

describe('thumbImageHref', () => {
  it("hands an inline picture back as it is and a gallery one's URL from its source", () => {
    const href = thumbImageHref((id) => (id === 'g1' ? 'blob:g1' : undefined));
    expect(href('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    expect(href('g1')).toBe('blob:g1');
    expect(href('g2')).toBeUndefined();
  });
});
