import { describe, expect, it } from 'vitest';
import {
  pickDockEdge,
  placeTourPopover,
  TOUR_EDGE_MARGIN,
  TOUR_MIN_ROOM,
  TOUR_POPOVER_GAP,
  type TourRect,
} from './tour-position';

// Pure placement rules for the tour popover (docs/specs/007-editor/editor-tour.md): prefer beside the
// target (right, then left), fall back to below / above, centre when
// nothing fits, and always clamp into the viewport with the edge margin.

const POP = { width: 320, height: 180 };
const VIEW = { width: 1280, height: 800 };
const rect = (left: number, top: number, width = 200, height = 100): TourRect => ({
  left,
  top,
  width,
  height,
});

describe('placeTourPopover', () => {
  it('prefers the right side when there is room', () => {
    const p = placeTourPopover(rect(100, 100), POP, VIEW);
    expect(p.side).toBe('right');
    expect(p.left).toBe(100 + 200 + TOUR_POPOVER_GAP);
    expect(p.top).toBe(100);
  });

  it('falls back to the left when the right edge is tight', () => {
    const p = placeTourPopover(rect(1000, 100, 260), POP, VIEW);
    expect(p.side).toBe('left');
    expect(p.left).toBe(1000 - TOUR_POPOVER_GAP - POP.width);
  });

  it('falls back to below when neither side fits', () => {
    // Target spans nearly the full width, so no side has room.
    const p = placeTourPopover(rect(20, 100, 1240), POP, VIEW);
    expect(p.side).toBe('below');
    expect(p.top).toBe(100 + 100 + TOUR_POPOVER_GAP);
  });

  it('flips above when the target hugs the bottom edge', () => {
    const p = placeTourPopover(rect(20, 720, 1240, 60), POP, VIEW);
    expect(p.side).toBe('above');
    expect(p.top).toBe(720 - TOUR_POPOVER_GAP - POP.height);
  });

  it('clamps the cross axis into the viewport', () => {
    // Target at the very top: a beside placement aligned to its top would
    // sit above y=margin only if unclamped; verify the clamp floor.
    const p = placeTourPopover(rect(100, -50), POP, VIEW);
    expect(p.side).toBe('right');
    expect(p.top).toBe(TOUR_EDGE_MARGIN);
  });

  it('docks at the bottom edge only when the target leaves no room on either side', () => {
    const p = placeTourPopover(rect(0, 0, 300, 300), POP, { width: 340, height: 340 });
    expect(p.side).toBe('center');
    expect(p.left).toBeGreaterThanOrEqual(TOUR_EDGE_MARGIN);
    expect(p.top).toBe(340 - TOUR_EDGE_MARGIN - POP.height);
    expect(p.maxHeight).toBeUndefined();
  });

  it('caps a card taller than the window when it docks', () => {
    const p = placeTourPopover(
      rect(0, 0, 300, 300),
      { width: 320, height: 500 },
      { width: 340, height: 340 },
    );
    expect(p.maxHeight).toBe(340 - TOUR_EDGE_MARGIN * 2);
    expect(p.top).toBe(TOUR_EDGE_MARGIN);
  });
});

// "Where the card sits" (docs/specs/007-editor/editor-tour.md; owner, 2026-11-09: on a phone the card covered the
// Card Types control it asked the person to press): on a phone the card never meets its target, wherever it is.
describe('placeTourPopover on a phone', () => {
  const PHONES = [
    { width: 390, height: 844 },
    { width: 360, height: 740 },
    { width: 360, height: 640 },
  ];
  // The card at its phone width (22rem, capped to the window less 1.5rem), short, typical and tall.
  const cards = (vw: number) =>
    [140, 230, 360].map((height) => ({ width: Math.min(352, vw - 24), height }));
  // Targets a tour rings on a phone: a toolbar button at the top, a panel row mid-screen, a footer cluster button at
  // the bottom, a tall section, and a wide sheet row.
  const targets = (vh: number): [string, TourRect][] => [
    ['top button', rect(20, 70, 44, 44)],
    ['middle row', rect(16, vh / 2 - 22, 340, 44)],
    ['bottom button', rect(230, vh - 130, 40, 44)],
    ['footer button', rect(300, vh - 50, 44, 44)],
    ['tall section', rect(10, vh * 0.3, 340, vh * 0.35)],
  ];
  const meets = (a: TourRect, b: TourRect) =>
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height;

  for (const view of PHONES) {
    for (const card of cards(view.width)) {
      for (const [name, target] of targets(view.height)) {
        it(`${view.width}x${view.height}, a ${card.height}px card, ${name}: clear of it and on screen`, () => {
          const p = placeTourPopover(target, card, view);
          const shown = {
            left: p.left,
            top: p.top,
            width: card.width,
            height: p.maxHeight ?? card.height,
          };
          expect(meets(shown, target)).toBe(false);
          expect(p.side).not.toBe('center');
          expect(shown.top).toBeGreaterThanOrEqual(TOUR_EDGE_MARGIN);
          expect(shown.top + shown.height).toBeLessThanOrEqual(view.height - TOUR_EDGE_MARGIN);
          expect(shown.left).toBeGreaterThanOrEqual(TOUR_EDGE_MARGIN);
          expect(shown.left + shown.width).toBeLessThanOrEqual(view.width - TOUR_EDGE_MARGIN);
        });
      }
    }
  }

  it('takes the side with more room, capped to it, when neither holds the whole card', () => {
    const view = { width: 390, height: 844 };
    const below = placeTourPopover(rect(16, 300, 340, 44), { width: 352, height: 520 }, view);
    expect(below.side).toBe('below');
    expect(below.top).toBe(344 + TOUR_POPOVER_GAP);
    expect(below.maxHeight).toBe(844 - TOUR_EDGE_MARGIN - (344 + TOUR_POPOVER_GAP));
    const above = placeTourPopover(rect(16, 500, 340, 44), { width: 352, height: 520 }, view);
    expect(above.side).toBe('above');
    expect(above.top).toBe(TOUR_EDGE_MARGIN);
    expect(above.maxHeight).toBe(500 - TOUR_POPOVER_GAP - TOUR_EDGE_MARGIN);
    expect(above.maxHeight).toBeGreaterThanOrEqual(TOUR_MIN_ROOM);
  });

  it('places a 360px card on a 740px phone in under a microsecond each', () => {
    const view = { width: 360, height: 740 };
    const start = performance.now();
    for (let i = 0; i < 100_000; i++)
      placeTourPopover(rect(16, i % 700, 340, 44), { width: 336, height: 360 }, view);
    expect((performance.now() - start) / 100_000).toBeLessThan(0.001 * 50);
  });
});

describe('pickDockEdge', () => {
  const VH = 844;
  const SHEET = 160;
  const FOOTER = 48;

  it('keeps its usual edge with nothing to point at', () => {
    expect(pickDockEdge(null, SHEET, VH, 'bottom')).toBe('bottom');
    expect(pickDockEdge(null, SHEET, VH, 'top')).toBe('top');
  });

  it('keeps its usual edge when the target is clear of it', () => {
    expect(pickDockEdge(rect(20, 300, 100, 44), SHEET, VH, 'bottom', { bottom: FOOTER })).toBe(
      'bottom',
    );
  });

  it('docks at the top when the target sits where the bottom sheet would (Types above the footer)', () => {
    const types = rect(230, 715, 40, 44);
    expect(pickDockEdge(types, SHEET, VH, 'bottom', { bottom: FOOTER })).toBe('top');
  });

  it('docks at the bottom when the target sits where the top sheet would (a window name field)', () => {
    expect(pickDockEdge(rect(36, 120, 300, 44), SHEET, VH, 'top')).toBe('bottom');
  });

  it('a target mid-screen leaves either edge clear: the usual one stands', () => {
    expect(pickDockEdge(rect(16, VH / 2 - 22, 340, 44), SHEET, VH, 'bottom')).toBe('bottom');
  });

  it('a target both edges meet keeps the edge that covers less of it', () => {
    // From 100 to 760: the top sheet covers 60px of it, the bottom one (above a 48px footer) 124.
    const tall = rect(16, 100, 340, 660);
    expect(pickDockEdge(tall, SHEET, VH, 'bottom', { bottom: FOOTER })).toBe('top');
    // The whole window: each covers 160px of it; the usual edge stands.
    expect(pickDockEdge(rect(16, 0, 340, VH), SHEET, VH, 'bottom', { bottom: FOOTER })).toBe(
      'bottom',
    );
  });

  it('never leaves the docked sheet over the target when one edge is clear', () => {
    for (const top of [0, 100, 200, 400, 600, 700, 780]) {
      const target = rect(200, top, 44, 44);
      const edge = pickDockEdge(target, SHEET, VH, 'bottom', { bottom: FOOTER });
      const sheetTop = edge === 'top' ? 0 : VH - FOOTER - SHEET;
      expect(sheetTop < top + 44 && top < sheetTop + SHEET).toBe(false);
    }
  });
});
