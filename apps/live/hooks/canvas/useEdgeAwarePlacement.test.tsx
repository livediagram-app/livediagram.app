// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overlapsChrome, useEdgeAwarePlacement } from './useEdgeAwarePlacement';

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

// The floating chrome over the canvas counts as an edge: a toolbar that would sit on the palette flips below.
describe('useEdgeAwarePlacement and the floating chrome', () => {
  const rect = (l: number, t: number, r: number, b: number) =>
    ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }) as DOMRect;

  it('tells an overlap with a floating panel, skipping its own and hidden ones', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    panel.getBoundingClientRect = () => rect(300, 0, 700, 60);
    const hidden = document.createElement('div');
    hidden.setAttribute('data-floating-panel', '');
    hidden.getBoundingClientRect = () => rect(0, 0, 0, 0);
    document.body.append(panel, hidden);
    const box = document.createElement('div');
    document.body.append(box);
    expect(overlapsChrome(rect(400, 40, 500, 80), box)).toBe(true);
    expect(overlapsChrome(rect(400, 100, 500, 140), box)).toBe(false);
    panel.append(box);
    expect(overlapsChrome(rect(400, 40, 500, 80), box)).toBe(false);
    panel.remove();
    hidden.remove();
  });

  it('flips below a selection whose toolbar would sit on the palette', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    panel.getBoundingClientRect = () => rect(300, 0, 700, 120);
    document.body.append(panel);
    const box = document.createElement('div');
    box.getBoundingClientRect = () => rect(400, 60, 500, 100);
    document.body.append(box);
    const view = renderHook(() => {
      const placement = useEdgeAwarePlacement(
        { x: 400, y: 120, width: 100, height: 40 },
        { x: 0, y: 0 },
        1,
        8,
      );
      placement.ref.current = box;
      return placement;
    });
    expect(view.result.current.placeAbove).toBe(false);
    panel.remove();
    box.remove();
  });
});
