// The stroke points codec (docs/specs/006-document/stroke-points.md): a freehand element's points,
// and the pen's pressure at each, packed into one byte block and stored as base64 in
// `packedPoints`. Version byte, flags byte, then a fixed-size little-endian record per point
// (x u16, y u16 across the box, optional pressure u8), so point i is found by multiplying.
// Pure; one reader and one writer for the editor, the api worker, the MCP server and the imports.

export const STROKE_POINTS_VERSION = 1;
export const STROKE_POINTS_HEADER_BYTES = 2;
export const STROKE_POINTS_PRESSURE_FLAG = 0b0000_0001;
export const STROKE_POINT_STEPS = 65_535;
export const STROKE_PRESSURE_STEPS = 255;
/** A stored coordinate is within this fraction of its box's side of where it was written. */
export const STROKE_POINT_MAX_ERROR = 1 / (2 * STROKE_POINT_STEPS);
/** A stored pressure is within this of the pressure written. */
export const STROKE_PRESSURE_MAX_ERROR = 1 / (2 * STROKE_PRESSURE_STEPS);
export const MAX_FREEHAND_POINTS = 20_000;

const RECORD_BYTES = 4;
const PRESSURE_RECORD_BYTES = 5;

function base64Length(bytes: number): number {
  return 4 * Math.ceil(bytes / 3);
}

/** The longest `packedPoints` a valid stroke can need: every point with a pressure. */
export const MAX_PACKED_POINTS_LENGTH = base64Length(
  STROKE_POINTS_HEADER_BYTES + MAX_FREEHAND_POINTS * PRESSURE_RECORD_BYTES,
);

export type NormalisedPoint = { nx: number; ny: number };

/** A decoded block. Shared and memoised: callers never write into the arrays. */
export type StrokePoints = {
  readonly count: number;
  readonly nx: Float64Array;
  readonly ny: Float64Array;
  readonly pressures: Float64Array | null;
};

/** A stroke with no points: what an undecodable block draws as. */
export const EMPTY_STROKE_POINTS: StrokePoints = Object.freeze({
  count: 0,
  nx: new Float64Array(0),
  ny: new Float64Array(0),
  pressures: null,
});

export type StrokePointsRejection =
  | 'not-a-string'
  | 'too-long'
  | 'not-base64'
  | 'too-short'
  | 'unknown-version'
  | 'unknown-flags'
  | 'ragged'
  | 'too-many-points';

export type StrokePointsParse =
  { ok: true; points: StrokePoints } | { ok: false; rejection: StrokePointsRejection };

// --- base64 (standard alphabet, `=` padding, canonical only) -------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DECODE_TABLE = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out +=
      ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]! + '==';
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + '=';
  }
  return out;
}

function sextet(text: string, i: number): number {
  const code = text.charCodeAt(i);
  return code < 128 ? DECODE_TABLE[code]! : -1;
}

// Null for anything but canonical padded base64 (a stray bit in the last sextet is not canonical).
function fromBase64(text: string): Uint8Array | null {
  if (text.length % 4 !== 0) return null;
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((text.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const last = i + 4 === text.length;
    const a = sextet(text, i);
    const b = sextet(text, i + 1);
    const c = last && pad === 2 ? 0 : sextet(text, i + 2);
    const d = last && pad >= 1 ? 0 : sextet(text, i + 3);
    if ((a | b | c | d) < 0) return null;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    bytes[o++] = n >> 16;
    if (o < bytes.length) bytes[o++] = (n >> 8) & 255;
    else if ((n & 0xffff) !== 0) return null;
    if (o < bytes.length) bytes[o++] = n & 255;
    else if (last && pad === 1 && (n & 255) !== 0) return null;
  }
  return bytes;
}

// --- quantisation ----------------------------------------------------------------------------

function unitStep(n: number, steps: number): number {
  if (!Number.isFinite(n)) throw new RangeError('stroke-point-not-finite');
  return Math.round(Math.min(1, Math.max(0, n)) * steps);
}

function checkInput(points: readonly NormalisedPoint[], pressures?: readonly number[]): void {
  if (points.length > MAX_FREEHAND_POINTS) throw new RangeError('stroke-too-many-points');
  if (pressures && pressures.length !== points.length) {
    throw new RangeError('stroke-pressures-length');
  }
}

/**
 * Packs normalised points (each in [0, 1] of the box; float noise outside is clamped) and, when
 * the pen reported them, one pressure per point (0 to 1). Throws a RangeError on a non-finite
 * value, a pressure list of another length, or more than MAX_FREEHAND_POINTS points.
 */
export function encodeStrokePoints(
  points: readonly NormalisedPoint[],
  pressures?: readonly number[],
): string {
  checkInput(points, pressures);
  const stride = pressures ? PRESSURE_RECORD_BYTES : RECORD_BYTES;
  const bytes = new Uint8Array(STROKE_POINTS_HEADER_BYTES + points.length * stride);
  const view = new DataView(bytes.buffer);
  bytes[0] = STROKE_POINTS_VERSION;
  bytes[1] = pressures ? STROKE_POINTS_PRESSURE_FLAG : 0;
  for (let i = 0; i < points.length; i++) {
    const at = STROKE_POINTS_HEADER_BYTES + i * stride;
    view.setUint16(at, unitStep(points[i]!.nx, STROKE_POINT_STEPS), true);
    view.setUint16(at + 2, unitStep(points[i]!.ny, STROKE_POINT_STEPS), true);
    if (pressures) bytes[at + 4] = unitStep(pressures[i]!, STROKE_PRESSURE_STEPS);
  }
  return toBase64(bytes);
}

/** What decoding the encoded block gives, without building the string (the live ink's points). */
export function quantiseStrokePoints(
  points: readonly NormalisedPoint[],
  pressures?: readonly number[],
): StrokePoints {
  checkInput(points, pressures);
  const nx = new Float64Array(points.length);
  const ny = new Float64Array(points.length);
  const ps = pressures ? new Float64Array(points.length) : null;
  for (let i = 0; i < points.length; i++) {
    nx[i] = unitStep(points[i]!.nx, STROKE_POINT_STEPS) / STROKE_POINT_STEPS;
    ny[i] = unitStep(points[i]!.ny, STROKE_POINT_STEPS) / STROKE_POINT_STEPS;
    if (ps) ps[i] = unitStep(pressures![i]!, STROKE_PRESSURE_STEPS) / STROKE_PRESSURE_STEPS;
  }
  return { count: points.length, nx, ny, pressures: ps };
}

/** Decodes and checks a block from anywhere (untrusted included); never cached. */
export function parseStrokePoints(packed: unknown): StrokePointsParse {
  if (typeof packed !== 'string') return { ok: false, rejection: 'not-a-string' };
  if (packed.length > MAX_PACKED_POINTS_LENGTH) return { ok: false, rejection: 'too-long' };
  const bytes = fromBase64(packed);
  if (!bytes) return { ok: false, rejection: 'not-base64' };
  if (bytes.length < STROKE_POINTS_HEADER_BYTES) return { ok: false, rejection: 'too-short' };
  if (bytes[0] !== STROKE_POINTS_VERSION) return { ok: false, rejection: 'unknown-version' };
  const flags = bytes[1]!;
  if ((flags & ~STROKE_POINTS_PRESSURE_FLAG) !== 0) {
    return { ok: false, rejection: 'unknown-flags' };
  }
  const withPressure = (flags & STROKE_POINTS_PRESSURE_FLAG) !== 0;
  const stride = withPressure ? PRESSURE_RECORD_BYTES : RECORD_BYTES;
  const body = bytes.length - STROKE_POINTS_HEADER_BYTES;
  if (body % stride !== 0) return { ok: false, rejection: 'ragged' };
  const count = body / stride;
  if (count > MAX_FREEHAND_POINTS) return { ok: false, rejection: 'too-many-points' };
  const view = new DataView(bytes.buffer);
  const nx = new Float64Array(count);
  const ny = new Float64Array(count);
  const pressures = withPressure ? new Float64Array(count) : null;
  for (let i = 0; i < count; i++) {
    const at = STROKE_POINTS_HEADER_BYTES + i * stride;
    nx[i] = view.getUint16(at, true) / STROKE_POINT_STEPS;
    ny[i] = view.getUint16(at + 2, true) / STROKE_POINT_STEPS;
    if (pressures) pressures[i] = bytes[at + 4]! / STROKE_PRESSURE_STEPS;
  }
  return { ok: true, points: { count, nx, ny, pressures } };
}

/** How many points a valid block holds, from its length and flags alone. */
export function strokePointCount(packed: string): number {
  const pad = packed.endsWith('==') ? 2 : packed.endsWith('=') ? 1 : 0;
  const byteLength = (packed.length / 4) * 3 - pad;
  // The flags byte is bits 4..11 of the first two sextets after the version byte.
  const flags = ((sextet(packed, 1) & 15) << 4) | (sextet(packed, 2) >> 2);
  const stride = flags & STROKE_POINTS_PRESSURE_FLAG ? PRESSURE_RECORD_BYTES : RECORD_BYTES;
  return Math.max(0, Math.floor((byteLength - STROKE_POINTS_HEADER_BYTES) / stride));
}
