import { afterEach, describe, expect, it } from 'vitest';
import { setLayer } from '@livedesign/photo-engine';
import { at, harness, photoOf, pixel, pixelLayer, solid } from '../photo-test-utils';
import { toolHandler } from '.';
import {
  beginCrop,
  cancelCrop,
  cropBox,
  cropReadout,
  drawnBox,
  reshapeCrop,
  setStraighten,
} from './crop-tool';
import {
  beginTransform,
  cancelTransform,
  commitTransform,
  freeTransform,
  readout,
  setTransformInterpolation,
  setTransformMode,
  transformHandler,
} from './transform-tool';
import { boxCorners } from '@livedesign/photo-engine';

// docs/specs/031-photo/photo-tools.md "Transforming", "Cropping": the Free Transform's box and keys, and
// the crop box's ratio, straightening and keys.
const k = { shift: false, alt: false, mod: false };
const block = () => harness(photoOf(20, 20), { a: solid(10, 10, [0, 0, 255, 255]) });

afterEach(() => {
  const { ctx } = harness(photoOf(1, 1));
  cancelTransform(ctx);
  cancelCrop(ctx);
});

// Pressed at 4x zoom, so the handles reach 2 photo px.
const zoomed = (x: number, y: number) => ({ ...at(x, y), scale: 4 });

describe('the Free Transform', () => {
  it('drags the whole box by its inside, and Enter commits it', async () => {
    const h = block();
    expect(beginTransform(h.ctx)).toBe(true);
    // Already open: it stays the one in hand.
    expect(beginTransform(h.ctx)).toBe(true);
    const t = transformHandler(h.ctx);
    expect(t.down(zoomed(5, 5))).toBe(true);
    t.move!(zoomed(9, 8));
    t.up!(zoomed(9, 8));
    expect(readout(freeTransform.get()!)).toMatchObject({ x: 4, y: 3, width: 10, height: 10 });
    setTransformInterpolation('nearest');
    expect(freeTransform.get()!.interpolation).toBe('nearest');
    expect(t.key!('Tab', k)).toBe(false);
    expect(t.key!('Enter', k)).toBe(true);
    await h.s.settled();
    expect(pixel(h, 4, 3)).toEqual([0, 0, 255, 255]);
    expect(pixel(h, 2, 2)[3]).toBe(0);
    expect(t.key!('Enter', k)).toBe(false);
    expect(t.down(at(1, 1))).toBe(false);
  });

  it('scales by a corner handle, and Escape (or a cancel) puts it back', () => {
    const h = block();
    beginTransform(h.ctx);
    const t = transformHandler(h.ctx);
    t.down(zoomed(10, 10));
    t.move!(zoomed(15, 15));
    t.up!(zoomed(15, 15));
    expect(readout(freeTransform.get()!).width).toBeCloseTo(15, 3);
    expect(t.key!('Escape', k)).toBe(true);
    expect(freeTransform.get()).toBeNull();
    expect(pixel(h, 9, 9)).toEqual([0, 0, 255, 255]);
    beginTransform(h.ctx);
    t.cancel!();
    expect(freeTransform.get()).toBeNull();
    // Nothing open: the box calls do nothing.
    commitTransform(h.ctx);
    cancelTransform(h.ctx);
    expect(h.commits).toEqual([]);
  });

  it('skews by an edge in Skew mode', () => {
    const h = block();
    beginTransform(h.ctx);
    setTransformMode('skew');
    expect(freeTransform.get()!.mode).toBe('skew');
    const t = transformHandler(h.ctx);
    t.down(zoomed(5, 0));
    t.move!(zoomed(9, 0));
    t.up!(zoomed(9, 0));
    const [nw, , se] = boxCorners(freeTransform.get()!.matrix, 10, 10);
    expect(nw!.x).toBeCloseTo(4, 6);
    expect(se!.x).toBeCloseTo(10, 6);
  });

  it('refuses a locked layer, no pixel layer and nothing to lift', () => {
    const h = block();
    h.s.commitStack(setLayer(h.s.photo, 'a', { locks: { pixels: true } }), 'Lock');
    expect(beginTransform(h.ctx)).toBe(false);
    expect(h.toasts.at(-1)).toBe('a is locked.');
    const none = harness(photoOf(4, 4, []));
    expect(beginTransform(none.ctx)).toBe(false);
    expect(none.toasts).toEqual(['Choose a pixel layer to transform.']);
    const empty = harness(photoOf(4, 4, [pixelLayer('e')]));
    expect(beginTransform(empty.ctx)).toBe(false);
    expect(empty.toasts).toEqual(['Nothing to transform there.']);
  });
});

describe('the crop box', () => {
  it('begins on a press, keeps a fixed ratio’s shape and crops on a double press', async () => {
    const h = harness(photoOf(20, 10), { a: solid(20, 10, [9, 9, 9, 255]) });
    h.state.options.crop = { ...h.state.options.crop, ratio: '1:1' };
    const t = toolHandler('crop', h.ctx);
    t.down(at(15, 10));
    expect(cropReadout(cropBox.get()!)).toMatchObject({ width: 10, height: 10 });
    t.move!(at(13, 8));
    t.up!(at(13, 8));
    const r = cropReadout(cropBox.get()!);
    expect(r.width).toBeCloseTo(r.height, 6);
    t.double!(at(13, 8));
    await h.s.settled();
    expect(h.s.photo.width).toBe(h.s.photo.height);
    expect(cropBox.get()).toBeNull();
  });

  it('draws a new box with a drag on the photo, then moves it with a drag inside it', async () => {
    const h = harness(photoOf(100, 60), { a: solid(100, 60, [9, 9, 9, 255]) });
    h.state.options.crop = { ...h.state.options.crop, ratio: 'free' };
    const t = toolHandler('crop', h.ctx);
    t.down(at(10, 10));
    t.move!(at(90, 50));
    t.up!(at(90, 50));
    expect(cropReadout(cropBox.get()!)).toMatchObject({ x: 10, y: 10, width: 80, height: 40 });
    // The drawn box is no longer fresh: inside it, a drag moves it.
    t.down(at(50, 30));
    t.move!(at(45, 25));
    t.up!(at(45, 25));
    expect(cropReadout(cropBox.get()!)).toMatchObject({ width: 80, height: 40 });
    expect(cropReadout(cropBox.get()!).x).toBeCloseTo(5, 6);
    t.key!('Enter', k);
    await h.s.settled();
    expect([h.s.photo.width, h.s.photo.height]).toEqual([80, 40]);
  });

  it('holds a drawn box to a fixed ratio, and a click leaves the fresh box whole', () => {
    expect(drawnBox({ x: 10, y: 10 }, { x: 50, y: 20 }, 1)).toMatchObject({
      width: 40,
      height: 40,
    });
    expect(drawnBox({ x: 50, y: 50 }, { x: 40, y: 10 }, null)).toMatchObject({
      x: 40,
      y: 10,
      width: 10,
      height: 40,
    });
    const h = harness(photoOf(40, 20));
    const t = toolHandler('crop', h.ctx);
    t.down(at(20, 10));
    t.move!(at(20.5, 10.5));
    t.up!(at(20.5, 10.5));
    expect(cropReadout(cropBox.get()!)).toMatchObject({ x: 0, y: 0, width: 40, height: 20 });
  });

  it('reshapes to a ratio once begun, and begins when none is open', () => {
    const h = harness(photoOf(40, 20));
    reshapeCrop(h.ctx, '16:9');
    expect(cropBox.get()).not.toBeNull();
    reshapeCrop(h.ctx, '9:16');
    const r = cropReadout(cropBox.get()!);
    expect(r.height / r.width).toBeCloseTo(16 / 9, 3);
    reshapeCrop(h.ctx, 'free');
    expect(cropReadout(cropBox.get()!).width).toBeCloseTo(r.width, 6);
  });

  it('turns the box so a line drawn with Straighten lies level, and ignores a short one', () => {
    const h = harness(photoOf(40, 40));
    setStraighten(h.ctx, true);
    const t = toolHandler('crop', h.ctx);
    t.down(at(5, 5));
    t.move!(at(6, 5.5));
    t.up!(at(6, 5.5));
    expect(cropReadout(cropBox.get()!).angle).toBeCloseTo(0, 6);
    expect(cropBox.get()!.straighten).toBe(false);
    setStraighten(h.ctx, true);
    t.down(at(5, 5));
    t.move!(at(25, 15));
    expect(h.overlays.at(-1)).toMatchObject({ kind: 'line', to: { x: 25, y: 15 } });
    t.up!(at(25, 15));
    const a = cropReadout(cropBox.get()!).angle;
    expect(Math.abs(a)).toBeGreaterThan(20);
    expect(Math.abs(a)).toBeLessThanOrEqual(45);
    // A near-upright line turns the box the short way.
    setStraighten(h.ctx, true);
    t.down(at(5, 5));
    t.move!(at(7, 30));
    t.up!(at(7, 30));
    expect(Math.abs(cropReadout(cropBox.get()!).angle)).toBeLessThan(10);
  });

  it('Escape and a cancel close it unchanged', () => {
    const h = harness(photoOf(10, 10));
    const t = toolHandler('crop', h.ctx);
    beginCrop(h.ctx);
    expect(t.key!('Escape', k)).toBe(true);
    expect(cropBox.get()).toBeNull();
    expect(t.key!('a', k)).toBe(false);
    beginCrop(h.ctx);
    t.cancel!();
    cancelCrop(h.ctx);
    expect(cropBox.get()).toBeNull();
    expect(h.commits).toEqual([]);
  });
});
