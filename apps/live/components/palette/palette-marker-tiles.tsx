// Draw mode's markers as palette tiles, for the Toolbar strip's Search in the other modes
// (docs/specs/007-editor/toolbar-layout.md "Search: every element type"). Draw mode has no palette:
// its pens live in the whiteboard dock (docs/specs/023-draw-mode/draw-mode.md "Pens"), each with the
// colour and width this person gave it. A tile here is that pen as it is now, picked up exactly as
// the dock picks it up (onBeginMarker), so a stroke drawn from it is the dock's stroke.
import { penColourCss, type CanvasSurface } from '@livediagram/document';
import { PenGlyph } from '@/components/canvas/whiteboard/whiteboard-icons';
import {
  colourLabel,
  PEN_NAMES,
  penAdjustsColour,
  widthLabel,
  type WhiteboardPrefs,
} from '@/lib/whiteboard-prefs';
import type { PaletteTileDef } from './palette-tile-defs';

/** One tile per marker, left to right as in the dock. `surface` picks a stock colour's version
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
      // "marker pen whiteboard" so the words someone brings from Draw mode find it.
      blurb: `A whiteboard marker pen from Draw mode (${look}).`,
      description: `${name} from Draw mode, in its colour and width (${look}). It stays in your hand until you pick another tool or press Escape.`,
      // Its own colour, never the theme's tint.
      noTint: true,
      action: { type: 'marker', penId: pen.id, colour: pen.colour, width: pen.width },
      icon: (
        <PenGlyph colour={penColourCss(pen.colour, surface, 'currentColor')} width={pen.width} />
      ),
    };
  });
}
