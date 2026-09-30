// The cursor while a whiteboard pen is in hand (docs/specs/023-whiteboard/whiteboard.md "Pens"): it
// marks exactly where ink lands. Two looks, chosen in the dock's More flyout: a dot of the ink, or
// a crosshair with a nib and a dot of the pen's colour beside it.
import { WHITEBOARD_BOARD, type Appearance } from '@livediagram/document';

export type PenCursorVariant = 'dot' | 'nib-crosshair';
export const PEN_CURSOR_VARIANTS: readonly PenCursorVariant[] = ['dot', 'nib-crosshair'];
export const DEFAULT_PEN_CURSOR: PenCursorVariant = 'nib-crosshair';

type Look = { svg: string; size: number; hotspot: [number, number] };

function look(variant: PenCursorVariant, colour: string, appearance: Appearance): Look {
  if (variant === 'dot') {
    // A solid dot at the tip, rimmed in the board's own colour.
    return {
      size: 16,
      hotspot: [8, 8],
      svg: `<circle cx='8' cy='8' r='3.25' fill='${colour}' stroke='${WHITEBOARD_BOARD[appearance]}' stroke-width='1.5' />`,
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

/** The SVG image of a pen cursor, for the cursor itself and for its option in the dock. */
export function penCursorSvg(
  variant: PenCursorVariant,
  colour: string,
  appearance: Appearance,
): Look {
  const { svg, size, hotspot } = look(variant, colour, appearance);
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
): string {
  const { svg, hotspot } = penCursorSvg(variant, colour, appearance);
  return `url("${svgDataUrl(svg)}") ${hotspot[0]} ${hotspot[1]}, crosshair`;
}
