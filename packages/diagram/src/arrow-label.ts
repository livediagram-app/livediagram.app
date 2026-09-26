// An arrow caption's size and footprint (docs/specs/008-canvas/canvas-and-palette.md).
//
// In the diagram package because BOTH renderers need it: the canvas draws the
// text and its plate from these numbers, and the headless SVG render (exports,
// thumbnails, the MCP render) has to land on the same ones or an exported
// caption is a different size to the one on the board. They used to live only
// in the editor, which is exactly why the export drew every caption at a fixed
// 12px in a fixed near-black, ignoring the size and colour the user had picked.

import type { TextSize } from './index';

const LABEL_HEIGHT_PX = 16;
const LABEL_CHAR_WIDTH_PX = 7;

// Arrow-label font size by preset, mirroring the boxed-label scale
// (sm 12 / md 14 / lg 20 / scale 18). Default 'sm' keeps the historic
// 12px label size for arrows authored before the field existed.
export function arrowLabelFontSize(size: TextSize | undefined): number {
  switch (size) {
    case 'lg':
      return 20;
    case 'md':
      return 14;
    case 'scale':
      return 18;
    default:
      return 12;
  }
}

// Approximate label dimensions for collision avoidance and for the caption
// plate. The rendered SVG <text> doesn't have a stable width until paint, so
// we estimate from the text length. The numbers are conservative: slightly
// overshooting means the placement leaves a comfortable gap rather than
// colliding.
export function arrowLabelSize(text: string, fontSize = 12): { width: number; height: number } {
  const trimmed = text || ' ';
  const scale = fontSize / 12;
  return {
    width: Math.max(24, trimmed.length * LABEL_CHAR_WIDTH_PX * scale) + 8,
    height: LABEL_HEIGHT_PX * scale + 4,
  };
}
