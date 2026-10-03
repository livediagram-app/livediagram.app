import { describe, expect, it } from 'vitest';
import { createFreehand, penColourHex, type Element } from '@livediagram/document';
import { createStockColourProjector } from './stock-colour-projector';

const stroke = (over: Partial<Element> = {}): Element =>
  ({
    ...createFreehand(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      false,
    ),
    ...over,
  }) as Element;

const strokeColorOf = (el: Element | undefined) => (el as { strokeColor?: string }).strokeColor;

describe('createStockColourProjector', () => {
  it('draws a named colour in its version for the canvas surface, on any tab', () => {
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'blue' } as Partial<Element>);
    expect(strokeColorOf(project([a], 'light')[0])).toBe(penColourHex('blue', 'light'));
    expect(strokeColorOf(project([a], 'dark')[0])).toBe(penColourHex('blue', 'dark'));
  });

  it('keeps each projected object stable while its source is unchanged', () => {
    // The element views are memoised: a fresh object per render would redraw
    // every stroke on every drag frame.
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'red' } as Partial<Element>);
    const b = stroke({ penColour: 'green' } as Partial<Element>);
    const first = project([a, b], 'light');
    const second = project([a, b], 'light');
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('returns the same board for the same board, so a render that changes no element changes nothing', () => {
    // A pan, zoom or marquee re-renders the editor without touching the elements; a fresh array
    // there rebuilt the Map and every derived pass on each frame (docs/specs/008-canvas/canvas-performance.md).
    const project = createStockColourProjector();
    const board = [stroke({ penColour: 'red' } as Partial<Element>), stroke()];
    const first = project(board, 'dark');
    expect(project(board, 'dark')).toBe(first);
  });

  it('returns a new board when the board changes', () => {
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'red' } as Partial<Element>);
    const first = project([a], 'dark');
    const next = project([a, stroke()], 'dark');
    expect(next).not.toBe(first);
    expect(next[0]).toBe(first[0]);
  });

  it('recomputes when the surface changes (an appearance switch)', () => {
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'teal' } as Partial<Element>);
    const light = project([a], 'light');
    const dark = project([a], 'dark');
    expect(dark[0]).not.toBe(light[0]);
  });

  it('leaves an unpainted element unpainted: the renderer draws its default', () => {
    const project = createStockColourProjector();
    const els = [stroke()];
    expect(project(els, 'light')).toBe(els);
  });
});
