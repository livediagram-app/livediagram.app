'use client';

// A catalogue shape's own preview (docs/specs/023-draw-mode/draw-mode.md "Shape slots", More
// shapes): a Shapes flyout kind shows the dock's glyph, every other kind its palette tile's icon.
// Line art in currentColor, so the caller paints it: the board's ink in the search, the dock's own
// text colour on a slot. Fixed 20 px box, so a result or a slot never changes size.

import type { WhiteboardShapeEntry } from '@/lib/whiteboard-shape-catalogue';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import { DOCK_ICON_PX, ShapeGlyph, StickyGlyph } from './whiteboard-icons';

// The key that picks a catalogue shape from anywhere on the board, if it has one (R, O, D, C, L, A,
// and N for the sticky note): shown on its button or entry and in aria-keyshortcuts.
export function shapeShortcut(entry: WhiteboardShapeEntry): string | undefined {
  if (entry.dockShape) return WHITEBOARD_TOOL_KEYS[entry.dockShape];
  return entry.glyph === 'sticky' ? WHITEBOARD_TOOL_KEYS.sticky : undefined;
}

export function ShapePreview({ entry, colour }: { entry: WhiteboardShapeEntry; colour?: string }) {
  return (
    <span
      aria-hidden
      data-shape-preview={entry.key}
      className="flex shrink-0 items-center justify-center"
      style={{ width: DOCK_ICON_PX, height: DOCK_ICON_PX, color: colour }}
    >
      {entry.dockShape ? (
        <ShapeGlyph id={entry.dockShape} />
      ) : entry.glyph === 'sticky' ? (
        <StickyGlyph />
      ) : (
        entry.tile?.icon
      )}
    </span>
  );
}
