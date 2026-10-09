// Where the quick style panel sits (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): on
// the left edge of the canvas, vertically centred. It keeps clear of the chrome
// by trying fixed candidates in order, so the same chrome always gives the same spot.

export type Rect = { left: number; top: number; width: number; height: number };
export type QuickStyleCandidate = 'centre' | 'below' | 'above' | 'beside' | 'right-edge';
export type QuickStylePlacement = {
  left: number;
  top: number;
  candidate: QuickStyleCandidate;
  // True when no candidate was clear and the centre was used anyway.
  fallback: boolean;
};

export const QUICK_STYLE_GAP_PX = 12;

const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;

function intersects(a: Rect, b: Rect): boolean {
  return a.left < right(b) && b.left < right(a) && a.top < bottom(b) && b.top < bottom(a);
}

function inflate(r: Rect, by: number): Rect {
  return { left: r.left - by, top: r.top - by, width: r.width + 2 * by, height: r.height + 2 * by };
}

export function placeQuickStylePanel(input: {
  area: Rect;
  panel: { width: number; height: number };
  obstacles: readonly Rect[];
  gap?: number;
}): QuickStylePlacement {
  const { area, panel, obstacles } = input;
  const gap = input.gap ?? QUICK_STYLE_GAP_PX;
  const leftX = area.left + gap;
  const centreY = area.top + (area.height - panel.height) / 2;
  const band: Rect = {
    left: area.left,
    top: area.top,
    width: panel.width + 2 * gap,
    height: area.height,
  };
  const edge = obstacles.filter((o) => intersects(o, band));

  const candidates: [QuickStyleCandidate, number, number][] = [['centre', leftX, centreY]];
  if (edge.length > 0) {
    // Just below each edge obstacle, highest first; then just above each,
    // lowest first; then beside all of them.
    for (const b of [...new Set(edge.map(bottom))].sort((x, y) => x - y)) {
      candidates.push(['below', leftX, b + gap]);
    }
    for (const t of [...new Set(edge.map((o) => o.top))].sort((x, y) => y - x)) {
      candidates.push(['above', leftX, t - gap - panel.height]);
    }
    candidates.push(['beside', Math.max(...edge.map(right)) + gap, centreY]);
  }
  candidates.push(['right-edge', right(area) - gap - panel.width, centreY]);

  const inner = inflate(area, -gap);
  const clear = (left: number, top: number) => {
    const box = { left, top, ...panel };
    const inside =
      left >= inner.left &&
      top >= inner.top &&
      right(box) <= right(inner) &&
      bottom(box) <= bottom(inner);
    return inside && obstacles.every((o) => !intersects(box, inflate(o, gap)));
  };
  for (const [candidate, left, top] of candidates) {
    if (clear(left, top)) return { left, top, candidate, fallback: false };
  }
  return { left: leftX, top: centreY, candidate: 'centre', fallback: true };
}
