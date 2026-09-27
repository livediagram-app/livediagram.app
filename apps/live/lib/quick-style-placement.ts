// Where the quick style panel sits (docs/specs/008-canvas/quick-style-panel.md "Where it sits"). In the
// Floating layout it docks right beneath the Palette, as the next panel in its
// stack; in Toolbar and Minimal it sits on the right edge, vertically centred.
// Either way it keeps clear of the chrome by trying fixed candidates in order,
// so the same chrome always gives the same spot.

export type Rect = { left: number; top: number; width: number; height: number };
export type QuickStyleLayout = 'floating' | 'minimal' | 'toolbar';
export type QuickStyleCandidate =
  'under-palette' | 'over-palette' | 'centre' | 'below' | 'above' | 'beside' | 'left-edge';
export type QuickStylePlacement = {
  left: number;
  top: number;
  candidate: QuickStyleCandidate;
  // True when no candidate was clear and the centre was used anyway.
  fallback: boolean;
  // Docked in too short a space: the panel caps its height and scrolls.
  maxHeight?: number;
};

export const QUICK_STYLE_GAP_PX = 12;
// The gap between panels in a corner stack (docs/specs/007-editor/panel-docking.md), so the docked
// panel reads as the next one in the Palette's stack.
export const QUICK_STYLE_DOCK_GAP_PX = 16;
// The least room worth docking into with a scrolling body: the header and one
// row. Docked and scrolling beats jumping into the middle of the canvas, so
// the bar is low; below it the right-edge walk takes over.
export const QUICK_STYLE_DOCK_MIN_HEIGHT_PX = 96;

const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;

function intersects(a: Rect, b: Rect): boolean {
  return a.left < right(b) && b.left < right(a) && a.top < bottom(b) && b.top < bottom(a);
}

function inflate(r: Rect, by: number): Rect {
  return { left: r.left - by, top: r.top - by, width: r.width + 2 * by, height: r.height + 2 * by };
}

export function placeQuickStylePanel(input: {
  layout: QuickStyleLayout;
  area: Rect;
  panel: { width: number; height: number };
  obstacles: readonly Rect[];
  // The Palette panel, when one is on screen (Floating docks under it).
  anchor?: Rect | null;
  gap?: number;
}): QuickStylePlacement {
  if (input.layout === 'floating' && input.anchor) {
    const docked = dockToPalette({ ...input, anchor: input.anchor });
    if (docked) return docked;
  }
  return placeOnRightEdge(input);
}

// Floating: right beneath the Palette, left edges aligned, stepping down past
// any panel already stacked there; else right above it (a Palette docked at
// the bottom); else null, and the right-edge walk takes over.
function dockToPalette(input: {
  area: Rect;
  panel: { width: number; height: number };
  obstacles: readonly Rect[];
  anchor: Rect;
  gap?: number;
}): QuickStylePlacement | null {
  const { area, panel, obstacles, anchor } = input;
  const gap = input.gap ?? QUICK_STYLE_GAP_PX;
  const inner = inflate(area, -gap);
  const left = Math.max(inner.left, Math.min(anchor.left, right(inner) - panel.width));
  const others = obstacles.filter(
    (o) =>
      !(
        o.left === anchor.left &&
        o.top === anchor.top &&
        o.width === anchor.width &&
        o.height === anchor.height
      ),
  );
  const hits = (top: number) => others.filter((o) => intersects({ left, top, ...panel }, o));

  // Beneath: walk down the Palette's column past whatever is stacked there.
  // A full fit wins; the first usable short gap is kept as the scrolling
  // choice, taken only when no full fit exists above either.
  const column = others.filter((o) => o.left < left + panel.width && left < right(o));
  let scrolling: QuickStylePlacement | null = null;
  let top = bottom(anchor) + QUICK_STYLE_DOCK_GAP_PX;
  for (let i = 0; i <= column.length; i++) {
    const covering = column.filter((o) => o.top <= top && top < bottom(o));
    if (covering.length > 0) {
      top = Math.max(...covering.map(bottom)) + QUICK_STYLE_DOCK_GAP_PX;
      continue;
    }
    const below = column.filter((o) => o.top > top);
    const next = below.length > 0 ? below.reduce((m, o) => (o.top < m.top ? o : m)) : null;
    const limit = Math.min(bottom(inner), next ? next.top - QUICK_STYLE_DOCK_GAP_PX : Infinity);
    const room = limit - top;
    if (room >= panel.height) return { left, top, candidate: 'under-palette', fallback: false };
    if (room >= QUICK_STYLE_DOCK_MIN_HEIGHT_PX && !scrolling) {
      scrolling = { left, top, maxHeight: room, candidate: 'under-palette', fallback: false };
    }
    if (!next) break;
    top = bottom(next) + QUICK_STYLE_DOCK_GAP_PX;
  }
  top = anchor.top - QUICK_STYLE_DOCK_GAP_PX - panel.height;
  for (let i = 0; i <= others.length; i++) {
    if (top < inner.top) break;
    const hit = hits(top);
    if (hit.length === 0) return { left, top, candidate: 'over-palette', fallback: false };
    top = Math.min(...hit.map((o) => o.top)) - QUICK_STYLE_DOCK_GAP_PX - panel.height;
  }
  return scrolling;
}

function placeOnRightEdge(input: {
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
    // Just below each edge obstacle, highest first; then just above each,
    // lowest first; then beside all of them.
    for (const b of [...new Set(edge.map(bottom))].sort((x, y) => x - y)) {
      candidates.push(['below', rightX, b + gap]);
    }
    for (const t of [...new Set(edge.map((o) => o.top))].sort((x, y) => y - x)) {
      candidates.push(['above', rightX, t - gap - panel.height]);
    }
    candidates.push(['beside', Math.min(...edge.map((o) => o.left)) - gap - panel.width, centreY]);
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
