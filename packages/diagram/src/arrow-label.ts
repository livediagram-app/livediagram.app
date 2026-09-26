// An arrow caption's font size (docs/specs/008-canvas/canvas-and-palette.md); its layout is
// arrow-label-layout.ts.
//
// In the diagram package because BOTH renderers need it: the canvas draws the
// text and its plate from these numbers, and the headless SVG render (exports,
// thumbnails, the MCP render) has to land on the same ones or an exported
// caption is a different size to the one on the board. They used to live only
// in the editor, which is exactly why the export drew every caption at a fixed
// 12px in a fixed near-black, ignoring the size and colour the user had picked.

import type { TextSize } from './index';

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
