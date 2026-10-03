import { describe, expect, it } from 'vitest';
import {
  A4_LONG_SIDE,
  A4_SHORT_SIDE,
  infographicPageFitBox,
  infographicPageRect,
  isOnInfographicPage,
  isPageOrientation,
  pageOrientationOf,
} from './infographic-page';

// Infographic mode's page (docs/specs/007-editor/editor-modes.md "The page").
describe('infographic page', () => {
  it('is A4 at 96 px per inch', () => {
    expect(A4_LONG_SIDE / A4_SHORT_SIDE).toBeCloseTo(297 / 210, 2);
  });

  it('stands tall in portrait and lies wide in landscape, centred on the origin', () => {
    expect(infographicPageRect('portrait')).toEqual({
      x: -397,
      y: -561.5,
      width: 794,
      height: 1123,
    });
    expect(infographicPageRect('landscape')).toEqual({
      x: -561.5,
      y: -397,
      width: 1123,
      height: 794,
    });
  });

  it('frames both orientations with one square fit box', () => {
    const box = infographicPageFitBox();
    for (const o of ['portrait', 'landscape'] as const) {
      const r = infographicPageRect(o);
      expect(r.x).toBeGreaterThanOrEqual(box.x);
      expect(r.y).toBeGreaterThanOrEqual(box.y);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height);
    }
  });

  it('knows which points lie on the page', () => {
    expect(isOnInfographicPage('portrait', { x: 0, y: 0 })).toBe(true);
    expect(isOnInfographicPage('portrait', { x: 397, y: 561.5 })).toBe(true);
    expect(isOnInfographicPage('portrait', { x: 500, y: 0 })).toBe(false);
    expect(isOnInfographicPage('landscape', { x: 500, y: 0 })).toBe(true);
    expect(isOnInfographicPage('landscape', { x: 0, y: 500 })).toBe(false);
  });

  it('reads a tab as portrait unless it says landscape', () => {
    expect(pageOrientationOf(undefined)).toBe('portrait');
    expect(pageOrientationOf({})).toBe('portrait');
    expect(pageOrientationOf({ pageOrientation: 'sideways' })).toBe('portrait');
    expect(pageOrientationOf({ pageOrientation: 'landscape' })).toBe('landscape');
    expect(isPageOrientation('portrait')).toBe(true);
  });
});
