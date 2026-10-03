import { describe, expect, it } from 'vitest';
import {
  A4_LONG_SIDE,
  A4_SHORT_SIDE,
  infographicPageRect,
  isPageOrientation,
  pageOrientationOf,
} from './infographic-page';

// Infographic mode's page (docs/specs/007-editor/editor-modes.md "The page").
describe('infographic page', () => {
  it('is A4 at 96 px per inch', () => {
    expect(A4_LONG_SIDE / A4_SHORT_SIDE).toBeCloseTo(297 / 210, 2);
  });

  it('stands tall in portrait and lies wide in landscape, at the origin', () => {
    expect(infographicPageRect('portrait')).toEqual({ x: 0, y: 0, width: 794, height: 1123 });
    expect(infographicPageRect('landscape')).toEqual({ x: 0, y: 0, width: 1123, height: 794 });
  });

  it('reads a tab as portrait unless it says landscape', () => {
    expect(pageOrientationOf(undefined)).toBe('portrait');
    expect(pageOrientationOf({})).toBe('portrait');
    expect(pageOrientationOf({ pageOrientation: 'sideways' })).toBe('portrait');
    expect(pageOrientationOf({ pageOrientation: 'landscape' })).toBe('landscape');
    expect(isPageOrientation('portrait')).toBe(true);
  });
});
