import { HighlighterIcon, ShapePenIcon } from '@/components/palette/palette-icons';
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
import { Glyph, Prims } from '@livedesign/ui';
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
  {
    // Page (docs/specs/009-elements/page-element.md). Sits first in Write: it is the largest writing
    // surface, and the group reads shortest-to-longest from there. Called
    // Page, not Design, so the palette and the selection toolbar agree —
    // and so it never collides with the Shapes tab's flowchart "document".
    id: 'tools:page',
    blurb: 'A paper-shaped page for prose',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Page',
    caption: 'Page',
    description: 'A paper-sized surface for rich text. Double-click to write.',
    action: { type: 'shape', kind: 'page' },
    icon: (
      <Glyph size={18} units={18}>
        <rect x="3.5" y="1.5" width="11" height="15" rx="1.5" />
        <path d="M6 5.5h6M6 8.5h6M6 11.5h3.5" />
      </Glyph>
    ),
  },
  // --- Write: the text styles (docs/specs/008-canvas/canvas-and-palette.md "Text styles") ---------------
  {
    id: 'tools:text-title',
    blurb: 'The name at the top of a screen',
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
    action: { type: 'text', preset: 'quote' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideQuote} />
      </Glyph>
    ),
  },
  {
    id: 'tools:text-caption',
    blurb: 'Small print under a picture',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Caption',
    description: 'Caption text. Small print for a picture, a field or a footer, left aligned.',
    dividerAfter: true,
    action: { type: 'text', preset: 'caption' },
    icon: (
      // A picture with its line of small print beneath, on Lucide's 24 grid.
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="3" width="18" height="12" rx="2" />
        <path d="m3 13 5-4.5 4 3.5 3-2.5 6 4.5" />
        <path d="M6 19.5h12" />
      </Glyph>
    ),
  },
  // The Path tool as a logo page's Pen (docs/specs/007-editor/logo-pages.md "The Logo palette",
  // docs/specs/023-draw-mode/path-tool.md), in a logo page's Draw only.
  {
    id: 'logo:pen',
    blurb: 'Click for corners, drag for curves',
    section: 'logo',
    caption: 'Pen',
    label: 'Pen',
    description:
      'Draw a precise path: click to place corners, drag to pull out curves, and close it on its first point.',
    action: { type: 'path' },
    icon: <ShapePenIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:pencil',
    blurb: 'Sketch a stroke, left as drawn',
    section: 'tools',
    toolGroup: 'draw',
    caption: 'Freehand',
    label: 'Freehand Pencil',
    description:
      'Sketch a freehand stroke, kept exactly as you drew it. Drag to draw; release near the start to close the shape.',
    shortcut: 'P',
    action: { type: 'freehand' },
    icon: (
      <Glyph size={18} units={18}>
        {/* Diagonal pencil. Body angled bottom-left to top-right, with a
            separated tip + eraser segment so the silhouette reads as
            "pencil" even at the 18 px palette size. Pairs with the cursor
            glyph (also a diagonal nib) so the tool's two visual surfaces
            stay in sync. */}
        <path d="M2 16 L6 12" />
        <path d="M5 13 L12 6 L14 8 L7 15 Z" />
        <path d="M12 6 L15 3 L17 5 L14 8" />
        <path d="M2 16 L5 13" />
      </Glyph>
    ),
  },
  {
    id: 'tools:shape-pen',
    blurb: 'A rough shape snaps to the real one',
    section: 'tools',
    toolGroup: 'draw',
    caption: 'Shape Pen',
    label: 'Shape Pen',
    description:
      'Draw a rough circle, square, triangle or line and it converts to the real shape on release.',
    shortcut: '6',
    action: { type: 'shape-pen' },
    icon: <ShapePenIcon size={TILE_GLYPH_PX} />,
  },
  // The marker (docs/specs/008-canvas/highlighter.md): the third pen, one stroke per pick like the
  // other two. No shortcut: only the common flowchart vocabulary gets letters.
  {
    id: 'tools:highlighter',
    blurb: 'A wide translucent marker stroke',
    section: 'tools',
    toolGroup: 'draw',
    label: 'Highlighter',
    description: 'A wide translucent yellow marker. Drag to call attention to a region.',
    dividerAfter: true,
    action: { type: 'highlighter' },
    icon: <HighlighterIcon size={TILE_GLYPH_PX} />,
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
