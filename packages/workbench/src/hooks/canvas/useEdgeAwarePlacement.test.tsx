// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '../../lib/clamp-to-viewport';
import { overlapsChrome, useEdgeAwarePlacement } from './useEdgeAwarePlacement';

// Each editor's docs/specs/008-canvas/canvas-performance.md: a gesture frame never reads layout. While the selection
// moves the box is suspended: it measures nothing, then places once when it resumes.

const rect = (l: number, t: number, r: number, b: number) =>
  ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }) as DOMRect;

type Props = {
  x: number;
  y?: number;
  suspended?: boolean;
  zoom?: number;
};

// A box whose measured rect the test sets, inside a <main> of 1000 x 800 unless `noHost`.
function setup(boxRect: () => DOMRect, opts: { noHost?: boolean } = {}) {
  const host = document.createElement(opts.noHost ? 'div' : 'main');
  host.getBoundingClientRect = () => rect(0, 0, 1000, 800);
  const box = document.createElement('div');
  host.append(box);
  document.body.append(host);
  let measures = 0;
  box.getBoundingClientRect = () => {
    measures += 1;
    return boxRect();
  };
  const initialProps: Props = { x: 400 };
  const view = renderHook(
    ({ x, y = 300, suspended = false, zoom = 1 }: Props) => {
      const placement = useEdgeAwarePlacement(
        { x, y, width: 100, height: 40 },
        { x: 0, y: 0 },
        zoom,
        8,
        suspended,
      );
      // Attach the box before the layout effect reads it.
      placement.ref.current = box;
      return placement;
    },
    { initialProps },
  );
  return { ...view, box, host, measures: () => measures };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('useEdgeAwarePlacement', () => {
  it('measures the box when the selection moves while not suspended', () => {
    const h = setup(() => rect(400, 300, 500, 340));
    const before = h.measures();
    h.rerender({ x: 420 });
    expect(h.measures()).toBeGreaterThan(before);
  });

  it('measures nothing while suspended, however the selection moves', () => {
    const h = setup(() => rect(400, 300, 500, 340));
    h.rerender({ x: 400, suspended: true });
    const before = h.measures();
    for (let x = 401; x < 431; x++) h.rerender({ x, suspended: true });
    expect(h.measures()).toBe(before);
  });

  it('places once when it resumes', () => {
    const h = setup(() => rect(400, 300, 500, 340));
    h.rerender({ x: 400, suspended: true });
    h.rerender({ x: 480, suspended: true });
    const before = h.measures();
    h.rerender({ x: 480, suspended: false });
    expect(h.measures()).toBeGreaterThan(before);
  });

  it('places above, centred, counter-scaled', () => {
    const h = setup(() => rect(400, 300, 500, 340));
    expect(h.result.current.placeAbove).toBe(true);
    expect(h.result.current.style).toMatchObject({
      left: 450,
      top: 292,
      transform: 'translate(-50%, -100%) scale(1)',
      transformOrigin: 'center bottom',
    });
  });

  it('flips below at the top edge, then back above at the bottom edge only for a new geometry', () => {
    let r = rect(400, 0, 500, 40);
    const h = setup(() => r);
    expect(h.result.current.placeAbove).toBe(false);
    expect(h.result.current.style).toMatchObject({
      transform: 'translate(-50%, 0) scale(1)',
      transformOrigin: 'center top',
    });
    // Below, and now past the bottom: a new geometry flips it back above.
    r = rect(400, 790, 500, 830);
    h.rerender({ x: 410 });
    expect(h.result.current.placeAbove).toBe(true);
  });

  it('flips at most once per geometry, then nudges inside the area', () => {
    // Fits neither side: flipped once, then nudged instead of flipping back.
    const h = setup(() => rect(400, -20, 500, 20));
    expect(h.result.current.placeAbove).toBe(false);
    expect(h.result.current.style).toMatchObject({ top: 348 + EDGE + 20 });
  });

  it('nudges past the left and right edges and below the bottom, in canvas units at the zoom', () => {
    let r = rect(-30, 300, 70, 340);
    const h = setup(() => r);
    expect(h.result.current.style).toMatchObject({ left: 450 + EDGE + 30 });
    r = rect(950, 300, 1050, 340);
    h.rerender({ x: 401 });
    // The correction is worked out against the un-nudged box: the rect less the nudge it was drawn with.
    const dx = 1000 - EDGE - (1050 - (EDGE + 30));
    expect(h.result.current.style).toMatchObject({ left: 451 + dx });
    r = rect(400, 300, 500, 340);
    h.rerender({ x: 402, zoom: 2 });
    expect(h.result.current.style).toMatchObject({
      left: 452,
      transform: 'translate(-50%, -100%) scale(0.5)',
    });
  });

  it('nudges up from the bottom edge, without flipping back, when below fits no better', () => {
    // Above it runs off the top and flips below; below it runs off the bottom and is nudged up.
    let calls = 0;
    const h = setup(() => (calls++ === 0 ? rect(400, 0, 500, 40) : rect(400, 790, 500, 830)));
    expect(h.result.current.placeAbove).toBe(false);
    expect(h.result.current.style).toMatchObject({ top: 348 + (800 - EDGE - 830) });
  });

  it('uses the window when the box sits in no <main>', () => {
    const h = setup(() => rect(400, 300, 500, 340), { noHost: true });
    expect(h.result.current.placeAbove).toBe(true);
    expect(h.measures()).toBeGreaterThan(0);
  });

  it('does nothing with no box attached', () => {
    const view = renderHook(() =>
      useEdgeAwarePlacement({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0 }, 1, 8),
    );
    expect(view.result.current.placeAbove).toBe(true);
  });
});

// The floating chrome over the canvas counts as an edge: a toolbar that would sit on the palette flips below.
describe('useEdgeAwarePlacement and the floating chrome', () => {
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
  });

  it('flips below a selection whose toolbar would sit on the palette', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    panel.getBoundingClientRect = () => rect(300, 0, 700, 120);
    document.body.append(panel);
    const h = setup(() => rect(400, 60, 500, 100));
    expect(h.result.current.placeAbove).toBe(false);
  });

  it('flips back above when below sits on a panel', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    panel.getBoundingClientRect = () => rect(300, 700, 700, 800);
    document.body.append(panel);
    let r = rect(400, 0, 500, 40);
    const h = setup(() => r);
    expect(h.result.current.placeAbove).toBe(false);
    r = rect(400, 710, 500, 750);
    h.rerender({ x: 405 });
    expect(h.result.current.placeAbove).toBe(true);
  });
});
