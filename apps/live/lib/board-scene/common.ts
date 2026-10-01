// What every landed element shares (docs/specs/020-import-export/board-scene.md "Kinds"): rotation,
// lock, a safe link and opacity, plus the point helpers the point kinds use.
import type { ElementLink } from '@livediagram/document';
import { normaliseUrl } from '@/lib/url-safety';
import { LANDING_RULES, type LandContext } from './context';
import type { SceneItem, ScenePoint } from './scene';

type Point = { x: number; y: number };

/** Clockwise degrees in [0, 360); none for no turn or a broken one. */
export function normaliseRotation(deg: number | undefined): number | undefined {
  if (deg === undefined || !Number.isFinite(deg)) return undefined;
  const turned = ((deg % 360) + 360) % 360;
  return turned === 0 ? undefined : turned;
}

export type CommonFields = {
  rotation?: number;
  locked?: true;
  link?: ElementLink;
  opacity?: number;
};

/**
 * Rotation, lock, link and opacity. A link is kept only as a web or email address (normaliseUrl:
 * http, https, mailto), so a pasted board never carries a script link; any other is dropped and
 * counted. `opacity` 1 is omitted.
 */
export function commonFields(
  item: Pick<SceneItem, 'key' | 'rotationDeg' | 'locked' | 'link'>,
  ctx: LandContext,
  opacity: number,
): CommonFields {
  const rotation = normaliseRotation(item.rotationDeg);
  let link: ElementLink | undefined;
  if (item.link) {
    const url = normaliseUrl(item.link);
    if (url) link = { kind: 'url', url };
    else ctx.degrade(LANDING_RULES.unsafeLink);
  }
  return {
    ...(rotation !== undefined ? { rotation } : {}),
    ...(item.locked ? { locked: true as const } : {}),
    ...(link ? { link } : {}),
    ...(opacity < 1 ? { opacity: Math.max(0, opacity) } : {}),
  };
}

/**
 * The box around points, at least 1 px each way (a flat line keeps its centre), and the points
 * normalised into it: the freehand storage shape.
 */
export function boxOfPoints(points: readonly Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
  points: { nx: number; ny: number }[];
} {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const x = minX - (width - (maxX - minX)) / 2;
  const y = minY - (height - (maxY - minY)) / 2;
  return {
    x,
    y,
    width,
    height,
    points: points.map((p) => ({ nx: (p.x - x) / width, ny: (p.y - y) / height })),
  };
}

/** At most `max` points, sampled evenly along the list with both ends kept. */
export function limitPoints<P extends ScenePoint | Point>(points: readonly P[], max: number): P[] {
  if (points.length <= max) return points as P[];
  const out: P[] = [];
  for (let i = 0; i < max; i++) {
    out.push(points[Math.round((i * (points.length - 1)) / (max - 1))]!);
  }
  return out;
}

/** Whether the last point coincides with the first (within `epsilon` px). */
export function endsMeet(points: readonly Point[], epsilon: number): boolean {
  if (points.length < 3) return false;
  const a = points[0]!;
  const b = points[points.length - 1]!;
  return Math.hypot(a.x - b.x, a.y - b.y) <= epsilon;
}

/** Points turned clockwise by `deg` about the centre of their bounds (none: the same points). */
export function turnPoints<P extends Point>(points: readonly P[], deg: number | undefined): P[] {
  const rotation = normaliseRotation(deg);
  if (rotation === undefined || points.length === 0) return points as P[];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = (rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return points.map((p) => ({
    ...p,
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
  }));
}
