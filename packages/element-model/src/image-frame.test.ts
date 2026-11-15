import { describe, expect, it } from 'vitest';
import {
  IMAGE_MASKS,
  MASK_LABEL,
  cleanImageCrop,
  imageDrawsCover,
  imageIsShaped,
  imageLayout,
  imageMaskPath,
  isImageCrop,
  isImageMask,
  withImageGreyscale,
  withImageMask,
} from './image-frame';

// docs/specs/009-elements/picture-crop-and-mask.md (livedocuments and livedesign)
describe('crop guards', () => {
  it('takes a part inside the picture and refuses the rest', () => {
    expect(isImageCrop({ x: 0.1, y: 0.2, width: 0.5, height: 0.5 })).toBe(true);
    expect(isImageCrop({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(isImageCrop({ x: 0.6, y: 0, width: 0.5, height: 0.5 })).toBe(false);
    expect(isImageCrop({ x: -0.1, y: 0, width: 0.5, height: 0.5 })).toBe(false);
    expect(isImageCrop({ x: 0, y: 0, width: 0.01, height: 0.5 })).toBe(false);
    expect(isImageCrop({ x: 0, y: 0, width: Number.NaN, height: 0.5 })).toBe(false);
    expect(isImageCrop(null)).toBe(false);
    expect(isImageCrop('crop')).toBe(false);
  });

  it('stores four decimals, inside the picture, and the whole picture as none', () => {
    expect(cleanImageCrop({ x: 0.123456, y: 0, width: 0.5, height: 0.5 })).toEqual({
      x: 0.1235,
      y: 0,
      width: 0.5,
      height: 0.5,
    });
    expect(cleanImageCrop({ x: 0.0001, y: 0, width: 0.9999, height: 1 })).toBeUndefined();
    expect(cleanImageCrop({ x: 0.9, y: 0.9, width: 0.5, height: 0.001 })).toEqual({
      x: 0.5,
      y: 0.9,
      width: 0.5,
      height: 0.02,
    });
  });

  it('knows its masks', () => {
    expect(IMAGE_MASKS).toHaveLength(8);
    for (const m of IMAGE_MASKS) expect(isImageMask(m)).toBe(true);
    expect(isImageMask('heart')).toBe(false);
  });
});

describe('imageLayout', () => {
  it('fits a cropped part whole and places the picture around it', () => {
    // A 400 x 200 picture, its right half kept, in a 100 x 100 box: the 200 x 200 part scales by 0.5.
    const l = imageLayout(
      { width: 100, height: 100 },
      { width: 400, height: 200 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
      'contain',
    );
    expect(l.part).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(l.picture).toEqual({ x: -100, y: 0, width: 200, height: 100 });
  });

  it('letterboxes with contain and fills with cover', () => {
    const contain = imageLayout(
      { width: 200, height: 100 },
      { width: 100, height: 100 },
      null,
      'contain',
    );
    expect(contain.part).toEqual({ x: 50, y: 0, width: 100, height: 100 });
    const cover = imageLayout(
      { width: 200, height: 100 },
      { width: 100, height: 100 },
      null,
      'cover',
    );
    expect(cover.part).toEqual({ x: 0, y: -50, width: 200, height: 200 });
  });

  it('uses the box proportions without a natural size and ignores a bad crop', () => {
    const l = imageLayout(
      { width: 80, height: 40 },
      null,
      { x: 2, y: 0, width: 1, height: 1 },
      'cover',
    );
    expect(l.picture).toEqual({ x: 0, y: 0, width: 80, height: 40 });
    const empty = imageLayout({ width: 0, height: 0 }, { width: 0, height: 0 }, null, 'cover');
    expect(empty.part.width).toBe(0);
  });

  it('says when a picture covers and when it is shaped', () => {
    expect(imageDrawsCover({ mask: 'star' })).toBe(true);
    expect(imageDrawsCover({ objectFit: 'cover' })).toBe(true);
    expect(imageDrawsCover({ objectFit: 'contain', mask: 'nope' })).toBe(false);
    expect(imageIsShaped({ crop: { x: 0, y: 0, width: 0.5, height: 0.5 } })).toBe(true);
    expect(imageIsShaped({ mask: 'circle' })).toBe(true);
    expect(imageIsShaped({})).toBe(false);
  });
});

describe('imageMaskPath', () => {
  it('draws every mask as a closed path of numbers inside the box', () => {
    for (const m of IMAGE_MASKS) {
      const d = imageMaskPath(m, 120, 80, 10, 20);
      expect(d).toMatch(/^M[-\d. ACHLVZ]+Z$/);
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(nums.length).toBeGreaterThan(3);
    }
  });

  it('places the polygon masks on the box', () => {
    expect(imageMaskPath('diamond', 100, 50)).toBe('M50 0L100 25L50 50L0 25Z');
    expect(imageMaskPath('triangle', 100, 50, 5, 5)).toBe('M55 5L105 55L5 55Z');
    expect(imageMaskPath('hexagon', 100, 50)).toBe('M0 25L25 0L75 0L100 25L75 50L25 50Z');
    expect(imageMaskPath('star', 100, 100).startsWith('M50 0L')).toBe(true);
    expect(imageMaskPath('rounded', 100, 50)).toContain('A10 10');
    expect(imageMaskPath('arch', 100, 200)).toBe('M0 200V50A50 50 0 0 1 100 50V200Z');
    expect(imageMaskPath('circle', 100, 50)).toContain('A50 25');
    expect(imageMaskPath('blob', 100, 100).match(/C/g)).toHaveLength(4);
  });
});

describe('mask and greyscale edits', () => {
  const img = { id: 'i', type: 'image', mask: 'star' as const };
  const box = { id: 'b', type: 'shape' };

  it('sets, replaces and removes a mask on an image only', () => {
    expect(withImageMask(img, 'circle')).toEqual({ id: 'i', type: 'image', mask: 'circle' });
    expect(withImageMask(img, null)).toEqual({ id: 'i', type: 'image' });
    expect(withImageMask(box, 'circle')).toBe(box);
  });

  it('turns greyscale on and off on an image only', () => {
    expect(withImageGreyscale(img, true)).toEqual({ ...img, greyscale: true });
    expect(withImageGreyscale({ ...img, greyscale: true }, false)).toEqual(img);
    expect(withImageGreyscale(box, true)).toBe(box);
  });

  it('names every mask', () => {
    expect(IMAGE_MASKS.map((m) => MASK_LABEL[m])).toEqual([
      'Circle',
      'Rounded',
      'Arch',
      'Hexagon',
      'Diamond',
      'Triangle',
      'Star',
      'Blob',
    ]);
  });
});
