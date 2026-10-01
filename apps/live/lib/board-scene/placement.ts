// Where a landed scene goes (docs/specs/020-import-export/board-scene.md "Placement"): at a point
// its bounds are centred there; at the origin its coordinates are the tab's.
import type { SceneItem } from './scene';

export type BoardScenePlacement = { kind: 'at'; x: number; y: number } | { kind: 'origin' };
export type SceneBounds = { x: number; y: number; width: number; height: number };

type Point = { x: number; y: number };

function cornersOf(item: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg?: number;
}): Point[] {
  const { x, y, width: w, height: h } = item;
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  const deg = item.rotationDeg ?? 0;
  if (!Number.isFinite(deg) || deg % 360 === 0) return corners;
  const r = (deg * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return corners.map((p) => ({
    x: cx + (p.x - cx) * Math.cos(r) - (p.y - cy) * Math.sin(r),
    y: cy + (p.x - cx) * Math.sin(r) + (p.y - cy) * Math.cos(r),
  }));
}

const pointsOf = (item: SceneItem): readonly Point[] =>
  'points' in item ? item.points : cornersOf(item);

/** The union of every item's extent (a rotated box by its turned corners); null when empty. */
export function sceneBounds(items: readonly SceneItem[]): SceneBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    for (const p of pointsOf(item)) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** How far to move every item: the bounds' centre onto the point, or nowhere. */
export function placementOffset(
  items: readonly SceneItem[],
  placement: BoardScenePlacement,
): { dx: number; dy: number } {
  if (placement.kind === 'origin') return { dx: 0, dy: 0 };
  const b = sceneBounds(items);
  if (!b) return { dx: 0, dy: 0 };
  return { dx: placement.x - (b.x + b.width / 2), dy: placement.y - (b.y + b.height / 2) };
}

/** An item moved by an offset; the same item when the offset is zero. */
export function translateItem<T extends SceneItem>(item: T, dx: number, dy: number): T {
  if (dx === 0 && dy === 0) return item;
  if ('points' in item) {
    return { ...item, points: item.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  }
  return { ...item, x: item.x + dx, y: item.y + dy };
}
