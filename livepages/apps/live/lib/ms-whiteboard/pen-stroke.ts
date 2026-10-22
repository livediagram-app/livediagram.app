// A pen stroke's packed geometry (docs/specs/020-import-export/whiteboard-import.md "Pen
// strokes"): a flags byte, an optional extension byte, packed doubles, then varints: the pressure
// maximum, the width, the extension's header values, and one record per point.
import { readPackedDouble, readVarint, zigzag } from './values';

export const STROKE_FLAG = {
  origin: 0x01,
  unitScale: 0x02,
  extraDouble: 0x04,
  timing: 0x08,
  pressure: 0x10,
  perPointExtra: 0x20,
  extension: 0x80,
} as const;

export const STROKE_EXT = {
  threeHeaderValues: 0x02,
  oneHeaderValue: 0x04,
  channelA: 0x08,
  channelB: 0x10,
} as const;

export type PenPoint = { x: number; y: number; p?: number };

export type PenStroke = {
  /** Where the points start, in canvas px from the stroke's place (arrowheads carry one). */
  originPx: { x: number; y: number };
  /** Canvas px per stored unit. */
  unitScale: number;
  /** The line's width in stored units. */
  width: number;
  /** The pressure that reads as 1; 0 when the stroke records no pressure. */
  pressureMax: number;
  /** In stored units, relative to the stroke's ink group. */
  points: PenPoint[];
};

/** The stroke, or null when its payload cannot be read whole. */
export function decodePenStroke(bytes: Uint8Array): PenStroke | null {
  let at = 0;
  const flags = bytes[at++];
  if (flags === undefined) return null;
  let ext = 0;
  if (flags & STROKE_FLAG.extension) {
    if (at >= bytes.length) return null;
    ext = bytes[at++]!;
  }
  const doubles: number[] = [];
  const doubleCount =
    (flags & STROKE_FLAG.origin ? 2 : 0) +
    (flags & STROKE_FLAG.unitScale ? 1 : 0) +
    (flags & STROKE_FLAG.extraDouble ? 1 : 0);
  for (let i = 0; i < doubleCount; i++) {
    const read = readPackedDouble(bytes, at);
    if (!read) return null;
    doubles.push(read[0]);
    at = read[1];
  }
  if (!(flags & STROKE_FLAG.unitScale)) return null;
  const unitScale = doubles[flags & STROKE_FLAG.origin ? 2 : 0]!;
  const originPx = flags & STROKE_FLAG.origin ? { x: doubles[0]!, y: doubles[1]! } : { x: 0, y: 0 };
  if (!Number.isFinite(originPx.x) || !Number.isFinite(originPx.y)) return null;
  if (!Number.isFinite(unitScale) || unitScale <= 0) return null;

  const values: number[] = [];
  while (at < bytes.length) {
    const read = readVarint(bytes, at);
    if (!read) return null;
    values.push(read[0]);
    at = read[1];
  }
  let k = 0;
  const hasPressure = (flags & STROKE_FLAG.pressure) !== 0;
  const pressureMax = hasPressure ? (values[k++] ?? 0) : 0;
  const width = values[k++];
  if (width === undefined || (hasPressure && pressureMax <= 0)) return null;
  const extChannels = (ext & STROKE_EXT.channelA ? 1 : 0) + (ext & STROKE_EXT.channelB ? 1 : 0);
  k +=
    extChannels +
    (ext & STROKE_EXT.threeHeaderValues ? 3 : 0) +
    (ext & STROKE_EXT.oneHeaderValue ? 1 : 0);
  const hasTiming = (flags & STROKE_FLAG.timing) !== 0;
  const record =
    2 +
    (hasTiming ? 1 : 0) +
    (hasPressure ? 1 : 0) +
    (flags & STROKE_FLAG.perPointExtra ? 1 : 0) +
    extChannels;
  if (k > values.length || (values.length - k) % record !== 0) return null;

  const points: PenPoint[] = [];
  let x = 0;
  let y = 0;
  for (; k < values.length; k += record) {
    x += zigzag(values[k]!);
    y += zigzag(values[k + 1]!);
    if (hasPressure) {
      const p = values[k + 2 + (hasTiming ? 1 : 0)]! / pressureMax;
      points.push({ x, y, p: Math.min(1, p) });
    } else points.push({ x, y });
  }
  return { originPx, unitScale, width, pressureMax, points };
}
