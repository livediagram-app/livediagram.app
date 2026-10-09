// A logo page's construction geometry (docs/specs/007-editor/logo-pages.md "Construction
// guides"): the lines and keyline shapes drawn over the artboard to build a mark on, and the
// keylines it snaps to. A view of the page's rect, never elements and never stored.
import type { ShapeElement } from './element-types';
import { LOGO_SAFE_FRACTION, type LaidOutPage, type PageRect } from './illustrate-page';

// The keylines as shares of the artboard's side: the keyline circle is inscribed in the safe area.
export const LOGO_KEYLINE_CIRCLE = 0.8;
export const LOGO_INNER_CIRCLE = 0.5;
export const LOGO_KEYLINE_SQUARE = 0.64;
// The grid's divisions each way.
export const LOGO_GRID_DIVISIONS = 8;

export type GuideLine = { x1: number; y1: number; x2: number; y2: number };
export type GuideCircle = { cx: number; cy: number; r: number };

export type LogoGuides = {
  centre: { v: GuideLine; h: GuideLine };
  diagonals: [GuideLine, GuideLine];
  safeArea: PageRect;
  keylineCircle: GuideCircle;
  innerCircle: GuideCircle;
  keylineSquare: PageRect;
  // The grid's inner lines, both ways (its outer edges are the artboard's).
  grid: GuideLine[];
};

function centredSquare(cx: number, cy: number, side: number): PageRect {
  return { x: cx - side / 2, y: cy - side / 2, width: side, height: side };
}

/** The construction guides of a logo page at `rect`, in canvas px. */
export function logoGuides(rect: PageRect): LogoGuides {
  const { x, y, width, height } = rect;
  const side = Math.min(width, height);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const inset = Math.round(side * LOGO_SAFE_FRACTION);
  const grid: GuideLine[] = [];
  for (let i = 1; i < LOGO_GRID_DIVISIONS; i += 1) {
    const gx = x + (width * i) / LOGO_GRID_DIVISIONS;
    const gy = y + (height * i) / LOGO_GRID_DIVISIONS;
    grid.push({ x1: gx, y1: y, x2: gx, y2: y + height }, { x1: x, y1: gy, x2: x + width, y2: gy });
  }
  return {
    centre: {
      v: { x1: cx, y1: y, x2: cx, y2: y + height },
      h: { x1: x, y1: cy, x2: x + width, y2: cy },
    },
    diagonals: [
      { x1: x, y1: y, x2: x + width, y2: y + height },
      { x1: x + width, y1: y, x2: x, y2: y + height },
    ],
    safeArea: { x: x + inset, y: y + inset, width: width - 2 * inset, height: height - 2 * inset },
    keylineCircle: { cx, cy, r: (side * LOGO_KEYLINE_CIRCLE) / 2 },
    innerCircle: { cx, cy, r: (side * LOGO_INNER_CIRCLE) / 2 },
    keylineSquare: centredSquare(cx, cy, side * LOGO_KEYLINE_SQUARE),
    grid,
  };
}

/** The extra snap targets of every logo page: the inner circle's bounding square and the keyline
 *  square, as invisible boxes the alignment snap measures (their edges and centres). The safe
 *  area already snaps as every page's margin (`illustratePageSnapBoxes`). */
export function logoPageSnapBoxes(pages: readonly LaidOutPage[]): ShapeElement[] {
  return pages.flatMap((page) => {
    if (page.kind !== 'logo') return [];
    const g = logoGuides(page.rect);
    const box = (id: string, r: PageRect): ShapeElement => ({
      id,
      type: 'shape',
      shape: 'square',
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    });
    const inner = centredSquare(g.innerCircle.cx, g.innerCircle.cy, g.innerCircle.r * 2);
    return [box(`logo-inner:${page.id}`, inner), box(`logo-keyline:${page.id}`, g.keylineSquare)];
  });
}

/** The logo page whose sheet holds `point`, if any. */
export function logoPageAt(
  pages: readonly LaidOutPage[],
  point: { x: number; y: number },
): LaidOutPage | undefined {
  return pages.find(
    (p) =>
      p.kind === 'logo' &&
      point.x >= p.rect.x &&
      point.x <= p.rect.x + p.rect.width &&
      point.y >= p.rect.y &&
      point.y <= p.rect.y + p.rect.height,
  );
}
