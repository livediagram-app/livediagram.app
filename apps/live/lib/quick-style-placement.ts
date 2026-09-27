// Where the quick style panel sits (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): the right
// edge, vertically centred, unless chrome is there. Fixed candidates, tried in
// order, first clear one wins, so the same chrome always gives the same spot.

export type Rect = { left: number; top: number; width: number; height: number };
export type QuickStyleCandidate = 'centre' | 'below' | 'above' | 'beside' | 'left-edge';
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
  const rightX = right(area) - gap - panel.width;
  const centreY = area.top + (area.height - panel.height) / 2;
  const band: Rect = {
    left: rightX - gap,
    top: area.top,
    width: right(area) - rightX + gap,
    height: area.height,
  };
  const edge = obstacles.filter((o) => intersects(o, band));

  const candidates: [QuickStyleCandidate, number, number][] = [['centre', rightX, centreY]];
  if (edge.length > 0) {
    candidates.push(
      ['below', rightX, Math.max(...edge.map(bottom)) + gap],
      ['above', rightX, Math.min(...edge.map((o) => o.top)) - gap - panel.height],
      ['beside', Math.min(...edge.map((o) => o.left)) - gap - panel.width, centreY],
    );
  }
  candidates.push(['left-edge', area.left + gap, centreY]);

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
  return { left: rightX, top: centreY, candidate: 'centre', fallback: true };
}
