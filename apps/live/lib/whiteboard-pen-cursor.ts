// The cursor while a whiteboard pen is in hand (docs/specs/023-whiteboard/whiteboard.md "Pens"): it
// marks exactly where ink lands. Two looks, chosen in the dock's More flyout: a dot of the ink, or
// a crosshair with a nib and a dot of the pen's colour beside it.
import { WHITEBOARD_BOARD, type Appearance } from '@livediagram/document';

export type PenCursorVariant = 'dot' | 'nib-crosshair';
export const PEN_CURSOR_VARIANTS: readonly PenCursorVariant[] = ['dot', 'nib-crosshair'];
export const DEFAULT_PEN_CURSOR: PenCursorVariant = 'nib-crosshair';

// The dot is the stroke's own width on screen, so it shows exactly what the pen will lay down,
// but never smaller than this, so it stays visible zoomed far out.
export const PEN_CURSOR_DOT_MIN_PX = 6;
// Browsers refuse cursor images much past 128 px; the dot stops growing there.
export const PEN_CURSOR_MAX_PX = 128;
const DOT_RIM_PX = 1.5;

type Look = { svg: string; size: number; hotspot: [number, number] };

function look(
  variant: PenCursorVariant,
  colour: string,
  appearance: Appearance,
  strokePx: number,
): Look {
  if (variant === 'dot') {
    // A solid dot at the tip, as wide as the stroke on screen, rimmed outside
    // it in the board's own colour.
    const d = Math.min(
      Math.max(strokePx, PEN_CURSOR_DOT_MIN_PX),
      PEN_CURSOR_MAX_PX - 2 * DOT_RIM_PX - 2,
    );
    // Even, so the hotspot is a whole pixel at the dot's centre.
    const size = 2 * Math.ceil((d + 2 * DOT_RIM_PX + 2) / 2);
    const c = size / 2;
    return {
      size,
      hotspot: [c, c],
      svg:
        `<circle cx='${c}' cy='${c}' r='${d / 2 + DOT_RIM_PX / 2}' fill='none' stroke='${WHITEBOARD_BOARD[appearance]}' stroke-width='${DOT_RIM_PX}' />` +
        `<circle cx='${c}' cy='${c}' r='${d / 2}' fill='${colour}' />`,
    };
  }
  // Black on the light board with a white outline; on the dark board its exact
  // inverse, white, with no outline.
  const dark = appearance === 'dark';
  const fg = dark ? 'white' : 'black';
  const bg = dark ? 'black' : 'white';
  return {
    size: 28,
    hotspot: [4, 4],
    svg:
      (dark
        ? ''
        : `<path d='M0 4 H8 M4 0 V8' stroke='white' stroke-width='3' stroke-linecap='round' />`) +
      `<path d='M0 4 H8 M4 0 V8' stroke='${fg}' stroke-width='1.5' stroke-linecap='round' />` +
      `<path d='M14 22 L20 16 L23 19 L17 25 Z M20 16 L22 14' stroke='${fg}' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' fill='none' />` +
      `<circle cx='23.5' cy='12.5' r='3' fill='${colour}' stroke='${bg}' stroke-width='1' />`,
  };
}

/**
 * The SVG image of a pen cursor, for the cursor itself and for its option in the dock.
 * `strokePx` is the stroke's width on screen (pen width x zoom), which sizes the dot.
 */
export function penCursorSvg(
  variant: PenCursorVariant,
  colour: string,
  appearance: Appearance,
  strokePx = 0,
): Look {
  const { svg, size, hotspot } = look(variant, colour, appearance, strokePx);
  return {
    size,
    hotspot,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${svg}</svg>`,
  };
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** The CSS `cursor` value, with the system crosshair as the fallback. */
export function penCursor(
  variant: PenCursorVariant,
  colour: string,
  appearance: Appearance,
  strokePx = 0,
): string {
  const { svg, hotspot } = penCursorSvg(variant, colour, appearance, strokePx);
  return `url("${svgDataUrl(svg)}") ${hotspot[0]} ${hotspot[1]}, crosshair`;
}
