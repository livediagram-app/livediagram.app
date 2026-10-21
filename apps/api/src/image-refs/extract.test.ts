import { describe, expect, it } from 'vitest';
import {
  IMAGE_REF_ID_MAX_LENGTH,
  imageRefIds,
  imageRefIdsFromData,
  imageRefIdsFromText,
  isGalleryImageId,
} from './extract';

const image = (imageId: unknown) => ({ id: 'e', type: 'image', x: 0, y: 0, imageId });

describe('isGalleryImageId', () => {
  it('accepts a gallery uuid', () => {
    expect(isGalleryImageId('9b2f7f1e-3c1a-4c55-9d2e-2b8f0e6a1c3d')).toBe(true);
  });

  it('rejects null, empty, non-strings and data URIs', () => {
    expect(isGalleryImageId(null)).toBe(false);
    expect(isGalleryImageId('')).toBe(false);
    expect(isGalleryImageId(42)).toBe(false);
    expect(isGalleryImageId('data:image/png;base64,AAAA')).toBe(false);
  });

  it('bounds the length', () => {
    expect(isGalleryImageId('a'.repeat(IMAGE_REF_ID_MAX_LENGTH))).toBe(true);
    expect(isGalleryImageId('a'.repeat(IMAGE_REF_ID_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('imageRefIds', () => {
  it('returns the distinct gallery ids of image elements in document order', () => {
    expect(imageRefIds([image('b'), image('a'), image('b')])).toEqual(['b', 'a']);
  });

  it('skips placeholders, data URIs and non-image elements carrying an imageId', () => {
    const elements = [
      image(null),
      image('data:image/png;base64,AAAA'),
      { id: 's', type: 'shape', imageId: 'x' },
      image('kept'),
    ];
    expect(imageRefIds(elements)).toEqual(['kept']);
  });

  it('returns nothing for anything that is not an array of objects', () => {
    expect(imageRefIds(undefined)).toEqual([]);
    expect(imageRefIds({ elements: [image('a')] })).toEqual([]);
    expect(imageRefIds([null, 'image', 3])).toEqual([]);
  });
});

describe('imageRefIdsFromText', () => {
  it('finds every id after an imageId key, whatever the element', () => {
    const text = '{"elements":[{"type":"image","imageId":"a"},{"type":"shape", "imageId" : "b"}';
    expect(imageRefIdsFromText(text)).toEqual(['a', 'b']);
  });

  it('skips null, data URIs and over-long values', () => {
    const long = 'x'.repeat(IMAGE_REF_ID_MAX_LENGTH + 1);
    const text = `"imageId":null,"imageId":"data:image/png;base64,AA","imageId":"${long}","imageId":"ok"`;
    expect(imageRefIdsFromText(text)).toEqual(['ok']);
  });
});

describe('imageRefIdsFromData', () => {
  it('parses a valid body', () => {
    expect(imageRefIdsFromData(JSON.stringify({ elements: [image('a')] }))).toEqual(['a']);
  });

  it('keeps the images of a corrupt body by scanning its text', () => {
    expect(imageRefIdsFromData('{"elements":[{"type":"image","imageId":"a"}')).toEqual(['a']);
  });

  it('returns nothing for a valid body without elements', () => {
    expect(imageRefIdsFromData('{"theme":"x"}')).toEqual([]);
  });

  it('returns nothing for a valid body that is not an object', () => {
    expect(imageRefIdsFromData('"imageId"')).toEqual([]);
    expect(imageRefIdsFromData('["imageId"]')).toEqual([]);
  });
});
