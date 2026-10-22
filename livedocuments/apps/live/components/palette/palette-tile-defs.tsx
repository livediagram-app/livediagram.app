import { BADGE_PRESET_TILES, CARD_PRESET_TILES } from './palette-element-presets';
import { BadgePresetGlyph } from './BadgePresetGlyph';
import { badgePresetFace } from '@livedocuments/document';
import type { EmbedProvider } from '@livedocuments/document';

import type { ComponentKind, ShapeKind } from '@livedocuments/document';
import {
  lucideCircle,
  lucideDiamond,
  lucideFileText,
  lucideGlobe,
  lucideImage,
  lucideAppWindow,
  lucideMoveRight,
  lucideSquare,
  lucideStickyNote,
  lucideTable,
  lucideType,
} from '@livedocuments/icons/lucide';
import { Glyph, Prims } from '@livedocuments/ui';
import { WIREFRAME_TILES } from './palette-wireframe-tiles';
import { tileCaption } from './tile-caption';

import {
  CodeBlockTileArt,
  FigmaTileArt,
  LoomTileArt,
  VimeoTileArt,
  YouTubeTileArt,
} from '@/components/palette/palette-tile-art';

// Every palette tile glyph is drawn at this size (docs/specs/004-interface-design/iconography.md), so a strip of
// tiles reads as one set.
export const TILE_GLYPH_PX = 18;

// Lucide's sticky-note as its two paths: the note body takes the paper fill, the corner fold does not.
const pathD = (i: number) => {
  const p = lucideStickyNote[i];
  if (p?.t !== 'path') throw new Error('lucideStickyNote: expected a path');
  return p.d;
};
const lucideStickyNotePaths = { body: pathD(0), fold: pathD(1) };

// The shared palette tile catalogue: every creation tile across the categories as one data
// entry — label, glyph, tinting flags, and an action descriptor that PaletteTileGrid maps to the
// editor's add-handlers. Every category body, Popular, the Toolbar strip and the Search panel
// render from this one catalogue (arranged per mode by palette-layouts.ts), so a tile is defined
// once and can never drift between the places it shows.
//
// Pure data: a flat catalogue, exempt from the file-size target (see
// AGENTS.md) — extend it in place rather than splitting it.

// 'icons' and 'technology' exist only on DYNAMIC tiles (individual catalogue
// icons on the Toolbar strip, palette-dynamic-tiles.tsx) — no PALETTE_TILES entry carries
// them, so tilesInSection never returns them.
export type PaletteTileSection =
  | 'shapes'
  // Structure (docs/specs/010-palette/build-category.md): the elements you lay a diagram OUT with rather than
  // draw on it — a frame, a stack, a table, a Sankey. They were
  // scattered across Write, Draw, Data and Components, filed by what they look
  // like; what they have in common is that they hold other work.
  | 'build'
  // A logo page's drawing tools (docs/specs/007-editor/logo-pages.md "The Logo palette").
  | 'logo'
  // A screen's parts (docs/specs/007-editor/wireframe-pages.md "The Elements palette").
  | 'wireframe'
  | 'tools'
  | 'data'
  | 'media'
  | 'components'
  // Concept graphics (docs/specs/009-elements/concept-graphics.md).
  | 'concepts'
  | 'devices'
  | 'stickers'
  | 'icons'
  | 'technology';

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
type PaletteTileAction =
  | {
      type: 'shape';
      kind: ShapeKind;
      // A creation-time variant of the kind (packages/document shape-variants.ts): the Callout card, a Funnel.
      variant?: string;
    }
  | { type: 'text' }
  // An opener (palette-openers): stands for a category, or one group of a catalogue, and opens it; places nothing.
  | { type: 'open'; category: string; group?: string }
  | { type: 'video'; provider?: EmbedProvider }
  | { type: 'sticker'; stickerId: string }
  | { type: 'polygon' }
  // `ends`: the Line tile's `'none'`; the Arrow tile leaves it to the tool's pointer at its end.
  | { type: 'arrow'; ends?: import('@livedocuments/document').ArrowEnds }
  | { type: 'sticky' }
  | { type: 'table' }
  | { type: 'image' }
  | { type: 'link-card' }
  | { type: 'component'; kind: ComponentKind }
  // Dynamic icon tiles (palette-dynamic-tiles.tsx): a single line-art /
  // Technology catalogue entry as a tile.
  | { type: 'icon'; iconId: string }
  | { type: 'tech-icon'; iconId: string };

// Themed sub-groups within the Tools section (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"):
// the Tools tab renders one labelled grid per group instead of a flat
// sixteen-tile wall. Group membership is metadata on the tile — ids stay
// stable, so palette layouts and search are untouched.
export type ToolGroupId = 'write' | 'draw';

// Display order, headings, and a one-line "what's in here" for the Tools tab's
// groups. The description is what the category tile's hover card says: a count
// ("6 tools") tells you nothing you can act on, whereas naming the contents
// answers the actual question — is the thing I want in this box?
// Label + membership only. These groups render through PaletteToolRows /
// PaletteTileGroup, each carrying its own title, and a title shows a label
// rather than a blurb —
// the browsable category descriptions live in PALETTE_CATEGORIES.
export const TOOL_GROUPS: { id: ToolGroupId; label: string }[] = [
  {
    id: 'write',
    label: 'Write',
  },
  {
    // Split back out from a combined "Write & Draw" (docs/specs/010-palette/palette-top-level-categories.md): once both were
    // one click from the category picker rather than two inside Tools, the
    // pairing bought nothing and the combined list ran to eight rows.
    id: 'draw',
    label: 'Draw',
  },
];

export type PaletteTileDef = {
  // Stable id: palette layouts (palette-layouts.ts) and the Search panel address tiles by it, so
  // renaming one means renaming it there too.
  id: string;
  section: PaletteTileSection;
  // Which Tools-tab group the tile renders under. Required exactly when
  // `section === 'tools'` (a test pins this); meaningless elsewhere.
  toolGroup?: ToolGroupId;
  // Collapses this tile into a named group inside its category, rather than
  // showing it as a top-level row (docs/specs/009-elements/embed-providers.md). 'embed' = the Media tab's embed
  // providers; 'web' = the Components tab's website composites.
  tileGroup?: 'embed' | 'web';
  label: string;
  // Overrides the caption derived from `label` where that runs too long
  // for the tile (see IconButton).
  caption?: string;
  description: string;
  // A short line rendered UNDER the tile in list layouts (the Tools tab).
  // Separate from `description`, which is the fuller hover card / search text:
  // this one has to fit a palette-width row, so it is a clause, not a
  // sentence, and it says what the tool IS rather than how to use it.
  blurb?: string;
  icon: React.ReactNode;
  shortcut?: string;
  // IconButton flags (docs/specs/008-canvas/canvas-and-palette.md theme tinting): `filled` tiles preview the
  // theme's element fill; `noTint` tiles keep fixed colours.
  filled?: boolean;
  noTint?: boolean;
  // Tile only renders when the editor supplies onAddImage (image uploads
  // available) — the Image / Avatar / Hero / Header tiles.
  needsImage?: boolean;
  // Greyed out with its reason (no press, no drag, the reason in its hover card).
  disabled?: { reason: string };
  // Ends a group of related tiles in its category: a fixed divider follows it on the Toolbar
  // strip, between it and the next tile shown (docs/specs/007-editor/toolbar-layout.md "Fixed
  // dividers"). Never more than two per category.
  dividerAfter?: true;
  // Presets of this tile's element (docs/specs/009-elements/card.md "Card presets"): on the Toolbar strip the tile is
  // drawn as an opener (its glyph with a caret) whose popover offers them; elsewhere the tile places its own element.
  variants?: readonly PaletteTileDef[];
  // The line under the presets popover's title: what can still change after one is placed.
  variantsHint?: string;
  action: PaletteTileAction;
};

export const PALETTE_TILES: PaletteTileDef[] = [
  // --- Shapes -------------------------------------------------------------
  {
    id: 'shapes:square',
    section: 'shapes',
    label: 'Add Square',
    description: 'Drop a new square shape on the canvas.',
    shortcut: 'R',
    filled: true,
    action: { type: 'shape', kind: 'square' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideSquare} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:circle',
    section: 'shapes',
    label: 'Add Circle',
    description: 'Drop a new circle shape on the canvas.',
    shortcut: 'O',
    filled: true,
    action: { type: 'shape', kind: 'circle' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideCircle} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:diamond',
    section: 'shapes',
    label: 'Add Diamond',
    description: 'Diamond. Decision node.',
    shortcut: 'D',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'diamond' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideDiamond} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:cylinder',
    section: 'shapes',
    label: 'Add Cylinder',
    description: 'Cylinder. Flowchart database / storage.',
    shortcut: 'C',
    filled: true,
    action: { type: 'shape', kind: 'cylinder' },
    icon: (
      <Glyph size={18} units={18}>
        <path d="M3 5 L3 13 A6 1.8 0 0 0 15 13 L15 5" />
        <ellipse cx="9" cy="5" rx="6" ry="1.8" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:parallelogram',
    section: 'shapes',
    label: 'Add Parallelogram',
    description: 'Parallelogram. Flowchart input / output.',
    shortcut: 'G',
    filled: true,
    action: { type: 'shape', kind: 'parallelogram' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,3 16,3 13,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:hexagon',
    section: 'shapes',
    label: 'Add Hexagon',
    description: 'Hexagon. Preparation / milestone.',
    filled: true,
    action: { type: 'shape', kind: 'hexagon' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,3 13,3 16,9 13,15 5,15 2,9" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:document',
    section: 'shapes',
    label: 'Add Document',
    description: 'Document shape. Flowchart output.',
    filled: true,
    action: { type: 'shape', kind: 'document' },
    icon: (
      <Glyph size={18} units={18}>
        <path d="M3 3 L15 3 L15 13 C13 15.3 11 11.8 9 13.5 C7 15.3 5 11.8 3 13.5 Z" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:stadium',
    section: 'shapes',
    label: 'Add Stadium',
    description: 'Stadium shape. Flowchart Start / End.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'stadium' },
    icon: (
      <Glyph size={18} units={18}>
        <rect x="1.5" y="6" width="15" height="6" rx="3" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:cloud',
    section: 'shapes',
    label: 'Add Cloud',
    description: 'Cloud. Networking / architecture.',
    filled: true,
    action: { type: 'shape', kind: 'cloud' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <path d="M5.5 13.5 C3.2 13.5 2 11.7 3.4 10.2 C2.4 8.7 4 7 5.5 7.7 C6 5.4 9.4 5.2 9.9 7.6 C11.9 6.7 13.5 8.6 12.2 10.2 C13.5 11.2 12.6 13.5 10.8 13.5 Z" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:triangle',
    section: 'shapes',
    label: 'Add Triangle',
    description: 'Triangle. A basic shape.',
    filled: true,
    action: { type: 'shape', kind: 'triangle' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="9,3 16,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:trapezoid',
    section: 'shapes',
    label: 'Add Trapezoid',
    description: 'Trapezoid. Flowchart manual operation.',
    filled: true,
    action: { type: 'shape', kind: 'trapezoid' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,4 13,4 16,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:star',
    section: 'shapes',
    label: 'Add Star',
    description: 'Star. Highlight or rating.',
    filled: true,
    action: { type: 'shape', kind: 'star' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="9,1.5 10.8,6.6 16.1,6.7 11.9,9.9 13.4,15.1 9,12 4.6,15.1 6.1,9.9 1.9,6.7 7.2,6.6" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:speech-bubble',
    section: 'shapes',
    label: 'Add Speech Bubble',
    caption: 'Bubble',
    description: 'Speech bubble. A callout with a tail.',
    filled: true,
    action: { type: 'shape', kind: 'speech-bubble' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <path d="M4 3 H14 a2 2 0 0 1 2 2 V10 a2 2 0 0 1 -2 2 H7 L4.5 15.5 L5.5 12 H4 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z" />
      </Glyph>
    ),
  },
  // --- Tools --------------------------------------------------------------
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
  {
    id: 'tools:checklist',
    blurb: 'Tickable to-do rows',
    section: 'components',
    label: 'Add Checklist',
    caption: 'Checklist',
    description: 'Checkable to-do rows. Tick boxes on the canvas; edit rows from the menu.',
    filled: true,
    action: { type: 'shape', kind: 'checklist' },
    icon: (
      <Glyph size={18} units={18}>
        <rect x="2.5" y="3" width="4" height="4" rx="1" />
        <path d="M3.7 5 L4.6 5.9 L6 4.3" strokeWidth="1.2" />
        <path d="M9 5 H15.5" />
        <rect x="2.5" y="10.5" width="4" height="4" rx="1" />
        <path d="M9 12.5 H15.5" />
      </Glyph>
    ),
  },
  {
    id: 'tools:image',
    blurb: 'Place an uploaded picture',
    section: 'media',
    label: 'Add Image',
    description: 'Drop an image placeholder + pick / upload a file.',
    shortcut: '9',
    noTint: true,
    needsImage: true,
    action: { type: 'image' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideImage} />
      </Glyph>
    ),
  },
  {
    // The tab window (docs/specs/009-elements/tab-window.md): another tab of the document, live, fitted inside it.
    id: 'media:tab-window',
    blurb: 'Another tab, live',
    caption: 'Tab Window',
    section: 'media',
    label: 'Add Tab Window',
    description:
      'Tab Window. Shows another tab of this document, live and fitted inside it, so a slide stays up to date with the diagram it shows.',
    dividerAfter: true,
    action: { type: 'shape', kind: 'tab-window' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideAppWindow} />
      </Glyph>
    ),
  },
  {
    id: 'media:embed-youtube',
    tileGroup: 'embed',
    blurb: 'A YouTube video',
    caption: 'YouTube',
    section: 'media',
    label: 'Add YouTube Embed',
    description:
      'Embeds a YouTube link on the canvas. Double-click it to set the link; it loads when you press play.',
    action: { type: 'video', provider: 'youtube' },
    icon: <YouTubeTileArt />,
  },
  {
    id: 'media:embed-vimeo',
    tileGroup: 'embed',
    blurb: 'A Vimeo video',
    caption: 'Vimeo',
    section: 'media',
    label: 'Add Vimeo Embed',
    description:
      'Embeds a Vimeo link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'vimeo' },
    icon: <VimeoTileArt />,
  },
  {
    id: 'media:embed-loom',
    tileGroup: 'embed',
    blurb: 'A Loom recording',
    caption: 'Loom',
    section: 'media',
    label: 'Add Loom Embed',
    description:
      'Embeds a Loom link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'loom' },
    icon: <LoomTileArt />,
  },
  {
    id: 'media:embed-figma',
    tileGroup: 'embed',
    blurb: 'A Figma file or prototype',
    caption: 'Figma',
    section: 'media',
    label: 'Add Figma Embed',
    description:
      'Embeds a Figma link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'figma' },
    icon: <FigmaTileArt />,
  },
  {
    id: 'media:embed-gdocs',
    tileGroup: 'embed',
    blurb: 'A Doc, Sheet or Slide deck',
    caption: 'Google Docs',
    section: 'media',
    label: 'Add Google Docs Embed',
    description:
      'Embeds a Google Docs link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'gdocs' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideFileText} />
      </Glyph>
    ),
  },
  {
    id: 'media:embed-website',
    tileGroup: 'embed',
    blurb: 'Any site, framed on the canvas',
    caption: 'Website',
    section: 'media',
    label: 'Add Website Embed',
    description:
      'Embeds any website on the canvas. Double-click it to set the address; it loads when you press Load embed. Some sites refuse to be framed and will come up blank.',
    dividerAfter: true,
    action: { type: 'video', provider: 'website' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideGlobe} />
      </Glyph>
    ),
  },
  {
    id: 'tools:avatar',
    blurb: 'A circular photo of a person',
    section: 'media',
    label: 'Add Avatar',
    description:
      'Avatar. A circular image. Tap to drop or drag to size; double-click it to pick / upload a photo.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'avatar' },
    icon: (
      <Glyph size={18} units={24}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="9.5" r="3" />
        <path d="M6.5 19a6 6 0 0 1 11 0" />
      </Glyph>
    ),
  },
  {
    // The card (docs/specs/009-elements/card.md): a diagram node with slots, placed like any shape so the theme
    // paints it. The Callout below is its preset.
    id: 'components:card',
    blurb: 'A node with an icon, title, meta and tags',
    caption: 'Card',
    section: 'components',
    label: 'Add Card',
    description:
      'Card. A diagram node with slots you switch on: a header band, an icon, a title and meta line, a body and tags. Tap to drop or drag to size.',
    filled: true,
    action: { type: 'shape', kind: 'card' },
    variants: CARD_PRESET_TILES,
    variantsHint: 'Start from a preset, then switch any part on or off.',
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
        <rect x="5.5" y="6.5" width="4.5" height="4.5" rx="1.2" />
        <path d="M12.5 7.5h6M12.5 10h4M5.5 14h13" />
        <rect x="5.5" y="16.5" width="4" height="1.6" rx="0.8" />
        <rect x="11" y="16.5" width="4" height="1.6" rx="0.8" />
      </Glyph>
    ),
  },
  {
    // The badge (docs/specs/009-elements/badge.md): a pill that attaches to a point on a node when dropped there.
    id: 'components:badge',
    blurb: 'A small tag that sits on a node',
    caption: 'Badge',
    section: 'components',
    label: 'Add Badge',
    description:
      'Badge. A small pill like "Beta" or "v2". Drop it on a corner or edge of a node and it stays there as the node moves.',
    // Drawn as the badge it drops (a New pill), so untinted: the glyph carries the theme's colours itself.
    noTint: true,
    action: { type: 'shape', kind: 'badge' },
    variants: BADGE_PRESET_TILES,
    variantsHint: 'Start from a preset, then change its text, look or colour.',
    icon: <BadgePresetGlyph {...badgePresetFace(undefined)} />,
  },
  {
    // The step number (docs/specs/009-elements/step-number.md): numbers itself as it lands.
    id: 'components:step',
    blurb: 'A numbered disc for walkthroughs',
    caption: 'Step Number',
    section: 'components',
    label: 'Add Step Number',
    description:
      'Step number. A numbered disc for walking through a diagram in order; each new one takes the next number.',
    filled: true,
    action: { type: 'shape', kind: 'step' },
    icon: (
      <Glyph size={18} units={24}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M10.5 9.5 12.5 8v8" />
      </Glyph>
    ),
  },
  {
    // The stack (docs/specs/009-elements/stack.md): a container that arranges what is dropped into it.
    id: 'tools:stack',
    blurb: 'Lines things up with even gaps',
    caption: 'Stack',
    section: 'build',
    label: 'Add Stack',
    description:
      'Stack. Drop elements in and it lines them up in a row, a column or a grid with even gaps, and reflows as they change.',
    action: { type: 'shape', kind: 'stack' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="2.5" y="6" width="19" height="12" rx="2" strokeDasharray="2.5 2" />
        <rect x="5" y="9" width="4" height="6" rx="1" />
        <rect x="10" y="9" width="4" height="6" rx="1" />
        <rect x="15" y="9" width="4" height="6" rx="1" />
      </Glyph>
    ),
  },
  // --- Concepts (docs/specs/009-elements/concept-graphics.md) --------------------------------------
  {
    id: 'concepts:layer-stack',
    blurb: 'Stacked layers with side notes',
    caption: 'Layer Stack',
    section: 'concepts',
    label: 'Add Layer Stack',
    description:
      'Layer stack. Horizontal bands for a tech stack, the OSI model or architecture tiers.',
    action: { type: 'shape', kind: 'layer-stack' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="3.5" width="18" height="4.5" rx="1.2" />
        <rect x="3" y="9.75" width="18" height="4.5" rx="1.2" />
        <rect x="3" y="16" width="18" height="4.5" rx="1.2" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:pyramid',
    blurb: 'Tiers in a triangle',
    caption: 'Pyramid',
    section: 'concepts',
    label: 'Add Pyramid',
    description: 'Pyramid. Tiers cut from one triangle: a hierarchy, a strategy stack, needs.',
    action: { type: 'shape', kind: 'pyramid' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M12 3 15.4 9H8.6Z" />
        <path d="M7.7 10.6h8.6l2.9 5H4.8Z" />
        <path d="M3.9 17.2h16.2l1.4 3.3h-19Z" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:funnel',
    blurb: 'Narrowing bands with values',
    caption: 'Funnel',
    section: 'concepts',
    label: 'Add Funnel',
    description: 'Funnel. Bands narrowing downward, each with a value: a conversion story.',
    action: { type: 'shape', kind: 'pyramid', variant: 'funnel' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M3 4h18l-2.2 4.5H5.2Z" />
        <path d="M6 10.5h12l-2 4H8Z" />
        <path d="M8.8 16.5h6.4l-1.2 3.5h-4Z" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:cycle',
    blurb: 'Steps round a loop',
    caption: 'Cycle',
    section: 'concepts',
    label: 'Add Cycle',
    description: 'Cycle. Steps round a ring joined by arrows: PDCA, a flywheel, a release loop.',
    action: { type: 'shape', kind: 'cycle' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="4.5" r="2.3" />
        <circle cx="19.5" cy="12" r="2.3" />
        <circle cx="12" cy="19.5" r="2.3" />
        <circle cx="4.5" cy="12" r="2.3" />
        <path d="M15 5.5a8 8 0 0 1 3.5 3.5M18.5 15a8 8 0 0 1-3.5 3.5M9 18.5A8 8 0 0 1 5.5 15M5.5 9A8 8 0 0 1 9 5.5" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:hub',
    blurb: 'Satellites round a centre',
    caption: 'Hub and Spoke',
    section: 'concepts',
    label: 'Add Hub and Spoke',
    description:
      'Hub and spoke. Satellites round a central hub, joined by spokes: an ecosystem, stakeholders, integrations.',
    action: { type: 'shape', kind: 'hub' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="12" cy="3.5" r="1.8" />
        <circle cx="19.4" cy="16.2" r="1.8" />
        <circle cx="4.6" cy="16.2" r="1.8" />
        <path d="M12 8.8V5.3M14.8 13.6l3 1.7M9.2 13.6l-3 1.7" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:onion',
    blurb: 'Rings from a core outward',
    caption: 'Onion',
    section: 'concepts',
    label: 'Add Onion',
    description:
      'Onion rings. Concentric rings from a core outward: clean architecture, trust layers, a maturity model.',
    action: { type: 'shape', kind: 'onion' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="3" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:chevrons',
    blurb: 'Arrow-shaped stages in a row',
    caption: 'Chevrons',
    section: 'concepts',
    label: 'Add Chevrons',
    description:
      'Chevron process. Arrow-shaped stages in a row, each pointing into the next: a pipeline, a value chain, phases.',
    action: { type: 'shape', kind: 'chevrons' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M2 8h5l2.5 4L7 16H2l2.5-4Z" />
        <path d="M9 8h5l2.5 4L14 16H9l2.5-4Z" />
        <path d="M16 8h4.5l2 4-2 4H16l2.5-4Z" />
      </Glyph>
    ),
  },
  {
    // The Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"). Its id is the one it had in Build, so a
    // palette layout that pinned it keeps it.
    id: 'tools:timeline',
    blurb: 'Milestones along a line, when and what',
    caption: 'Timeline',
    section: 'concepts',
    label: 'Add Timeline',
    description:
      'Timeline. Milestones along a line, each with when and what, taking turns above and below: a roadmap, a project plan, a history.',
    action: { type: 'shape', kind: 'timeline-rail' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M2 12h18" />
        <path d="m20 9.5 2.5 2.5-2.5 2.5" />
        <circle cx="5.5" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="11" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <path d="M5.5 9.5V6M11 14.5V18M16.5 9.5V6" />
      </Glyph>
    ),
  },
  {
    // The pointer note (docs/specs/009-elements/pointer-note.md): a note whose leader's tip pins to a point on a shape.
    id: 'tools:pointer-note',
    blurb: 'A note that points at a spot',
    caption: 'Pointer Note',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Pointer Note',
    description:
      'Pointer note. A short note with a line to a dot; drag the dot onto a corner or edge of a shape and the note follows it.',
    filled: true,
    action: { type: 'shape', kind: 'pointer-note' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="9" y="3" width="12.5" height="8" rx="2" />
        <path d="M11.5 6h7.5M11.5 8.5h4.5" />
        <path d="M9 11 4.5 18" />
        <circle cx="4" cy="19" r="1.6" fill="currentColor" />
      </Glyph>
    ),
  },
  {
    id: 'tools:link-card',
    blurb: 'A clickable preview of a link',
    // Media, beside the Tab Window: both show another page inside this one. It sat under Components, which groups by
    // what a thing looks like — a ready-made composite you recolour — and a link card is neither composite nor
    // decoration.
    section: 'media',
    label: 'Add Link Card',
    description: "Link card. A bookmark preview with the page's title, favicon, and image.",
    noTint: true,
    action: { type: 'link-card' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
      </Glyph>
    ),
  },
  {
    // Sankey diagram (docs/specs/009-elements/sankey.md): last in Build, after the containers, because it is
    // the one Build element that lays itself out from data rather than holding work you place in it.
    id: 'tools:sankey',
    blurb: 'Flows drawn as wide as the amount they carry',
    caption: 'Sankey',
    section: 'build',
    label: 'Add Sankey Diagram',
    description:
      'A Sankey diagram: how much moves where, each band as wide as its amount. Double-click it to edit the flows.',
    action: { type: 'shape', kind: 'sankey' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        {/* Two inputs merging into a node, splitting three ways: the shape of every Sankey. */}
        <path d="M3 5h2M3 13h2M11 7v10M19 4v4M19 11v3M19 17v3" />
        <path d="M5 4c4 0 2 4 6 4M5 14c4 0 2 2 6 2M11 9c4 0 4-3 8-3M11 12c4 0 4 0 8 1M11 15c4 0 4 3 8 3" />
      </Glyph>
    ),
  },
  // --- Data (docs/specs/009-elements/pie-chart.md) -------------------------------------------------------
  {
    id: 'data:pie',
    blurb: 'Proportions of a whole',
    section: 'data',
    label: 'Add Pie Chart',
    caption: 'Pie',
    description: 'A pie chart. Edit its labels + values from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'pie-chart' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24} filled>
        <circle cx="12" cy="12" r="9" opacity="0.25" />
        <path d="M12 12 L12 3 A9 9 0 0 1 20.5 15 Z" />
      </Glyph>
    ),
  },
  {
    id: 'data:bar',
    blurb: 'Compare values side by side',
    section: 'data',
    // Upright bars: a Column chart, as Google Sheets and Excel name it (docs/specs/009-elements/pie-chart.md
    // "Chart types"); its Chart Type menu turns it into a Bar chart (horizontal) or any other type.
    label: 'Add Column Chart',
    caption: 'Column',
    description: 'A column chart. Edit its labels + values from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'bar-chart' },
    icon: (
      <Glyph size={18} units={24} filled>
        <rect x="4" y="12" width="4" height="8" rx="1" opacity="0.45" />
        <rect x="10" y="7" width="4" height="13" rx="1" />
        <rect x="16" y="10" width="4" height="10" rx="1" opacity="0.7" />
      </Glyph>
    ),
  },
  {
    id: 'data:line',
    blurb: 'A trend over time',
    section: 'data',
    label: 'Add Line Chart',
    caption: 'Line',
    description:
      'A multi-series line chart. Edit the data grid or import a CSV from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'line-chart' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M4 18 L9 11 L14 14 L20 6" />
      </Glyph>
    ),
  },
  {
    id: 'data:legend',
    blurb: 'A key for your colours',
    section: 'data',
    label: 'Add Legend',
    caption: 'Legend',
    description:
      'A key: a colour-coded dot and a label per row. Edit the colours and words from the Legend menu.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'legend' },
    icon: (
      <Glyph size={18} units={24} strokeLinejoin="miter">
        <circle cx="5" cy="6" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="5" cy="18" r="1.8" fill="currentColor" stroke="none" />
        <path d="M10 6 H20 M10 12 H20 M10 18 H16" />
      </Glyph>
    ),
  },
  {
    id: 'data:progress-bar',
    blurb: 'How far along something is',
    section: 'data',
    label: 'Add Progress Bar',
    caption: 'Progress',
    description: 'Horizontal progress bar. Set the percentage from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'progress-bar' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={18}>
        <rect x="2" y="6.5" width="14" height="5" rx="2.5" />
        <rect x="2" y="6.5" width="8" height="5" rx="2.5" fill="currentColor" stroke="none" />
      </Glyph>
    ),
  },
  {
    id: 'data:progress-ring',
    blurb: 'The same, as a donut meter',
    section: 'data',
    label: 'Add Progress Ring',
    caption: 'Donut',
    description: 'Donut progress ring. Set the percentage from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'progress-ring' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt" strokeLinejoin="miter">
        <circle cx="9" cy="9" r="6" strokeWidth="2.4" opacity="0.3" />
        <path d="M9 3 a6 6 0 0 1 5.2 9" strokeWidth="2.4" strokeLinecap="round" />
      </Glyph>
    ),
  },
  {
    id: 'data:rating',
    blurb: 'A score out of five stars',
    section: 'data',
    label: 'Add Rating',
    caption: 'Rating',
    description: 'A 1–5 star rating. Set the score + an animation from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'rating' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24} filled>
        <path d="M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z" />
      </Glyph>
    ),
  },
  // --- Components (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/web-components-and-no-groups.md): each one element that lays itself out -
  {
    id: 'components:banner',
    tileGroup: 'web',
    blurb: 'A themed title block for the top',
    caption: 'Banner',
    section: 'components',
    label: 'Add Banner',
    description:
      'Banner. A themed title block (an accent bar with a title and subtitle) to head your diagram. Tap to drop or drag to size; double-click to edit the title, click the subtitle once it is selected to edit it.',
    noTint: true,
    action: { type: 'component', kind: 'banner' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M7 10.75h10" strokeWidth="2.2" />
        <path d="M9 14.25h6" />
      </Glyph>
    ),
  },
  {
    id: 'components:callout',
    tileGroup: 'web',
    blurb: 'A note box with an icon and title',
    caption: 'Callout',
    section: 'components',
    label: 'Add Callout',
    description:
      'Callout. A soft note box with an icon badge, a heading, and a body for annotating a diagram. Tap to drop or drag to size; double-click to edit the body.',
    noTint: true,
    action: { type: 'component', kind: 'callout' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
        <circle cx="7" cy="9" r="2" fill="currentColor" stroke="none" />
        <path d="M11 8.5h8M6 13h13M6 16h9" />
      </Glyph>
    ),
  },
  {
    id: 'components:stat',
    tileGroup: 'web',
    blurb: 'Three KPI cards side by side',
    caption: 'Stat Row',
    section: 'components',
    label: 'Add Stat Row',
    description:
      'Stat row. KPI cards (big number + caption) for dashboards and summaries. Resize to spread the cards; click a number to edit it, and add or remove stats from its menu.',
    noTint: true,
    action: { type: 'component', kind: 'stat' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2" y="6" width="6" height="12" rx="1" />
        <rect x="9" y="6" width="6" height="12" rx="1" />
        <rect x="16" y="6" width="6" height="12" rx="1" />
        <path d="M3.5 10.5h3M10.5 10.5h3M17.5 10.5h3" />
      </Glyph>
    ),
  },
  {
    id: 'components:process',
    tileGroup: 'web',
    blurb: 'Numbered steps joined by arrows',
    caption: 'Process',
    section: 'components',
    label: 'Add Process Steps',
    description:
      'Process steps. Numbered circles joined by arrows with captions, for flows. Resize to spread the steps; click a caption to edit it, and add or remove steps from its menu.',
    noTint: true,
    action: { type: 'component', kind: 'process' },
    icon: (
      <Glyph size={18} units={24}>
        <circle cx="5" cy="12" r="3" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="12" r="3" />
        <path d="M8 12h1M15 12h1" />
      </Glyph>
    ),
  },
  {
    id: 'components:hero',
    tileGroup: 'web',
    blurb: 'A big image with a title card',
    caption: 'Hero',
    section: 'components',
    label: 'Add Hero',
    description:
      'Hero. A large image with a title and supporting line on a themed caption card. Tap to drop or drag to size; double-click the image to set it, click the caption to edit it.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'hero' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
        <path d="M2.5 14l5-4 4 3 3-2.5 7 5.5" />
        <path d="M7 17.5h10" strokeWidth="2.2" />
      </Glyph>
    ),
  },
  {
    id: 'components:header',
    tileGroup: 'web',
    blurb: 'A website-style nav bar',
    caption: 'Header',
    section: 'components',
    label: 'Add Header',
    description:
      'Header. A website-style bar with a logo, brand name, and nav links. Resize to make room for more links; drop an icon on it to set the logo.',
    noTint: true,
    action: { type: 'component', kind: 'header' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
        <circle cx="7" cy="12" r="2.2" />
        <path d="M14 10.5h5M14 13.5h5" />
      </Glyph>
    ),
  },
  // --- Devices (docs/specs/008-canvas/canvas-and-palette.md) ------------------------------------------------------
  {
    id: 'devices:browser',
    blurb: 'A desktop web page frame',
    section: 'devices',
    label: 'Add Web Browser',
    caption: 'Browser',
    description: 'Browser window. Wireframe a web page or a web-app screen.',
    filled: true,
    action: { type: 'shape', kind: 'browser' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="2" y="3" width="14" height="12" rx="1.5" />
        <path d="M2 7 L16 7" />
      </Glyph>
    ),
  },
  {
    id: 'devices:monitor',
    blurb: 'A full-screen desktop layout',
    section: 'devices',
    label: 'Add Computer Monitor',
    caption: 'Monitor',
    description: 'Desktop monitor with stand. Wireframe a desktop app.',
    filled: true,
    action: { type: 'shape', kind: 'monitor' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="2" y="2.5" width="14" height="9" rx="1" />
        <path d="M6 15.5 L12 15.5" />
        <path d="M9 11.5 L9 15.5" />
      </Glyph>
    ),
  },
  {
    id: 'devices:laptop',
    blurb: 'A portable-screen view',
    section: 'devices',
    label: 'Add Laptop',
    description: 'Laptop. Screen plus keyboard base.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'laptop' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="3.5" y="3" width="11" height="8" rx="1" />
        <path d="M1.5 14 L16.5 14 L15 11 L3 11 Z" />
      </Glyph>
    ),
  },
  {
    id: 'devices:phone',
    blurb: 'A mobile app or page',
    section: 'devices',
    label: 'Add Phone',
    description: 'Phone. Wireframe a mobile screen.',
    filled: true,
    action: { type: 'shape', kind: 'phone' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="5.5" y="1.5" width="7" height="15" rx="1.6" />
      </Glyph>
    ),
  },
  {
    id: 'devices:tablet',
    blurb: 'A larger touch layout',
    section: 'devices',
    label: 'Add Tablet',
    description: 'Tablet. Larger than a phone, smaller than a laptop screen.',
    filled: true,
    action: { type: 'shape', kind: 'tablet' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="3" y="2" width="12" height="14" rx="1.2" />
      </Glyph>
    ),
  },
  {
    id: 'devices:foldable',
    blurb: 'A foldable phone, opened out',
    section: 'devices',
    label: 'Add Foldable',
    caption: 'Foldable',
    description: 'Foldable phone, unfolded. A book-style phone opened to its inner screen.',
    filled: true,
    action: { type: 'shape', kind: 'foldable' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="1.5" y="3" width="15" height="12" rx="1.2" />
        <path d="M9 3 V15" />
      </Glyph>
    ),
  },
  {
    id: 'devices:smartwatch',
    blurb: 'A compact wearable screen',
    section: 'devices',
    label: 'Add Smartwatch',
    caption: 'Watch',
    description: 'Smartwatch. A wrist-device frame for watch-app wireframes.',
    filled: true,
    action: { type: 'shape', kind: 'smartwatch' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="5.5" y="4" width="7" height="10" rx="2.2" />
        <path d="M7 4 V1.8 M11 4 V1.8 M7 14 V16.2 M11 14 V16.2 M12.5 8 H14" />
      </Glyph>
    ),
  },
  // A wireframe page's parts (docs/specs/007-editor/wireframe-pages.md "The Elements palette").
  ...WIREFRAME_TILES,
];

export function tilesInSection(section: PaletteTileSection): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === section);
}

// The Tools tab's grouped view (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"): the tools-section
// tiles carrying the given group, in catalogue order.
export function tilesInToolGroup(group: ToolGroupId): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === 'tools' && t.toolGroup === group);
}

export function tileById(id: string): PaletteTileDef | undefined {
  return PALETTE_TILES.find((t) => t.id === id);
}

// The tile's short human name: the explicit caption where one is set,
// otherwise derived from the action label the same way IconButton derives
// its tile caption ("Add Web Browser" → "Web Browser", "Pencil (freehand)"
// → "Pencil"). Used by the Search panel's add-to-canvas entries.
export function tileDisplayName(def: PaletteTileDef): string {
  return tileCaption(def.label, def.caption);
}

/** The palette category a tile renders under by default: its section, or its tool group inside
 *  Tools. The inverse of tilesForCategory. */
export function tileCategoryId(tile: PaletteTileDef): string {
  if (tile.section !== 'tools') return tile.section;
  return tile.toolGroup ?? 'tools';
}

/**
 * The tiles a palette CATEGORY holds by default, which is not the same thing as a
 * section id. A mode's palette layout (palette-layouts.ts) starts from these and may
 * re-fill a category for that mode; ask the layout (paletteCategoriesFor) for what a
 * palette actually shows.
 *
 * Most categories are a section. Write and Draw are not: they are tool GROUPS
 * inside the tools section (docs/specs/010-palette/palette-top-level-categories.md), so `tilesInSection('write')`
 * is empty and a caller that assumed otherwise silently showed nothing (the
 * since-removed Edit Favourites dialog did exactly that and dropped all three).
 *
 * Returns [] for the open-ended catalogues (Icons / Stickers / Technology),
 * whose contents are async data rather than fixed tiles — callers handle
 * those through their own search.
 */
export function tilesForCategory(categoryId: string): PaletteTileDef[] {
  if (TOOL_GROUPS.some((g) => g.id === categoryId)) {
    return tilesInToolGroup(categoryId as ToolGroupId);
  }
  return PALETTE_TILES.filter((t) => t.section === categoryId);
}
