import { describe, expect, it } from 'vitest';
import { SVG_FRAME_FALLBACK, svgFrameOf } from './svg-frame';

// docs/specs/007-editor/split-view.md "The other pane"
describe('svgFrameOf', () => {
  it("reads the export renderer's root tag", () => {
    expect(
      svgFrameOf(
        '<svg xmlns="http://www.w3.org/2000/svg" width="640.5" height="480" viewBox="-120.25 40 640.5 480">\n<rect/></svg>',
      ),
    ).toEqual({ width: 640.5, height: 480, origin: { x: -120.25, y: 40 } });
  });

  it('reads only the root tag, never attributes further in', () => {
    expect(svgFrameOf('<svg><rect width="10" height="20"/></svg>')).toEqual(SVG_FRAME_FALLBACK);
  });

  it('falls back on markup with no svg, or an unclosed tag', () => {
    expect(svgFrameOf('')).toEqual(SVG_FRAME_FALLBACK);
    expect(svgFrameOf('<svg width="5"')).toEqual(SVG_FRAME_FALLBACK);
  });

  // The CodeQL js/polynomial-redos case: markup that is many `<svg` in a row. The old single pattern
  // measured 9 ms at 2,000 repeats, 35 ms at 4,000 and 209 ms at 8,000 (at least quadratic), so
  // minutes at the 200,000 here; reading the one tag is linear.
  it('stays linear on hostile markup', () => {
    const hostile = '<svg'.repeat(200_000) + ' width="1"';
    const started = performance.now();
    svgFrameOf(hostile);
    svgFrameOf('<svg ' + ' width="x'.repeat(100_000) + '>');
    expect(performance.now() - started).toBeLessThan(200);
  });
});
