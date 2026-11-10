import { describe, expect, it } from 'vitest';
import { elementImageId, elementsImageIds, withMappedImageId } from './element-images';
import { createImage } from './factories';
import { createShape } from './shape-factory';

// docs/specs/009-elements/quote.md "The slots": a quote's photo is a picture like an image's.
describe('elementImageId', () => {
  const image = { ...createImage(0, 0), imageId: 'a' };
  const quote = { ...createShape('quote', 0, 0), imageId: 'q' };

  it("reads an image's picture and a quote's photo, nothing else", () => {
    expect(elementImageId(image)).toBe('a');
    expect(elementImageId({ ...image, imageId: null })).toBeNull();
    expect(elementImageId(quote)).toBe('q');
    expect(elementImageId(createShape('quote', 0, 0))).toBeNull();
    expect(elementImageId({ ...createShape('card', 0, 0), imageId: 'x' })).toBeNull();
  });

  it('gathers each picture once, in order', () => {
    expect(elementsImageIds([quote, image, { ...image, id: 'b' }])).toEqual(['q', 'a']);
  });

  it('maps a picture through an offline copy, leaving the rest', () => {
    const map = new Map([
      ['q', 'data:image/png;base64,AA'],
      ['a', 'a'],
    ]);
    expect(withMappedImageId(quote, map).imageId).toBe('data:image/png;base64,AA');
    expect(withMappedImageId(image, map)).toBe(image);
    const card = createShape('card', 0, 0);
    expect(withMappedImageId(card, map)).toBe(card);
  });
});
