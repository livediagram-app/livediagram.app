import { describe, expect, it } from 'vitest';
import { WHITEBOARD_INK, createFreehand, penColourHex, type Element } from '@livediagram/document';
import { createInkProjector } from './whiteboard-ink';

const stroke = (): Element =>
  createFreehand(
    [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    false,
  );

describe('createInkProjector', () => {
  it('draws unpainted elements in the ink', () => {
    const project = createInkProjector();
    const [out] = project([stroke()], 'light');
    expect((out as { strokeColor?: string }).strokeColor).toBe(WHITEBOARD_INK.light);
  });

  it('keeps each projected object stable while its source is unchanged', () => {
    // The element views are memoised: a fresh object per render would redraw
    // every stroke on every drag frame.
    const project = createInkProjector();
    const a = stroke();
    const b = stroke();
    const first = project([a, b], 'light');
    const second = project([a, b], 'light');
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('recomputes when the ink changes (an appearance switch)', () => {
    const project = createInkProjector();
    const a = stroke();
    const light = project([a], 'light');
    const dark = project([a], 'dark');
    expect(dark[0]).not.toBe(light[0]);
    expect((dark[0] as { strokeColor?: string }).strokeColor).toBe(WHITEBOARD_INK.dark);
  });

  it('re-tunes a named marker colour for the board (docs/specs/023-whiteboard/whiteboard.md)', () => {
    const project = createInkProjector();
    const a = { ...stroke(), penColour: 'blue' } as Element;
    expect((project([a], 'light')[0] as { strokeColor?: string }).strokeColor).toBe(
      penColourHex('blue', 'light'),
    );
    expect((project([a], 'dark')[0] as { strokeColor?: string }).strokeColor).toBe(
      penColourHex('blue', 'dark'),
    );
  });

  it('returns the same array when nothing needed ink', () => {
    const project = createInkProjector();
    const painted = { ...stroke(), strokeColor: '#ff0000', fillColor: 'transparent' } as Element;
    const els = [painted];
    expect(project(els, 'light')).toBe(els);
  });
});
