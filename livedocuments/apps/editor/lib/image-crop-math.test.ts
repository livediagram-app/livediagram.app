import { describe, expect, it } from 'vitest';
import {
  IMAGE_CROP_FRAME_MIN,
  IMAGE_CROP_ZOOM_MAX,
  cropSessionResult,
  cropSessionStart,
  cropZoom,
  dragFrame,
  fitAspect,
  localDelta,
  panPicture,
  resetCrop,
  zoomPicture,
} from './image-crop-math';

// docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the editor".
const el = { x: 100, y: 50, width: 400, height: 200, rotation: 0 };
const natural = { width: 800, height: 800 };

describe('image crop math', () => {
  it('starts with the box as the frame and the picture covering it', () => {
    const s = cropSessionStart(el, natural);
    expect(s.frame).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    expect(s.picture).toMatchObject({ width: 400, height: 400, x: 0, y: -100 });
  });

  it('starts a stored crop where it is drawn, the frame its part', () => {
    const s = cropSessionStart({ ...el, crop: { x: 0, y: 0.25, width: 1, height: 0.5 } }, natural);
    expect(s.frame.width).toBeCloseTo(400);
    expect(s.frame.height).toBeCloseTo(200);
    expect(s.picture.y).toBeCloseTo(-100);
  });

  it('stores nothing when nothing moved', () => {
    expect(cropSessionResult(el, cropSessionStart(el, natural))).toBeNull();
  });

  it('pans the picture but never leaves the frame uncovered', () => {
    const s = cropSessionStart(el, natural);
    expect(panPicture(s, 0, 40).picture.y).toBe(-60);
    expect(panPicture(s, 0, 500).picture.y).toBe(0);
    expect(panPicture(s, 0, -500).picture.y).toBe(-200);
    expect(panPicture(s, 50, 0).picture.x).toBe(0);
  });

  it('drags an edge, held on the picture and at the minimum', () => {
    const s = cropSessionStart(el, natural);
    expect(dragFrame(s, 'e', -100, 0, null).frame.width).toBe(300);
    expect(dragFrame(s, 'w', -50, 0, null).frame.x).toBe(0);
    expect(dragFrame(s, 'n', 0, -60, null).frame).toMatchObject({ y: -60, height: 260 });
    expect(dragFrame(s, 'n', 0, -500, null).frame.y).toBe(-100);
    expect(dragFrame(s, 'e', -1000, 0, null).frame.width).toBe(IMAGE_CROP_FRAME_MIN);
    expect(dragFrame(s, 's', 0, -1000, null).frame.height).toBe(IMAGE_CROP_FRAME_MIN);
  });

  it('drags a corner keeping an aspect, the opposite corner fixed', () => {
    const s = cropSessionStart(el, natural);
    const f = dragFrame(s, 'se', -100, -10, 1).frame;
    expect(f.x).toBe(0);
    expect(f.y).toBe(0);
    expect(f.width).toBeCloseTo(f.height);
    const g = dragFrame(s, 'nw', 10, 100, 2).frame;
    expect(g.x + g.width).toBeCloseTo(400);
    expect(g.width / g.height).toBeCloseTo(2);
    // Out of room on the picture: shrunk to fit from the fixed corner.
    const h = dragFrame(s, 'se', 0, 400, 1).frame;
    expect(h.y + h.height).toBeLessThanOrEqual(300.0001);
  });

  it('zooms about the frame, from 100% to the most', () => {
    const s = cropSessionStart(el, natural);
    expect(cropZoom(s)).toBeCloseTo(1);
    const z = zoomPicture(s, 2);
    expect(cropZoom(z)).toBeCloseTo(2);
    expect(z.picture.x + z.picture.width / 2).toBeCloseTo(200);
    expect(cropZoom(zoomPicture(s, 99))).toBeCloseTo(IMAGE_CROP_ZOOM_MAX);
    expect(cropZoom(zoomPicture(s, 0.1))).toBeCloseTo(1);
  });

  it('fits an aspect inside the frame, and resets to the whole box', () => {
    const s = cropSessionStart(el, natural);
    expect(fitAspect(s, 1).frame).toEqual({ x: 100, y: 0, width: 200, height: 200 });
    expect(fitAspect(s, 4).frame).toEqual({ x: 0, y: 50, width: 400, height: 100 });
    const back = resetCrop(fitAspect(zoomPicture(s, 3), 1), el);
    expect(back.frame).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    expect(cropZoom(back)).toBeCloseTo(1);
  });

  it('moves the box to the frame and stores the part shown', () => {
    const s = fitAspect(cropSessionStart(el, natural), 1);
    expect(cropSessionResult(el, s)).toEqual({
      x: 200,
      y: 50,
      width: 200,
      height: 200,
      crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    });
  });

  it('turns the moved box with a rotated element, about its old centre', () => {
    const turned = { ...el, rotation: 90 };
    const s = dragFrame(cropSessionStart(turned, natural), 'e', -200, 0, null);
    const r = cropSessionResult(turned, s)!;
    // The frame's centre was 100 left of the box's, turned a quarter: 100 above it.
    expect(r.x + r.width / 2).toBeCloseTo(300);
    expect(r.y + r.height / 2).toBeCloseTo(50);
  });

  it('turns screen deltas into the element frame', () => {
    expect(localDelta(20, 10, 2)).toEqual({ dx: 10, dy: 5 });
    const d = localDelta(10, 0, 1, 90);
    expect(d.dx).toBeCloseTo(0);
    expect(d.dy).toBeCloseTo(-10);
  });
});
