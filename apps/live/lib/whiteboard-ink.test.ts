import { describe, expect, it } from 'vitest';
import { createFreehand, type Element } from '@livediagram/diagram';
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
    const [out] = project([stroke()], '#111111');
    expect((out as { strokeColor?: string }).strokeColor).toBe('#111111');
  });

  it('keeps each projected object stable while its source is unchanged', () => {
    // The element views are memoised: a fresh object per render would redraw
    // every stroke on every drag frame.
    const project = createInkProjector();
    const a = stroke();
    const b = stroke();
    const first = project([a, b], '#111111');
    const second = project([a, b], '#111111');
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('recomputes when the ink changes (an appearance switch)', () => {
    const project = createInkProjector();
    const a = stroke();
    const light = project([a], '#111111');
    const dark = project([a], '#eeeeee');
    expect(dark[0]).not.toBe(light[0]);
    expect((dark[0] as { strokeColor?: string }).strokeColor).toBe('#eeeeee');
  });

  it('returns the same array when nothing needed ink', () => {
    const project = createInkProjector();
    const painted = { ...stroke(), strokeColor: '#ff0000', fillColor: 'transparent' } as Element;
    const els = [painted];
    expect(project(els, '#111111')).toBe(els);
  });
});
