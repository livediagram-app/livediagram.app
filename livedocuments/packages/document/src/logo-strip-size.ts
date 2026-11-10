// The logo strip's sizes (docs/specs/009-elements/logo-strip.md), a leaf the component catalogue reads at load.

export const LOGO_STRIP_COUNT = 5;
export const LOGO_W = 160;
export const LOGO_H = 64;
export const LOGO_STRIP_GAP = 40;
export const LOGO_STRIP_PADDING = 16;
export const LOGO_MIN_W = 48;
export const LOGO_MIN_H = 24;

/** The strip's natural size for `count` logos of the default size. */
export function logoStripSize(count = LOGO_STRIP_COUNT): { width: number; height: number } {
  return {
    width: count * LOGO_W + (count - 1) * LOGO_STRIP_GAP + LOGO_STRIP_PADDING * 2,
    height: LOGO_H + LOGO_STRIP_PADDING * 2,
  };
}
