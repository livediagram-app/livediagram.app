import { describe, expect, it } from 'vitest';
import { setLayer } from '@livedesign/photo-engine';
import { at, harness, photoOf, pixel, pixelLayer, solid } from '../photo-test-utils';
import { toolHandler } from '.';

// docs/specs/031-photo/photo-tools.md "Painting and erasing", "Retouching", "Focus and tone": each a
// stroke on the active layer (or its mask), one edit when it ends.
type H = ReturnType<typeof harness>;
type Keys = Partial<{ shift: boolean; alt: boolean; mod: boolean }>;

const white = (w = 24, h = 12) => harness(photoOf(w, h), { a: solid(w, h, [255, 255, 255, 255]) });

function stroke(h: H, tool: Parameters<typeof toolHandler>[0], pts: number[][], keys: Keys = {}) {
  const t = toolHandler(tool, h.ctx);
  const [first, ...rest] = pts;
  const took = t.down(at(first![0]!, first![1]!, keys));
  if (took) {
    for (const p of rest) t.move?.(at(p[0]!, p[1]!, keys));
    const end = pts.at(-1)!;
    t.up?.(at(end[0]!, end[1]!, keys));
  }
  return { t, took };
}

const hardBrush = (h: H, key: 'brush' | 'pencil' | 'eraser' | 'clone' | 'heal', size = 3) => {
  h.state.options[key] = {
    ...h.state.options[key],
    size,
    hardness: 1,
    pressure: 'off',
    smoothing: 0,
  } as never;
};

describe('painting and erasing', () => {
  it('the Pencil paints hard, aliased pixels, a square tip when asked', async () => {
    const h = white();
    hardBrush(h, 'pencil', 1);
    stroke(h, 'pencil', [
      [2.5, 2.5],
      [10.5, 2.5],
    ]);
    await h.s.settled();
    expect(pixel(h, 6, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 6, 3)).toEqual([255, 255, 255, 255]);
    h.state.options.pencil = { ...h.state.options.pencil, square: true, size: 3 };
    stroke(h, 'pencil', [[5.5, 8.5]]);
    await h.s.settled();
    // A square tip reaches the corner a round one would miss.
    expect(pixel(h, 4, 7)).toEqual([255, 0, 0, 255]);
    expect(h.commits.map((c) => c.label)).toEqual(['Pencil', 'Pencil']);
  });

  it('Auto Erase paints the background colour over the foreground colour', async () => {
    const h = harness(photoOf(12, 6), { a: solid(12, 6, [255, 0, 0, 255]) });
    hardBrush(h, 'pencil', 2);
    h.state.options.pencil = { ...h.state.options.pencil, autoErase: true };
    stroke(h, 'pencil', [
      [3, 3],
      [8, 3],
    ]);
    await h.s.settled();
    expect(pixel(h, 5, 3)).toEqual([0, 0, 255, 255]);
  });

  it('draws a straight line from the last stroke’s end with Shift', async () => {
    const h = white(24, 24);
    hardBrush(h, 'brush', 2);
    const t = toolHandler('brush', h.ctx);
    t.down(at(2, 2));
    t.up!(at(2, 2));
    t.down(at(20, 20, { shift: true }));
    t.up!(at(20, 20, { shift: true }));
    await h.s.settled();
    expect(pixel(h, 11, 11)).toEqual([255, 0, 0, 255]);
  });

  it('the Eraser clears to transparent, or paints the background where transparency is locked', async () => {
    const h = white();
    hardBrush(h, 'eraser', 3);
    stroke(h, 'eraser', [
      [3, 3],
      [10, 3],
    ]);
    await h.s.settled();
    expect(pixel(h, 6, 3)[3]).toBe(0);
    h.s.commitStack(setLayer(h.s.photo, 'a', { locks: { transparency: true } }), 'Lock');
    stroke(h, 'eraser', [
      [3, 9],
      [10, 9],
    ]);
    await h.s.settled();
    expect(pixel(h, 6, 9)).toEqual([0, 0, 255, 255]);
    h.state.options.eraser = { ...h.state.options.eraser, eraserMode: 'block' };
    stroke(h, 'eraser', [[20, 6]]);
    await h.s.settled();
    expect(h.commits.at(-1)?.label).toBe('Eraser');
  });

  it('paints a mask grey: the foreground hides, the Eraser shows again', async () => {
    const h = white();
    h.s.commitStack(setLayer(h.s.photo, 'a', { mask: { pixels: { tiles: {} } } }), 'Add Mask');
    h.s.choose('a', 'mask');
    h.state.foreground = '#000000';
    h.state.background = '#ffffff';
    hardBrush(h, 'brush', 4);
    stroke(h, 'brush', [
      [3, 3],
      [10, 3],
    ]);
    await h.s.settled();
    expect(h.s.raster('a', 'mask').sample(6, 3, 0)).toBe(0);
    hardBrush(h, 'eraser', 4);
    stroke(h, 'eraser', [
      [3, 3],
      [10, 3],
    ]);
    await h.s.settled();
    expect(h.s.raster('a', 'mask').sample(6, 3, 0)).toBe(255);
  });

  it('never makes a layer by itself: with no pixel layer it refuses and offers New Layer', async () => {
    const h = harness(photoOf(8, 8, []));
    const offers: { message: string; actions: { label: string; run: () => void }[] }[] = [];
    h.ctx.offer = (message, actions) => offers.push({ message, actions });
    hardBrush(h, 'brush', 2);
    expect(stroke(h, 'brush', [[2, 2]]).took).toBe(false);
    expect(h.commits).toEqual([]);
    expect(offers[0]!.actions.map((a) => a.label)).toEqual(['New Layer']);
    // Pressed, it adds the layer; the next stroke paints there.
    offers[0]!.actions[0]!.run();
    expect(stroke(h, 'brush', [[2, 2]]).took).toBe(true);
    await h.s.settled();
    expect(h.commits.map((c) => c.label)).toEqual(['New Layer', 'Brush']);
  });

  it('refuses a hidden layer', () => {
    const h = white();
    h.s.commitStack(setLayer(h.s.photo, 'a', { visible: false }), 'Hide');
    expect(stroke(h, 'brush', [[2, 2]]).took).toBe(false);
    expect(h.toasts.length).toBe(1);
  });
});

describe('the Clone Stamp and Heal', () => {
  const halves = () => {
    const r = solid(24, 12, [255, 255, 255, 255]);
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) r.data.set([0, 200, 0, 255], (y * 24 + x) * 4);
    return harness(photoOf(24, 12), { a: r });
  };

  it('asks for a source first, then copies from it along the stroke', async () => {
    const h = halves();
    hardBrush(h, 'clone', 3);
    expect(stroke(h, 'clone', [[18, 6]]).took).toBe(false);
    expect(h.toasts.at(-1)).toBe('Alt+press to choose where Clone Stamp copies from.');
    const t = toolHandler('clone', h.ctx);
    expect(t.down(at(4, 6, { alt: true }))).toBe(false);
    expect(h.overlays.at(-1)).toEqual({ kind: 'source', x: 4, y: 6 });
    stroke(h, 'clone', [
      [18, 6],
      [20, 6],
    ]);
    await h.s.settled();
    expect(pixel(h, 19, 6)).toEqual([0, 200, 0, 255]);
    expect(h.commits.at(-1)?.label).toBe('Clone Stamp');
    // Aligned: the source follows on from where the last stroke left it.
    toolHandler('clone', h.ctx).move!(at(21, 9));
    expect(h.overlays.at(-1)).toMatchObject({ kind: 'source' });
  });

  it('Heal copies, then blends the copy into its surroundings', async () => {
    const h = halves();
    hardBrush(h, 'heal', 3);
    h.state.options.heal = { ...h.state.options.heal, sampleAll: true };
    toolHandler('heal', h.ctx).down(at(4, 6, { alt: true }));
    stroke(h, 'heal', [
      [18, 6],
      [19, 6],
    ]);
    await h.s.settled();
    expect(h.commits.at(-1)?.label).toBe('Heal');
    // The copy's flat texture, toned to the white around it rather than pasted green.
    const [r, g, b] = pixel(h, 18, 6);
    expect(r).toBeGreaterThan(150);
    expect(b).toBeGreaterThan(150);
    expect(g).toBeGreaterThan(150);
  });
});

describe('the dab tools', () => {
  const noisy = () => {
    const r = solid(20, 20, [120, 120, 120, 255]);
    for (let i = 0; i < 400; i += 3) r.data.set([240, 40, 40, 255], i * 4);
    return harness(photoOf(20, 20), { a: r });
  };

  for (const [tool, label] of [
    ['blur', 'Blur'],
    ['sharpen', 'Sharpen'],
    ['smudge', 'Smudge'],
    ['dodge', 'Dodge'],
    ['burn', 'Burn'],
    ['sponge', 'Sponge'],
    ['background-eraser', 'Background Eraser'],
  ] as const) {
    it(`${label} changes the pixels under its stroke, one edit`, async () => {
      const h = noisy();
      const before = pixel(h, 10, 10).join();
      stroke(h, tool, [
        [6, 10],
        [10, 10],
        [14, 10],
      ]);
      await h.s.settled();
      expect(h.commits.map((c) => c.label)).toEqual([label]);
      expect([
        pixel(h, 9, 10).join(),
        pixel(h, 10, 10).join(),
        pixel(h, 11, 10).join(),
      ]).not.toEqual([before, before, before]);
    });
  }

  it('Smudge with Finger Painting starts from the foreground colour', async () => {
    const h = noisy();
    h.state.options.focus = { ...h.state.options.focus, fingerPainting: true, strength: 1 };
    h.state.options.backgroundEraser = { ...h.state.options.backgroundEraser, protect: true };
    stroke(h, 'smudge', [
      [4, 4],
      [8, 4],
    ]);
    await h.s.settled();
    expect(pixel(h, 4, 4)[0]).toBeGreaterThan(120);
  });
});

describe('Spot Heal and Red Eye', () => {
  it('Spot Heal fills what was painted from around it', async () => {
    const r = solid(40, 40, [90, 140, 200, 255]);
    for (let y = 18; y < 22; y++)
      for (let x = 18; x < 22; x++) r.data.set([0, 0, 0, 255], (y * 40 + x) * 4);
    const h = harness(photoOf(40, 40), { a: r });
    h.state.options.spotHeal = { ...h.state.options.spotHeal, size: 10, proximity: true };
    stroke(h, 'spot-heal', [
      [20, 20],
      [20.5, 20],
    ]);
    for (let i = 0; i < 20 && !h.commits.length; i++)
      await new Promise((res) => setTimeout(res, 10));
    await h.s.settled();
    expect(h.commits.at(-1)?.label).toBe('Spot Heal');
    expect(pixel(h, 20, 20)[2]).toBeGreaterThan(50);
  });

  it('Spot Heal refuses a hidden layer', () => {
    const h = white();
    h.s.commitStack(setLayer(h.s.photo, 'a', { visible: false }), 'Hide');
    expect(stroke(h, 'spot-heal', [[2, 2]]).took).toBe(false);
  });

  it('Red Eye darkens a red pupil, and says when there is none', async () => {
    const r = solid(60, 60, [230, 200, 180, 255]);
    for (let y = 0; y < 60; y++)
      for (let x = 0; x < 60; x++)
        if ((x - 30) ** 2 + (y - 30) ** 2 < 36) r.data.set([220, 20, 30, 255], (y * 60 + x) * 4);
    const h = harness(photoOf(60, 60, [pixelLayer('a')]), { a: r });
    expect(toolHandler('red-eye', h.ctx).down(at(30, 30))).toBe(false);
    await h.s.settled();
    expect(h.commits.at(-1)?.label).toBe('Red Eye');
    expect(pixel(h, 30, 30)[0]).toBeLessThan(120);
    toolHandler('red-eye', h.ctx).down(at(5, 5));
    expect(h.toasts.at(-1)).toBe('No red pupil there.');
  });
});
