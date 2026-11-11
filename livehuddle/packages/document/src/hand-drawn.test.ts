import { describe, expect, it } from 'vitest';
import { handDrawnElementPaint } from './hand-drawn';
import { MARKER_INK_OPACITY, MARKER_STREAK_OPACITY } from './marker';
import { MARKER_LINE_PX } from './finish';
import { createSticky } from './factories';
import { createShape } from './shape-factory';
import { renderElementsToSvg } from './index';
import { sketchBackdropIds } from './sketch-backdrop';

// docs/specs/008-canvas/finish.md "Sketch" and "Marker": one door to both pens, for the canvas and the export.

const box = (extra: object = {}) => ({ ...createShape('focus-button', 0, 0), id: 'box', ...extra });

describe('handDrawnElementPaint', () => {
  it('draws Sketch in pencil and Marker in felt-tip', () => {
    expect(handDrawnElementPaint(box(), 'sketch', '#fff')?.drawing.pen).toBe('pencil');
    expect(handDrawnElementPaint(box(), 'marker', '#fff')?.drawing.pen).toBe('marker');
  });

  it('draws nothing by hand under Flexible or Professional', () => {
    expect(handDrawnElementPaint(box(), 'flexible', '#fff')).toBeNull();
    expect(handDrawnElementPaint(box(), 'professional', '#fff')).toBeNull();
  });

  it('keeps a sticky as paper under Marker, unoutlined, but coloured in', () => {
    const sticky = { ...createSticky(0, 0), id: 's' };
    const paint = handDrawnElementPaint(sticky, 'marker', '#fef08a');
    if (paint?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(paint.drawing.ink).toEqual(['', '']);
    expect(paint.drawing.solid).not.toBe('');
    expect(paint.drawing.streaks[0]).not.toBe('');
    expect(handDrawnElementPaint(sticky, 'sketch', '#fef08a')).not.toBeNull();
  });

  it('draws an unset or Thin border at a marker’s nib, and a wider one as picked', () => {
    expect(handDrawnElementPaint(box(), 'marker', '#fff')?.strokePx).toBe(MARKER_LINE_PX);
    expect(handDrawnElementPaint(box({ strokeWidth: 'thin' }), 'marker', '#fff')?.strokePx).toBe(
      MARKER_LINE_PX,
    );
    expect(handDrawnElementPaint(box({ strokeWidth: 'thick' }), 'marker', '#fff')?.strokePx).toBe(
      4,
    );
    expect(handDrawnElementPaint(box({ strokeWidth: 'none' }), 'marker', '#fff')?.strokePx).toBe(0);
  });

  // Marker colours a backdrop in too (finish.md "Marker"): one shape left solid beside a coloured one read as missed.
  it('colours a standing shape and a backdrop in, and keeps a see-through fill plain', () => {
    const coloured = handDrawnElementPaint(box(), 'marker', '#dbeafe');
    if (coloured?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(coloured.drawing.solid).not.toBe('');
    expect(coloured.drawing.streaks[0]).not.toBe('');
    const backdrop = handDrawnElementPaint(box(), 'marker', '#dbeafe', true);
    if (backdrop?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(backdrop.drawing.solid).not.toBe('');
    expect(backdrop.drawing.streaks[0]).not.toBe('');
    const clear = handDrawnElementPaint(box(), 'marker', 'transparent');
    if (clear?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(clear.drawing.solid).toBe('');
  });

  it('leaves a self-painting face as it is', () => {
    expect(
      handDrawnElementPaint({ ...createShape('plant', 0, 0), id: 'p' }, 'marker', '#fff'),
    ).toBeNull();
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
    expect(svg).toContain('Shantell Sans');
  });

  it('keeps a sticky as paper, coloured in with no outline', () => {
    const svg = renderElementsToSvg(tab([{ ...createSticky(0, 0), id: 's' }]));
    const at = svg.indexOf('data-finish="marker"');
    const body = at < 0 ? '' : svg.slice(at, svg.indexOf('</g>', at));
    expect(body).toMatch(/stroke-opacity="0\.07"/);
    expect(body).not.toMatch(/stroke-opacity="0\.86"/);
  });

  it('keeps a backdrop solid, as under Sketch', () => {
    const card = box({ id: 'card', width: 400, height: 300 });
    const caption = { ...createShape('focus-button', 150, 120), id: 'cap', width: 60, height: 40 };
    expect(sketchBackdropIds([card, caption], 'marker').has('card')).toBe(true);
  });
});
