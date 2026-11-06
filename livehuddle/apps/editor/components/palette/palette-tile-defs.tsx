import { BADGE_PRESET_TILES, CARD_PRESET_TILES } from './palette-element-presets';
import { BadgePresetGlyph } from './BadgePresetGlyph';
import { badgePresetFace } from '@livehuddle/document';
import type { EmbedProvider } from '@livehuddle/document';

import type { ComponentKind, SelectionMode, ShapeKind } from '@livehuddle/document';
import {
  AvatarModeIcon,
  ChairIcon,
  DeskIcon,
  FenceIcon,
  AvatarPadIcon,
  DirectoryIcon,
  ElevatorIcon,
  RoomIcon,
  RoomBuilderIcon,
  DoorIcon,
  StageIcon,
  MeetingTableIcon,
  PlantIcon,
  BookshelfIcon,
  WaterCoolerIcon,
  CoffeeMachineIcon,
  RugIcon,
  SofaIcon,
  HighlighterIcon,
  ShapePenIcon,
} from '@/components/palette/palette-icons';
import { SPACE_CATEGORIES, type SpaceTileGroup } from './space-categories';
import {
  BarIcon,
  BarStoolIcon,
  DrinksCabinetIcon,
  DrinksFridgeIcon,
  GardenFenceIcon,
  GardenPathIcon,
  GrassIcon,
  OfficePodIcon,
  OutdoorPlantIcon,
  TreeIcon,
} from './palette-icons-garden';
import { RoomSignIcon, ScreenIcon } from './palette-icons-meeting';
import {
  ArcadeMachineIcon,
  BeanBagIcon,
  BenchIcon,
  CampfireIcon,
  DartboardIcon,
  FireplaceIcon,
  FoosballTableIcon,
  FountainIcon,
  GardenUmbrellaIcon,
  HammockIcon,
  JukeboxIcon,
  NoticeBoardIcon,
  PicnicTableIcon,
  PingPongTableIcon,
  PondIcon,
  PoolTableIcon,
  ReadingNookIcon,
  StopwatchIcon,
  TimerPieceIcon,
  VendingMachineIcon,
  WorldClockIcon,
} from './palette-icons-social';
import {
  lucideCircle,
  lucideDiamond,
  lucideFileText,
  lucideGlobe,
  lucideImage,
  lucideMoveRight,
  lucideSquare,
  lucideStickyNote,
  lucideTable,
  lucideType,
} from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livehuddle/ui';
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

export type PaletteTileSection =
  | 'shapes'
  // Structure (docs/specs/010-palette/build-category.md): the elements you lay a diagram OUT with rather than
  // draw on it — a lane, a frame, a timeline, a table. They were
  // scattered across Write, Draw, Data and Components, filed by what they look
  // like; what they have in common is that they hold other work.
  | 'build'
  | 'tools'
  | 'data'
  // 'collaborate' is GONE (docs/specs/010-palette/palette-top-level-categories.md), and the collaboration elements
  // with it (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements").
  | 'media'
  | 'components'
  | 'stickers';

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
type PaletteTileAction =
  // `mode` is a creation-time choice, not a separate kind: a Mode button is ONE kind with a field, and the palette
  // offers a tile per choice (docs/specs/009-elements/mode-button.md) the way Media does for embed providers.
  | {
      type: 'shape';
      kind: ShapeKind;
      mode?: SelectionMode;
      // A creation-time variant of the kind (packages/document shape-variants.ts): the Callout card, a Funnel.
      variant?: string;
    }
  | { type: 'text' }
  // An opener: stands for a category and opens it; places nothing.
  | { type: 'open'; category: string }
  | { type: 'freehand' }
  // Marker variant of the pencil (docs/specs/008-canvas/highlighter.md), the recognising pen
  // (docs/specs/008-canvas/two-pens.md) and the click-to-place vertex tool (docs/specs/008-canvas/polygon-tool.md)
  // are separate action types, so each tile maps to its own arm-handler and pressed state.
  | { type: 'highlighter' }
  | { type: 'shape-pen' }
  | { type: 'video'; provider?: EmbedProvider }
  | { type: 'sticker'; stickerId: string }
  | { type: 'polygon' }
  // The Room Builder (docs/specs/009-elements/room-builder.md): walls placed corner by corner.
  | { type: 'room-walls' }
  // `ends`: the Line tile's `'none'`; the Arrow tile leaves it to the tool's pointer at its end.
  | { type: 'arrow'; ends?: import('@livehuddle/document').ArrowEnds }
  | { type: 'sticky' }
  | { type: 'table' }
  | { type: 'image' }
  | { type: 'annotation' }
  | { type: 'link-card' }
  | { type: 'component'; kind: ComponentKind };

// Themed sub-groups within the Tools section (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories"):
// the Tools tab renders one labelled grid per group instead of a flat
// sixteen-tile wall. Group membership is metadata on the tile — ids stay
// stable, so palette layouts and search are untouched.
export type ToolGroupId = 'write' | 'draw' | 'behaviour';

// Display order, headings, and a one-line "what's in here" for the Tools tab's
// groups. The description is what the category tile's hover card says: a count
// ("6 tools") tells you nothing you can act on, whereas naming the contents
// answers the actual question — is the thing I want in this box?
// Label + membership only. These groups render through PaletteToolRows /
// PaletteTileGroup, each carrying its own title, and a title shows a label
// rather than a blurb —
// the browsable category descriptions live in PALETTE_CATEGORIES. A
// `description` field here went unread for long enough to drift out of step
// with the live one for `behaviour`, which is why it is gone.
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
  // Behaviour (docs/specs/009-elements/mode-button.md): elements that DO something when someone interacts
  // with them, rather than elements that say something. Last, because a
  // diagram is drawn before it is wired up.
  {
    id: 'behaviour',
    label: 'Behaviour',
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
  // providers; 'web' = the Components tab's website composites; and a
  // SpaceTileGroup the Space category the piece belongs in (space-categories.tsx).
  tileGroup?: 'embed' | 'web' | SpaceTileGroup;
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
  {
    // Portal (docs/specs/009-elements/portal-element.md): step in here, come out of the portal it is linked to.
    // The tile id keeps its original 'door' word: ids are stable, since palette layouts and
    // search address tiles by them.
    id: 'tools:door',
    tileGroup: 'travel',
    blurb: 'Step through to its linked portal',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Portal',
    caption: 'Portal',
    description:
      'Click it, or walk your Avatar character into it, and you come out of the portal it is linked to. Link a pair from the element menu.',
    filled: true,
    action: { type: 'shape', kind: 'portal' },
    icon: (
      <Glyph size={18} units={18}>
        {/* The standing oval ring, with the far side showing through it. */}
        <ellipse cx="9" cy="9" rx="4.6" ry="7" />
        <ellipse cx="9" cy="9" rx="2.1" ry="3.6" strokeWidth="1.1" opacity="0.6" />
      </Glyph>
    ),
  },
  {
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md): Navigate, beside Portal and Chair, because all
    // three take somebody somewhere. This is the one that takes everybody.
    id: 'tools:focus-button',
    tileGroup: 'travel',
    blurb: 'Ask everyone to look here',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bring Focus',
    caption: 'Bring Focus',
    description:
      'Bring Focus. Press it and everyone else in the room is offered a jump to it, on your tab.',
    filled: true,
    action: { type: 'shape', kind: 'focus-button' },
    icon: (
      <Glyph size={18} units={24} strokeLinejoin="miter">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
      </Glyph>
    ),
  },
  {
    // Chair (docs/specs/009-elements/chair.md): Behaviour, because what it does only happens when
    // somebody interacts with it — here by walking an Avatar-mode character
    // into it rather than by pressing it.
    id: 'tools:chair',
    tileGroup: 'seating',
    blurb: 'A chair for Avatars to sit in',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Chair',
    caption: 'Chair',
    description:
      'Furniture for Avatar mode: walk your character into one and it sits down. Give the room a seating plan.',
    filled: true,
    action: { type: 'shape', kind: 'chair' },
    icon: <ChairIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Desk (docs/specs/009-elements/chair.md "Desk and sofa"): a chair pulled up to a desk with a
    // computer on it; whoever sits faces the screen.
    id: 'tools:desk',
    tileGroup: 'seating',
    blurb: 'A desk with a computer for an Avatar to sit at',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Desk',
    caption: 'Desk',
    description:
      'A desk with a computer and a chair for Avatar mode: walk your character in and it sits down facing the screen.',
    filled: true,
    action: { type: 'shape', kind: 'desk' },
    icon: <DeskIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Sofa (docs/specs/009-elements/chair.md "Desk and sofa"): two seats side by side.
    id: 'tools:sofa',
    tileGroup: 'seating',
    blurb: 'A two-seater sofa for Avatars',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Sofa',
    caption: 'Sofa',
    description:
      'A two-seater sofa for Avatar mode: walk your character in and it sits on the nearer cushion, room for two.',
    filled: true,
    action: { type: 'shape', kind: 'sofa' },
    icon: <SofaIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Fence (docs/specs/009-elements/fence.md): Avatar-mode characters cannot walk through one.
    id: 'tools:fence',
    tileGroup: 'rooms',
    blurb: 'A barrier Avatars cannot walk through',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fence',
    caption: 'Fence',
    description:
      'A fence Avatar-mode characters cannot cross. Join fences end to end to wall off an area: people can walk round it, not into it.',
    filled: true,
    action: { type: 'shape', kind: 'fence' },
    icon: <FenceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Avatar Pad (docs/specs/009-elements/avatar-pad.md): where everyone entering Avatar mode starts.
    id: 'tools:avatar-pad',
    tileGroup: 'travel',
    blurb: 'Where Avatars arrive',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Avatar Pad',
    caption: 'Avatar Pad',
    description:
      "The board's entrance for Avatar mode: everyone who starts walking appears on the pad, beamed in, rather than wherever they were looking.",
    filled: true,
    action: { type: 'shape', kind: 'avatar-pad' },
    icon: <AvatarPadIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Directory (docs/specs/009-elements/directory.md): every room in the space and who is in each, to walk or jump to.
    id: 'tools:directory',
    tileGroup: 'travel',
    blurb: 'Every room and who is in it',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Directory',
    caption: 'Directory',
    description:
      "A stand listing the space's rooms, stages and pods on every tab, with who is in each right now. Walk There or Go from it.",
    filled: true,
    action: { type: 'shape', kind: 'directory' },
    icon: <DirectoryIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Elevator (docs/specs/009-elements/elevator.md): a lift between the space's tabs, its floors.
    id: 'tools:elevator',
    tileGroup: 'travel',
    blurb: 'Ride between floors (tabs)',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Elevator',
    caption: 'Elevator',
    description:
      "A lift between this space's tabs. Click it, or walk your character in, pick a floor and you step out of that floor's Elevator.",
    filled: true,
    action: { type: 'shape', kind: 'elevator' },
    icon: <ElevatorIcon size={TILE_GLYPH_PX} />,
  },
  {
    // The Avatar Selection Mode button (docs/specs/009-elements/mode-button.md "Only Avatar"): the one mode button
    // livehuddle keeps, in Travel after the Avatar Pad because it is how people walk into a Space. The id is unchanged:
    // palette layouts and search address tiles by it.
    id: 'tools:mode-avatar',
    tileGroup: 'travel',
    blurb: 'Walk a character around the canvas',
    caption: 'Avatar Button',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Avatar Mode Button',
    description:
      'A button that switches whoever presses it into Avatar mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'avatar' },
    // Avatar's OWN glyph, the one the Edit | Walk toggle's Walk and Search's Walk show for it.
    icon: <AvatarModeIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Room (docs/specs/009-elements/office.md).
    id: 'tools:room',
    tileGroup: 'rooms',
    blurb: 'A room with walls and a doorway',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Room',
    caption: 'Room',
    description:
      'A room for a virtual office: walls Avatar-mode characters walk round, a doorway they walk through, and its name on the back wall. It goes in behind everything, so furniture stands on its floor.',
    filled: true,
    action: { type: 'shape', kind: 'room' },
    icon: <RoomIcon size={TILE_GLYPH_PX} />,
  },
  {
    // The Room Builder (docs/specs/009-elements/room-builder.md): a room of any shape, wall by wall.
    id: 'tools:room-builder',
    tileGroup: 'rooms',
    blurb: 'Draw a room of any shape',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Room Builder',
    caption: 'Room Builder',
    description:
      'Draw a room wall by wall: click to place each corner, every wall snapped to 45 degrees, and click the first corner to close it. Hold Cmd or Ctrl to place a corner freely.',
    filled: true,
    action: { type: 'room-walls' },
    icon: <RoomBuilderIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Door (docs/specs/009-elements/room-builder.md "Door"): snaps onto any wall and lets characters through. Not
    // 'tools:door': the Portal tile kept that id.
    id: 'tools:wall-door',
    tileGroup: 'rooms',
    blurb: 'A way through any wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Door',
    caption: 'Door',
    description:
      'A door for any room wall, at any angle: drop it on a wall and it snaps on and turns to match, and Avatar-mode characters walk through it. Drag it along the wall to move it.',
    filled: true,
    action: { type: 'shape', kind: 'door' },
    icon: <DoorIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Stage (docs/specs/009-elements/office.md "Stage", docs/specs/012-collaboration/meeting-rooms-and-stage.md).
    id: 'tools:stage',
    tileGroup: 'rooms',
    blurb: 'A platform the whole tab hears',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Stage',
    caption: 'Stage',
    description:
      'A raised platform: whoever stands on it is heard by the whole tab. It goes in behind everything, so chairs stand in front of it; choose who may speak from it in its menu.',
    filled: true,
    action: { type: 'shape', kind: 'stage' },
    icon: <StageIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Meeting Table (docs/specs/009-elements/office.md).
    id: 'tools:meeting-table',
    tileGroup: 'seating',
    blurb: 'A table with six seats round it',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Meeting Table',
    caption: 'Meeting Table',
    description:
      'A meeting table with six chairs for Avatar mode: walk your character in and it sits on the nearest seat, facing the table.',
    filled: true,
    action: { type: 'shape', kind: 'meeting-table' },
    icon: <MeetingTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:bean-bag',
    tileGroup: 'seating',
    blurb: 'A slouchy seat for one',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bean Bag',
    caption: 'Bean Bag',
    description: 'A coral bean bag for a breakout corner. Walk onto it to sink in; it seats one.',
    filled: true,
    action: { type: 'shape', kind: 'bean-bag' },
    icon: <BeanBagIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:reading-nook',
    tileGroup: 'seating',
    blurb: 'An armchair, a lamp and books',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Reading Nook',
    caption: 'Reading Nook',
    description:
      'A wingback armchair on a rug, with a side table of books and a floor lamp that glows on dark paper. Walk onto it to sit.',
    filled: true,
    action: { type: 'shape', kind: 'reading-nook' },
    icon: <ReadingNookIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Plant (docs/specs/009-elements/office.md).
    id: 'tools:plant',
    tileGroup: 'amenities',
    blurb: 'A potted plant Avatars walk round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Plant',
    caption: 'Plant',
    description:
      'A potted plant to make an office feel lived in. Avatar-mode characters walk round its pot.',
    filled: true,
    action: { type: 'shape', kind: 'plant' },
    icon: <PlantIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Bookshelf (docs/specs/009-elements/office.md).
    id: 'tools:bookshelf',
    tileGroup: 'amenities',
    blurb: 'Shelves of books Avatars walk round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bookshelf',
    caption: 'Bookshelf',
    description:
      'A bookshelf to stand against a wall. Avatar-mode characters walk along in front of it, not through it.',
    filled: true,
    action: { type: 'shape', kind: 'bookshelf' },
    icon: <BookshelfIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Water Cooler (docs/specs/009-elements/office.md).
    id: 'tools:water-cooler',
    tileGroup: 'amenities',
    blurb: 'Walk up for a cup of water',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Water Cooler',
    caption: 'Water Cooler',
    description:
      'A water cooler for Avatar mode: walk your character up to it and it gets a cup of water, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'water-cooler' },
    icon: <WaterCoolerIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Coffee Machine (docs/specs/009-elements/office.md).
    id: 'tools:coffee-machine',
    tileGroup: 'amenities',
    blurb: 'Walk up for a coffee',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Coffee Machine',
    caption: 'Coffee Machine',
    description:
      'A coffee machine for Avatar mode: walk your character up to it and it gets a steaming coffee, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'coffee-machine' },
    icon: <CoffeeMachineIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:vending-machine',
    tileGroup: 'amenities',
    blurb: 'A lit machine of snacks and cans',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Vending Machine',
    caption: 'Vending Machine',
    description:
      'A vending machine for a break room, its window lit and glowing on dark paper. Characters walk round its base.',
    filled: true,
    action: { type: 'shape', kind: 'vending-machine' },
    icon: <VendingMachineIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Office Pod (docs/specs/009-elements/office.md).
    id: 'tools:office-pod',
    tileGroup: 'rooms',
    blurb: 'Two seats, a door that shuts',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Office Pod',
    caption: 'Office Pod',
    description:
      'A booth for two in Avatar mode: walk in and sit, and once both seats are taken its glass door slides shut and the pod becomes its own private call.',
    filled: true,
    action: { type: 'shape', kind: 'office-pod' },
    icon: <OfficePodIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Bar (docs/specs/009-elements/office.md). The bar pieces are Play's Bar group
    // (docs/specs/010-palette/palette-top-level-categories.md "Play holds the Bar").
    id: 'tools:bar',
    tileGroup: 'recreation',
    blurb: 'A counter to gather at',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bar',
    caption: 'Bar',
    description:
      'A bar counter with bottles on the shelf behind it. Avatar-mode characters stand at it and walk round its ends, not through it.',
    filled: true,
    action: { type: 'shape', kind: 'bar' },
    icon: <BarIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Bar Stool (docs/specs/009-elements/office.md).
    id: 'tools:bar-stool',
    tileGroup: 'recreation',
    blurb: 'A seat at the bar',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bar Stool',
    caption: 'Bar Stool',
    description:
      'A stool for Avatar mode: walk onto it to sit, facing the bar. One sitter at a time, their name above it.',
    filled: true,
    action: { type: 'shape', kind: 'bar-stool' },
    icon: <BarStoolIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Drinks Cabinet (docs/specs/009-elements/office.md).
    id: 'tools:drinks-cabinet',
    tileGroup: 'recreation',
    blurb: 'Walk up for a juice',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Drinks Cabinet',
    caption: 'Drinks Cabinet',
    description:
      'A glass-fronted drinks cabinet for Avatar mode: walk your character up to it and it gets a juice, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'drinks-cabinet' },
    icon: <DrinksCabinetIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Drinks Fridge (docs/specs/009-elements/office.md).
    id: 'tools:drinks-fridge',
    tileGroup: 'recreation',
    blurb: 'Walk up for a soda',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Drinks Fridge',
    caption: 'Drinks Fridge',
    description:
      'A fridge of cans for Avatar mode: walk your character up to it and it gets a soda, sipping it for a minute where everyone can see.',
    filled: true,
    action: { type: 'shape', kind: 'drinks-fridge' },
    icon: <DrinksFridgeIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Outdoor Plant (docs/specs/009-elements/office.md).
    id: 'tools:outdoor-plant',
    tileGroup: 'garden',
    blurb: 'A flowering shrub',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Outdoor Plant',
    caption: 'Outdoor Plant',
    description:
      'A leafy shrub in a stone planter. Avatar-mode characters walk round its planter, not through it.',
    filled: true,
    action: { type: 'shape', kind: 'outdoor-plant' },
    icon: <OutdoorPlantIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Tree (docs/specs/009-elements/office.md).
    id: 'tools:tree',
    tileGroup: 'garden',
    blurb: 'Shade for the garden',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Tree',
    caption: 'Tree',
    description:
      'A tree with a full canopy. Avatar-mode characters walk round its trunk and pass in front of its leaves.',
    filled: true,
    action: { type: 'shape', kind: 'tree' },
    icon: <TreeIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Garden Path (docs/specs/009-elements/office.md).
    id: 'tools:garden-path',
    tileGroup: 'garden',
    blurb: 'Stepping stones to follow',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Garden Path',
    caption: 'Garden Path',
    description:
      'Stepping stones in gravel, lying on the ground under everything. Stretch it to any length; characters walk along it.',
    filled: true,
    action: { type: 'shape', kind: 'garden-path' },
    icon: <GardenPathIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Grass (docs/specs/009-elements/office.md).
    id: 'tools:grass',
    tileGroup: 'garden',
    blurb: 'A patch of lawn',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Grass',
    caption: 'Grass',
    description:
      'A patch of lawn lying on the ground under everything. Stretch it to any size; characters walk across it.',
    filled: true,
    action: { type: 'shape', kind: 'grass' },
    icon: <GrassIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Garden Fence (docs/specs/009-elements/office.md).
    id: 'tools:garden-fence',
    tileGroup: 'garden',
    blurb: 'A low picket fence',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Garden Fence',
    caption: 'Garden Fence',
    description:
      'A low white picket fence. Avatar-mode characters cannot walk through it, just as with a fence.',
    filled: true,
    action: { type: 'shape', kind: 'garden-fence' },
    icon: <GardenFenceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:jukebox',
    tileGroup: 'recreation',
    blurb: 'Background music in its room',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Jukebox',
    caption: 'Jukebox',
    description:
      'Plays a music link to everyone standing in its room once they press Play on it. Set the link from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'jukebox' },
    icon: <JukeboxIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:ping-pong-table',
    tileGroup: 'recreation',
    blurb: 'A table for two players',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Ping-Pong Table',
    caption: 'Ping-Pong Table',
    description:
      'Two seats, one at each end. When both are taken, a little rally plays between them.',
    filled: true,
    action: { type: 'shape', kind: 'ping-pong-table' },
    icon: <PingPongTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:pool-table',
    tileGroup: 'recreation',
    blurb: 'A table racked for a game',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Pool Table',
    caption: 'Pool Table',
    description:
      'A pool table with the balls racked and a cue on the cloth. Characters walk round it.',
    filled: true,
    action: { type: 'shape', kind: 'pool-table' },
    icon: <PoolTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:foosball-table',
    tileGroup: 'recreation',
    blurb: 'A table football game',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Foosball Table',
    caption: 'Foosball Table',
    description: 'A foosball table with its rods, players and ball. Characters walk round it.',
    filled: true,
    action: { type: 'shape', kind: 'foosball-table' },
    icon: <FoosballTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:arcade-machine',
    tileGroup: 'recreation',
    blurb: 'A glowing arcade cabinet',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Arcade Machine',
    caption: 'Arcade Machine',
    description:
      'A cabinet with a glowing screen. Characters walk round it; walk up to it and it asks for a coin.',
    filled: true,
    action: { type: 'shape', kind: 'arcade-machine' },
    icon: <ArcadeMachineIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:dartboard',
    tileGroup: 'recreation',
    blurb: 'A board for the wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Dartboard',
    caption: 'Dartboard',
    description: 'A dartboard with three darts in it, to hang on a wall. Characters walk past it.',
    filled: true,
    action: { type: 'shape', kind: 'dartboard' },
    icon: <DartboardIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:fireplace',
    tileGroup: 'recreation',
    blurb: 'A fire to gather round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fireplace',
    caption: 'Fireplace',
    description:
      'A brick fireplace with a flickering fire, for a lounge. Characters walk round its hearth.',
    filled: true,
    action: { type: 'shape', kind: 'fireplace' },
    icon: <FireplaceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:bench',
    tileGroup: 'garden',
    blurb: 'Two seats outdoors',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bench',
    caption: 'Bench',
    description: 'A wooden garden bench. Walk onto it to sit; it seats two side by side.',
    filled: true,
    action: { type: 'shape', kind: 'bench' },
    icon: <BenchIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:picnic-table',
    tileGroup: 'garden',
    blurb: 'Six seats round a table',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Picnic Table',
    caption: 'Picnic Table',
    description:
      'A wooden picnic table with a bench each side. Walk onto it to sit, facing the table; it seats six.',
    filled: true,
    action: { type: 'shape', kind: 'picnic-table' },
    icon: <PicnicTableIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:hammock',
    tileGroup: 'garden',
    blurb: 'A hammock for one',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Hammock',
    caption: 'Hammock',
    description: 'A striped hammock between two posts. Walk onto it to lie back in it.',
    filled: true,
    action: { type: 'shape', kind: 'hammock' },
    icon: <HammockIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:garden-umbrella',
    tileGroup: 'garden',
    blurb: 'A striped parasol',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Garden Umbrella',
    caption: 'Garden Umbrella',
    description:
      'A striped parasol to stand beside or over a picnic table. Only its base gets in the way.',
    filled: true,
    action: { type: 'shape', kind: 'garden-umbrella' },
    icon: <GardenUmbrellaIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:fountain',
    tileGroup: 'garden',
    blurb: 'A stone fountain',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fountain',
    caption: 'Fountain',
    description: 'A stone fountain with gently moving water. Characters walk round its basin.',
    filled: true,
    action: { type: 'shape', kind: 'fountain' },
    icon: <FountainIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:pond',
    tileGroup: 'garden',
    blurb: 'Water to walk round',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Pond',
    caption: 'Pond',
    description: 'A pond with lily pads. Stretch it to any size; characters walk round the water.',
    filled: true,
    action: { type: 'shape', kind: 'pond' },
    icon: <PondIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:campfire',
    tileGroup: 'garden',
    blurb: 'A fire in a ring of stones',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Campfire',
    caption: 'Campfire',
    description:
      'A campfire with a flicker, to gather round in the garden. Characters walk round its stones.',
    filled: true,
    action: { type: 'shape', kind: 'campfire' },
    icon: <CampfireIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Screen (docs/specs/009-elements/screen-and-room-sign.md "Screen").
    id: 'tools:screen',
    tileGroup: 'meeting',
    blurb: "Shows the room's screen share",
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Screen',
    caption: 'Screen',
    description:
      'A wall screen. When someone in its room shares their screen in the call, it shows for everyone in the room; otherwise it plays a video link set from its menu. Click it to open it large.',
    filled: true,
    action: { type: 'shape', kind: 'screen' },
    icon: <ScreenIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Room Sign (docs/specs/009-elements/screen-and-room-sign.md "Room Sign").
    id: 'tools:room-sign',
    tileGroup: 'meeting',
    blurb: 'Free, In Use, or Knock',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Room Sign',
    caption: 'Room Sign',
    description:
      "A sign by a room's door with its name and whether it is free, in use (how many, how long) or Do Not Disturb. Knock from it to ask the people inside to let you in.",
    filled: true,
    action: { type: 'shape', kind: 'room-sign' },
    icon: <RoomSignIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:notice-board',
    tileGroup: 'meeting',
    blurb: 'Pinned notes on the wall',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Notice Board',
    caption: 'Notice Board',
    description:
      'A cork board for the wall. Editors and participants pin short notes on it and unpin their own; the four newest show on the board.',
    filled: true,
    action: { type: 'shape', kind: 'notice-board' },
    icon: <NoticeBoardIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Social pieces (docs/specs/009-elements/social-pieces.md).
    id: 'tools:world-clock',
    tileGroup: 'meeting',
    blurb: 'Clocks for several time zones',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add World Clock',
    caption: 'World Clock',
    description:
      'A wall clock with a dial per time zone. It shows each viewer their own time until you add zones from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'world-clock' },
    icon: <WorldClockIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Timer (docs/specs/009-elements/timer-and-stopwatch.md).
    id: 'tools:timer',
    tileGroup: 'meeting',
    blurb: 'A countdown for the room',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Timer',
    caption: 'Timer',
    description:
      'A countdown on the wall. Set its length, then start, pause and reset it from its face; everyone sees the same time, and the room hears a chime at zero.',
    filled: true,
    action: { type: 'shape', kind: 'timer' },
    icon: <TimerPieceIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
    id: 'tools:stopwatch',
    tileGroup: 'meeting',
    blurb: 'Count up how long it takes',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Stopwatch',
    caption: 'Stopwatch',
    description:
      'A stopwatch on the wall that counts up. Start, pause and reset it from its face; everyone sees the same time.',
    filled: true,
    action: { type: 'shape', kind: 'stopwatch' },
    icon: <StopwatchIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Rug (docs/specs/009-elements/office.md).
    id: 'tools:rug',
    tileGroup: 'rooms',
    blurb: 'A rug on the floor',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Rug',
    caption: 'Rug',
    description:
      'A rug that lies on the floor under the furniture, to mark out a lounge or a reception.',
    filled: true,
    action: { type: 'shape', kind: 'rug' },
    icon: <RugIcon size={TILE_GLYPH_PX} />,
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
    // Offered by no category (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link card"), and no
    // `9` key: kept so a stored image still finds its name and glyph.
    description: 'Drop an image placeholder + pick / upload a file.',
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
      'Avatar. A circular image. Click to drop or drag to size; double-click it to pick / upload a photo.',
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
      'Card. A diagram node with slots you switch on: a header band, an icon, a title and meta line, a body and tags. Click to drop or drag to size.',
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
    id: 'tools:lane',
    blurb: 'A titled band that carries its steps',
    caption: 'Lane',
    section: 'build',
    label: 'Add Lane',
    description:
      'A swimlane: a horizontal band with a title down its left edge. Dragging it carries everything inside, like a frame.',
    action: { type: 'shape', kind: 'lane' },
    icon: (
      <Glyph size={18} units={24}>
        {/* Two stacked bands, each with its title gutter. */}
        <rect x="2" y="5" width="20" height="6.5" rx="1.5" />
        <rect x="2" y="13" width="20" height="6.5" rx="1.5" />
        <path d="M8 5v6.5M8 13v6.5" />
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
  {
    // The boundary (docs/specs/009-elements/boundary.md): a titled, tinted container for regions and systems.
    id: 'tools:boundary',
    blurb: 'A titled zone: a region, a VPC, a system',
    section: 'build',
    label: 'Add Boundary',
    description:
      'Boundary. A titled, tinted container for a cloud region, a network or a system. It carries what is inside it, and nested boundaries tint deeper.',
    action: { type: 'shape', kind: 'boundary' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="6" width="18" height="15" rx="2" strokeDasharray="3 2.5" />
        <rect x="5" y="3.5" width="9" height="5" rx="1.5" />
      </Glyph>
    ),
  },
  {
    // The diagram key (docs/specs/009-elements/diagram-key.md): a legend of the tab's line patterns and tag colours.
    id: 'tools:diagram-key',
    blurb: 'A legend that fills itself in',
    caption: 'Diagram Key',
    section: 'build',
    label: 'Add Diagram Key',
    description:
      'Diagram key. Lists the line styles and tag colours this tab uses, each with a meaning you type.',
    filled: true,
    action: { type: 'shape', kind: 'diagram-key' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
        <path d="M5.5 9h5M15 9h3.5" />
        <path d="M5.5 14h1.5M9 14h1.5M15 14h3.5" />
        <path d="M5.5 17.5h5" strokeOpacity={0.5} />
      </Glyph>
    ),
  },
  {
    // The Timeline (docs/specs/009-elements/timeline.md), in Build with the other structures.
    id: 'tools:timeline',
    blurb: 'Milestones along a line, when and what',
    caption: 'Timeline',
    section: 'build',
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
    id: 'tools:annotation',
    blurb: 'A marker that holds a note',
    section: 'tools',
    // Last in Write, and the odd one out in it: an annotation is a MARKER you
    // drop on the canvas that happens to hold text, not a surface you write
    // on like Text, a sticky or a Page. It briefly sat in its own Blocks group
    // for exactly that reason, but docs/specs/010-palette/palette-top-level-categories.md emptied Blocks out and deleted it,
    // so Write is where it lives — ordered last, after the three surfaces,
    // which is the distinction the row order now carries.
    toolGroup: 'write',
    label: 'Add Annotation',
    description: 'Annotation. A note marker: hover to read it, double-click to edit.',
    filled: true,
    action: { type: 'annotation' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
        <path d="M6.5 9.75h11" />
        <path d="M6.5 12.5h7" />
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
    // Offered by no category (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link card"): kept
    // so a stored link card still finds its name and glyph. It left Travel with the Media category.
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
      'Banner. A themed title block (an accent bar with a title and subtitle) to head your diagram. Click to drop or drag to size; double-click to edit the title, click the subtitle once it is selected to edit it.',
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
      'Callout. A soft note box with an icon badge, a heading, and a body for annotating a diagram. Click to drop or drag to size; double-click to edit the body.',
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
      'Hero. A large image with a title and supporting line on a themed caption card. Click to drop or drag to size; double-click the image to set it, click the caption to edit it.',
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

// The meeting elements' categories (docs/specs/012-collaboration/workshop-mode.md "The palette"): each holds the
// `behaviour` tool group's tiles of one `tileGroup`, in catalogue order. The Space categories come from their one
// list (space-categories.tsx).
export const COLLABORATE_CATEGORY_GROUPS: Readonly<
  Record<string, NonNullable<PaletteTileDef['tileGroup']>>
> = {
  ...Object.fromEntries(SPACE_CATEGORIES.map((c) => [c.id, c.tileGroup])),
};

/** The palette category a tile renders under by default: its section, its tool group inside
 *  Tools, or for a Collaborate element its group's category. The inverse of tilesForCategory. */
export function tileCategoryId(tile: PaletteTileDef): string {
  if (tile.section !== 'tools') return tile.section;
  if (tile.toolGroup === 'behaviour' && tile.tileGroup) {
    const id = Object.keys(COLLABORATE_CATEGORY_GROUPS).find(
      (c) => COLLABORATE_CATEGORY_GROUPS[c] === tile.tileGroup,
    );
    if (id) return id;
  }
  return tile.toolGroup ?? 'tools';
}

/**
 * The tiles a palette CATEGORY holds by default, which is not the same thing as a
 * section id. A mode's palette layout (palette-layouts.ts) starts from these and may
 * re-fill a category for that mode; ask the layout (paletteCategoriesFor) for what a
 * palette actually shows.
 *
 * Most categories are a section. Write and Draw are not: they are tool GROUPS
 * inside the tools section, and the six Collaborate categories are `tileGroup`s of
 * the Behaviour tool group (docs/specs/010-palette/palette-top-level-categories.md), so `tilesInSection('write')`
 * is empty and a caller that assumed otherwise silently showed nothing (the
 * since-removed Edit Favourites dialog did exactly that and dropped all three).
 *
 * Returns [] for the open-ended catalogues (Icons / Stickers / Technology),
 * whose contents are async data rather than fixed tiles — callers handle
 * those through their own search.
 */
export function tilesForCategory(categoryId: string): PaletteTileDef[] {
  const collaborate = COLLABORATE_CATEGORY_GROUPS[categoryId];
  if (collaborate) {
    return tilesInToolGroup('behaviour').filter((t) => t.tileGroup === collaborate);
  }
  if (TOOL_GROUPS.some((g) => g.id === categoryId)) {
    return tilesInToolGroup(categoryId as ToolGroupId);
  }
  return PALETTE_TILES.filter((t) => t.section === categoryId);
}
