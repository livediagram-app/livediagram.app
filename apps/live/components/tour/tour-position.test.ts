import { describe, expect, it } from 'vitest';
import {
  placeTourPopover,
  TOUR_EDGE_MARGIN,
  TOUR_POPOVER_GAP,
  type TourRect,
} from './tour-position';

// Pure placement rules for the tour popover (spec/79): prefer beside the
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

  it('centres when the viewport is too small for any placement', () => {
    const p = placeTourPopover(rect(0, 0, 300, 300), POP, { width: 340, height: 340 });
    expect(p.side).toBe('center');
    expect(p.left).toBeGreaterThanOrEqual(TOUR_EDGE_MARGIN);
    expect(p.top).toBeGreaterThanOrEqual(TOUR_EDGE_MARGIN);
  });
});
