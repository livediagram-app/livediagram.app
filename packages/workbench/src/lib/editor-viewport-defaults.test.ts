import { describe, expect, it } from 'vitest';
import { MIN_FIT_ZOOM, MOBILE_DEFAULT_ZOOM, sameView } from './editor-viewport-defaults';

describe('editor viewport defaults', () => {
  it('opens a phone zoomed out, never past the fit floor', () => {
    expect(MOBILE_DEFAULT_ZOOM).toBeGreaterThan(MIN_FIT_ZOOM);
  });

  it('treats views a pixel apart as the same', () => {
    const a = { zoom: 1, offset: { x: 10, y: 10 } };
    expect(sameView(a, { zoom: 1.0005, offset: { x: 11, y: 9 } })).toBe(true);
    expect(sameView(a, { zoom: 1.01, offset: { x: 10, y: 10 } })).toBe(false);
    expect(sameView(a, { zoom: 1, offset: { x: 12, y: 10 } })).toBe(false);
    expect(sameView(a, { zoom: 1, offset: { x: 10, y: 12 } })).toBe(false);
  });
});
