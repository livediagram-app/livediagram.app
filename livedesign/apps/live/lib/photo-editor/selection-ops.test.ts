import { describe, expect, it } from 'vitest';
import { createMask, maskAt, maskBounds, type PixelLayer } from '@livedesign/photo-engine';
import { contentAwareFill } from './edit-ops';
import { harness, photoOf, pixel, pixelLayer, solid } from './photo-test-utils';
import {
  deselect,
  grow,
  inverse,
  modifySelection,
  removeBackground,
  reselect,
  selectAll,
  selectColourRange,
  selectSubject,
} from './selection-ops';

// docs/specs/031-photo/photo-tools.md "Selecting", "Smart selections": the Select menu.
const blank = (w = 12, h = 12) => harness(photoOf(w, h), { a: solid(w, h, [255, 255, 255, 255]) });
const box = (x: number, y: number, width: number, height: number) =>
  createMask({ x, y, width, height }, 255);
const sel = (h: ReturnType<typeof blank>, x: number, y: number) =>
  h.s.selection ? maskAt(h.s.selection, x, y) : 0;

// A dark disc on a light ground: a subject to find.
function subjectPicture(size = 48) {
  const r = solid(size, size, [235, 235, 225, 255]);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if ((x - c) ** 2 + (y - c) ** 2 < (size / 4) ** 2)
        r.data.set([30, 60, 140, 255], (y * size + x) * 4);
  return r;
}

describe('the Select menu', () => {
  it('selects all, deselects and reselects the last selection', () => {
    const h = blank();
    selectAll(h.s);
    expect(maskBounds(h.s.selection!)).toEqual({ x: 0, y: 0, width: 12, height: 12 });
    deselect(h.s);
    expect(h.s.selection).toBeNull();
    reselect(h.s);
    expect(maskBounds(h.s.selection!)).toEqual({ x: 0, y: 0, width: 12, height: 12 });
    // Nothing to reselect: nothing changes.
    const fresh = blank();
    reselect(fresh.s);
    expect(fresh.s.selection).toBeNull();
  });

  it('inverts the selection within the photo', () => {
    const h = blank();
    h.s.selection = box(0, 0, 6, 12);
    inverse(h.s);
    expect(sel(h, 2, 2)).toBe(0);
    expect(sel(h, 9, 2)).toBe(255);
  });

  it('expands, contracts, borders, smooths and feathers a selection, and asks for one first', () => {
    const h = blank(30, 30);
    expect(modifySelection(h.s, 'expand', 2)).toBe('Make a selection first.');
    const start = box(10, 10, 10, 10);
    h.s.selection = start;
    expect(modifySelection(h.s, 'expand', 2)).toBeNull();
    expect(sel(h, 8, 15)).toBe(255);
    h.s.selection = start;
    modifySelection(h.s, 'contract', 2);
    expect(sel(h, 10, 15)).toBe(0);
    expect(sel(h, 15, 15)).toBe(255);
    h.s.selection = start;
    modifySelection(h.s, 'border', 2);
    expect(sel(h, 15, 15)).toBe(0);
    expect(sel(h, 10, 15)).toBeGreaterThan(0);
    h.s.selection = start;
    modifySelection(h.s, 'smooth', 2);
    expect(sel(h, 15, 15)).toBe(255);
    h.s.selection = start;
    modifySelection(h.s, 'feather', 2);
    expect(sel(h, 10, 15)).toBeGreaterThan(0);
    expect(sel(h, 10, 15)).toBeLessThan(255);
  });

  it('grows into the like-coloured neighbours, and asks for a selection first', () => {
    const r = solid(20, 10, [0, 0, 255, 255]);
    for (let y = 0; y < 10; y++)
      for (let x = 12; x < 20; x++) r.data.set([255, 0, 0, 255], (y * 20 + x) * 4);
    const h = harness(photoOf(20, 10), { a: r });
    expect(grow(h.s, 32)).toBe('Make a selection first.');
    h.s.selection = box(2, 2, 3, 3);
    expect(grow(h.s, 32)).toBeNull();
    expect(sel(h, 10, 8)).toBeGreaterThan(0);
    expect(sel(h, 15, 5)).toBe(0);
  });

  it('picks every pixel near the colours chosen', () => {
    const r = solid(10, 4, [0, 0, 0, 255]);
    r.data.set([250, 250, 250, 255], (1 * 10 + 3) * 4);
    const h = harness(photoOf(10, 4), { a: r });
    const m = selectColourRange(h.s, [[255, 255, 255]], 20);
    expect(maskAt(m, 3, 1)).toBeGreaterThan(0);
    expect(maskAt(m, 0, 0)).toBe(0);
  });
});

describe('Subject and Remove Background', () => {
  it('selects the subject of the picture', async () => {
    const h = harness(photoOf(48, 48), { a: subjectPicture() });
    expect(await selectSubject(h.s)).toBeNull();
    expect(sel(h, 24, 24)).toBeGreaterThan(128);
    expect(sel(h, 2, 2)).toBeLessThan(128);
  });

  it('makes the subject the active layer’s mask, one edit', async () => {
    const h = harness(photoOf(48, 48), { a: subjectPicture() });
    h.s.choose('a', 'layer');
    expect(await removeBackground(h.s)).toBeNull();
    await h.s.settled();
    expect(h.commits.at(-1)?.label).toBe('Remove Background');
    const layer = h.s.photo.layers.find((l) => l.id === 'a') as PixelLayer;
    expect(layer.mask).toBeDefined();
    expect(h.s.target).toBe('mask');
    // A second time: the mask is in the way.
    expect(await removeBackground(h.s)).toBe('a already has a mask. Delete it first.');
  });

  it('refuses a layer that is not pixels', async () => {
    const h = harness(
      photoOf(8, 8, [pixelLayer('a'), { id: 'g', name: 'Group', layerKind: 'group' }]),
    );
    h.s.choose('g', 'layer');
    expect(await removeBackground(h.s)).toBe('Choose a pixel layer to remove its background.');
  });

  it('says when no subject is found', async () => {
    const h = harness(photoOf(16, 16), { a: solid(16, 16, [0, 0, 0, 0]) });
    expect(await selectSubject(h.s)).toBe('No subject found.');
  });
});

describe('Content-Aware Fill', () => {
  it('fills the selection from the rest of the layer, one edit', async () => {
    const r = solid(40, 40, [60, 160, 90, 255]);
    for (let y = 18; y < 22; y++)
      for (let x = 18; x < 22; x++) r.data.set([255, 0, 255, 255], (y * 40 + x) * 4);
    const h = harness(photoOf(40, 40), { a: r });
    h.s.choose('a', 'layer');
    expect(await contentAwareFill(h.s)).toBe('Make a selection first.');
    h.s.selection = box(17, 17, 6, 6);
    expect(await contentAwareFill(h.s)).toBeNull();
    await h.s.settled();
    expect(h.commits.at(-1)?.label).toBe('Content-Aware Fill');
    expect(pixel(h, 20, 20)).toEqual([60, 160, 90, 255]);
  });

  it('works on a layer’s pixels, never its mask', async () => {
    const h = blank();
    h.s.selection = box(1, 1, 3, 3);
    await removeBackgroundFree(h);
    h.s.choose('a', 'mask');
    expect(await contentAwareFill(h.s)).toBe(
      'Content-Aware works on a layer’s pixels, not its mask.',
    );
  });
});

// A mask on layer a without the Subject search.
async function removeBackgroundFree(h: ReturnType<typeof blank>) {
  const { addMask } = await import('./mask-ops');
  addMask(h.s, 'a', 'reveal');
  await h.s.settled();
}

describe('a new adjustment layer with a selection', () => {
  it('is masked by it, the layer and its mask one edit', async () => {
    const { newAdjustmentLayer } = await import('./layer-ops');
    const h = harness(photoOf(8, 8), { a: solid(8, 8, [200, 100, 50, 255]) });
    h.s.selection = box(0, 0, 4, 4);
    const id = newAdjustmentLayer(h.s, 'invert');
    await h.s.settled();
    expect(h.commits.map((c) => c.label)).toEqual(['Invert']);
    expect(h.s.layer(id)?.mask).toBeDefined();
    expect(pixel(h, 1, 1)).toEqual([55, 155, 205, 255]);
    expect(pixel(h, 6, 6)).toEqual([200, 100, 50, 255]);
  });
});
