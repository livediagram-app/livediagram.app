'use client';

// A catalogue shape's own preview (docs/specs/023-whiteboard/whiteboard.md "Shape slots", More
// shapes): a Shapes flyout kind shows the dock's glyph, every other kind its palette tile's icon.
// Line art in currentColor, so the caller paints it: the board's ink in the search, the dock's own
// text colour on a slot. Fixed 20 px box, so a result or a slot never changes size.

import type { WhiteboardShapeEntry } from '@/lib/whiteboard-shape-catalogue';
import { DOCK_ICON_PX, ShapeGlyph } from './whiteboard-icons';

export function ShapePreview({ entry, colour }: { entry: WhiteboardShapeEntry; colour?: string }) {
  return (
    <span
      aria-hidden
      data-shape-preview={entry.key}
      className="flex shrink-0 items-center justify-center"
      style={{ width: DOCK_ICON_PX, height: DOCK_ICON_PX, color: colour }}
    >
      {entry.dockShape ? <ShapeGlyph id={entry.dockShape} /> : entry.tile?.icon}
    </span>
  );
}
