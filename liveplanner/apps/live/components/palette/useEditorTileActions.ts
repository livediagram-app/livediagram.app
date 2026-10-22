// The palette's tile-handler bundle (PaletteTileActions), built from the editor
// context, for a surface outside the palette that places tiles: the search
// panel's non-shape "Add to canvas" results (docs/specs/008-canvas/canvas-and-palette.md "Search panel").
// Running a tile through the SAME handler the palette grid calls
// (tileHandler) is what keeps a search add identical to clicking the tile.
// No mobile-close / draw-armed wrapping: that is the palette's own chrome.

import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { PaletteTileActions } from './PaletteTileGrid';

export function useEditorTileActions(): PaletteTileActions {
  const { addShape, addText, addSticky } = useEditorContext();
  return { addShape, addText, addSticky };
}
