import { lucideStickyNote, lucideType } from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livehuddle/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Write tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

// Lucide's sticky-note as its two paths: the note body takes the paper fill, the corner fold does not.
const pathD = (i: number) => {
  const p = lucideStickyNote[i];
  if (p?.t !== 'path') throw new Error('lucideStickyNote: expected a path');
  return p.d;
};
const lucideStickyNotePaths = { body: pathD(0), fold: pathD(1) };

export const WRITE_TILES: PaletteTileDef[] = [
  {
    id: 'tools:text',
    blurb: 'A free-standing text label',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Text',
    description: 'Text element. Double-click to edit.',
    shortcut: 'T',
    action: { type: 'text' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideType} />
      </Glyph>
    ),
  },
  {
    id: 'tools:sticky',
    blurb: 'A coloured note card',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Sticky Note',
    caption: 'Note',
    description: 'Sticky note for short annotations.',
    shortcut: 'N',
    noTint: true,
    action: { type: 'sticky' },
    icon: (
      // The note keeps its paper colour (noTint): Lucide sticky-note, body filled.
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d={lucideStickyNotePaths.body} fill="rgb(254 243 199)" />
        <path d={lucideStickyNotePaths.fold} />
      </Glyph>
    ),
  },
];
