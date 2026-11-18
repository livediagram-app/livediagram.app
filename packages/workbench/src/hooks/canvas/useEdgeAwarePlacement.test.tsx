// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '../../lib/clamp-to-viewport';
import { noteToolbarObstacle } from './toolbar-obstacle';
import { overlapsChrome, sidewaysClear, useEdgeAwarePlacement } from './useEdgeAwarePlacement';

// Each editor's docs/specs/008-canvas/canvas-performance.md: a gesture frame never reads layout. While the selection
// moves the box is suspended: it measures nothing, then places once when it resumes. It places in the next animation
// frame, never inside the commit ("Chrome after a gesture"): these tests hold the frames and run them by hand.
let frames: { id: number; cb: FrameRequestCallback | null }[] = [];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push({ id: frames.length + 1, cb });
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    const f = frames.find((x) => x.id === id);
    if (f) f.cb = null;
  });
});

/** Runs every frame asked for so far, as the browser would before its next paint. */
function nextFrame() {
  act(() => {
    const due = frames;
    frames = [];
    for (const f of due) f.cb?.(0);
  });
}

const rect = (l: number, t: number, r: number, b: number) =>
  ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }) as DOMRect;

type Props = {
  x: number;
  y?: number;
  suspended?: boolean;
  zoom?: number;
  avoid?: { x: number; y: number; width: number; height: number } | null;
};

// A box whose measured rect the test sets, inside a <main> of 1000 x 800 unless `noHost`.
function setup(boxRect: () => DOMRect, opts: { noHost?: boolean; initial?: Partial<Props> } = {}) {
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
  const initialProps: Props = { x: 400, ...opts.initial };
  const view = renderHook(
    ({ x, y = 300, suspended = false, zoom = 1, avoid = null }: Props) => {
      const placement = useEdgeAwarePlacement(
        { x, y, width: 100, height: 40 },
        { x: 0, y: 0 },
        zoom,
        8,
        suspended,
        avoid,
      );
      // Attach the box before the layout effect reads it.
      placement.ref.current = box;
      return placement;
    },
    { initialProps },
  );
  nextFrame();
  // A render and the frame after it, as most tests want; `commit` alone is the render without its frame.
  const rerender = (props: Props) => {
    view.rerender(props);
    nextFrame();
  };
  return { ...view, rerender, commit: view.rerender, box, host, measures: () => measures };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
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

  // Work Tracker 911: neither the drop's commit nor a press's reads layout; the box places in the next frame.
  it('places once when it resumes, in the next frame rather than inside the commit', () => {
    const h = setup(() => rect(400, 300, 500, 340));
    h.rerender({ x: 400, suspended: true });
    h.rerender({ x: 480, suspended: true });
    const before = h.measures();
    h.commit({ x: 480, suspended: false });
    expect(h.measures()).toBe(before);
    nextFrame();
    expect(h.measures()).toBe(before + 1);
  });

  it('reads nothing in the commit of a fresh geometry, and one frame serves every render before it', () => {
    const h = setup(() => rect(400, 300, 500, 340));
    const before = h.measures();
    h.commit({ x: 420 });
    h.commit({ x: 440 });
    expect(h.measures()).toBe(before);
    expect(frames.filter((f) => f.cb)).toHaveLength(1);
    nextFrame();
    expect(h.measures()).toBe(before + 1);
  });

  it('applies a flip found in that frame, and places again for it in the same frame', () => {
    let top = 300;
    const h = setup(() => rect(400, top, 500, top + 40));
    h.rerender({ x: 400, suspended: true });
    top = 0;
    const before = h.measures();
    h.rerender({ x: 480, suspended: false });
    expect(h.result.current.placeAbove).toBe(false);
    // The flip's own render placed again inside the frame: no frame is left waiting.
    expect(h.measures()).toBe(before + 2);
    expect(frames.filter((f) => f.cb)).toHaveLength(0);
  });

  it('drops a pending frame when it is suspended again, or unmounted, before it comes', () => {
    const h = setup(() => rect(400, 300, 500, 340));
    h.rerender({ x: 400, suspended: true });
    h.commit({ x: 480, suspended: false });
    h.commit({ x: 500, suspended: true });
    const before = h.measures();
    nextFrame();
    expect(h.measures()).toBe(before);
    h.commit({ x: 500, suspended: false });
    h.unmount();
    nextFrame();
    expect(h.measures()).toBe(before);
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

  // Work Tracker 898: a pinch or a zoom shortcut with the selection kept moves the box on screen with no bounds or
  // offset change, so the zoom alone must re-place it.
  it('re-places on a zoom change alone while the selection stays up', () => {
    let r = rect(400, 300, 500, 340);
    const h = setup(() => r);
    expect(h.result.current.placeAbove).toBe(true);
    const before = h.measures();
    // Zoomed in about the canvas origin: the selection's on-screen top is now near the area's top, so above runs off.
    r = rect(400, -10, 500, 30);
    h.rerender({ x: 400, zoom: 2 });
    expect(h.measures()).toBeGreaterThan(before);
    expect(h.result.current.placeAbove).toBe(false);
  });

  it('nudges back on screen on a zoom change alone', () => {
    let r = rect(400, 300, 500, 340);
    const h = setup(() => r);
    expect(h.result.current.style).toMatchObject({ left: 450 });
    // Zoomed out: the box now pokes past the right edge with the same bounds and offset; the nudge is in canvas units.
    r = rect(950, 300, 1050, 340);
    h.rerender({ x: 400, zoom: 0.5 });
    expect(h.result.current.style).toMatchObject({ left: 450 + (1000 - EDGE - 1050) / 0.5 });
  });

  it('does nothing with no box attached', () => {
    const view = renderHook(() =>
      useEdgeAwarePlacement({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0 }, 1, 8),
    );
    nextFrame();
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

// Work Tracker 1032: an element at the canvas's left edge, beside livediagram's Quick Style panel (taller than the room
// above and below the element), had its toolbar drawn over the panel's controls.
describe('useEdgeAwarePlacement sliding off the chrome', () => {
  const quickStyle = (r: DOMRect) => {
    const panel = document.createElement('div');
    panel.setAttribute('data-toolbar-obstacle', '');
    panel.getBoundingClientRect = () => r;
    document.body.append(panel);
  };

  it('slides sideways off a panel both sides cover, leaving the two boxes apart', () => {
    const panelRect = rect(8, 200, 260, 600);
    quickStyle(panelRect);
    const h = setup(() => rect(100, 300, 400, 340), { initial: { x: 100 } });
    // Both sides cover it: one flip, then the slide past the panel's right edge.
    expect(h.result.current.placeAbove).toBe(false);
    const dx = 260 + EDGE - 100;
    expect(h.result.current.style.left).toBe(150 + dx);
    const toolbar = rect(100 + dx, 300, 400 + dx, 340);
    expect(toolbar.left >= panelRect.right || toolbar.right <= panelRect.left).toBe(true);
  });

  // The verifier's order: the toolbar places for a fresh selection, then the Quick Style panel mounts under it.
  it('places again when an obstacle arrives after it placed, but not while suspended', () => {
    // The box as drawn: it carries its sideways nudge, as a real one does.
    let h: ReturnType<typeof setup> | null = null;
    const drawn = () => {
      const dx = ((h?.result.current.style.left as number | undefined) ?? 150) - 150;
      return rect(100 + dx, 300, 400 + dx, 340);
    };
    h = setup(drawn, { initial: { x: 100 } });
    expect(h.result.current.placeAbove).toBe(true);
    expect(h.result.current.style.left).toBe(150);
    // Mounted hidden at the corner first: no obstacle yet.
    const panel = document.createElement('div');
    panel.setAttribute('data-toolbar-obstacle', '');
    panel.getBoundingClientRect = () => rect(8, 200, 260, 600);
    (panel as unknown as { checkVisibility: () => boolean }).checkVisibility = () => false;
    document.body.append(panel);
    act(() => noteToolbarObstacle());
    expect(h.result.current.style.left).toBe(150);
    // Then at its spot: suspended for a drag, nothing; resumed, the toolbar flips and slides off it.
    (panel as unknown as { checkVisibility: () => boolean }).checkVisibility = () => true;
    h.rerender({ x: 100, suspended: true });
    const before = h.measures();
    act(() => noteToolbarObstacle());
    expect(h.measures()).toBe(before);
    expect(h.result.current.style.left).toBe(150);
    // Resumed with the selection where it was (no geometry change): only the note places it again. Both sides
    // cover the panel here, so it slides past the panel's right edge.
    act(() => noteToolbarObstacle());
    expect(h.measures()).toBe(before);
    h.rerender({ x: 100, suspended: false });
    act(() => noteToolbarObstacle());
    expect(h.measures()).toBeGreaterThan(before);
    expect(h.result.current.style.left).toBe(150 + 260 + EDGE - 100);
  });

  it('stays put beside chrome it does not cover', () => {
    quickStyle(rect(8, 200, 260, 600));
    const h = setup(() => rect(400, 300, 500, 340));
    expect(h.result.current.placeAbove).toBe(true);
    expect(h.result.current.style.left).toBe(450);
  });
});

describe('sidewaysClear', () => {
  const area = { left: 0, right: 1000 };
  const box = { left: 100, right: 300, top: 300, bottom: 340 };

  it('is 0 off the chrome', () => {
    expect(sidewaysClear(box, [{ left: 400, right: 500, top: 0, bottom: 800 }], area)).toBe(0);
  });

  it('takes the shorter way past an obstacle, where it fits the area', () => {
    const ob = { left: 220, right: 240, top: 0, bottom: 800 };
    expect(sidewaysClear({ ...box, left: 180 }, [ob], area)).toBe(240 + EDGE - 180);
    // Past the area's right edge it goes left instead.
    const nearRight = { left: 860, right: 990, top: 300, bottom: 340 };
    const ob2 = { left: 900, right: 995, top: 0, bottom: 800 };
    expect(sidewaysClear(nearRight, [ob2], area)).toBe(900 - EDGE - 990);
  });

  it('skips a slide onto other chrome, and gives up when none clears', () => {
    const a = { left: 50, right: 250, top: 0, bottom: 800 };
    const b = { left: 250 + EDGE, right: 900, top: 0, bottom: 800 };
    expect(sidewaysClear(box, [a, b], area)).toBe(0);
  });
});

// livehuddle's Selection popover keeps off the piece a fresh duplicate came from (Work Tracker 849): `avoid`.
describe('useEdgeAwarePlacement keeping off a box', () => {
  // The selection is 400..500 x 300..340 with a gap of 8; a 30 px tall box sits 262..292 above it, 348..378 below.
  const above = () => rect(400, 262, 500, 292);
  const original = { x: 400, y: 230, width: 100, height: 60 };

  it('goes below the selection when above would sit on the box', () => {
    const h = setup(above, { initial: { avoid: original } });
    expect(h.result.current.placeAbove).toBe(false);
  });

  it('stays above when it clears the box, or when below would sit on it too', () => {
    expect(
      setup(above, { initial: { avoid: { x: 520, y: 230, width: 100, height: 60 } } }).result
        .current.placeAbove,
    ).toBe(true);
    document.body.replaceChildren();
    const tall = { x: 400, y: 230, width: 100, height: 200 };
    expect(setup(above, { initial: { avoid: tall } }).result.current.placeAbove).toBe(true);
  });

  it('stays above when below has no room in the canvas', () => {
    // At y 740 the box below would end at 818, past the 800 px area.
    const h = setup(() => rect(400, 702, 500, 732), {
      initial: { y: 740, avoid: { x: 400, y: 690, width: 100, height: 40 } },
    });
    expect(h.result.current.placeAbove).toBe(true);
  });

  it('goes back above when below would sit on the box, for a new geometry', () => {
    // Flipped below at the top edge first; then a copy placed above its original keeps the box off the original.
    let r = rect(400, 0, 500, 40);
    const h = setup(() => r);
    expect(h.result.current.placeAbove).toBe(false);
    r = rect(400, 348, 500, 378);
    h.rerender({ x: 400, y: 300, avoid: { x: 400, y: 350, width: 100, height: 60 } });
    // The geometry did not change, so nothing flips yet; a moved selection earns the fresh decision.
    h.rerender({ x: 401, avoid: { x: 400, y: 350, width: 100, height: 60 } });
    expect(h.result.current.placeAbove).toBe(true);
  });
});
