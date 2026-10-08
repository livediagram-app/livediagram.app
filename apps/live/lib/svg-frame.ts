// The frame of an SVG the export renderer drew (docs/specs/007-editor/split-view.md "The other pane"):
// its size and where its drawing starts in canvas space, read off the root element so the side by
// side pane can fit and anchor it.
//
// Linear in the markup, whatever it holds: only the opening `<svg …>` tag is read (cut out with
// indexOf), and each attribute with its own pattern that cannot backtrack. One pattern spanning the
// tag with `[^>]*` runs between the attributes backtracked polynomially on markup full of `<svg`
// (CodeQL js/polynomial-redos), and the markup carries tab content.

export type SvgFrame = { width: number; height: number; origin: { x: number; y: number } };

export const SVG_FRAME_FALLBACK: SvgFrame = { width: 800, height: 600, origin: { x: 0, y: 0 } };

const WIDTH = / width="([\d.]+)"/;
const HEIGHT = / height="([\d.]+)"/;
const VIEW_BOX = / viewBox="(-?[\d.]+) (-?[\d.]+) /;

export function svgFrameOf(markup: string): SvgFrame {
  const start = markup.indexOf('<svg');
  if (start === -1) return SVG_FRAME_FALLBACK;
  const end = markup.indexOf('>', start);
  if (end === -1) return SVG_FRAME_FALLBACK;
  const tag = markup.slice(start, end);
  const width = WIDTH.exec(tag);
  const height = HEIGHT.exec(tag);
  const viewBox = VIEW_BOX.exec(tag);
  return {
    width: width ? Number(width[1]) : SVG_FRAME_FALLBACK.width,
    height: height ? Number(height[1]) : SVG_FRAME_FALLBACK.height,
    origin: viewBox ? { x: Number(viewBox[1]), y: Number(viewBox[2]) } : SVG_FRAME_FALLBACK.origin,
  };
}
