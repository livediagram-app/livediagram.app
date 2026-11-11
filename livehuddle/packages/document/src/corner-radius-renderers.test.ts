import { describe, expect, it } from 'vitest';
import type { ShapeElement } from './index';
import { borderOf } from './svg-render-border';
import { renderElementsToSvg } from './svg-render';

// docs/specs/008-canvas/corner-radius.md: the export draws a corner by the one rule, so a small rounded box stays
// a rounded box, and a large one is unchanged.
const square = (size: number, over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'focus-button',
  x: 0,
  y: 0,
  width: size,
  height: size,
  borderRadius: 'lg',
  ...over,
});

describe('the SVG export’s corners', () => {
  it('rounds a small rounded square by a quarter of its side, not into a circle', () => {
    expect(borderOf(square(14)).radius).toBe(3.5);
    const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [square(14)] });
    // The border's centre line runs half the 2 px stroke inside the box: 3.5 - 1.
    expect(svg).toMatch(/rx="2\.5"/);
  });

  it('draws a large rounded square exactly as before', () => {
    expect(borderOf(square(200)).radius).toBe(24);
    expect(borderOf(square(14, { borderRadius: 'full' })).radius).toBe(7);
  });
});
