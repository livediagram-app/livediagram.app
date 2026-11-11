import { describe, expect, it } from 'vitest';
import {
  IMAGE_BACKING_COLOUR,
  IMAGE_BACKING_INSET_PX,
  IMAGE_BACKING_INSET_VAR,
  containedPictureRect,
  imageBackingInsetPx,
  imageBackingInsetVar,
  imageBackingStyle,
} from './image-backing';

describe('imageBackingInsetPx', () => {
  it('keeps 2 px while that is a device pixel or more', () => {
    expect(IMAGE_BACKING_INSET_PX).toBe(2);
    expect(imageBackingInsetPx(0.5, 1)).toBe(2);
    expect(imageBackingInsetPx(3, 1)).toBe(2);
    expect(imageBackingInsetPx(0.25, 2)).toBe(2);
  });

  it('grows to at least one device pixel at every zoom below that, in powers of two', () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      for (let zoom = 0.02; zoom <= 4; zoom += 0.01) {
        const inset = imageBackingInsetPx(zoom, dpr);
        expect(inset * zoom * dpr).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(Math.log2(inset) % 1).toBe(0);
        // Never more than twice what a device pixel needs, once past the 2 px floor.
        if (inset > 2) expect(inset * zoom * dpr).toBeLessThan(2 + 1e-9);
      }
    }
    expect(imageBackingInsetPx(0.33, 1)).toBe(4);
    expect(imageBackingInsetPx(0.1, 1)).toBe(16);
  });

  it('changes at only a few thresholds over the whole zoom range, so zooming rarely restyles', () => {
    const seen = new Set<number>();
    for (let zoom = 0.05; zoom <= 4; zoom += 0.001) seen.add(imageBackingInsetPx(zoom, 1));
    expect([...seen].sort((a, b) => a - b)).toEqual([2, 4, 8, 16, 32]);
  });

  it('falls back to 2 px for a zoom or screen it cannot use', () => {
    expect(imageBackingInsetPx(0, 1)).toBe(2);
    expect(imageBackingInsetPx(Number.NaN, 1)).toBe(2);
    expect(imageBackingInsetPx(1, 0)).toBe(2);
  });

  it('hands the canvas the variable the frames read', () => {
    expect(imageBackingInsetVar(1, 2)).toEqual({ [IMAGE_BACKING_INSET_VAR]: '2px' });
    expect(imageBackingInsetVar(0.3, 1)).toEqual({ '--lw-image-backing-inset': '4px' });
    // With no ratio given, this screen's, else 1.
    const g = globalThis as { devicePixelRatio?: number };
    const before = g.devicePixelRatio;
    g.devicePixelRatio = 2;
    expect(imageBackingInsetVar(0.3)).toEqual({ [IMAGE_BACKING_INSET_VAR]: '2px' });
    delete g.devicePixelRatio;
    expect(imageBackingInsetVar(0.3)).toEqual({ [IMAGE_BACKING_INSET_VAR]: '4px' });
    if (before !== undefined) g.devicePixelRatio = before;
  });
});

// docs/specs/009-elements/images.md "The white under a picture" (each product's).
describe('containedPictureRect', () => {
  it('fits a wide picture to the width, centred, leaving bands above and below', () => {
    const rect = containedPictureRect(400, 300, 600, 200)!;
    expect(rect.x).toBe(0);
    expect(rect.width).toBe(400);
    expect(rect.height).toBeCloseTo(133.333, 3);
    expect(rect.y).toBeCloseTo(83.333, 3);
  });

  it('fits a tall picture to the height, leaving bands beside it', () => {
    expect(containedPictureRect(400, 200, 100, 200)).toEqual({
      x: 150,
      y: 0,
      width: 100,
      height: 200,
    });
  });

  it('answers null for an empty box or picture, never NaN', () => {
    expect(containedPictureRect(0, 200, 100, 100)).toBeNull();
    expect(containedPictureRect(200, 200, 100, 0)).toBeNull();
    expect(containedPictureRect(200, Number.NaN, 100, 100)).toBeNull();
  });
});

describe('imageBackingStyle', () => {
  it('insets the white from every edge when the picture covers the box', () => {
    expect(imageBackingStyle(400, 300, null)).toEqual({
      frame: {
        padding: `var(${IMAGE_BACKING_INSET_VAR}, 2px)`,
        backgroundColor: IMAGE_BACKING_COLOUR,
        backgroundClip: 'content-box',
      },
      bands: null,
    });
  });

  it('treats a picture filling the box (to within a hundredth of a pixel) as covering it', () => {
    expect(imageBackingStyle(400, 300, { x: 0.004, y: 0, width: 399.995, height: 300 })).toEqual(
      imageBackingStyle(400, 300, null),
    );
  });

  it('runs the bands above and below a wide picture to the box edge', () => {
    const style = imageBackingStyle(400, 300, containedPictureRect(400, 300, 600, 200));
    expect(style.frame.backgroundClip).toBe('content-box');
    expect(style.bands?.boxShadow).toBe('inset 0px 83.33px 0 0 #fff, inset 0px -83.33px 0 0 #fff');
  });

  it('runs the bands beside a tall picture to the box edge', () => {
    const style = imageBackingStyle(400, 200, containedPictureRect(400, 200, 100, 200));
    expect(style.bands?.boxShadow).toBe('inset 150px 0px 0 0 #fff, inset -150px 0px 0 0 #fff');
  });

  it('bands every side of a part laid inside the box, clamped to the box', () => {
    const style = imageBackingStyle(100, 100, { x: 10, y: 20, width: 70, height: 200 });
    // Above (20), beside left (10) and right (20); the part runs past the bottom, so no band there.
    expect(style.bands?.boxShadow).toBe(
      'inset 0px 20px 0 0 #fff, inset 10px 0px 0 0 #fff, inset -20px 0px 0 0 #fff',
    );
  });
});
