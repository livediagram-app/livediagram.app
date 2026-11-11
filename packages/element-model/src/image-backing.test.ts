import { describe, expect, it } from 'vitest';
import {
  IMAGE_BACKING_COLOUR,
  IMAGE_BACKING_INSET_PX,
  containedPictureRect,
  imageBackingStyle,
} from './image-backing';

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
      padding: IMAGE_BACKING_INSET_PX,
      backgroundColor: IMAGE_BACKING_COLOUR,
      backgroundClip: 'content-box',
      boxShadow: 'none',
    });
    // A whole screen pixel at 50% zoom on a 1x screen.
    expect(IMAGE_BACKING_INSET_PX * 0.5).toBeGreaterThanOrEqual(1);
  });

  it('treats a picture filling the box (to within a hundredth of a pixel) as covering it', () => {
    expect(imageBackingStyle(400, 300, { x: 0.004, y: 0, width: 399.995, height: 300 })).toEqual(
      imageBackingStyle(400, 300, null),
    );
  });

  it('runs the bands above and below a wide picture to the box edge', () => {
    const style = imageBackingStyle(400, 300, containedPictureRect(400, 300, 600, 200));
    expect(style.backgroundClip).toBe('content-box');
    expect(style.boxShadow).toBe('inset 0px 83.33px 0 0 #fff, inset 0px -83.33px 0 0 #fff');
  });

  it('runs the bands beside a tall picture to the box edge', () => {
    const style = imageBackingStyle(400, 200, containedPictureRect(400, 200, 100, 200));
    expect(style.boxShadow).toBe('inset 150px 0px 0 0 #fff, inset -150px 0px 0 0 #fff');
  });

  it('bands every side of a part laid inside the box, clamped to the box', () => {
    const style = imageBackingStyle(100, 100, { x: 10, y: 20, width: 70, height: 200 });
    // Above (20), beside left (10) and right (20); the part runs past the bottom, so no band there.
    expect(style.boxShadow).toBe(
      'inset 0px 20px 0 0 #fff, inset 10px 0px 0 0 #fff, inset -20px 0px 0 0 #fff',
    );
  });
});
