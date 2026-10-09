// A Fit to Content page's sides and the row anchor as stored (docs/specs/007-editor/
// illustrate-pages.md "A page", "Sizes"): their types, limits and how a stored value is read. Kept
// apart from illustrate-page.ts, which reads every page through these.

// A Fit to Content page's own sides, whole canvas px.
export type PageSides = { width: number; height: number };

// The row anchor: where the first page's centre sits, whole canvas px.
export type RowAt = { x: number; y: number };

// A Fit to Content page's sides are never under FIT_PAGE_MIN_SIDE, and never past
// FIT_PAGE_MAX_SIDE: 14400 pt, the largest page a PDF holds, at 0.75 pt per px.
export const FIT_PAGE_MIN_SIDE = 200;
export const FIT_PAGE_MAX_SIDE = 19200;

/** A side rounded to whole px and clamped to the Fit to Content limits. */
export const clampPageSide = (n: number): number =>
  Math.min(FIT_PAGE_MAX_SIDE, Math.max(FIT_PAGE_MIN_SIDE, Math.round(n)));

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Stored Fit to Content sides: both finite and positive, rounded and clamped; else undefined. */
export function parsePageSides(v: unknown): PageSides | undefined {
  const f = v as Record<string, unknown> | null;
  if (!f || typeof f !== 'object') return undefined;
  const { width, height } = f;
  if (!isNumber(width) || !isNumber(height) || width <= 0 || height <= 0) return undefined;
  return { width: clampPageSide(width), height: clampPageSide(height) };
}

/** A stored row anchor: both finite, rounded to whole px; else undefined. */
export function parseRowAt(v: unknown): RowAt | undefined {
  const a = v as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return undefined;
  const { x, y } = a;
  if (!isNumber(x) || !isNumber(y)) return undefined;
  return { x: Math.round(x), y: Math.round(y) };
}
