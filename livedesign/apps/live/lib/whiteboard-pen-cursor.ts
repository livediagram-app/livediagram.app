// The cursor while a marker is in hand (docs/specs/023-draw-mode/drawing-tools.md "Markers"): a
// crosshair that marks exactly where ink lands, with a nib and a dot of the marker's colour beside
// it.
import type { Appearance } from '@livedesign/document';

/** The SVG image of the marker cursor, drawn for the canvas `appearance`. */
export function penCursorSvg(
  colour: string,
  appearance: Appearance,
): { svg: string; size: number; hotspot: [number, number] } {
  // Black on the light canvas with a white outline; on the dark canvas its exact inverse, white,
  // with no outline.
  const dark = appearance === 'dark';
  const fg = dark ? 'white' : 'black';
  const bg = dark ? 'black' : 'white';
  const body =
    (dark
      ? ''
      : `<path d='M0 4 H8 M4 0 V8' stroke='white' stroke-width='3' stroke-linecap='round' />`) +
    `<path d='M0 4 H8 M4 0 V8' stroke='${fg}' stroke-width='1.5' stroke-linecap='round' />` +
    `<path d='M14 22 L20 16 L23 19 L17 25 Z M20 16 L22 14' stroke='${fg}' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' fill='none' />` +
    `<circle cx='23.5' cy='12.5' r='3' fill='${colour}' stroke='${bg}' stroke-width='1' />`;
  return {
    size: 28,
    hotspot: [4, 4],
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>${body}</svg>`,
  };
}

/** The CSS `cursor` value, with the system crosshair as the fallback. */
export function penCursor(colour: string, appearance: Appearance): string {
  const { svg, hotspot } = penCursorSvg(colour, appearance);
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotspot[0]} ${hotspot[1]}, crosshair`;
}
