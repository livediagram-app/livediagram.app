import { describe, expect, it } from 'vitest';
import {
  COVER_CREDIT_MAX,
  coverObjectPosition,
  movedCoverFocus,
  parsePageCover,
  patchPageCover,
} from './cover';

const isId = (v: unknown) => typeof v === 'string' && /^[a-z0-9_-]+$/i.test(v);
const gradient = { kind: 'gradient' as const, from: '#ffffff', to: '#000000', angle: 160 };

describe('parsePageCover', () => {
  it('keeps a colour background, a picture with its focus and credit, or both', () => {
    expect(parsePageCover({ fill: gradient }, isId)).toEqual({ fill: gradient });
    expect(parsePageCover({ imageId: 'img_1', focus: 20, credit: '  Photo by A  ' }, isId)).toEqual(
      {
        imageId: 'img_1',
        focus: 20,
        credit: 'Photo by A',
      },
    );
    expect(parsePageCover({ fill: gradient, pattern: 'dots', imageId: 'img_1' }, isId)).toEqual({
      fill: gradient,
      pattern: 'dots',
      imageId: 'img_1',
    });
  });

  it('drops what it cannot use, and answers none when nothing is left', () => {
    expect(parsePageCover(null, isId)).toBeUndefined();
    expect(parsePageCover('cover', isId)).toBeUndefined();
    expect(parsePageCover({ imageId: 'no spaces allowed' }, isId)).toBeUndefined();
    // A focus that is not a whole number from 0 to 100, or the centre, is not kept; a credit is capped.
    for (const focus of [-1, 101, 2.5, '40', 50])
      expect(parsePageCover({ imageId: 'a', focus }, isId)).toEqual({ imageId: 'a' });
    expect(parsePageCover({ imageId: 'a', credit: 'x'.repeat(400) }, isId)?.credit).toHaveLength(
      COVER_CREDIT_MAX,
    );
    expect(parsePageCover({ imageId: 'a', credit: '   ' }, isId)).toEqual({ imageId: 'a' });
    // A focus or credit without a picture means nothing.
    expect(parsePageCover({ fill: gradient, focus: 10, credit: 'c' }, isId)).toEqual({
      fill: gradient,
    });
  });
});

describe('patchPageCover', () => {
  it('lays a patch over a cover, keeping a picture’s focus and credit with it', () => {
    expect(patchPageCover({ imageId: 'a', focus: 10, credit: 'c' }, { focus: 70 })).toEqual({
      imageId: 'a',
      focus: 70,
      credit: 'c',
    });
    expect(patchPageCover(undefined, { fill: gradient })).toEqual({ fill: gradient });
    // A pattern over a picture keeps both; the pattern alone is a cover too.
    expect(patchPageCover({ imageId: 'a' }, { pattern: 'dots' })).toEqual({
      imageId: 'a',
      pattern: 'dots',
    });
    expect(patchPageCover({ imageId: 'a', pattern: 'dots' }, { imageId: undefined })).toEqual({
      pattern: 'dots',
    });
  });

  it('drops a centred focus, a picture’s parts with the picture, and an empty cover', () => {
    expect(patchPageCover({ imageId: 'a', focus: 10 }, { focus: 50 })).toEqual({ imageId: 'a' });
    expect(
      patchPageCover(
        { imageId: 'a', focus: 10, credit: 'c', fill: gradient },
        { imageId: undefined },
      ),
    ).toEqual({
      fill: gradient,
    });
    expect(patchPageCover({ fill: gradient }, { fill: undefined })).toBeUndefined();
  });
});

describe('where a picture sits', () => {
  it('draws the focus, the middle when there is none or it is not one', () => {
    expect(coverObjectPosition(undefined)).toBe('50% 50%');
    expect(coverObjectPosition(0)).toBe('50% 0%');
    expect(coverObjectPosition(140)).toBe('50% 50%');
  });

  it('moves the focus by whole percents, inside the picture', () => {
    expect(movedCoverFocus(undefined, 5)).toBe(55);
    expect(movedCoverFocus(98, 5)).toBe(100);
    expect(movedCoverFocus(3, -5)).toBe(0);
    expect(movedCoverFocus(40, 2.4)).toBe(42);
  });
});
