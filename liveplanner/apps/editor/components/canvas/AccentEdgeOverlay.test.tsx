// @vitest-environment jsdom

// The accent edge on the canvas (docs/specs/008-canvas/accent-edge.md).

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import { AccentEdgeOverlay } from './AccentEdgeOverlay';

afterEach(cleanup);

const square = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('square', 0, 0),
  width: 200,
  height: 100,
  ...over,
});

describe('AccentEdgeOverlay', () => {
  it('draws nothing without an edge or on a kind that takes none', () => {
    const { container: none } = render(<AccentEdgeOverlay element={square()} stroke="#123" />);
    expect(none.firstChild).toBeNull();
    const { container: circle } = render(
      <AccentEdgeOverlay element={square({ shape: 'circle', accentEdge: 'left' })} stroke="#123" />,
    );
    expect(circle.firstChild).toBeNull();
  });

  it('lays a bar on its edge in the border colour, clipped by the inherited radius', () => {
    const { container } = render(
      <AccentEdgeOverlay element={square({ accentEdge: 'left' })} stroke="rgb(1, 2, 3)" />,
    );
    const clip = container.querySelector('[data-accent-edge="left"]') as HTMLElement;
    expect(clip.style.borderRadius).toBe('inherit');
    const bar = clip.firstElementChild as HTMLElement;
    expect(bar.style.width).toBe('6px');
    expect(bar.style.backgroundColor).toBe('rgb(1, 2, 3)');
  });

  it('prefers its own colour', () => {
    const { container } = render(
      <AccentEdgeOverlay
        element={square({ accentEdge: 'bottom', accentEdgeColor: 'rgb(9, 9, 9)' })}
        stroke="rgb(1, 2, 3)"
      />,
    );
    const bar = container.querySelector('[data-accent-edge="bottom"] > div') as HTMLElement;
    expect(bar.style.bottom).toBe('0px');
    expect(bar.style.backgroundColor).toBe('rgb(9, 9, 9)');
  });
});
