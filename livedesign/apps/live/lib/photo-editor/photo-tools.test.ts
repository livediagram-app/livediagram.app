import { describe, expect, it } from 'vitest';
import { createMask, setLayer, type PixelLayer, type TextLayer } from '@livedesign/photo-engine';
import { adjustArea, cancelApplying, commitApplying, filterArea, startApplying } from './apply-ops';
import { copy, paste } from './clipboard';
import { at, harness, photoOf, pixel, pixelLayer, solid } from './photo-test-utils';
import { photoTools } from './tool-state';
import {
  beginCrop,
  commitCrop,
  cropBox,
  cropReadout,
  fittedBox,
  ratioOf,
  reshapeCrop,
} from './tools/crop-tool';
import { pickColour } from './tools/fill-tools';
import { toolHandler } from './tools';
import { movedLayers } from './tools/move-tool';
import { shapeEnds } from './tools/shape-tools';
import { beginTextEdit, textLayerAt } from './tools/text-tool';
import {
  beginTransform,
  cancelTransform,
  commitTransform,
  flipTransform,
  freeTransform,
  setTransformReadout,
} from './tools/transform-tool';

const drag = (
  h: ReturnType<typeof harness>,
  tool: Parameters<typeof toolHandler>[0],
  from: [number, number],
  to: [number, number],
  keys = {},
) => {
  const t = toolHandler(tool, h.ctx);
  if (t.down(at(from[0], from[1], keys))) {
    t.move?.(at((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, keys));
    t.move?.(at(to[0], to[1], keys));
    t.up?.(at(to[0], to[1], keys));
  }
  return t;
};

const blank = (w = 8, h = 8) => harness(photoOf(w, h), { a: solid(w, h, [255, 255, 255, 255]) });

describe('painting', () => {
  it('brushes the foreground colour along a drag, one edit', async () => {
    const h = blank(20, 6);
    h.state.options.brush = { ...h.state.options.brush, size: 3, hardness: 1, pressure: 'off' };
    drag(h, 'brush', [2, 2], [17, 2]);
    await h.s.settled();
    expect(pixel(h, 10, 2)).toEqual([255, 0, 0, 255]);
    // A 3 px tip centred on row 2 reaches rows 0.5 to 3.5: row 5 is untouched.
    expect(pixel(h, 10, 5)).toEqual([255, 255, 255, 255]);
    expect(h.commits.map((c) => c.label)).toEqual(['Brush']);
  });

  it('refuses a hidden or locked layer', () => {
    const h = harness(photoOf(4, 4, [pixelLayer('a', { locks: { pixels: true } })]));
    drag(h, 'brush', [1, 1], [2, 2]);
    expect(h.toasts).toEqual(['a is locked.']);
    expect(h.commits).toEqual([]);
  });

  it('refuses to paint on a text layer, naming it, rather than adding a layer', async () => {
    const h = harness(
      photoOf(4, 4, [
        {
          id: 't',
          name: 'T',
          layerKind: 'text',
          text: {
            text: 'x',
            font: 'inter',
            size: 10,
            weight: 400,
            colour: '#000000',
            align: 'left',
            at: { x: 0, y: 0 },
          },
        },
      ]),
    );
    drag(h, 'pencil', [1, 1], [2, 1]);
    await h.s.settled();
    expect(h.s.photo.layers.map((l) => l.layerKind)).toEqual(['text']);
    expect(h.commits).toEqual([]);
    expect(h.toasts).toEqual(['T is a text layer. Choose a pixel layer, or add one.']);
  });

  it('picks a colour with Alt held', () => {
    const h = harness(photoOf(2, 1), {
      a: (() => {
        const r = solid(2, 1, [0, 0, 0, 255]);
        r.data.set([10, 20, 30, 255], 4);
        return r;
      })(),
    });
    photoTools.set({ foreground: '#000000' });
    drag(h, 'brush', [1, 0], [1, 0], { alt: true });
    expect(photoTools.get().foreground).toBe('#0a141e');
    expect(h.commits).toEqual([]);
  });
});

describe('fills and sampling', () => {
  it('buckets the like area and gradients across the selection', async () => {
    const h = harness(photoOf(4, 1), {
      a: (() => {
        const r = solid(4, 1, [255, 255, 255, 255]);
        r.data.set([0, 0, 0, 255], 8);
        return r;
      })(),
    });
    h.state.options.bucket.antiAlias = false;
    toolHandler('bucket', h.ctx).down(at(0, 0));
    await h.s.settled();
    expect(pixel(h, 1, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 3, 0)).toEqual([255, 255, 255, 255]);
    h.s.selection = createMask({ x: 3, y: 0, width: 1, height: 1 }, 255);
    h.state.options.gradient.dither = false;
    drag(h, 'gradient', [3, 0], [4, 0]);
    await h.s.settled();
    expect(pixel(h, 2, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(h, 3, 0)[3]).toBe(255);
    expect(h.commits.map((c) => c.label)).toEqual(['Paint Bucket', 'Gradient']);
  });

  it('averages the sample size, ignoring transparent pixels', () => {
    const h = harness(photoOf(3, 1), {
      a: (() => {
        const r = solid(3, 1, [0, 0, 0, 0]);
        r.data.set([100, 0, 0, 255], 0);
        r.data.set([200, 0, 0, 255], 4);
        return r;
      })(),
    });
    expect(pickColour(h.ctx, { x: 1, y: 0 }, 3, false)).toBe('#960000');
    expect(pickColour(h.ctx, { x: 2, y: 0 }, 1, false)).toBeNull();
  });
});

describe('shapes and text', () => {
  it('keeps the shape with Shift and draws from the centre with Alt', () => {
    expect(shapeEnds('rectangle', { x: 0, y: 0 }, at(4, 2, { shift: true }))).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 4, y: 4 },
    });
    expect(shapeEnds('ellipse', { x: 5, y: 5 }, at(7, 6, { alt: true }))).toEqual({
      a: { x: 3, y: 4 },
      b: { x: 7, y: 6 },
    });
    const line = shapeEnds('line', { x: 0, y: 0 }, at(10, 1, { shift: true }));
    expect(line.b.y).toBeCloseTo(0, 6);
  });

  it('draws a filled rectangle into the active layer, or a new one only when asked', async () => {
    const h = blank();
    h.state.options.shape.antiAlias = false;
    drag(h, 'rectangle', [2, 2], [5, 5]);
    await h.s.settled();
    expect(h.s.photo.layers.map((l) => l.name)).toEqual(['a']);
    expect(pixel(h, 3, 3)).toEqual([255, 0, 0, 255]);
    h.state.options.shape.intoActive = false;
    drag(h, 'rectangle', [6, 6], [7, 7]);
    await h.s.settled();
    expect(h.s.photo.layers.map((l) => l.name)).toEqual(['a', 'Rectangle 1']);
  });

  it('draws nothing for a box dragged flat, and asks for Fill or Stroke only when both are off', async () => {
    const h = blank();
    drag(h, 'rectangle', [2, 2], [8, 2]);
    await h.s.settled();
    expect(h.commits).toEqual([]);
    expect(h.toasts).toEqual([]);
    h.state.options.shape.fill = false;
    h.state.options.shape.stroke = false;
    drag(h, 'ellipse', [2, 2], [8, 8]);
    expect(h.toasts).toEqual(['Turn on Fill or Stroke to draw a shape.']);
  });

  it('fills and strokes a shape on a layer of its own with Draw Into Active Layer off', async () => {
    const h = blank();
    h.state.options.shape.antiAlias = false;
    h.state.options.shape.intoActive = false;
    drag(h, 'rectangle', [2, 2], [5, 5]);
    await h.s.settled();
    expect(h.s.photo.layers.map((l) => l.name)).toEqual(['a', 'Rectangle 1']);
    expect(pixel(h, 3, 3)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 6, 6)).toEqual([255, 255, 255, 255]);
  });

  it('types a text layer as one edit and removes an empty one', () => {
    const h = blank();
    // Small enough that a press at (6, 6) misses the first layer's box.
    h.state.options.text.size = 2;
    toolHandler('text', h.ctx).down(at(1, 1));
    const t = toolHandler('text', h.ctx);
    let edited: string | null = null;
    h.ctx.editText = (id) => (edited = id);
    t.down(at(1, 1));
    t.up?.(at(1, 1));
    expect(edited).not.toBeNull();
    expect(h.checkpoints).toBe(1);
    const edit = beginTextEdit(h.s, edited!, true)!;
    edit.change({ text: 'Hi' });
    edit.end();
    expect(edit.spec().text).toBe('Hi');
    expect(h.s.layer(edit.layerId)?.layerKind).toBe('text');
    expect(h.commits.every((c) => !c.undoable)).toBe(true);
    // An edit that leaves it empty removes it; a new one cancels its checkpoint.
    t.down(at(6, 6));
    t.up?.(at(6, 6));
    const second = h.s.active!;
    beginTextEdit(h.s, second, true)!.end();
    expect(h.s.layer(second)).toBeUndefined();
    expect(h.cancels).toBe(1);
  });

  it('names a text layer by its words as an edit ends, unless it was renamed', () => {
    const h = blank();
    h.state.options.text.size = 2;
    let edited: string | null = null;
    h.ctx.editText = (id) => (edited = id);
    const t = toolHandler('text', h.ctx);
    t.down(at(1, 1));
    t.up?.(at(1, 1));
    const id = String(edited);
    const edit = beginTextEdit(h.s, id, true)!;
    edit.change({ text: 'Summer   sale today' });
    edit.end();
    expect(h.s.layer(id)?.name).toBe('Summer sale today');
    // Edited again, it follows its words.
    const again = beginTextEdit(h.s, id, false)!;
    again.change({ text: 'Winter sale' });
    again.end();
    expect(h.s.layer(id)?.name).toBe('Winter sale');
    // Renamed by hand, it keeps its name.
    h.s.commitStack(setLayer(h.s.photo, id, { name: 'Headline' }), 'Rename Layer');
    const third = beginTextEdit(h.s, id, false)!;
    third.change({ text: 'Spring' });
    third.end();
    expect(h.s.layer(id)?.name).toBe('Headline');
  });

  it('moves a text layer with a drag on it, and edits it with a press', () => {
    const h = harness(
      photoOf(200, 100, [
        {
          id: 't',
          name: 'T',
          layerKind: 'text',
          text: {
            text: 'Hello',
            font: 'inter',
            size: 20,
            weight: 400,
            colour: '#000000',
            align: 'left',
            at: { x: 10, y: 10 },
          },
        },
      ]),
    );
    let edited: string | null = null;
    h.ctx.editText = (id) => (edited = id);
    const t = toolHandler('text', h.ctx);
    expect(t.down(at(15, 15))).toBe(true);
    t.move!(at(55, 35));
    t.up!(at(55, 35));
    const moved = h.s.layer('t');
    expect(moved?.layerKind === 'text' && moved.text.at).toEqual({ x: 50, y: 30 });
    expect(edited).toBeNull();
    // One edit: a checkpoint, the moves written without steps of their own.
    expect(h.checkpoints).toBe(1);
    expect(h.commits.every((c) => !c.undoable)).toBe(true);
    // A press with no drag edits it.
    t.down(at(55, 35));
    t.up!(at(55, 35));
    expect(edited).toBe('t');
    expect(h.checkpoints).toBe(1);
  });

  it('finds the text layer under a press', () => {
    const h = blank();
    expect(textLayerAt(h.s, { x: 1, y: 1 })).toBeNull();
  });
});

describe('moving', () => {
  it('moves pixel and text layers by whole px', () => {
    const p = photoOf(4, 4, [
      pixelLayer('a'),
      {
        id: 't',
        name: 'T',
        layerKind: 'text',
        text: {
          text: 'x',
          font: 'inter',
          size: 10,
          weight: 400,
          colour: '#000000',
          align: 'left',
          at: { x: 1, y: 1 },
        },
      },
    ]);
    const next = movedLayers(p, new Set(['a', 't']), 2, -1);
    expect((next.layers[0] as PixelLayer).offset).toEqual({ x: 2, y: -1 });
    expect((next.layers[1] as TextLayer).text.at).toEqual({ x: 3, y: 0 });
    expect(movedLayers(p, new Set(['a']), 0, 0)).toBe(p);
  });

  it('drags the layer, one edit, and nudges with the arrows', async () => {
    const h = harness(photoOf(4, 1), { a: solid(1, 1, [9, 9, 9, 255]) });
    drag(h, 'move', [0, 0], [2, 0]);
    expect((h.s.photo.layers[0] as PixelLayer).offset).toEqual({ x: 2, y: 0 });
    toolHandler('move', h.ctx).key?.('ArrowRight', { shift: false, alt: false, mod: false });
    expect(pixel(h, 3, 0)).toEqual([9, 9, 9, 255]);
    expect(h.commits.map((c) => c.label)).toEqual(['Move', 'Nudge']);
  });

  it('lifts the selection’s pixels and puts them down where the drag ends', async () => {
    const h = harness(photoOf(4, 1), { a: solid(2, 1, [9, 9, 9, 255]) });
    h.s.selection = createMask({ x: 0, y: 0, width: 1, height: 1 }, 255);
    drag(h, 'move', [0, 0], [3, 0]);
    await h.s.settled();
    expect(pixel(h, 0, 0)[3]).toBe(0);
    expect(pixel(h, 1, 0)).toEqual([9, 9, 9, 255]);
    expect(pixel(h, 3, 0)).toEqual([9, 9, 9, 255]);
    // The selection went with them.
    expect(h.s.selection?.x).toBe(3);
  });
});

describe('free transform', () => {
  it('flips the lifted pixels and commits one edit', async () => {
    const h = harness(photoOf(2, 1), {
      a: (() => {
        const r = solid(2, 1, [255, 0, 0, 255]);
        r.data.set([0, 0, 255, 255], 4);
        return r;
      })(),
    });
    expect(beginTransform(h.ctx)).toBe(true);
    // Lifted: the layer shows nothing while the pixels float.
    expect(pixel(h, 0, 0)[3]).toBe(0);
    flipTransform(h.ctx, true);
    commitTransform(h.ctx);
    await h.s.settled();
    expect(freeTransform.get()).toBeNull();
    expect(pixel(h, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(h.commits.map((c) => c.label)).toEqual(['Free Transform']);
  });

  it('cancels back to the layer as it was, and types a box', () => {
    const h = harness(photoOf(4, 4), { a: solid(2, 2, [1, 2, 3, 255]) });
    beginTransform(h.ctx);
    setTransformReadout(h.ctx, { x: 1, y: 1, width: 3, height: 3 });
    expect(freeTransform.get()?.matrix[0]).toBeCloseTo(1.5, 6);
    cancelTransform(h.ctx);
    expect(pixel(h, 0, 0)).toEqual([1, 2, 3, 255]);
    expect(h.commits).toEqual([]);
  });

  it('refuses a text layer', () => {
    const h = harness(
      photoOf(4, 4, [
        {
          id: 't',
          name: 'T',
          layerKind: 'text',
          text: {
            text: 'x',
            font: 'inter',
            size: 10,
            weight: 400,
            colour: '#000000',
            align: 'left',
            at: { x: 1, y: 1 },
          },
        },
      ]),
    );
    expect(beginTransform(h.ctx)).toBe(false);
    expect(h.toasts[0]).toMatch(/Rasterize/);
  });
});

describe('crop', () => {
  it('fits a ratio in the photo', () => {
    expect(ratioOf('free', { width: 4, height: 2 })).toBeNull();
    expect(ratioOf('original', { width: 4, height: 2 })).toBe(2);
    expect(fittedBox({ width: 400, height: 200 }, 1)).toEqual({
      x: 100,
      y: 0,
      width: 200,
      height: 200,
      angle: 0,
    });
  });

  it('drags the box in and crops, one edit', async () => {
    const h = harness(photoOf(10, 10), { a: solid(10, 10, [5, 5, 5, 255]) });
    beginCrop(h.ctx);
    expect(cropReadout(cropBox.get()!)).toMatchObject({ width: 10, height: 10 });
    const t = toolHandler('crop', h.ctx);
    t.down(at(10, 10));
    t.move?.(at(6, 4));
    t.up?.(at(6, 4));
    expect(cropReadout(cropBox.get()!).width).toBeCloseTo(6, 6);
    t.key?.('Enter', { shift: false, alt: false, mod: false });
    await h.s.settled();
    expect([h.s.photo.width, h.s.photo.height]).toEqual([6, 4]);
    expect(h.commits.map((c) => c.label)).toEqual(['Crop']);
  });

  it('reshapes to a ratio about its centre', () => {
    const h = harness(photoOf(400, 200));
    beginCrop(h.ctx);
    reshapeCrop(h.ctx, '1:1');
    const r = cropReadout(cropBox.get()!);
    expect(r.width).toBeCloseTo(r.height, 6);
    commitCrop(h.ctx);
  });
});

describe('the clipboard', () => {
  it('copies the selection and pastes it in place as a new layer', async () => {
    const h = harness(photoOf(4, 1), { a: solid(4, 1, [7, 7, 7, 255]) });
    h.s.selection = createMask({ x: 2, y: 0, width: 1, height: 1 }, 255);
    expect(await copy(h.s)).toBeNull();
    const id = paste(h.s, true)!;
    await h.s.settled();
    expect((h.s.layer(id) as PixelLayer).offset).toEqual({ x: 2, y: 0 });
  });
});

describe('filters and applied adjustments', () => {
  it('previews an adjustment, cancels it, and commits it', async () => {
    const h = harness(photoOf(2, 1), { a: solid(2, 1, [10, 20, 30, 255]) });
    const a = startApplying(h.s);
    if (typeof a === 'string') throw new Error(a);
    adjustArea(h.s, a, { id: 'invert', params: {} });
    expect(pixel(h, 0, 0)).toEqual([245, 235, 225, 255]);
    cancelApplying(h.s, a);
    expect(pixel(h, 0, 0)).toEqual([10, 20, 30, 255]);
    const b = startApplying(h.s) as Exclude<ReturnType<typeof startApplying>, string>;
    h.s.selection = null;
    adjustArea(h.s, b, { id: 'invert', params: {} });
    commitApplying(h.s, b, 'Invert');
    await h.s.settled();
    expect(h.commits.map((c) => c.label)).toEqual(['Invert']);
  });

  it('runs a filter within the selection', async () => {
    const h = harness(photoOf(3, 1), { a: solid(3, 1, [200, 210, 220, 255]) });
    h.s.selection = createMask({ x: 0, y: 0, width: 1, height: 1 }, 255);
    const a = startApplying(h.s);
    if (typeof a === 'string') throw new Error(a);
    const { done } = filterArea(
      h.s,
      a,
      'solarize',
      {},
      { foreground: '#000000', background: '#ffffff' },
    );
    expect(await done).toBe(true);
    expect(pixel(h, 2, 0)).toEqual([200, 210, 220, 255]);
    expect(pixel(h, 0, 0)).toEqual([55, 45, 35, 255]);
  });

  it('asks to rasterize a text layer', () => {
    const h = harness(
      photoOf(4, 4, [
        {
          id: 't',
          name: 'T',
          layerKind: 'text',
          text: {
            text: 'x',
            font: 'inter',
            size: 10,
            weight: 400,
            colour: '#000000',
            align: 'left',
            at: { x: 1, y: 1 },
          },
        },
      ]),
    );
    expect(startApplying(h.s)).toBe('rasterize');
  });
});
