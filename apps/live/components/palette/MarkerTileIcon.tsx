'use client';

import { useContext } from 'react';
import { penColourCss } from '@livediagram/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { PenGlyph } from '@/components/canvas/whiteboard/whiteboard-icons';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { DEFAULT_WHITEBOARD_PREFS, type WhiteboardPenId } from '@/lib/whiteboard-prefs';

// A marker's Draw tile icon (docs/specs/023-whiteboard/whiteboard.md "The markers on diagram tabs"):
// the dock's own marker glyph in that marker's current colour and width, so the three tiles read
// apart at a glance and change with the pen. The pens are the editor's device-local ones; outside
// the editor (a test, a preview) the tile shows the pens as they start. Marker 1's ink is the
// tile's own colour, as the theme's ink is on the canvas.
export function MarkerTileIcon({ pen, size = 14 }: { pen: WhiteboardPenId; size?: number }) {
  const editor = useContext(EditorContext);
  const { appearance } = useAppearance();
  const pens = editor?.whiteboardDock.prefs.pens ?? DEFAULT_WHITEBOARD_PREFS.pens;
  const held = pens.find((p) => p.id === pen) ?? DEFAULT_WHITEBOARD_PREFS.pens[0]!;
  return (
    <PenGlyph
      colour={penColourCss(held.colour, appearance, 'currentColor')}
      width={held.width}
      size={size}
    />
  );
}
