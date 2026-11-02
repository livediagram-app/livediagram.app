// The percentage label's size on a progress element (docs/specs/009-elements/progress.md "The
// percentage's size"), in px. Shared by every product's canvas ProgressView and its export
// renderer (svg-render-data.ts), so the label is the same size on the canvas and in every export.

/** The bar's percentage, and the ring's floor: small rings stay readable at this size. */
export const PROGRESS_LABEL_PX = 14;

/** The ring's percentage as a share of its diameter: "100%" still fits the hole (72% of it). */
export const PROGRESS_RING_LABEL_SHARE = 0.2;

/** The ring's ceiling, so a poster-sized ring keeps a readout rather than a headline. */
export const PROGRESS_RING_LABEL_MAX_PX = 64;

/** A ring's percentage size for its box: a share of the drawn diameter (the box's shorter side,
 *  as the 100x100 viewBox meets it), whole px, held between the floor and the ceiling. */
export function progressRingLabelPx(width: number, height: number): number {
  const diameter = Math.min(width, height);
  if (!Number.isFinite(diameter)) return PROGRESS_LABEL_PX;
  const px = Math.round(diameter * PROGRESS_RING_LABEL_SHARE);
  return Math.min(PROGRESS_RING_LABEL_MAX_PX, Math.max(PROGRESS_LABEL_PX, px));
}

/** A value rounded to a whole 0 to 100 percentage: the progress elements' setter, slider and views, and
 *  liveplanner's Percent fields, so a share rounds the same way everywhere (the caller applies any default first). */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
