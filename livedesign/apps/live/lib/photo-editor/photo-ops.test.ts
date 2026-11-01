import { describe, expect, it } from 'vitest';
import { createMask, setLayer, type PixelLayer, type TextLayer } from '@livedesign/photo-engine';
import { clearSelection, fillSelection } from './edit-ops';
import {
  canvasSize,
  coverPlan,
  coverSize,
  cropTo,
  flipImage,
  imageSize,
  rotateAny,
  rotateQuarterTurn,
  sizeRefused,
  trimTransparent,
} from './image-ops';
import {
  deleteLayers,
  duplicate,
  flatten,
  flattenDiscards,
  layerVia,
  mergeDown,
  STILL_MERGING,
  mergeVisible,
  newAdjustmentLayer,
  newGroup,
  newLayer,
  placePicture,
  rasterize,
  toggleClip,
} from './layer-ops';
import { addMask, applyMask, deleteMask, invertMask, selectPixels, toggleMask } from './mask-ops';
import { harness, lastCommit, photoOf, pixel, pixelLayer, solid } from './photo-test-utils';
import { deselect, inverse, modifySelection, reselect, selectAll } from './selection-ops';
import { textBox } from './text-raster';

/** A 4 x 2 photo, its one layer red on the left half and green on the right. */
function halves() {
  const r = solid(4, 2, [255, 0, 0, 255]);
  for (const i of [2, 3, 6, 7]) r.data.set([0, 255, 0, 255], i * 4);
  return harness(photoOf(4, 2), { a: r });
}

describe('the session', () => {
  it('holds a stack edit at once and keeps it through a pixel commit still encoding', async () => {
    const h = halves();
    h.s.raster('a').write(solid(1, 1, [0, 0, 255, 255]), 0, 0);
    h.s.commitPixels('Brush', [{ layerId: 'a', target: 'layer' }]);
    // Made while the stroke's tiles encode.
    h.s.commitStack(setLayer(h.s.photo, 'a', { opacity: 0.5 }), 'Opacity');
    expect(h.s.photo.layers[0]!.opacity).toBe(0.5);
    await h.s.settled();
    const a = h.s.photo.layers[0] as PixelLayer;
    expect(a.opacity).toBe(0.5);
    expect(Object.keys(a.pixels.tiles)).toEqual(['0.0']);
    expect(h.commits.map((c) => c.label)).toEqual(['Opacity', 'Brush']);
  });
});

describe('changing the size', () => {
  it('refuses sizes past the cap or under a pixel', () => {
    expect(sizeRefused(0, 10)).toMatch(/at least one pixel/);
    expect(sizeRefused(9000, 10)).toMatch(/8192 px/);
    expect(sizeRefused(100, 100)).toBeNull();
  });

  it('turns and flips every layer with the photo', async () => {
    const h = halves();
    rotateQuarterTurn(h.s, 90);
    await h.s.settled();
    expect([h.s.photo.width, h.s.photo.height]).toEqual([2, 4]);
    // The left half (red) is on top after a clockwise quarter turn.
    expect(pixel(h, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 1, 3)).toEqual([0, 255, 0, 255]);
    flipImage(h.s, false);
    await h.s.settled();
    expect(pixel(h, 0, 0)).toEqual([0, 255, 0, 255]);
    expect(lastCommit(h)?.label).toBe('Flip Vertical');
  });

  it('takes a second turn made before the first has landed from the new size', async () => {
    const h = halves();
    rotateQuarterTurn(h.s, 90);
    rotateQuarterTurn(h.s, 90);
    flipImage(h.s, true);
    await h.s.settled();
    // A half turn, then a flip across: left red, right green again, one edit each.
    expect([h.s.photo.width, h.s.photo.height]).toEqual([4, 2]);
    expect(pixel(h, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 3, 1)).toEqual([0, 255, 0, 255]);
    expect(h.commits).toHaveLength(3);
  });

  it('moves a text layer once however the edit lands', async () => {
    const h = harness(
      photoOf(10, 10, [
        pixelLayer('a'),
        {
          id: 't',
          name: 'T',
          layerKind: 'text',
          text: {
            text: 'Hi',
            font: 'inter',
            size: 12,
            weight: 400,
            colour: '#000000',
            align: 'left',
            at: { x: 4, y: 4 },
          },
        },
      ]),
      { a: solid(10, 10, [255, 255, 255, 255]) },
    );
    const at = () => (h.s.photo.layers.find((l) => l.id === 't') as TextLayer).text.at;
    // Grown 2 px each side, then cropped 3 px in: each move made once, back to back.
    canvasSize(h.s, 14, 14, 'centre', null);
    cropTo(h.s, { x: 3, y: 3, width: 8, height: 8 });
    await h.s.settled();
    expect(at()).toEqual({ x: 3, y: 3 });
  });

  it('keeps a text layer upright on the same part of the picture through a turn and a flip', async () => {
    const text = {
      text: 'Hi',
      font: 'inter',
      size: 12,
      weight: 400 as const,
      colour: '#000000',
      align: 'left' as const,
      at: { x: 2, y: 2 },
    };
    const h = harness(
      photoOf(40, 20, [pixelLayer('a'), { id: 't', name: 'T', layerKind: 'text', text }]),
      { a: solid(40, 20, [255, 255, 255, 255]) },
    );
    const box = () => textBox(h.s.photo.layers.find((l) => l.id === 't') as TextLayer);
    const centre = () => ({ x: box().x + box().width / 2, y: box().y + box().height / 2 });
    const was = centre();
    rotateQuarterTurn(h.s, 90);
    await h.s.settled();
    // (x, y) turns clockwise to (H - y, x) in a 20 x 40 photo.
    expect(centre().x).toBeCloseTo(20 - was.y, 0);
    expect(centre().y).toBeCloseTo(was.x, 0);
    rotateQuarterTurn(h.s, 270);
    flipImage(h.s, true);
    await h.s.settled();
    expect(centre().x).toBeCloseTo(40 - was.x, 0);
    expect(centre().y).toBeCloseTo(was.y, 0);
    expect(rotateAny(h.s, 30)).toBeNull();
    await h.s.settled();
    expect(h.s.photo.width).toBeGreaterThan(40);
    const c = centre();
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(h.s.photo.width);
  });

  it('resizes the photo and its layers', async () => {
    const h = halves();
    expect(imageSize(h.s, 8, 4, 'nearest')).toBeNull();
    await h.s.settled();
    expect([h.s.photo.width, h.s.photo.height]).toEqual([8, 4]);
    expect(pixel(h, 3, 3)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 4, 0)).toEqual([0, 255, 0, 255]);
  });

  it('grows the canvas about its anchor, filling the bottom layer’s new area', async () => {
    const h = halves();
    expect(canvasSize(h.s, 6, 2, 'right', '#ffffff')).toBeNull();
    await h.s.settled();
    expect(h.s.photo.width).toBe(6);
    expect(pixel(h, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(h, 2, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 5, 1)).toEqual([0, 255, 0, 255]);
  });

  it('plans a cover fit: the larger scale, centred', () => {
    expect(coverPlan({ width: 4000, height: 3000 }, { width: 1080, height: 1920 })).toEqual({
      k: 0.64,
      dx: -740,
      dy: 0,
    });
    expect(coverPlan({ width: 1080, height: 1080 }, { width: 1584, height: 396 })).toEqual({
      k: 1584 / 1080,
      dx: 0,
      dy: -594,
    });
  });

  it('fills another size, cropped about the centre, keeping the pixels past its edges', async () => {
    // A 4 x 2 photo into 2 x 2: scale 1, the middle two columns kept in view.
    const h = halves();
    const text = {
      text: 'Hi',
      font: 'inter',
      size: 12,
      weight: 400 as const,
      colour: '#000000',
      align: 'left' as const,
      at: { x: 2, y: 0 },
      boxWidth: 4,
    };
    h.s.commitStack(
      {
        ...h.s.photo,
        layers: [...h.s.photo.layers, { id: 't', name: 'T', layerKind: 'text', text }],
      },
      'Text',
    );
    expect(coverSize(h.s, 2, 2)).toBeNull();
    await h.s.settled();
    expect([h.s.photo.width, h.s.photo.height]).toEqual([2, 2]);
    expect(pixel(h, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 1, 0)).toEqual([0, 255, 0, 255]);
    const a = h.s.photo.layers[0] as PixelLayer;
    expect(a.offset).toEqual({ x: -1, y: 0 });
    expect(h.s.raster('a').contentBounds()).toMatchObject({ width: 4, height: 2 });
    expect((h.s.photo.layers[1] as TextLayer).text).toMatchObject({ at: { x: 1, y: 0 } });
    expect(lastCommit(h)?.label).toBe('Make Sizes');
    // Twice as big: every layer and its text scaled with it.
    expect(coverSize(h.s, 4, 4)).toBeNull();
    await h.s.settled();
    expect((h.s.photo.layers[1] as TextLayer).text).toMatchObject({ size: 24, boxWidth: 8 });
    expect(coverSize(h.s, 0, 4)).toMatch(/at least one pixel/);
  });

  it('crops to a rect and trims transparent edges', async () => {
    const h = halves();
    expect(cropTo(h.s, { x: 2, y: 0, width: 2, height: 2 })).toBeNull();
    await h.s.settled();
    expect(h.s.photo.width).toBe(2);
    expect(pixel(h, 0, 0)).toEqual([0, 255, 0, 255]);
    const t = harness(photoOf(5, 5), {
      a: (() => {
        const r = solid(5, 5, [0, 0, 0, 0]);
        r.data.set([9, 9, 9, 255], (2 * 5 + 3) * 4);
        return r;
      })(),
    });
    expect(trimTransparent(t.s)).toBeNull();
    await t.s.settled();
    expect([t.s.photo.width, t.s.photo.height]).toEqual([1, 1]);
    expect(pixel(t, 0, 0)).toEqual([9, 9, 9, 255]);
    expect(trimTransparent(t.s)).toBe('Nothing to trim.');
  });
});

describe('layer operations', () => {
  it('adds, groups, duplicates and deletes layers, each one edit', () => {
    const h = halves();
    newLayer(h.s);
    expect(h.s.photo.layers.map((l) => l.name)).toEqual(['a', 'Layer 1']);
    newGroup(h.s, [h.s.active!]);
    expect(h.s.photo.layers.find((l) => l.name === 'Layer 1')?.parent).toBe(h.s.active);
    duplicate(h.s, ['a']);
    expect(h.s.photo.layers.map((l) => l.name)).toContain('a Copy');
    deleteLayers(h.s, ['a']);
    expect(h.s.photo.layers.some((l) => l.id === 'a')).toBe(false);
    expect(h.commits.map((c) => c.label)).toEqual([
      'New Layer',
      'Group',
      'Duplicate Layer',
      'Delete Layer',
    ]);
  });

  it('merges down by the upper layer’s opacity, keeping the lower layer', async () => {
    const h = harness(photoOf(2, 1, [pixelLayer('low'), pixelLayer('up', { opacity: 0.5 })]), {
      low: solid(2, 1, [0, 0, 0, 255]),
      up: solid(1, 1, [255, 255, 255, 255]),
    });
    h.s.active = 'up';
    expect(await mergeDown(h.s)).toBeNull();
    await h.s.settled();
    expect(h.s.photo.layers.map((l) => l.id)).toEqual(['low']);
    const [r] = pixel(h, 0, 0);
    expect(r).toBeGreaterThan(120);
    expect(r).toBeLessThan(135);
    expect(pixel(h, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(await mergeDown(h.s)).toMatch(/pixel layer under/);
  });

  it('refuses a second merge while one is compositing', async () => {
    const h = harness(photoOf(4, 4, [pixelLayer('a'), pixelLayer('b'), pixelLayer('c')]), {
      a: solid(4, 4, [255, 0, 0, 255]),
      b: solid(4, 4, [0, 255, 0, 128]),
      c: solid(4, 4, [0, 0, 255, 128]),
    });
    h.s.choose('c', 'layer');
    const first = mergeDown(h.s);
    expect(await mergeDown(h.s)).toBe(STILL_MERGING);
    expect(await mergeVisible(h.s)).toBe(STILL_MERGING);
    expect(await first).toBeNull();
    await h.s.settled();
    expect(h.s.photo.layers).toHaveLength(2);
    expect(await mergeDown(h.s)).toBeNull();
  });

  it('merges the visible layers and flattens, discarding hidden ones', async () => {
    const h = harness(
      photoOf(1, 1, [pixelLayer('a'), pixelLayer('b'), pixelLayer('hidden', { visible: false })]),
      { a: solid(1, 1, [10, 0, 0, 255]), b: solid(1, 1, [0, 0, 0, 0]) },
    );
    expect(flattenDiscards(h.s.photo)).toBe(true);
    expect(await mergeVisible(h.s)).toBeNull();
    await h.s.settled();
    expect(h.s.photo.layers.map((l) => l.name)).toEqual(['a', 'hidden']);
    await flatten(h.s);
    await h.s.settled();
    expect(h.s.photo.layers.map((l) => l.name)).toEqual(['Background']);
    expect(pixel(h, 0, 0)).toEqual([10, 0, 0, 255]);
  });

  it('copies and cuts the selection into a new layer', async () => {
    const h = halves();
    h.s.selection = createMask({ x: 0, y: 0, width: 2, height: 2 }, 255);
    expect(layerVia(h.s, true)).toBeNull();
    await h.s.settled();
    expect(h.s.photo.layers).toHaveLength(2);
    const made = h.s.photo.layers[1] as PixelLayer;
    expect(h.s.raster(made.id).sample(1, 1, 0)).toBe(255);
    // Cut: the source's selected pixels are transparent.
    expect(h.s.raster('a').sample(0, 0, 3)).toBe(0);
    expect(h.s.raster('a').sample(3, 0, 3)).toBe(255);
  });

  it('places a picture centred, scaled down to fit', async () => {
    const h = halves();
    const id = placePicture(h.s, solid(8, 2, [1, 2, 3, 255]), 'Picture');
    await h.s.settled();
    const l = h.s.layer(id) as PixelLayer;
    expect(l.name).toBe('Picture 1');
    expect(h.s.raster(id).contentBounds()).toMatchObject({ width: 4, height: 1 });
    expect(l.offset).toEqual({ x: 0, y: 1 });
  });

  it('adds adjustment layers, clips and rasterizes', async () => {
    const h = halves();
    const id = newAdjustmentLayer(h.s, 'invert', true);
    expect(h.s.layer(id)).toMatchObject({ layerKind: 'adjustment', clip: true });
    expect(pixel(h, 0, 0)).toEqual([0, 255, 255, 255]);
    toggleClip(h.s, id);
    expect(h.s.layer(id)?.clip).toBeUndefined();
    expect(rasterize(h.s, id)).toMatch(/text or fill/);
    const fill = {
      id: 'f',
      name: 'Fill',
      layerKind: 'fill' as const,
      fill: { kind: 'solid' as const, colour: '#336699' },
    };
    h.s.commitStack({ ...h.s.photo, layers: [...h.s.photo.layers, fill] }, 'Fill');
    expect(rasterize(h.s, 'f')).toBeNull();
    await h.s.settled();
    expect(h.s.layer('f')?.layerKind).toBe('pixel');
    expect(pixel(h, 3, 1)).toEqual([0x33, 0x66, 0x99, 255]);
  });
});

describe('masks', () => {
  it('adds a mask from the selection, inverts, disables, applies and deletes it', async () => {
    const h = halves();
    h.s.selection = createMask({ x: 0, y: 0, width: 2, height: 2 }, 255);
    expect(addMask(h.s, 'a', 'selection')).toBeNull();
    await h.s.settled();
    expect(pixel(h, 3, 0)[3]).toBe(0);
    expect(pixel(h, 0, 0)[3]).toBe(255);
    invertMask(h.s, 'a');
    await h.s.settled();
    expect(pixel(h, 0, 0)[3]).toBe(0);
    toggleMask(h.s, 'a');
    expect(pixel(h, 0, 0)[3]).toBe(255);
    toggleMask(h.s, 'a');
    expect(applyMask(h.s, 'a')).toBeNull();
    await h.s.settled();
    expect(h.s.layer('a')?.mask).toBeUndefined();
    expect(h.s.raster('a').sample(0, 0, 3)).toBe(0);
    expect(h.s.raster('a').sample(3, 0, 3)).toBe(255);
    expect(addMask(h.s, 'a', 'hide')).toBeNull();
    await h.s.settled();
    expect(pixel(h, 3, 0)[3]).toBe(0);
    deleteMask(h.s, 'a');
    expect(pixel(h, 3, 0)[3]).toBe(255);
  });

  it('selects a layer’s pixels', () => {
    const h = harness(photoOf(3, 1), {
      a: (() => {
        const r = solid(3, 1, [0, 0, 0, 0]);
        r.data.set([1, 1, 1, 200], 4);
        return r;
      })(),
    });
    expect(selectPixels(h.s, 'a')).toBeNull();
    // Exactly the pixels there are.
    expect(h.s.selection).toMatchObject({ x: 1, y: 0, width: 1, height: 1 });
    expect([...h.s.selection!.data]).toEqual([200]);
  });
});

describe('fill, delete and the Select menu', () => {
  it('fills the selection and deletes its pixels', async () => {
    const h = halves();
    selectAll(h.s);
    modifySelection(h.s, 'contract', 1);
    expect(h.s.selection).toBeNull();
    reselect(h.s);
    expect(h.s.selection?.width).toBe(4);
    deselect(h.s);
    h.s.selection = createMask({ x: 0, y: 0, width: 1, height: 1 }, 255);
    expect(
      fillSelection(h.s, { contents: 'white' }, { foreground: '#000000', background: '#ffffff' }),
    ).toBeNull();
    await h.s.settled();
    expect(pixel(h, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(h, 1, 0)).toEqual([255, 0, 0, 255]);
    inverse(h.s);
    expect(clearSelection(h.s, '#ffffff')).toBeNull();
    await h.s.settled();
    expect(pixel(h, 1, 0)[3]).toBe(0);
    expect(pixel(h, 0, 0)).toEqual([255, 255, 255, 255]);
    deselect(h.s);
    expect(clearSelection(h.s, '#ffffff')).toMatch(/selection first/);
  });
});
