import { describe, expect, it } from 'vitest';
import { handDrawnArrow, handDrawnElementPaint } from './hand-drawn';
import { MARKER_INK_OPACITY, MARKER_STREAK_OPACITY } from './marker';
import { MARKER_LINE_PX } from './finish';
import { createSticky, createTable } from './factories';
import { createShape } from './shape-factory';
import { renderElementsToSvg } from './index';
import { sketchBackdropIds } from './sketch-backdrop';

// docs/specs/008-canvas/finish.md "Sketch" and "Marker": one door to both pens, for the canvas and the export.

const box = (extra: object = {}) => ({ ...createShape('square', 0, 0), id: 'box', ...extra });

describe('handDrawnElementPaint', () => {
  it('draws Sketch in pencil and Marker in felt-tip', () => {
    expect(handDrawnElementPaint(box(), 'sketch', '#fff')?.drawing.pen).toBe('pencil');
    expect(handDrawnElementPaint(box(), 'marker', '#fff')?.drawing.pen).toBe('marker');
  });

  it('draws nothing by hand under Flexible or Professional', () => {
    expect(handDrawnElementPaint(box(), 'flexible', '#fff')).toBeNull();
    expect(handDrawnElementPaint(box(), 'professional', '#fff')).toBeNull();
  });

  it('leaves a sticky as paper under Marker', () => {
    const sticky = { ...createSticky(0, 0), id: 's' };
    expect(handDrawnElementPaint(sticky, 'marker', '#fef08a')).toBeNull();
    expect(handDrawnElementPaint(sticky, 'sketch', '#fef08a')).not.toBeNull();
  });

  it('draws an unset border at a marker’s nib, and a picked one as picked', () => {
    expect(handDrawnElementPaint(box(), 'marker', '#fff')?.strokePx).toBe(MARKER_LINE_PX);
    expect(handDrawnElementPaint(box({ strokeWidth: 'thin' }), 'marker', '#fff')?.strokePx).toBe(1);
    expect(handDrawnElementPaint(box({ strokeWidth: 'none' }), 'marker', '#fff')?.strokePx).toBe(0);
  });

  it('colours a standing shape in, and keeps a backdrop’s or see-through fill plain', () => {
    const coloured = handDrawnElementPaint(box(), 'marker', '#dbeafe');
    if (coloured?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(coloured.drawing.solid).not.toBe('');
    expect(coloured.drawing.streaks[0]).not.toBe('');
    const backdrop = handDrawnElementPaint(box(), 'marker', '#dbeafe', true);
    if (backdrop?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(backdrop.drawing.solid).not.toBe('');
    expect(backdrop.drawing.streaks).toEqual(['', '']);
    const clear = handDrawnElementPaint(box(), 'marker', 'transparent');
    if (clear?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(clear.drawing.solid).toBe('');
  });

  it('draws a table’s frame and a silhouette’s chrome in marker', () => {
    const table = handDrawnElementPaint({ ...createTable(0, 0), id: 't' }, 'marker', '#fff');
    if (table?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(table.drawing.ink.join('')).not.toBe('');
    const laptop = handDrawnElementPaint(
      { ...createShape('laptop', 0, 0), id: 'l' },
      'marker',
      '#fff',
    );
    if (laptop?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(laptop.drawing.details).not.toBe('');
  });

  it('leaves a self-painting face and a comment pin as they are', () => {
    expect(
      handDrawnElementPaint({ ...createShape('pie-chart', 0, 0), id: 'p' }, 'marker', '#fff'),
    ).toBeNull();
    expect(
      handDrawnElementPaint({ ...createShape('comment-pin', 0, 0), id: 'c' }, 'marker', '#fff'),
    ).toBeNull();
  });
});

describe('handDrawnArrow', () => {
  const opts = {
    strokePx: 3,
    headSize: 'medium' as const,
    headShape: 'triangle' as const,
    startHead: false,
    endHead: true,
    flowing: false,
  };
  const path = 'M 0 0 L 200 0 L 200 120';

  it('is null for a finish that draws a plain path', () => {
    expect(handDrawnArrow('flexible', 'a', path, opts)).toBeNull();
    expect(handDrawnArrow('professional', 'a', path, opts)).toBeNull();
  });

  it('draws Marker’s line in two layers of see-through ink, a triangle head as a solid wedge', () => {
    const a = handDrawnArrow('marker', 'a', path, opts)!;
    expect(a.lineOver).not.toBe('');
    expect(a.inkOpacity).toBe(MARKER_INK_OPACITY);
    expect(a.sketchedHeads).toBe(true);
    expect(a.headFill).toBe(true);
  });

  it('draws a line head as a stroke, and keeps one layer while a flow runs', () => {
    const a = handDrawnArrow('marker', 'a', path, { ...opts, headShape: 'line', flowing: true })!;
    expect(a.headFill).toBe(false);
    expect(a.lineOver).toBe('');
  });

  it('stops the line short of a hollow head', () => {
    const hollow = handDrawnArrow('marker', 'a', 'M 0 0 L 200 0', {
      ...opts,
      headShape: 'triangle-hollow',
    })!;
    const xs = [...`${hollow.line} ${hollow.lineOver}`.matchAll(/(-?[\d.]+) -?[\d.]+/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...xs)).toBeLessThan(190);
  });

  it('keeps circle and diamond heads to their markers', () => {
    const a = handDrawnArrow('marker', 'a', path, { ...opts, headShape: 'circle' })!;
    expect(a.sketchedHeads).toBe(false);
    expect(a.heads).toBe('');
  });

  it('draws Sketch as before: one layer of solid pencil', () => {
    const a = handDrawnArrow('sketch', 'a', path, opts)!;
    expect(a.lineOver).toBe('');
    expect(a.inkOpacity).toBe(1);
    expect(a.headFill).toBe(false);
  });
});

describe('a Marker tab in the export', () => {
  const tab = (elements: object[]) =>
    ({ id: 't', name: 't', finish: 'marker', elements }) as Parameters<
      typeof renderElementsToSvg
    >[0];

  it('draws a box’s body in marker ink and its colouring', () => {
    const svg = renderElementsToSvg(tab([box({ fillColor: '#dbeafe' })]));
    expect(svg).toContain('data-finish="marker"');
    expect(svg).toContain(`stroke-opacity="${MARKER_INK_OPACITY}"`);
    expect(svg).toContain(`stroke-opacity="${MARKER_STREAK_OPACITY}"`);
    expect(svg).toContain('Permanent Marker');
  });

  it('draws an arrow in two layers with a filled head', () => {
    const a = { ...createShape('square', 0, 0), id: 'a' };
    const b = { ...createShape('square', 400, 0), id: 'b' };
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
      arrowheadShape: 'triangle',
    };
    const svg = renderElementsToSvg(tab([a, b, arrow]));
    expect(svg).toMatch(/fill-opacity="0\.86"/);
  });

  it('keeps a sticky as paper', () => {
    const svg = renderElementsToSvg(tab([{ ...createSticky(0, 0), id: 's' }]));
    expect(svg).not.toContain('data-finish="marker"');
  });

  it('keeps a backdrop solid, as under Sketch', () => {
    const card = box({ id: 'card', width: 400, height: 300 });
    const caption = { ...createShape('square', 150, 120), id: 'cap', width: 60, height: 40 };
    expect(sketchBackdropIds([card, caption], 'marker').has('card')).toBe(true);
  });
});
