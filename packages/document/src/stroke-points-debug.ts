// The debug decoder for packed stroke points (docs/specs/006-document/stroke-points.md "Reading
// and writing"): stored JSON holds each stroke's points as an opaque base64 block, so a developer
// reads one here as plain `{ nx, ny, p }` points, or a whole tab or document file at once with
// `pnpm --filter @livediagram/document stroke-points <file.json>`.
import {
  STROKE_POINTS_VERSION,
  parseStrokePoints,
  type StrokePointsRejection,
} from './stroke-points';

export type DescribedStrokePoint = { nx: number; ny: number; p?: number };

export type DescribedStrokePoints =
  | { ok: true; version: number; pressure: boolean; points: DescribedStrokePoint[] }
  | { ok: false; rejection: StrokePointsRejection };

/** A block as readable points: its version, whether it carries pressure, and every point. */
export function describeStrokePoints(packed: string): DescribedStrokePoints {
  const parsed = parseStrokePoints(packed);
  if (!parsed.ok) return parsed;
  const { count, nx, ny, pressures } = parsed.points;
  const points: DescribedStrokePoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push(
      pressures ? { nx: nx[i]!, ny: ny[i]!, p: pressures[i]! } : { nx: nx[i]!, ny: ny[i]! },
    );
  }
  return { ok: true, version: STROKE_POINTS_VERSION, pressure: pressures !== null, points };
}

/** A deep copy of any JSON value with every string `packedPoints` replaced by its description. */
export function expandPackedPoints<T>(value: T): T {
  if (Array.isArray(value)) return value.map(expandPackedPoints) as T;
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] =
      key === 'packedPoints' && typeof v === 'string'
        ? describeStrokePoints(v)
        : expandPackedPoints(v);
  }
  return out as T;
}
