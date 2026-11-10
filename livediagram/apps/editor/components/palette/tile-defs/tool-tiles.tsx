import { HighlighterIcon, ShapePenIcon } from '@/components/palette/palette-icons';
import {
  lucideMoveRight,
  lucideStickyNote,
  lucideTable,
  lucideType,
} from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livediagram/ui';
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
    id: 'tools:mind-node',
    blurb: 'Tab adds a child, Enter a sibling',
    caption: 'Mind Node',
    section: 'build',
    label: 'Add Mind Node',
    description:
      'A mind-map node. With one selected, Tab adds a child to its right and Enter adds a sibling below, each connected and ready to type into.',
    action: { type: 'shape', kind: 'mind-node' },
    icon: (
      <Glyph size={18} units={24}>
        {/* A parent node with two branches: the picture IS the behaviour. */}
        <rect x="1.5" y="9" width="8" height="6" rx="2" />
        <rect x="15" y="3" width="7.5" height="5" rx="2" />
        <rect x="15" y="16" width="7.5" height="5" rx="2" />
        <path d="M9.5 12h2.5v-6.5H15M12 12v6.5h3" />
      </Glyph>
    ),
  },
  {
    // The org chart (docs/specs/009-elements/org-chart.md): a person root in the Downward flow; Tab adds a report.
    id: 'tools:org-chart',
    blurb: 'Tab adds a report, Enter a peer',
    caption: 'Org Chart',
    section: 'build',
    label: 'Add Org Chart',
    description:
      'Org chart. A person with a name and role; with it selected, Tab adds a report below and Enter a peer beside it.',
    action: { type: 'shape', kind: 'mind-node', variant: 'org-chart' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="8" y="2.5" width="8" height="5" rx="1.5" />
        <rect x="2" y="16.5" width="8" height="5" rx="1.5" />
        <rect x="14" y="16.5" width="8" height="5" rx="1.5" />
        <path d="M12 7.5V12M6 16.5V12h12v4.5" />
      </Glyph>
    ),
  },
  {
    // Flowchart (docs/specs/009-elements/flowchart.md): drops a Start that IS a chart; the steps grow
    // from it and the chart lays itself out.
    id: 'tools:flowchart',
    blurb: 'Tab adds the next step',
    caption: 'Flowchart',
    section: 'build',
    label: 'Add Flowchart',
    description:
      'A flowchart that lays itself out. With a step selected, Tab adds the next step and Enter a parallel one; change any step to a Decision, Input / Output and more.',
    action: { type: 'component', kind: 'flowchart' },
    icon: (
      <Glyph size={18} units={24}>
        {/* A start, a decision and two exits: the picture IS the behaviour. */}
        <rect x="7" y="1.5" width="10" height="4.5" rx="2.25" />
        <path d="M12 9.5l4 3.5-4 3.5-4-3.5z" />
        <path d="M12 6v3.5M8 13H4.5v4.5M16 13h3.5v4.5" />
        <rect x="1.5" y="17.5" width="6" height="5" rx="0.5" />
        <rect x="16.5" y="17.5" width="6" height="5" rx="0.5" />
      </Glyph>
    ),
  },
  {
    // The sequence diagram (docs/specs/009-elements/sequence-diagram.md): participants and messages, laid out as UML.
    id: 'tools:sequence',
    blurb: 'Who calls whom, in order',
    caption: 'Sequence',
    section: 'build',
    label: 'Add Sequence Diagram',
    description:
      'Sequence diagram. Participants side by side and the messages between them in order; add a message by typing a row and the diagram lays itself out.',
    action: { type: 'shape', kind: 'sequence' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2" y="2" width="6" height="4" rx="1" />
        <rect x="16" y="2" width="6" height="4" rx="1" />
        <path d="M5 6v16M19 6v16" strokeDasharray="2 2" />
        <path d="M5 10h13M15.5 8l2.5 2-2.5 2" />
        <path d="M19 16H6M8.5 14 6 16l2.5 2" strokeDasharray="2 1.5" />
      </Glyph>
    ),
  },
  {
    // Page (docs/specs/009-elements/page-element.md). Sits first in Write: it is the largest writing
    // surface, and the group reads shortest-to-longest from there. Called
    // Page, not Document, so the palette and the selection toolbar agree —
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
  {
    id: 'tools:text',
    blurb: 'A free-standing text label',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Text',
    description: 'Text element. Double-click to edit.',
    shortcut: 'T',
    dividerAfter: true,
    action: { type: 'text' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideType} />
      </Glyph>
    ),
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
