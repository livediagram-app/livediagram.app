import { describe, expect, it } from 'vitest';
import {
  SWIPE_AXIS_SLOP_PX,
  SWIPE_COMMIT_SHARE,
  SWIPE_FLICK_MIN_PX,
  SWIPE_FLICK_PX_PER_MS,
  SWIPE_VELOCITY_WINDOW_MS,
  addSample,
  landingLeft,
  nearestStop,
  sampleVelocity,
  swipeAxis,
  swipeStep,
  type SwipeSample,
} from './phone-swipe';

// docs/specs/026-plan/plan-board.md "On a phone", "A column changes only on a swipe meant for it".
const WIDTH = 326; // a 390 px phone's column (PHONE_COLUMN_WIDTH)

describe('swipeAxis', () => {
  it('waits until the touch has moved past the slop', () => {
    expect(swipeAxis(0, 0)).toBeNull();
    expect(swipeAxis(SWIPE_AXIS_SLOP_PX - 1, 0)).toBeNull();
    expect(swipeAxis(-6, 7)).toBeNull();
  });

  it('settles a scroll down with sideways drift as down', () => {
    expect(swipeAxis(4, 40)).toBe('y');
    expect(swipeAxis(-14, -30)).toBe('y');
    expect(swipeAxis(0, -SWIPE_AXIS_SLOP_PX)).toBe('y');
  });

  it('settles a diagonal as down, so only a clearly sideways touch changes column', () => {
    expect(swipeAxis(20, 20)).toBe('y');
    expect(swipeAxis(-23, 20)).toBe('y');
    expect(swipeAxis(25, -20)).toBe('x');
  });

  it('settles a clearly sideways touch as across, either way', () => {
    expect(swipeAxis(SWIPE_AXIS_SLOP_PX, 0)).toBe('x');
    expect(swipeAxis(-30, 6)).toBe('x');
  });
});

describe('swipeStep', () => {
  it('glides back from a short, slow swipe', () => {
    expect(swipeStep(-40, 0, -0.1, WIDTH)).toBe(0);
    expect(swipeStep(60, 0, 0.2, WIDTH)).toBe(0);
    expect(swipeStep(0, 0, 0, WIDTH)).toBe(0);
  });

  it('moves one column on a swipe past its share of the width, the way the finger went', () => {
    const far = Math.ceil(WIDTH * SWIPE_COMMIT_SHARE);
    expect(swipeStep(-far, 0, 0, WIDTH)).toBe(1);
    expect(swipeStep(far, 0, 0, WIDTH)).toBe(-1);
    expect(swipeStep(-(far - 2), 0, 0, WIDTH)).toBe(0);
  });

  it('moves one column on a flick, even a short one', () => {
    expect(swipeStep(-SWIPE_FLICK_MIN_PX, 0, -SWIPE_FLICK_PX_PER_MS, WIDTH)).toBe(1);
    expect(swipeStep(40, 0, 0.9, WIDTH)).toBe(-1);
  });

  it('takes no flick that is too short, or that the finger turned back from', () => {
    expect(swipeStep(-(SWIPE_FLICK_MIN_PX - 1), 0, -2, WIDTH)).toBe(0);
    expect(swipeStep(-50, 0, 1.2, WIDTH)).toBe(0);
  });

  it('glides back from a touch that set off across but ended more down than across', () => {
    // A thumb's arc: 150 px across, 420 px down.
    expect(swipeStep(-150, -420, -0.2, WIDTH)).toBe(0);
    expect(swipeStep(150, 300, 1.5, WIDTH)).toBe(0);
    // A deliberate swipe with a little wobble still counts.
    expect(swipeStep(-200, 30, 0, WIDTH)).toBe(1);
  });

  it('takes no distance against a column of no width', () => {
    expect(swipeStep(-200, 0, 0, 0)).toBe(0);
  });
});

describe('nearestStop and landingLeft', () => {
  const stops = [0, 338, 676, 1014];

  it('finds the column the board is on', () => {
    expect(nearestStop(stops, 0)).toBe(0);
    expect(nearestStop(stops, 350)).toBe(1);
    expect(nearestStop(stops, 1200)).toBe(3);
    expect(nearestStop([], 40)).toBe(0);
  });

  it('lands one column on, never past either end', () => {
    expect(landingLeft(stops, 1, 1)).toBe(676);
    expect(landingLeft(stops, 1, -1)).toBe(0);
    expect(landingLeft(stops, 1, 0)).toBe(338);
    expect(landingLeft(stops, 0, -1)).toBe(0);
    expect(landingLeft(stops, 3, 1)).toBe(1014);
    expect(landingLeft([], 0, 1)).toBe(0);
  });
});

describe('the release speed', () => {
  it('reads the speed over the last moves', () => {
    const samples: SwipeSample[] = [];
    addSample(samples, 0, 300);
    addSample(samples, 16, 290);
    addSample(samples, 32, 270);
    expect(sampleVelocity(samples, 40)).toBeCloseTo(-30 / 32);
  });

  it('keeps only the window, so a slow drag that speeds up at the end reads its end', () => {
    const samples: SwipeSample[] = [];
    for (let t = 0; t <= 1000; t += 10) addSample(samples, t, 300 - t * 0.01);
    expect(samples.length).toBeLessThanOrEqual(SWIPE_VELOCITY_WINDOW_MS / 10 + 2);
    addSample(samples, 1010, 200);
    expect(sampleVelocity(samples, 1010)).toBeLessThan(-0.5);
  });

  it('reads no speed from too few moves, no time, or a finger held still before lifting', () => {
    expect(sampleVelocity([], 0)).toBe(0);
    expect(sampleVelocity([{ t: 0, x: 10 }], 0)).toBe(0);
    expect(
      sampleVelocity(
        [
          { t: 5, x: 10 },
          { t: 5, x: 30 },
        ],
        5,
      ),
    ).toBe(0);
    expect(
      sampleVelocity(
        [
          { t: 0, x: 10 },
          { t: 16, x: 60 },
        ],
        16 + SWIPE_VELOCITY_WINDOW_MS + 1,
      ),
    ).toBe(0);
  });

  it('settles a long touch in linear time (a CPU budget)', () => {
    const samples: SwipeSample[] = [];
    const start = process.cpuUsage();
    for (let t = 0; t < 200_000; t++) addSample(samples, t, t % 400);
    const used = process.cpuUsage(start);
    expect(samples.length).toBeLessThan(110);
    expect((used.user + used.system) / 1000).toBeLessThan(500);
  });
});
