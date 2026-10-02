// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEdgeAwarePlacement } from './useEdgeAwarePlacement';

// docs/specs/008-canvas/canvas-performance.md: a gesture frame never reads layout. While the
// selection moves the box is suspended: it measures nothing, then places once when it resumes.

type Props = { x: number; suspended: boolean };

function setup() {
  const box = document.createElement('div');
  let measures = 0;
  box.getBoundingClientRect = () => {
    measures += 1;
    return { left: 400, right: 500, top: 300, bottom: 340, width: 100, height: 40 } as DOMRect;
  };
  const view = renderHook(
    ({ x, suspended }: Props) => {
      const placement = useEdgeAwarePlacement(
        { x, y: 300, width: 100, height: 40 },
        { x: 0, y: 0 },
        1,
        8,
        suspended,
      );
      // Attach the box before the layout effect reads it.
      placement.ref.current = box;
      return placement;
    },
    { initialProps: { x: 400, suspended: false } },
  );
  return { ...view, measures: () => measures };
}

describe('useEdgeAwarePlacement', () => {
  it('measures the box when the selection moves while not suspended', () => {
    const h = setup();
    const before = h.measures();
    h.rerender({ x: 420, suspended: false });
    expect(h.measures()).toBeGreaterThan(before);
  });

  it('measures nothing while suspended, however the selection moves', () => {
    const h = setup();
    h.rerender({ x: 400, suspended: true });
    const before = h.measures();
    for (let x = 401; x < 431; x++) h.rerender({ x, suspended: true });
    expect(h.measures()).toBe(before);
  });

  it('places once when it resumes', () => {
    const h = setup();
    h.rerender({ x: 400, suspended: true });
    h.rerender({ x: 480, suspended: true });
    const before = h.measures();
    h.rerender({ x: 480, suspended: false });
    expect(h.measures()).toBeGreaterThan(before);
  });
});
