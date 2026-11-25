// Sitting facing a Screen frames it (docs/specs/008-canvas/avatar-mode.md "The camera", Work Tracker 1427).
import { describe, expect, it } from 'vitest';
import {
  SEATED_FRAME_CLEAR,
  SEATED_FRAME_MIN_ZOOM,
  screenAhead,
  seatedScreenFrame,
} from './seated-screen-frame';

const WALL = { x: -400, y: -660, width: 800, height: 500 };
// A 1440 x 900 laptop's canvas, under the top bar.
const VIEW = { width: 1440, height: 844 };

// Where a canvas point lands on screen under a pose: the wrapper scales about the view's middle.
const onScreen = (
  p: { x: number; y: number },
  pose: ReturnType<typeof seatedScreenFrame>,
  view = VIEW,
) => ({
  x: view.width / 2 + (p.x + pose.offset.x - view.width / 2) * pose.zoom,
  y: view.height / 2 + (p.y + pose.offset.y - view.height / 2) * pose.zoom,
});

describe('screenAhead', () => {
  const behind = { x: -100, y: 400, width: 200, height: 120 };
  it('takes the nearest Screen in the half of the room the sitter faces', () => {
    expect(screenAhead({ x: 0, y: 0 }, 'up', [behind, WALL])).toBe(WALL);
    expect(screenAhead({ x: 0, y: 0 }, 'down', [behind, WALL])).toBe(behind);
    const far = { ...WALL, y: -2000 };
    expect(screenAhead({ x: 0, y: 0 }, 'up', [far, WALL])).toBe(WALL);
  });

  it('looks left and right too, and finds none behind', () => {
    const east = { x: 500, y: -50, width: 200, height: 100 };
    expect(screenAhead({ x: 0, y: 0 }, 'right', [east])).toBe(east);
    expect(screenAhead({ x: 0, y: 0 }, 'left', [east])).toBeNull();
    expect(screenAhead({ x: 0, y: 0 }, 'up', [behind])).toBeNull();
  });
});

describe('seatedScreenFrame', () => {
  it('shows a front-row sitter the whole Screen and themself, clear of the chrome', () => {
    const feet = { x: -300, y: -40 };
    const pose = seatedScreenFrame(feet, WALL, VIEW, 1.4);
    expect(pose.zoom).toBeLessThan(1.4);
    expect(pose.zoom).toBeGreaterThanOrEqual(SEATED_FRAME_MIN_ZOOM);
    const top = onScreen({ x: WALL.x, y: WALL.y }, pose);
    const right = onScreen({ x: WALL.x + WALL.width, y: WALL.y }, pose);
    const self = onScreen(feet, pose);
    expect(top.y).toBeGreaterThanOrEqual(SEATED_FRAME_CLEAR.top - 0.5);
    expect(top.x).toBeGreaterThanOrEqual(SEATED_FRAME_CLEAR.side - 0.5);
    expect(right.x).toBeLessThanOrEqual(VIEW.width - SEATED_FRAME_CLEAR.side + 0.5);
    expect(self.y).toBeLessThanOrEqual(VIEW.height - SEATED_FRAME_CLEAR.bottom + 0.5);
  });

  it('never zooms in', () => {
    const big = { width: 4000, height: 3000 };
    const pose = seatedScreenFrame({ x: 0, y: -100 }, WALL, big, 0.8);
    expect(pose.zoom).toBe(0.8);
    // Centred across on the box the Screen and the sitter make.
    expect(onScreen({ x: 0, y: 0 }, pose, big).x).toBeCloseTo(2000);
  });

  it('keeps the Screen when even the least zoom cannot hold both', () => {
    const feet = { x: 0, y: 900 };
    const pose = seatedScreenFrame(feet, WALL, VIEW, 1.4);
    expect(pose.zoom).toBe(SEATED_FRAME_MIN_ZOOM);
    expect(onScreen({ x: 0, y: WALL.y }, pose).y).toBeCloseTo(SEATED_FRAME_CLEAR.top);
  });

  it('keeps a zoom already below the least', () => {
    expect(seatedScreenFrame({ x: 0, y: 900 }, WALL, VIEW, 0.4).zoom).toBe(0.4);
  });
});
