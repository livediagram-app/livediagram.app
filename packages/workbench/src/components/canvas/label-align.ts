// How a label's alignment lays out (docs/specs/008-canvas/canvas-and-palette.md): the flex placement of its block and
// the text-align of its lines. One copy for every editor; each editor's components/canvas/label-style re-exports it.
import type { TextAlignX, TextAlignY } from '@liveworkspace/model-core/basics';

export const ALIGN_ITEMS: Record<TextAlignY, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

export const TEXT_ALIGN: Record<TextAlignX, 'left' | 'center' | 'right'> = {
  left: 'left',
  center: 'center',
  right: 'right',
};
