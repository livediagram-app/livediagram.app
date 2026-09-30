// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFreehand, type FreehandElement } from '@livediagram/document';
import { FreehandSvg } from './boxed-element-overlays';

const stroke = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  ...createFreehand(
    [
      { x: 0, y: 0 },
      { x: 200, y: 50 },
    ],
    false,
  ),
  ...over,
});

describe('FreehandSvg', () => {
  it('draws a pen stroke at its width in canvas px, so it zooms with the board in every browser', () => {
    // docs/specs/023-whiteboard/whiteboard.md "A pen's width is ink on the board".
    const el = stroke({ penWidth: 2.5 });
    const { container } = render(<FreehandSvg element={el} fill="none" stroke="#000" />);
    const svg = container.querySelector('svg')!;
    const path = container.querySelector('path')!;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${el.width} ${el.height}`);
    expect(path.getAttribute('stroke-width')).toBe('2.5');
    expect(path.getAttribute('vector-effect')).toBeNull();
  });

  it('keeps a pencil stroke on its non-scaling preset', () => {
    const { container } = render(<FreehandSvg element={stroke()} fill="none" stroke="#000" />);
    expect(container.querySelector('path')!.getAttribute('vector-effect')).toBe(
      'non-scaling-stroke',
    );
  });
});
