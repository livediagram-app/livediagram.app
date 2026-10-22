// The three markers as palette tiles (docs/specs/023-draw-mode/drawing-tools.md "Markers"), for a
// logo page's Draw and the Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search:
// every element type"), each with the colour and width this person gave it. A tile is that marker
// as it is now, picked up through onBeginMarker.
import { penColourCss, type CanvasSurface } from '@livedesign/document';
import { PenGlyph } from '@/components/canvas/whiteboard/whiteboard-icons';
import {
  colourLabel,
  PEN_NAMES,
  penAdjustsColour,
  widthLabel,
  type WhiteboardPrefs,
} from '@/lib/whiteboard-prefs';
import type { PaletteTileDef } from './palette-tile-defs';

/** One tile per marker, in palette order. `surface` picks a stock colour's version
 *  for the canvas; Marker 1's ink draws in the tile's own text colour. */
export function markerTiles(prefs: WhiteboardPrefs, surface: CanvasSurface): PaletteTileDef[] {
  return prefs.pens.map((pen) => {
    const name = PEN_NAMES[pen.id];
    const width = widthLabel(pen.width);
    const look = penAdjustsColour(pen) ? `${colourLabel(pen.colour)}, ${width}` : width;
    return {
      id: `draw:marker-${pen.id}`,
      section: 'tools',
      toolGroup: 'draw',
      label: name,
      caption: name,
      // "marker pen" so the words someone brings find it.
      blurb: `A marker pen (${look}).`,
      description: `${name}, in its colour and width (${look}). It stays in your hand until you pick another tool or press Escape.`,
      // Its own colour, never the theme's tint.
      noTint: true,
      action: { type: 'marker', penId: pen.id, colour: pen.colour, width: pen.width },
      icon: (
        <PenGlyph colour={penColourCss(pen.colour, surface, 'currentColor')} width={pen.width} />
      ),
    };
  });
}
