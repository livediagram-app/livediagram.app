import { describe, expect, it } from 'vitest';
import {
  INTRO_MIN_RATIO,
  introEase,
  introPose,
  introStart,
  introWorthPlaying,
} from './arrival-intro';

// docs/specs/008-canvas/3d-view.md "Arriving": the overview's start, whether it plays, and the zoom in.

const SIZE = { width: 1000, height: 800 };
const FROM = { zoom: 0.2, offset: { x: -500, y: -300 } };
const TARGET = { x: 1200, y: 900 };
// Centred on the target at 180%.
const TO = { zoom: 1.8, offset: { x: 500 - TARGET.x, y: 400 - TARGET.y } };

// Where a canvas point shows on screen, relative to the screen's middle.
const onScreen = (view: typeof FROM, p: { x: number; y: number }) => ({
  x: view.zoom * (p.x + view.offset.x - SIZE.width / 2),
  y: view.zoom * (p.y + view.offset.y - SIZE.height / 2),
});

describe('introEase', () => {
  it('runs 0 to 1, symmetric, clamped', () => {
    expect(introEase(0)).toBe(0);
    expect(introEase(1)).toBe(1);
    expect(introEase(0.5)).toBeCloseTo(0.5);
    expect(introEase(0.25) + introEase(0.75)).toBeCloseTo(1);
    expect(introEase(-1)).toBe(0);
    expect(introEase(2)).toBe(1);
  });
});

describe('introPose', () => {
  it('starts on the overview and ends exactly on the arrival', () => {
    expect(introPose(FROM, TO, TARGET, SIZE, 0)).toEqual(FROM);
    expect(introPose(FROM, TO, TARGET, SIZE, 1)).toBe(TO);
    expect(introPose(FROM, TO, TARGET, SIZE, 1.3)).toBe(TO);
  });

  it('zooms evenly in log space: halfway is the geometric mean', () => {
    expect(introPose(FROM, TO, TARGET, SIZE, 0.5).zoom).toBeCloseTo(Math.sqrt(0.2 * 1.8));
  });

  it('only ever zooms in, and slides the character straight to the middle', () => {
    const start = onScreen(FROM, TARGET);
    let last = FROM.zoom;
    for (let k = 0.05; k < 1; k += 0.05) {
      const pose = introPose(FROM, TO, TARGET, SIZE, k);
      expect(pose.zoom).toBeGreaterThanOrEqual(last);
      last = pose.zoom;
      // On the line from where it started to the middle, the eased share of the way along.
      const at = onScreen(pose, TARGET);
      const e = introEase(k);
      expect(at.x).toBeCloseTo(start.x * (1 - e), 6);
      expect(at.y).toBeCloseTo(start.y * (1 - e), 6);
    }
  });
});

describe('introStart and introWorthPlaying', () => {
  it('starts from the fit, clamped to the zoom range and never closer than the end', () => {
    expect(introStart({ zoom: 0.02, offset: { x: 1, y: 2 } }, TO)).toEqual({
      zoom: 0.1,
      offset: { x: 1, y: 2 },
    });
    expect(introStart({ zoom: 3, offset: { x: 0, y: 0 } }, TO).zoom).toBe(1.8);
  });

  it('skips a tab whose content already fits at the walking zoom', () => {
    expect(introWorthPlaying(FROM, TO)).toBe(true);
    expect(introWorthPlaying(introStart({ zoom: 3, offset: { x: 0, y: 0 } }, TO), TO)).toBe(false);
    expect(
      introWorthPlaying({ zoom: TO.zoom / (INTRO_MIN_RATIO * 0.99), offset: FROM.offset }, TO),
    ).toBe(false);
    expect(introWorthPlaying({ zoom: Number.NaN, offset: FROM.offset }, TO)).toBe(false);
  });
});
