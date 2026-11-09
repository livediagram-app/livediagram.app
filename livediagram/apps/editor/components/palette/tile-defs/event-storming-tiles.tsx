import { headlineCase } from '@livediagram/api-schema';
import { EVENT_STORMING_NOTES } from '@livediagram/document';
import { NoteTileArt } from '@/components/palette/palette-tile-art';
import type { PaletteTileDef } from './types';

// The Event Storming tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const EVENT_STORMING_TILES: PaletteTileDef[] = [
  // The Event Storming notation (docs/specs/021-event-storming/event-storming.md): one tile per note kind, derived
  // from the EVENT_STORMING_NOTES catalogue in @livediagram/document so the
  // palette can never drift from the colours the template builder (and any
  // future consumer) uses. Each tile arms the ordinary sticky gesture with
  // the kind's canonical fill + kind riding the intent (the kind routes the
  // note onto its stage's layer on event-storming boards). Its own top-level
  // category in the Structure band — promoted out of the Write accordion.
  // Tile ids keep their historical 'tools:' prefix: ids are stable, since palette layouts and
  // search address tiles by them.
  ...EVENT_STORMING_NOTES.map((note): PaletteTileDef => ({
    id: `tools:es-${note.kind}`,
    section: 'event-storming',
    label: `Add ${headlineCase(note.label)} Note`,
    caption: headlineCase(note.label),
    blurb: note.blurb,
    description: `Event storming: ${note.blurb.charAt(0).toLowerCase()}${note.blurb.slice(1)}.`,
    noTint: true,
    // The notation, then the Hotspot: a problem marker rather than a part of the model.
    ...(note.kind === 'aggregate' ? { dividerAfter: true as const } : {}),
    action: { type: 'sticky', fill: note.fill, esKind: note.kind },
    // The glyph mirrors the note's stationery silhouette (docs/specs/021-event-storming/event-storming.md): a
    // standard square, a WIDE rect for the prose kinds, a small square for
    // the actor — so the row's picture says the shape before the blurb does.
    icon: <NoteTileArt size={note.size} fill={note.fill} />,
  })),
];
