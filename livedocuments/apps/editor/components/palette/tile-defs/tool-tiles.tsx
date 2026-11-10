import {
  lucideMoveRight,
  lucideStickyNote,
  lucideTable,
  lucideType,
  lucideLetterText,
  lucideHeading1,
  lucideHeading2,
  lucidePilcrow,
  lucideQuote,
} from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livedocuments/ui';
import { CodeBlockTileArt } from '@liveworkspace/workbench/components/palette/embed-tile-art';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Tools tiles (Write, Draw and the Build elements filed beside them): one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

// Lucide's sticky-note as its two paths: the note body takes the paper fill, the corner fold does not.
const pathD = (i: number) => {
  const p = lucideStickyNote[i];
  if (p?.t !== 'path') throw new Error('lucideStickyNote: expected a path');
  return p.d;
};
const lucideStickyNotePaths = { body: pathD(0), fold: pathD(1) };

export const TOOL_TILES: PaletteTileDef[] = [
  // --- Tools --------------------------------------------------------------
  // --- Write: the text styles (docs/specs/008-canvas/canvas-and-palette.md "Text styles") ---------------
  {
    id: 'tools:text-title',
    blurb: 'The name at the top of a page',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Title',
    description: 'Title text. Large and bold, left aligned. Double-click to edit.',
    action: { type: 'text', preset: 'title' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideType} />
      </Glyph>
    ),
  },
  {
    id: 'tools:text-subtitle',
    blurb: 'A line under the title',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Subtitle',
    description: 'Subtitle text. A quieter line under a title, left aligned.',
    action: { type: 'text', preset: 'subtitle' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideLetterText} />
      </Glyph>
    ),
  },
  {
    id: 'tools:text-heading',
    blurb: 'Starts a section',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Heading',
    description: 'Heading text. Bold, to start a section, left aligned.',
    action: { type: 'text', preset: 'heading' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideHeading1} />
      </Glyph>
    ),
  },
  {
    id: 'tools:text-subheading',
    blurb: 'Splits a section up',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Subheading',
    description: 'Subheading text. Smaller and bold, within a section, left aligned.',
    action: { type: 'text', preset: 'subheading' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideHeading2} />
      </Glyph>
    ),
  },
  {
    id: 'tools:text-paragraph',
    blurb: 'Body text that wraps',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Paragraph',
    description: 'Paragraph text. Body copy that wraps at its width, left aligned.',
    shortcut: 'T',
    action: { type: 'text', preset: 'paragraph' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucidePilcrow} />
      </Glyph>
    ),
  },
  {
    id: 'tools:text-quote',
    blurb: 'A line worth pulling out',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Quote',
    description: 'Quote text. Italic, to pull a line out of the body, left aligned.',
    dividerAfter: true,
    action: { type: 'text', preset: 'quote' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideQuote} />
      </Glyph>
    ),
  },
  {
    id: 'tools:polygon',
    blurb: 'Straight edges, point by point',
    section: 'tools',
    toolGroup: 'draw',
    label: 'Polygon',
    description: 'Click to place points. Click the start to close, double-click to finish a line.',
    dividerAfter: true,
    action: { type: 'polygon' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={18}>
        {/* Irregular polygon with visible vertex dots: reads as
            "place points", distinct from the fixed shape tiles. */}
        <path d="M4 14 L5.5 6 L12.5 4 L15 10 L10 15 Z" />
        <circle cx="5.5" cy="6" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12.5" cy="4" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="10" cy="15" r="1.4" fill="currentColor" stroke="none" />
      </Glyph>
    ),
  },
  {
    id: 'tools:arrow',
    blurb: 'A connector you place by hand',
    section: 'tools',
    toolGroup: 'draw',
    label: 'Add Arrow',
    description:
      'A connector with a pointer at its end. Change its pointers in the Pointer accordion.',
    shortcut: 'A',
    action: { type: 'arrow' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideMoveRight} />
      </Glyph>
    ),
  },
  // The Line: the arrow tool without its heads (docs/specs/008-canvas/canvas-and-palette.md
  // "Arrows and lines"), the same element, connector and gesture.
  {
    id: 'tools:line',
    blurb: 'A plain line, no pointers',
    section: 'tools',
    toolGroup: 'draw',
    label: 'Line',
    description: 'A line you place by hand, with no pointers. Add them in the Pointer accordion.',
    action: { type: 'arrow', ends: 'none' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M5 19 19 5" />
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
  {
    id: 'tools:table',
    blurb: 'An editable grid of cells',
    section: 'build',
    label: 'Add Table',
    description: 'Editable grid. Double-click a cell to type.',
    dividerAfter: true,
    action: { type: 'table' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideTable} />
      </Glyph>
    ),
  },
  {
    id: 'tools:code-block',
    blurb: 'Syntax-highlighted code card',
    section: 'components',
    label: 'Add Code Block',
    caption: 'Code',
    description: 'Monospace code snippet with syntax highlighting. Double-click to edit.',
    noTint: true,
    action: { type: 'shape', kind: 'code-block' },
    icon: <CodeBlockTileArt />,
  },
];
