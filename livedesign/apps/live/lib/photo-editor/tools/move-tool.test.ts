import { describe, expect, it } from 'vitest';
import { createMask, setLayer, type PixelLayer } from '@livedesign/photo-engine';
import { at, harness, photoOf, pixel, pixelLayer, solid } from '../photo-test-utils';
import { toolHandler } from '.';
import { alignLayers } from './move-tool';

// docs/specs/031-photo/photo-tools.md "Moving": the Move tool moves the active layer (or a group), the
// selection's pixels when there is a selection, a copy with Alt, and nudges with the arrows.
type Keys = Partial<{ shift: boolean; alt: boolean; mod: boolean }>;
const k = { shift: false, alt: false, mod: false };

// A red 2 x 2 square at (2, 2) on a transparent layer over a white Background.
function scene() {
  const top = solid(10, 10, [0, 0, 0, 0]);
  for (let y = 2; y < 4; y++)
    for (let x = 2; x < 4; x++) top.data.set([255, 0, 0, 255], (y * 10 + x) * 4);
  const h = harness(photoOf(10, 10, [pixelLayer('bg'), pixelLayer('top')]), {
    bg: solid(10, 10, [255, 255, 255, 255]),
    top,
  });
  h.s.choose('top', 'layer');
  h.state.options.move = { ...h.state.options.move, autoSelect: false };
  return h;
}

function drag(h: ReturnType<typeof scene>, from: number[], to: number[], keys: Keys = {}) {
  const t = toolHandler('move', h.ctx);
  const took = t.down(at(from[0]!, from[1]!, keys));
  if (took) {
    t.move!(at((from[0]! + to[0]!) / 2, (from[1]! + to[1]!) / 2, keys));
    t.up!(at(to[0]!, to[1]!, keys));
  }
  return { t, took };
}

const offset = (h: ReturnType<typeof scene>, id: string) =>
  (h.s.photo.layers.find((l) => l.id === id) as PixelLayer).offset ?? { x: 0, y: 0 };

describe('the Move tool', () => {
  it('moves the active layer, kept level or plumb with Shift', () => {
    const h = scene();
    drag(h, [5, 5], [8, 6]);
    expect(offset(h, 'top')).toEqual({ x: 3, y: 1 });
    drag(h, [5, 5], [6, 9], { shift: true });
    expect(offset(h, 'top')).toEqual({ x: 3, y: 5 });
    expect(h.commits.map((c) => c.label)).toEqual(['Move', 'Move']);
  });

  it('changes nothing for a press that never moves', () => {
    const h = scene();
    drag(h, [5, 5], [5, 5]);
    expect(h.commits).toEqual([]);
  });

  it('refuses a locked layer and a press with no layer', () => {
    const h = scene();
    h.s.commitStack(setLayer(h.s.photo, 'top', { locks: { position: true } }), 'Lock');
    expect(drag(h, [5, 5], [6, 6]).took).toBe(false);
    expect(h.toasts).toEqual(['top is locked.']);
    expect(toolHandler('move', h.ctx).key!('ArrowLeft', k)).toBe(true);
    const empty = harness(photoOf(4, 4, []));
    expect(toolHandler('move', empty.ctx).down(at(1, 1))).toBe(false);
  });

  it('picks the layer under the press with Auto-Select, or Ctrl/Cmd for one press', () => {
    const h = scene();
    h.s.choose('bg', 'layer');
    drag(h, [2.5, 2.5], [3.5, 2.5], { mod: true });
    expect(h.s.active).toBe('top');
    h.state.options.move = { ...h.state.options.move, autoSelect: true };
    h.s.choose('bg', 'layer');
    // The square moved 1 px right: it is under (3.5, 2.5) now.
    drag(h, [3.5, 2.5], [3.5, 2.5]);
    expect(h.s.active).toBe('top');
  });

  it('moves a copy with Alt, the copy and its move one step', async () => {
    const h = scene();
    drag(h, [5, 5], [7, 5], { alt: true });
    expect(h.s.photo.layers).toHaveLength(3);
    expect(offset(h, 'top')).toEqual({ x: 0, y: 0 });
    expect(h.commits.map((c) => [c.label, c.undoable])).toEqual([
      ['Duplicate', false],
      ['Move', false],
    ]);
    expect(h.checkpoints).toBe(1);
    expect(h.ends).toBe(1);
    await h.s.settled();
  });

  it('moves the selection’s pixels, or leaves a copy behind with Alt', async () => {
    const h = scene();
    h.s.selection = createMask({ x: 2, y: 2, width: 2, height: 2 }, 255);
    drag(h, [2.5, 2.5], [6.5, 2.5]);
    await h.s.settled();
    expect(pixel(h, 6, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 2, 2)).toEqual([255, 255, 255, 255]);
    expect(h.overlays.some((o) => o.kind === 'float')).toBe(true);
    h.s.selection = createMask({ x: 6, y: 2, width: 2, height: 2 }, 255);
    drag(h, [6.5, 2.5], [6.5, 6.5], { alt: true });
    await h.s.settled();
    expect(pixel(h, 6, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(h, 6, 6)).toEqual([255, 0, 0, 255]);
  });

  it('puts lifted pixels back when the press never moves, or the move is cancelled', async () => {
    const h = scene();
    h.s.selection = createMask({ x: 2, y: 2, width: 2, height: 2 }, 255);
    drag(h, [2.5, 2.5], [2.5, 2.5]);
    const t = toolHandler('move', h.ctx);
    t.down(at(2.5, 2.5));
    t.move!(at(5, 5));
    t.cancel!();
    await h.s.settled();
    expect(pixel(h, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(h.commits).toEqual([]);
    // A layer move cancelled shows the photo as it was.
    h.s.selection = null;
    const u = toolHandler('move', h.ctx);
    u.down(at(5, 5));
    u.move!(at(9, 9));
    u.cancel!();
    expect(offset(h, 'top')).toEqual({ x: 0, y: 0 });
  });

  it('says when the selection holds nothing on the layer', () => {
    const h = scene();
    h.s.selection = createMask({ x: 7, y: 7, width: 2, height: 2 }, 255);
    expect(drag(h, [7.5, 7.5], [8, 8]).took).toBe(false);
    expect(h.toasts).toEqual(['Nothing selected on this layer to move.']);
  });

  it('nudges the layer, or the selection’s pixels, with the arrows', async () => {
    const h = scene();
    const t = toolHandler('move', h.ctx);
    expect(t.key!('ArrowRight', k)).toBe(true);
    expect(t.key!('ArrowDown', { ...k, shift: true })).toBe(true);
    expect(t.key!('ArrowUp', k)).toBe(true);
    expect(t.key!('ArrowLeft', k)).toBe(true);
    expect(t.key!('Enter', k)).toBe(false);
    expect(offset(h, 'top')).toEqual({ x: 0, y: 9 });
    expect(h.commits.map((c) => c.label)).toEqual(['Nudge', 'Nudge', 'Nudge', 'Nudge']);
    h.s.commitStack(setLayer(h.s.photo, 'top', { offset: undefined }), 'Reset');
    h.s.selection = createMask({ x: 2, y: 2, width: 2, height: 2 }, 255);
    t.key!('ArrowRight', k);
    await h.s.settled();
    expect(pixel(h, 4, 2)).toEqual([255, 0, 0, 255]);
  });

  it('moves the chosen layers together, and a press outside them moves one alone', () => {
    const h = scene();
    h.s.setChosen(new Set(['bg', 'top']));
    drag(h, [5, 5], [7, 5]);
    expect(offset(h, 'top')).toEqual({ x: 2, y: 0 });
    expect(offset(h, 'bg')).toEqual({ x: 2, y: 0 });
    h.state.options.move = { ...h.state.options.move, autoSelect: true };
    h.s.setChosen(new Set(['bg']));
    h.s.choose('bg', 'layer');
    drag(h, [4.5, 2.5], [5.5, 2.5]);
    expect(h.s.chosen.size).toBe(0);
    expect(offset(h, 'top')).toEqual({ x: 3, y: 0 });
    expect(offset(h, 'bg')).toEqual({ x: 2, y: 0 });
  });

  it('refuses when one of the chosen layers is locked', () => {
    const h = scene();
    h.s.commitStack(setLayer(h.s.photo, 'bg', { locks: { all: true } }), 'Lock');
    h.s.setChosen(new Set(['bg', 'top']));
    expect(drag(h, [5, 5], [7, 5]).took).toBe(false);
    expect(h.toasts).toEqual(['bg is locked.']);
  });

  it('aligns the layers in hand to the photo, or to the selection', () => {
    const h = scene();
    // The red square spans x 2..4, y 2..4 in a 10 x 10 photo.
    expect(alignLayers(h.s, 'right')).toBeNull();
    expect(offset(h, 'top')).toEqual({ x: 6, y: 0 });
    alignLayers(h.s, 'middle');
    expect(offset(h, 'top')).toEqual({ x: 6, y: 2 });
    h.s.selection = createMask({ x: 0, y: 0, width: 4, height: 4 }, 255);
    alignLayers(h.s, 'left');
    alignLayers(h.s, 'top');
    expect(offset(h, 'top')).toEqual({ x: -2, y: -2 });
    alignLayers(h.s, 'centre');
    alignLayers(h.s, 'bottom');
    expect(offset(h, 'top')).toEqual({ x: -1, y: 0 });
    expect(h.commits.map((c) => c.label)).toEqual([
      'Align Right',
      'Align Middles',
      'Align Left',
      'Align Top',
      'Align Centres',
      'Align Bottom',
    ]);
  });

  it('leaves a layer locked in place, saying so when nothing moved', () => {
    const h = scene();
    h.s.commitStack(setLayer(h.s.photo, 'top', { locks: { position: true } }), 'Lock');
    expect(alignLayers(h.s, 'right')).toBe('top is locked.');
    expect(offset(h, 'top')).toEqual({ x: 0, y: 0 });
  });
});
