// livediagram's selection-mode glyphs (docs/specs/009-elements/mode-button.md): the shared drawings
// (@liveworkspace/icons/mode-glyphs) plus the modes only livediagram has. Isometric is one
// (docs/specs/008-canvas/isometric-view.md), so its cube lives here. The palette, the Mode button face and the
// export all read this table, so an exported Mode button shows the same glyph as the canvas.
import {
  MODE_GLYPHS as SHARED_MODE_GLYPHS,
  type ModeGlyph,
} from '@liveworkspace/icons/mode-glyphs';

export type { ModeGlyph };

export const MODE_GLYPHS: Readonly<Record<string, ModeGlyph>> = {
  ...SHARED_MODE_GLYPHS,
  // A cube: the top rhombus and the two front faces.
  isometric: {
    units: 16,
    prims: [
      { t: 'path', d: 'M8 1.8l5.2 3v0L8 7.8 2.8 4.8z' },
      { t: 'path', d: 'M2.8 4.8v5.4L8 13.2v-5.4' },
      { t: 'path', d: 'M13.2 4.8v5.4L8 13.2' },
    ],
  },
};
