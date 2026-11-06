// livehuddle's selection-mode glyphs (docs/specs/009-elements/mode-button.md): the shared drawings
// (@liveworkspace/icons/mode-glyphs). Isometric, the one mode only livehuddle drew, left with the presenting tools
// (docs/specs/002-project-scope/not-in-livehuddle.md). The palette, the Mode button face and the export all read this
// table, so an exported Mode button shows the same glyph as the canvas.
import {
  MODE_GLYPHS as SHARED_MODE_GLYPHS,
  type ModeGlyph,
} from '@liveworkspace/icons/mode-glyphs';

export type { ModeGlyph };

export const MODE_GLYPHS: Readonly<Record<string, ModeGlyph>> = SHARED_MODE_GLYPHS;
