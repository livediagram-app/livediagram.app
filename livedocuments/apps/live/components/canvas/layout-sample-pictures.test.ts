import { describe, expect, it } from 'vitest';
import { createImage, createText } from '@livedocuments/document';
import { withSamplePictures } from './layout-sample-pictures';

describe('withSamplePictures', () => {
  it('gives each empty picture a sample, in turn, cropped to fill its frame', () => {
    const els = [createImage(0, 0), createText(0, 0), createImage(10, 10)];
    const { elements, pictures } = withSamplePictures(els);
    const [a, , b] = elements as [
      { imageId: string; objectFit: string },
      unknown,
      { imageId: string },
    ];
    expect(a.imageId).not.toBe(b.imageId);
    expect(a.objectFit).toBe('cover');
    expect(pictures.get(a.imageId)!.href).toMatch(/^data:image\/svg\+xml/);
    expect(elements[1]).toBe(els[1]);
  });

  it('leaves a picture that already holds one', () => {
    const held = { ...createImage(0, 0), imageId: 'abc' };
    const { elements, pictures } = withSamplePictures([held]);
    expect(elements[0]).toBe(held);
    expect(pictures.size).toBe(0);
  });
});
