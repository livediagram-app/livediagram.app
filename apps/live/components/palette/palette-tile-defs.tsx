import type { EmbedProvider } from '@livediagram/diagram';
import { REACTION_EMOJI } from '@livediagram/diagram';
import { ModeGroupIcon } from './palette-group-icons';
import type {
  ComponentKind,
  EstimateScale,
  Reaction,
  SelectionMode,
  SessionTool,
  ShapeKind,
} from '@livediagram/diagram';
import {
  AgendaIcon,
  ChairIcon,
  DecisionIcon,
  EstimateIcon,
  IdeaBoxIcon,
  PickerIcon,
  SessionPollIcon,
  SessionVoteIcon,
  RevealIcon,
  RollCallIcon,
  TemperatureIcon,
  TimerIcon,
} from '@/components/palette/palette-icons';

// The shared palette tile catalogue (spec/78): every creation tile across
// the Shapes / Tools / Data / Components / Devices categories as one data
// entry — label, glyph, tinting flags, and an action descriptor that
// PaletteTileGrid maps to the editor's add-handlers. The category tabs and
// the Favourites grid all render from this one catalogue, so a tile is
// defined once and Favourites can never drift from the home tabs.
//
// Pure data: a flat catalogue, exempt from the file-size target (see
// CLAUDE.md) — extend it in place rather than splitting it.

// 'icons' and 'technology' exist only on DYNAMIC tiles (individual icon
// favourites, palette-dynamic-tiles.tsx) — no PALETTE_TILES entry carries
// them, so tilesInSection never returns them.
export type PaletteTileSection =
  | 'shapes'
  // Structure (spec/132): the elements you lay a diagram OUT with rather than
  // draw on it — a mind node, a lane, a frame, a timeline, a table. They were
  // scattered across Write, Draw, Data and Components, filed by what they look
  // like; what they have in common is that they hold other work.
  | 'build'
  | 'tools'
  | 'data'
  // The collaboration family (spec/123 to spec/129): elements that record what
  // the ROOM thinks rather than what one author drew. Its own category rather
  // than a Behaviour sub-group, on spec/110's reasoning — Behaviour is
  // "pressing this does something to your session", these are "the board is
  // collecting an answer from everybody", and six rows under one heading is
  // where a category earns its place in the picker.
  | 'collaborate'
  | 'media'
  | 'components'
  | 'devices'
  | 'stickers'
  | 'icons'
  | 'technology';

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
type PaletteTileAction =
  // `session` / `reaction` are creation-time choices, not separate kinds: both
  // elements are ONE kind with a mode field, and the palette offers a tile per
  // mode inside an accordion (spec/105, spec/135) the way Media does for embed
  // providers. Placing "Poll" has to place a poll, not a timer to reconfigure.
  | {
      type: 'shape';
      kind: ShapeKind;
      session?: SessionTool;
      reaction?: Reaction;
      mode?: SelectionMode;
      estimateScale?: EstimateScale;
    }
  | { type: 'text' }
  | { type: 'freehand' }
  // Marker variant of the pencil (spec/81) and the click-to-place
  // vertex tool (spec/84) — separate action types so each tile maps
  // to its own arm-handler and pressed state.
  | { type: 'highlighter' }
  | { type: 'shape-pen' }
  | { type: 'video'; provider?: EmbedProvider }
  | { type: 'sticker'; stickerId: string }
  | { type: 'polygon' }
  | { type: 'arrow' }
  | { type: 'sticky' }
  | { type: 'table' }
  | { type: 'image' }
  | { type: 'annotation' }
  | { type: 'link-card' }
  | { type: 'component'; kind: ComponentKind }
  // Dynamic icon favourites (palette-dynamic-tiles.tsx): a single line-art /
  // Technology catalogue entry promoted to a tile.
  | { type: 'icon'; iconId: string }
  | { type: 'tech-icon'; iconId: string };

// Themed sub-groups within the Tools section (spec/09 "Sub-categories"):
// the Tools tab renders one labelled grid per group instead of a flat
// sixteen-tile wall. Group membership is metadata on the tile — ids stay
// stable, so favourites persistence and search are untouched.
export type ToolGroupId = 'write' | 'draw' | 'behaviour';

// Display order, headings, and a one-line "what's in here" for the Tools tab's
// groups. The description is what the category tile's tooltip says: a count
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
    // Split back out from a combined "Write & Draw" (spec/110): once both were
    // one click from the category picker rather than two inside Tools, the
    // pairing bought nothing and the combined list ran to eight rows.
    id: 'draw',
    label: 'Draw',
  },
  // Behaviour (spec/103): elements that DO something when someone interacts
  // with them, rather than elements that say something. Last, because a
  // diagram is drawn before it is wired up.
  {
    id: 'behaviour',
    label: 'Behaviour',
  },
];

export type PaletteTileDef = {
  // Stable id, persisted in the favourites list — never rename one without
  // accepting that saved favourites referencing it fall back silently.
  id: string;
  section: PaletteTileSection;
  // Which Tools-tab group the tile renders under. Required exactly when
  // `section === 'tools'` (a test pins this); meaningless elsewhere.
  toolGroup?: ToolGroupId;
  // Collapses this tile into a named group inside its category, rather than
  // showing it as a top-level row (spec/121). 'embed' = the Media tab's embed
  // providers; 'web' = the Components tab's website composites; 'session' and
  // 'reaction' = the Behaviour tab's session tools and reactions; 'mode' its
  // selection-mode buttons; 'move' / 'facilitate' the rest of Behaviour; and
  // 'ask' / 'record' the two halves of Collaborate.
  tileGroup?:
    | 'embed'
    | 'web'
    | 'session'
    | 'reaction'
    | 'mode'
    | 'move'
    | 'facilitate'
    | 'ask'
    | 'record';
  label: string;
  // Overrides the caption derived from `label` where that runs too long
  // for the tile (see IconButton).
  caption?: string;
  description: string;
  // A short line rendered UNDER the tile in list layouts (the Tools tab).
  // Separate from `description`, which is the fuller tooltip / search text:
  // this one has to fit a palette-width row, so it is a clause, not a
  // sentence, and it says what the tool IS rather than how to use it.
  blurb?: string;
  icon: React.ReactNode;
  shortcut?: string;
  // IconButton flags (spec/09 theme tinting): `filled` tiles preview the
  // theme's element fill; `noTint` tiles keep fixed colours.
  filled?: boolean;
  noTint?: boolean;
  // Tile only renders when the editor supplies onAddImage (image uploads
  // available) — the Image / Avatar / Hero / Header tiles.
  needsImage?: boolean;
  action: PaletteTileAction;
};

export const PALETTE_TILES: PaletteTileDef[] = [
  // --- Shapes -------------------------------------------------------------
  {
    id: 'shapes:square',
    section: 'shapes',
    label: 'Add square',
    description: 'Drop a new square shape on the canvas.',
    shortcut: 'R',
    filled: true,
    action: { type: 'shape', kind: 'square' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect
          x="3"
          y="3"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:circle',
    section: 'shapes',
    label: 'Add circle',
    description: 'Drop a new circle shape on the canvas.',
    shortcut: 'O',
    filled: true,
    action: { type: 'shape', kind: 'circle' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'shapes:diamond',
    section: 'shapes',
    label: 'Add diamond',
    description: 'Diamond. Decision node.',
    shortcut: 'D',
    filled: true,
    action: { type: 'shape', kind: 'diamond' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <polygon
          points="9,2.5 15.5,9 9,15.5 2.5,9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:cylinder',
    section: 'shapes',
    label: 'Add cylinder',
    description: 'Cylinder. Flowchart database / storage.',
    shortcut: 'C',
    filled: true,
    action: { type: 'shape', kind: 'cylinder' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M3 5 L3 13 A6 1.8 0 0 0 15 13 L15 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <ellipse
          cx="9"
          cy="5"
          rx="6"
          ry="1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:parallelogram',
    section: 'shapes',
    label: 'Add parallelogram',
    description: 'Parallelogram. Flowchart input / output.',
    shortcut: 'G',
    filled: true,
    action: { type: 'shape', kind: 'parallelogram' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <polygon
          points="5,3 16,3 13,15 2,15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:hexagon',
    section: 'shapes',
    label: 'Add hexagon',
    description: 'Hexagon. Preparation / milestone.',
    filled: true,
    action: { type: 'shape', kind: 'hexagon' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <polygon
          points="5,3 13,3 16,9 13,15 5,15 2,9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:document',
    section: 'shapes',
    label: 'Add document',
    description: 'Document shape. Flowchart output.',
    filled: true,
    action: { type: 'shape', kind: 'document' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M3 3 L15 3 L15 13 C13 15.3 11 11.8 9 13.5 C7 15.3 5 11.8 3 13.5 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:stadium',
    section: 'shapes',
    label: 'Add stadium',
    description: 'Stadium shape. Flowchart Start / End.',
    filled: true,
    action: { type: 'shape', kind: 'stadium' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect
          x="1.5"
          y="6"
          width="15"
          height="6"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:cloud',
    section: 'shapes',
    label: 'Add cloud',
    description: 'Cloud. Networking / architecture.',
    filled: true,
    action: { type: 'shape', kind: 'cloud' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5.5 13.5 C3.2 13.5 2 11.7 3.4 10.2 C2.4 8.7 4 7 5.5 7.7 C6 5.4 9.4 5.2 9.9 7.6 C11.9 6.7 13.5 8.6 12.2 10.2 C13.5 11.2 12.6 13.5 10.8 13.5 Z" />
      </svg>
    ),
  },
  {
    id: 'shapes:triangle',
    section: 'shapes',
    label: 'Add triangle',
    description: 'Triangle. A basic shape.',
    filled: true,
    action: { type: 'shape', kind: 'triangle' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <polygon
          points="9,3 16,15 2,15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:trapezoid',
    section: 'shapes',
    label: 'Add trapezoid',
    description: 'Trapezoid. Flowchart manual operation.',
    filled: true,
    action: { type: 'shape', kind: 'trapezoid' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <polygon
          points="5,4 13,4 16,15 2,15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:star',
    section: 'shapes',
    label: 'Add star',
    description: 'Star. Highlight or rating.',
    filled: true,
    action: { type: 'shape', kind: 'star' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <polygon
          points="9,1.5 10.8,6.6 16.1,6.7 11.9,9.9 13.4,15.1 9,12 4.6,15.1 6.1,9.9 1.9,6.7 7.2,6.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'shapes:speech-bubble',
    section: 'shapes',
    label: 'Add speech bubble',
    caption: 'Bubble',
    description: 'Speech bubble. A callout with a tail.',
    filled: true,
    action: { type: 'shape', kind: 'speech-bubble' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 3 H14 a2 2 0 0 1 2 2 V10 a2 2 0 0 1 -2 2 H7 L4.5 15.5 L5.5 12 H4 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z" />
      </svg>
    ),
  },
  // --- Tools --------------------------------------------------------------
  {
    id: 'tools:mind-node',
    blurb: 'Tab adds a child, Enter a sibling',
    caption: 'Mind node',
    section: 'build',
    label: 'Add mind node',
    description:
      'A mind-map node. With one selected, Tab adds a child to its right and Enter adds a sibling below — each connected and ready to type into.',
    action: { type: 'shape', kind: 'mind-node' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* A parent node with two branches: the picture IS the behaviour. */}
        <rect x="1.5" y="9" width="8" height="6" rx="2" />
        <rect x="15" y="3" width="7.5" height="5" rx="2" />
        <rect x="15" y="16" width="7.5" height="5" rx="2" />
        <path d="M9.5 12h2.5v-6.5H15M12 12v6.5h3" />
      </svg>
    ),
  },
  {
    // Page (spec/100). Sits first in Write: it is the largest writing
    // surface, and the group reads shortest-to-longest from there. Called
    // Page, not Document, so the palette and the selection toolbar agree —
    // and so it never collides with the Shapes tab's flowchart "document".
    id: 'tools:page',
    blurb: 'A paper-shaped page for prose',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add page',
    caption: 'Page',
    description: 'A paper-sized surface for rich text. Double-click to write.',
    action: { type: 'shape', kind: 'page' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect
          x="3.5"
          y="1.5"
          width="11"
          height="15"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M6 5.5h6M6 8.5h6M6 11.5h3.5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'tools:text',
    blurb: 'A free-standing text label',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add text',
    description: 'Text element. Double-click to edit.',
    shortcut: 'T',
    action: { type: 'text' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M3 5h12M9 5v9M6.5 14h5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'tools:pencil',
    blurb: 'Sketch a stroke, left as drawn',
    section: 'tools',
    toolGroup: 'draw',
    caption: 'Freehand',
    label: 'Freehand pencil',
    description:
      'Sketch a freehand stroke, kept exactly as you drew it. Drag to draw; release near the start to close the shape.',
    shortcut: 'P',
    action: { type: 'freehand' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Diagonal pencil. Body angled bottom-left to top-right, with a
            separated tip + eraser segment so the silhouette reads as
            "pencil" even at the 18 px palette size. Pairs with the cursor
            glyph (also a diagonal nib) so the tool's two visual surfaces
            stay in sync. */}
        <path d="M2 16 L6 12" />
        <path d="M5 13 L12 6 L14 8 L7 15 Z" />
        <path d="M12 6 L15 3 L17 5 L14 8" />
        <path d="M2 16 L5 13" />
      </svg>
    ),
  },
  {
    id: 'tools:shape-pen',
    blurb: 'A rough shape snaps to the real one',
    section: 'tools',
    toolGroup: 'draw',
    caption: 'Shape Pen',
    label: 'Shape pen',
    description:
      'Draw a rough circle, square, triangle or line and it converts to the real shape on release.',
    shortcut: '6',
    action: { type: 'shape-pen' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* The same diagonal nib as Freehand, shrunk to make room for a
            dashed square: the nib says "drawing", the square says "this one
            lands as a shape". Pairs with the shape-pen cursor glyph. */}
        <path d="M1.5 16.5 L4 14" />
        <path d="M3.5 14.5 L9 9 L10.5 10.5 L5 16 Z" />
        <path d="M9 9 L11 7 L12.5 8.5 L10.5 10.5" />
        <rect x="9.5" y="1.5" width="7" height="7" rx="0.8" strokeDasharray="2 1.6" />
      </svg>
    ),
  },
  {
    id: 'tools:highlighter',
    blurb: 'A wide translucent marker stroke',
    section: 'tools',
    toolGroup: 'draw',
    label: 'Highlighter',
    description: 'Wide translucent marker. Drag to call attention to a region.',
    action: { type: 'highlighter' },
    noTint: true,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Chisel-tip marker over a translucent yellow band, so the tile
            reads "highlighter" beside the pencil. Fixed colours (noTint):
            the yellow band is the tool's identity, like the sticky's amber. */}
        <path d="M4 12 L10 6 L13 9 L7 15 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 6 L12 3 L15 6 L13 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M2 16.5 H12" stroke="rgb(253 224 71)" strokeWidth="3" opacity="0.8" />
      </svg>
    ),
  },
  {
    id: 'tools:polygon',
    blurb: 'Straight edges, point by point',
    section: 'tools',
    toolGroup: 'draw',
    label: 'Polygon',
    description: 'Click to place points. Click the start to close, double-click to finish a line.',
    action: { type: 'polygon' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        {/* Irregular polygon with visible vertex dots: reads as
            "place points", distinct from the fixed shape tiles. */}
        <path
          d="M4 14 L5.5 6 L12.5 4 L15 10 L10 15 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="5.5" cy="6" r="1.4" fill="currentColor" />
        <circle cx="12.5" cy="4" r="1.4" fill="currentColor" />
        <circle cx="10" cy="15" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'tools:arrow',
    blurb: 'A connector you place by hand',
    section: 'tools',
    toolGroup: 'draw',
    label: 'Add arrow',
    description: 'Plain connector. Add pointers in the Pointer accordion.',
    shortcut: 'A',
    action: { type: 'arrow' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <line
          x1="3"
          y1="9"
          x2="15"
          y2="9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'tools:sticky',
    blurb: 'A coloured note card',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add sticky note',
    caption: 'Note',
    description: 'Sticky note for short annotations.',
    shortcut: 'N',
    noTint: true,
    action: { type: 'sticky' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M3 3h9l3 3v9H3z"
          fill="rgb(254 243 199)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 3v3h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'tools:table',
    blurb: 'An editable grid of cells',
    section: 'build',
    label: 'Add table',
    description: 'Editable grid. Double-click a cell to type.',
    action: { type: 'table' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <rect x="2.5" y="3.5" width="13" height="11" rx="1" />
        <line x1="2.5" y1="7.5" x2="15.5" y2="7.5" />
        <line x1="2.5" y1="11" x2="15.5" y2="11" />
        <line x1="7" y1="3.5" x2="7" y2="14.5" />
        <line x1="11" y1="3.5" x2="11" y2="14.5" />
      </svg>
    ),
  },
  {
    id: 'tools:code-block',
    blurb: 'Syntax-highlighted code card',
    section: 'components',
    label: 'Add code block',
    caption: 'Code',
    description: 'Monospace code snippet with syntax highlighting. Double-click to edit.',
    noTint: true,
    action: { type: 'shape', kind: 'code-block' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        {/* Dark editor card with angle brackets: the tile mirrors the
            element's fixed dark identity, so it stays untinted. */}
        <rect x="1.5" y="2.5" width="15" height="13" rx="2" fill="rgb(15 23 42)" />
        <path
          d="M7 7 L5 9 L7 11 M11 7 L13 9 L11 11"
          fill="none"
          stroke="rgb(148 163 184)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    // Selection Mode buttons (spec/103): one tile per mode, grouped, so the
    // button lands pointed at the mode you wanted rather than at the default
    // you then have to change.
    id: 'tools:mode-avatar',
    tileGroup: 'mode',
    blurb: 'Walk a character around the board',
    caption: 'Avatar',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Avatar mode button',
    description:
      'A button that switches whoever presses it into Avatar mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'avatar' },
    icon: <ModeGroupIcon />,
  },
  {
    id: 'tools:mode-select',
    tileGroup: 'mode',
    blurb: 'The ordinary pointer',
    caption: 'Select',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Select mode button',
    description:
      'A button that switches whoever presses it into Select mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'select' },
    icon: <ModeGroupIcon />,
  },
  {
    id: 'tools:mode-pan',
    tileGroup: 'mode',
    blurb: 'Drag the canvas around',
    caption: 'Hand',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Hand mode button',
    description:
      'A button that switches whoever presses it into Hand mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'pan' },
    icon: <ModeGroupIcon />,
  },
  {
    id: 'tools:mode-laser',
    tileGroup: 'mode',
    blurb: 'Point at things while you talk',
    caption: 'Laser',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Laser mode button',
    description:
      'A button that switches whoever presses it into Laser mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'laser' },
    icon: <ModeGroupIcon />,
  },
  {
    id: 'tools:mode-spotlight',
    tileGroup: 'mode',
    blurb: 'Dim everything but one patch',
    caption: 'Spotlight',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Spotlight mode button',
    description:
      'A button that switches whoever presses it into Spotlight mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'spotlight' },
    icon: <ModeGroupIcon />,
  },
  {
    id: 'tools:mode-eraser',
    tileGroup: 'mode',
    blurb: 'Rub things out by dragging',
    caption: 'Eraser',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Eraser mode button',
    description:
      'A button that switches whoever presses it into Eraser mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'eraser' },
    icon: <ModeGroupIcon />,
  },
  {
    id: 'tools:mode-format',
    tileGroup: 'mode',
    blurb: 'Copy one element\u2019s style onto others',
    caption: 'Format',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Format mode button',
    description:
      'A button that switches whoever presses it into Format mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'format' },
    icon: <ModeGroupIcon />,
  },
  {
    id: 'tools:mode-isometric',
    tileGroup: 'mode',
    blurb: 'Tilt the board into 3D',
    caption: 'Isometric',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Isometric mode button',
    description:
      'A button that switches whoever presses it into Isometric mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'isometric' },
    icon: <ModeGroupIcon />,
  },
  {
    // Portal (spec/104): step in here, come out of the portal it is linked to.
    // The tile id keeps its original 'door' word because it is persisted in
    // saved favourites — renaming it would silently drop the tile for anyone
    // who had favourited it.
    id: 'tools:door',
    tileGroup: 'move',
    blurb: 'Step through to its linked portal',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add portal',
    caption: 'Portal',
    description:
      'Click it, or walk your Avatar character into it, and you come out of the portal it is linked to. Link a pair from the element menu.',
    filled: true,
    action: { type: 'shape', kind: 'portal' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* The standing oval ring, with the far side showing through it. */}
        <ellipse cx="9" cy="9" rx="4.6" ry="7" />
        <ellipse cx="9" cy="9" rx="2.1" ry="3.6" strokeWidth="1.1" opacity="0.6" />
      </svg>
    ),
  },
  {
    // Session button (spec/105): starts a timer / vote / poll for the ro  {
    // Session tools (spec/105): one tile per tool, grouped, rather than one
    // button you place and then reconfigure. The tools have nothing in common
    // at the moment of choosing — you know whether you want a countdown or a
    // vote before you reach for the palette.
    id: 'tools:session-timer',
    tileGroup: 'session',
    blurb: 'A countdown everyone can see',
    caption: 'Timer',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add timer button',
    description:
      'A button that starts a countdown for everyone in the room. Pressing it again pauses, and again continues. Set the minutes from its right-click menu.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'timer' },
    icon: <TimerIcon />,
  },
  {
    id: 'tools:session-vote',
    tileGroup: 'session',
    blurb: 'Dot voting, a few dots each',
    caption: 'Dot vote',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add dot vote button',
    description:
      'A button that starts a dot vote for everyone in the room: each person gets a few dots to place on whatever they think matters. Set how many from its right-click menu.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'vote' },
    icon: <SessionVoteIcon />,
  },
  {
    id: 'tools:session-poll',
    tileGroup: 'session',
    blurb: 'A question you write in advance',
    caption: 'Poll',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add poll button',
    description:
      'A button that opens a poll you have written in advance, so the press asks the question rather than opening a composer. Write it from its right-click menu.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'poll' },
    icon: <SessionPollIcon />,
  },
  {
    // Reveal zone (spec/106): a cover you click to see what is underneath.
    id: 'tools:reveal',
    tileGroup: 'facilitate',
    blurb: 'Double-click to look underneath',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add reveal zone',
    caption: 'Reveal',
    description:
      'A cover over part of the canvas. Click it to uncover it just for you, or reveal it for everyone from the menu.',
    filled: true,
    action: { type: 'shape', kind: 'reveal' },
    icon: <RevealIcon />,
  },
  {
    // Done check (spec/137): who has finished, live.
    id: 'tools:done-check',
    tileGroup: 'facilitate',
    blurb: 'Everyone marks themselves finished',
    caption: 'Done',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add done check',
    description:
      'Everyone marks themselves done and the card shows who has and who has not, from whoever is actually in the room. It flashes when the last person finishes. Reset it for the next round from its own menu.',
    filled: true,
    action: { type: 'shape', kind: 'done-check' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Two ticked rows over one still waiting. */}
        <path d="M3.2 7.2 4.6 8.6 7.4 5.8" />
        <path d="M3.2 13 4.6 14.4 7.4 11.6" />
        <circle cx="4.8" cy="19" r="1.5" />
        <path d="M10.5 7.2h10.3M10.5 13h10.3M10.5 19h6.4" />
      </svg>
    ),
  },
  {
    // Reaction pads (spec/135): one tile per reaction, grouped, rather than one
    // pad you place and then switch. Which reaction you want is the whole
    // decision — a pad is not useful until it is the right one.
    id: 'tools:reaction-confetti',
    tileGroup: 'reaction',
    blurb: 'A result worth celebrating',
    caption: 'Confetti',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add confetti pad',
    description:
      'Press it, or walk a character onto it in Avatar mode, and confetti bursts up and falls for everyone in the room. A result worth celebrating.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'confetti' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['confetti']}</span>,
  },
  {
    id: 'tools:reaction-sparkles',
    tileGroup: 'reaction',
    blurb: 'A good idea, nicely done',
    caption: 'Sparkles',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add sparkles pad',
    description:
      'Press it, or walk a character onto it in Avatar mode, and a slow twinkle around the pad for everyone in the room. A good idea, nicely done.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'sparkles' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['sparkles']}</span>,
  },
  {
    id: 'tools:reaction-hearts',
    tileGroup: 'reaction',
    blurb: 'Warmth for a person, not a result',
    caption: 'Hearts',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add hearts pad',
    description:
      'Press it, or walk a character onto it in Avatar mode, and hearts rise and drift for everyone in the room. Warmth for a person, not a result.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'hearts' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['hearts']}</span>,
  },
  {
    id: 'tools:reaction-applause',
    tileGroup: 'reaction',
    blurb: 'Thanks for the talk or the demo',
    caption: 'Applause',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add applause pad',
    description:
      'Press it, or walk a character onto it in Avatar mode, and rings of sound spread out for everyone in the room. Thanks for the talk or the demo.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'applause' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['applause']}</span>,
  },
  {
    id: 'tools:reaction-fireworks',
    tileGroup: 'reaction',
    blurb: 'It shipped',
    caption: 'Fireworks',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add fireworks pad',
    description:
      'Press it, or walk a character onto it in Avatar mode, and shells burst one after another for everyone in the room. It shipped.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'fireworks' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['fireworks']}</span>,
  },
  {
    // Picker (spec/107): rolls a person or a written option.
    id: 'tools:picker',
    tileGroup: 'facilitate',
    blurb: 'Pick someone at random',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add picker',
    caption: 'Picker',
    description:
      'Press it to choose at random — one of the people in the room, or one of the options you write on it.',
    filled: true,
    action: { type: 'shape', kind: 'picker' },
    icon: <PickerIcon />,
  },
  {
    // Chair (spec/130): Behaviour, because what it does only happens when
    // somebody interacts with it — here by walking an Avatar-mode character
    // into it rather than by pressing it.
    id: 'tools:chair',
    tileGroup: 'move',
    blurb: 'A chair for Avatars to sit in',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add chair',
    caption: 'Chair',
    description:
      'Furniture for Avatar mode: walk your character into one and it sits down. Give the room a seating plan.',
    filled: true,
    action: { type: 'shape', kind: 'chair' },
    icon: <ChairIcon />,
  },
  // --- Collaborate (spec/123 to spec/129) ----------------------------------
  // Elements that collect what the ROOM thinks. Rows with a blurb, like
  // Behaviour: none of these glyphs can say what the element does, and
  // "everyone picks privately, then all at once" is the thing being chosen.
  {
    // Comment pin (spec/136): a remark about a PLACE rather than a shape.
    id: 'collab:comment-pin',
    blurb: 'A comment thread as a card on the board',
    caption: 'Comment',
    section: 'collaborate',
    label: 'Add comment panel',
    description:
      'A marker that carries a comment thread. Drop it on any spot and click it to talk about that spot, rather than attaching the remark to whichever shape happens to be nearest.',
    filled: true,
    action: { type: 'shape', kind: 'comment-pin' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20.5 12.2c0 3.9-3.8 7-8.5 7-.9 0-1.8-.1-2.6-.3l-5 3.1 1.1-4.5A6.6 6.6 0 0 1 3.5 12.2c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
        <path d="M8.6 11.9h.01M12 11.9h.01M15.4 11.9h.01" />
      </svg>
    ),
  },
  {
    // Estimate cards (spec/123): one tile per SCALE, grouped. Which scale a
    // team estimates on is a standing decision, not something you change per
    // card, so it belongs at the moment you reach for one.
    id: 'collab:estimate-fibonacci',
    tileGroup: 'ask',
    blurb: '1, 2, 3, 5, 8, 13, 21',
    caption: 'Fibonacci',
    section: 'collaborate',
    label: 'Add Fibonacci estimate card',
    description:
      'Planning poker on the canvas: everyone picks privately, then one Reveal shows every answer and the spread. Uses the classic story-point scale, where the gaps widen as the numbers grow so nobody argues over 6 versus 7.',
    filled: true,
    action: { type: 'shape', kind: 'estimate', estimateScale: 'fibonacci' },
    icon: <EstimateIcon />,
  },
  {
    id: 'collab:estimate-tshirt',
    tileGroup: 'ask',
    blurb: 'XS through XL',
    caption: 'T-shirt',
    section: 'collaborate',
    label: 'Add T-shirt estimate card',
    description:
      'Planning poker on the canvas: everyone picks privately, then one Reveal shows every answer and the spread. Uses sizes rather than numbers, for a room that starts haggling the moment it sees a digit.',
    filled: true,
    action: { type: 'shape', kind: 'estimate', estimateScale: 'tshirt' },
    icon: <EstimateIcon />,
  },
  {
    id: 'collab:estimate-powers',
    tileGroup: 'ask',
    blurb: '1, 2, 4, 8, 16',
    caption: 'Powers of two',
    section: 'collaborate',
    label: 'Add Powers of two estimate card',
    description:
      'Planning poker on the canvas: everyone picks privately, then one Reveal shows every answer and the spread. Uses doubling steps, for sizing where each step up is meant to feel twice the work.',
    filled: true,
    action: { type: 'shape', kind: 'estimate', estimateScale: 'powers' },
    icon: <EstimateIcon />,
  },
  {
    id: 'collab:temperature',
    tileGroup: 'ask',
    blurb: 'Fist of five: how does the room feel?',
    section: 'collaborate',
    label: 'Add temperature check',
    caption: 'Temperature',
    description:
      'A fist-of-five gauge. Everyone registers 1 to 5 and the bars and average move as the answers land.',
    filled: true,
    action: { type: 'shape', kind: 'temperature' },
    icon: <TemperatureIcon />,
  },
  {
    id: 'collab:idea-box',
    tileGroup: 'ask',
    blurb: 'Anonymous ideas, held until you open it',
    section: 'collaborate',
    label: 'Add idea box',
    caption: 'Idea box',
    description:
      'Anyone can drop in an idea without their name on it. Nothing shows until you open the box.',
    filled: true,
    action: { type: 'shape', kind: 'idea-box' },
    icon: <IdeaBoxIcon />,
  },
  {
    id: 'collab:agenda',
    tileGroup: 'record',
    blurb: 'Segments with minutes that start the timer',
    section: 'collaborate',
    label: 'Add agenda',
    caption: 'Agenda',
    description:
      'The run of the session. Press a segment and it starts the tab timer for that long and marks where the room is.',
    filled: true,
    action: { type: 'shape', kind: 'agenda' },
    icon: <AgendaIcon />,
  },
  {
    id: 'collab:decision',
    tileGroup: 'record',
    blurb: 'What was decided, why, and whether it stands',
    section: 'collaborate',
    label: 'Add decision record',
    caption: 'Decision record',
    description:
      'A decision on the diagram beside the thing it decided: the statement, a status, the date, and what drove it.',
    filled: true,
    action: { type: 'shape', kind: 'decision' },
    icon: <DecisionIcon />,
  },
  {
    id: 'collab:roll-call',
    tileGroup: 'record',
    blurb: 'Freezes who was in the room, right now',
    section: 'collaborate',
    label: 'Add roll call',
    caption: 'Roll call',
    description:
      'Press Take roll and it records everyone in the room at that moment, and keeps them after they leave.',
    filled: true,
    action: { type: 'shape', kind: 'roll-call' },
    icon: <RollCallIcon />,
  },
  {
    id: 'tools:checklist',
    blurb: 'Tickable to-do rows',
    section: 'components',
    label: 'Add checklist',
    caption: 'Checklist',
    description: 'Checkable to-do rows. Tick boxes on the canvas; edit rows from the menu.',
    filled: true,
    action: { type: 'shape', kind: 'checklist' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="3" width="4" height="4" rx="1" />
        <path d="M3.7 5 L4.6 5.9 L6 4.3" strokeWidth="1.2" />
        <path d="M9 5 H15.5" />
        <rect x="2.5" y="10.5" width="4" height="4" rx="1" />
        <path d="M9 12.5 H15.5" />
      </svg>
    ),
  },
  {
    id: 'tools:image',
    blurb: 'Place an uploaded picture',
    section: 'media',
    label: 'Add image',
    description: 'Drop an image placeholder + pick / upload a file.',
    shortcut: '9',
    noTint: true,
    needsImage: true,
    action: { type: 'image' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect
          x="2.5"
          y="3"
          width="13"
          height="12"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="7" cy="7" r="1.25" fill="currentColor" />
        <path
          d="M2.5 12 L6.5 8.5 L10 11 L13 8 L15.5 10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'media:embed-youtube',
    tileGroup: 'embed',
    blurb: 'A YouTube video',
    caption: 'YouTube',
    section: 'media',
    label: 'Add YouTube embed',
    description:
      'Embeds a YouTube link on the canvas. Double-click it to set the link; it loads when you press play.',
    action: { type: 'video', provider: 'youtube' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: `<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="M10.5 8.75 16 12l-5.5 3.25z" fill="#ffffff" />`,
        }}
      />
    ),
  },
  {
    id: 'media:embed-vimeo',
    tileGroup: 'embed',
    blurb: 'A Vimeo video',
    caption: 'Vimeo',
    section: 'media',
    label: 'Add Vimeo embed',
    description:
      'Embeds a Vimeo link on the canvas. Double-click it to set the link; it loads when you press play.',
    action: { type: 'video', provider: 'vimeo' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: `<rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M7 9c1.6-1.5 3 .4 3.4 2 .5 2 1 3.6 2 1.4C13.6 9.9 12.4 8 15 8c2 0 2.4 2.2 1.3 4.4C15 15.4 12.6 17 11 16c-1.7-1-2-4.2-2.6-5.4-.4-.8-.9-.4-1.4 0z" fill="currentColor" stroke="none" />`,
        }}
      />
    ),
  },
  {
    id: 'media:embed-loom',
    tileGroup: 'embed',
    blurb: 'A Loom recording',
    caption: 'Loom',
    section: 'media',
    label: 'Add Loom embed',
    description:
      'Embeds a Loom link on the canvas. Double-click it to set the link; it loads when you press play.',
    action: { type: 'video', provider: 'loom' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /><path d="M12 3v5M12 16v5M3 12h5M16 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
        }}
      />
    ),
  },
  {
    id: 'media:embed-figma',
    tileGroup: 'embed',
    blurb: 'A Figma file or prototype',
    caption: 'Figma',
    section: 'media',
    label: 'Add Figma embed',
    description:
      'Embeds a Figma link on the canvas. Double-click it to set the link; it loads when you press play.',
    action: { type: 'video', provider: 'figma' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: `<rect x="7" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="12" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="8.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><circle cx="14.5" cy="11.5" r="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="14.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" />`,
        }}
      />
    ),
  },
  {
    id: 'media:embed-gdocs',
    tileGroup: 'embed',
    blurb: 'A Doc, Sheet or Slide deck',
    caption: 'Google Docs',
    section: 'media',
    label: 'Add Google Docs embed',
    description:
      'Embeds a Google Docs link on the canvas. Double-click it to set the link; it loads when you press play.',
    action: { type: 'video', provider: 'gdocs' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: `<path d="M6 2.5h7l5 5v14H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="M13 2.5v5h5M9 12h6M9 15.5h6M9 19h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
        }}
      />
    ),
  },
  {
    id: 'media:embed-website',
    tileGroup: 'embed',
    blurb: 'Any site, framed on the canvas',
    caption: 'Website',
    section: 'media',
    label: 'Add website embed',
    description:
      'Embeds any website on the canvas. Double-click it to set the address; it loads when you press play. Some sites refuse to be framed and will come up blank.',
    action: { type: 'video', provider: 'website' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: `<circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.6" /><path d="M2.8 12h18.4M12 2.8c2.6 2.6 3.9 5.8 3.9 9.2s-1.3 6.6-3.9 9.2c-2.6-2.6-3.9-5.8-3.9-9.2s1.3-6.6 3.9-9.2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />`,
        }}
      />
    ),
  },
  {
    id: 'tools:avatar',
    blurb: 'A circular photo of a person',
    section: 'media',
    label: 'Add avatar',
    description:
      'Avatar. A circular image. Tap to drop or drag to size; double-click it to pick / upload a photo.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'avatar' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="9.5" r="3" />
        <path d="M6.5 19a6 6 0 0 1 11 0" />
      </svg>
    ),
  },
  {
    id: 'tools:entity',
    blurb: 'A class or table: title over fields',
    caption: 'Entity',
    section: 'components',
    label: 'Add entity',
    description:
      'A UML class or ER entity: a title bar over a list of name / type fields. Edit the fields from its right-click menu.',
    action: { type: 'shape', kind: 'entity' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* A titled box with rows: the classic class-diagram silhouette. */}
        <rect x="3.5" y="3" width="17" height="18" rx="2" />
        <path d="M3.5 8.5h17M7 12h6M7 15.5h9" />
      </svg>
    ),
  },
  {
    id: 'tools:lane',
    blurb: 'A titled band that carries its steps',
    caption: 'Lane',
    section: 'build',
    label: 'Add lane',
    description:
      'A swimlane: a horizontal band with a title down its left edge. Dragging it carries everything inside, like a frame.',
    action: { type: 'shape', kind: 'lane' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Two stacked bands, each with its title gutter. */}
        <rect x="2" y="5" width="20" height="6.5" rx="1.5" />
        <rect x="2" y="13" width="20" height="6.5" rx="1.5" />
        <path d="M8 5v6.5M8 13v6.5" />
      </svg>
    ),
  },
  {
    id: 'tools:frame',
    blurb: 'A labelled box that groups a section',
    section: 'build',
    label: 'Add frame',
    description: 'Frame. A titled container you draw around a cluster of elements.',
    shortcut: 'F',
    action: { type: 'shape', kind: 'frame' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="4" width="13" height="10.5" />
        <path d="M2.5 6.8 H8.5" />
      </svg>
    ),
  },
  {
    id: 'tools:annotation',
    blurb: 'A marker that holds a note',
    section: 'tools',
    // Last in Write, and the odd one out in it: an annotation is a MARKER you
    // drop on the diagram that happens to hold text, not a surface you write
    // on like Text, a sticky or a Page. It briefly sat in its own Blocks group
    // for exactly that reason, but spec/110 emptied Blocks out and deleted it,
    // so Write is where it lives — ordered last, after the three surfaces,
    // which is the distinction the row order now carries.
    toolGroup: 'write',
    label: 'Add annotation',
    description: 'Annotation. A note marker: hover to read it, click to edit.',
    filled: true,
    action: { type: 'annotation' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
        <path d="M6.5 9.75h11" />
        <path d="M6.5 12.5h7" />
      </svg>
    ),
  },
  {
    id: 'tools:link-card',
    blurb: 'A clickable preview of a link',
    // Get around (spec/110), beside Portal and Chair: the group is what an
    // element DOES, and all three take you somewhere. A portal moves you to
    // another tab, a chair seats your character, a link card sends you out to
    // the page. It sat under Components, which groups by what a thing looks
    // like — a ready-made composite you recolour — and a link card is neither
    // composite nor decoration.
    section: 'tools',
    toolGroup: 'behaviour',
    tileGroup: 'move',
    label: 'Add link card',
    description: "Link card. A bookmark preview with the page's title, favicon, and image.",
    noTint: true,
    action: { type: 'link-card' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
      </svg>
    ),
  },
  {
    id: 'tools:timeline',
    blurb: 'A track for sequencing events',
    section: 'build',
    label: 'Add timeline rail',
    caption: 'Timeline',
    description: 'A line with points above it. Add more points from its right-end button.',
    filled: true,
    action: { type: 'shape', kind: 'timeline-rail' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <line
          x1="2"
          y1="12"
          x2="16"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="4.5" cy="6" r="1.8" fill="currentColor" />
        <circle cx="9" cy="6" r="1.8" fill="currentColor" />
        <circle cx="13.5" cy="6" r="1.8" fill="currentColor" />
      </svg>
    ),
  },
  // --- Data (spec/53) -------------------------------------------------------
  {
    id: 'data:pie',
    blurb: 'Proportions of a whole',
    section: 'data',
    label: 'Add pie chart',
    caption: 'Pie',
    description: 'A pie chart. Edit its labels + values from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'pie-chart' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.25" />
        <path d="M12 12 L12 3 A9 9 0 0 1 20.5 15 Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'data:bar',
    blurb: 'Compare values side by side',
    section: 'data',
    label: 'Add bar chart',
    caption: 'Bar',
    description: 'A bar chart. Edit its labels + values from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'bar-chart' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="4" y="12" width="4" height="8" rx="1" opacity="0.45" />
        <rect x="10" y="7" width="4" height="13" rx="1" />
        <rect x="16" y="10" width="4" height="10" rx="1" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: 'data:line',
    blurb: 'A trend over time',
    section: 'data',
    label: 'Add line chart',
    caption: 'Line',
    description:
      'A multi-series line chart. Edit the data grid or import a CSV from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'line-chart' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 18 L9 11 L14 14 L20 6" />
      </svg>
    ),
  },
  {
    id: 'data:progress-bar',
    blurb: 'How far along something is',
    section: 'data',
    label: 'Add progress bar',
    caption: 'Progress',
    description: 'Horizontal progress bar. Set the percentage from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'progress-bar' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect
          x="2"
          y="6.5"
          width="14"
          height="5"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <rect x="2" y="6.5" width="8" height="5" rx="2.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'data:progress-ring',
    blurb: 'The same, as a donut meter',
    section: 'data',
    label: 'Add progress ring',
    caption: 'Donut',
    description: 'Donut progress ring. Set the percentage from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'progress-ring' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" aria-hidden>
        <circle cx="9" cy="9" r="6" strokeWidth="2.4" opacity="0.3" />
        <path d="M9 3 a6 6 0 0 1 5.2 9" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'data:rating',
    blurb: 'A score out of five stars',
    section: 'data',
    label: 'Add rating',
    caption: 'Rating',
    description: 'A 1–5 star rating. Set the score + an animation from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'rating' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  // --- Components (spec/09) -------------------------------------------------
  {
    id: 'components:banner',
    tileGroup: 'web',
    blurb: 'A themed title block for the top',
    caption: 'Banner',
    section: 'components',
    label: 'Add banner',
    description:
      'Banner. A themed title block (accent bar with a title and subtitle) to head your diagram. Tap to drop or drag to size; drops as a group you can recolour, retitle, or ungroup.',
    noTint: true,
    action: { type: 'component', kind: 'banner' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M7 10.75h10" strokeWidth="2.2" />
        <path d="M9 14.25h6" />
      </svg>
    ),
  },
  {
    id: 'components:callout',
    tileGroup: 'web',
    blurb: 'A note box with an icon and title',
    caption: 'Callout',
    section: 'components',
    label: 'Add callout',
    description:
      'Callout. A soft note box with an icon, title, and body for annotating a diagram. Tap to drop or drag to size.',
    noTint: true,
    action: { type: 'component', kind: 'callout' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
        <circle cx="7" cy="9" r="2" fill="currentColor" stroke="none" />
        <path d="M11 8.5h8M6 13h13M6 16h9" />
      </svg>
    ),
  },
  {
    id: 'components:stat',
    tileGroup: 'web',
    blurb: 'Three KPI cards side by side',
    caption: 'Stat row',
    section: 'components',
    label: 'Add stat row',
    description:
      'Stat row. Three KPI cards (big number + caption) for dashboards / summaries. Tap to drop or drag to size.',
    noTint: true,
    action: { type: 'component', kind: 'stat' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2" y="6" width="6" height="12" rx="1" />
        <rect x="9" y="6" width="6" height="12" rx="1" />
        <rect x="16" y="6" width="6" height="12" rx="1" />
        <path d="M3.5 10.5h3M10.5 10.5h3M17.5 10.5h3" />
      </svg>
    ),
  },
  {
    id: 'components:process',
    tileGroup: 'web',
    blurb: 'Numbered steps joined by arrows',
    caption: 'Process',
    section: 'components',
    label: 'Add process steps',
    description:
      'Process steps. Numbered circles joined by arrows with captions, for flows. Tap to drop or drag to size.',
    noTint: true,
    action: { type: 'component', kind: 'process' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="5" cy="12" r="3" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="12" r="3" />
        <path d="M8 12h1M15 12h1" />
      </svg>
    ),
  },
  {
    id: 'components:hero',
    tileGroup: 'web',
    blurb: 'A big image with a title card',
    caption: 'Hero',
    section: 'components',
    label: 'Add hero',
    description:
      'Hero. A large image with a title and supporting line on a themed caption card. Tap to drop or drag to size; double-click the image to set it.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'hero' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
        <path d="M2.5 14l5-4 4 3 3-2.5 7 5.5" />
        <path d="M7 17.5h10" strokeWidth="2.2" />
      </svg>
    ),
  },
  {
    id: 'components:header',
    tileGroup: 'web',
    blurb: 'A website-style nav bar',
    caption: 'Header',
    section: 'components',
    label: 'Add header',
    description:
      'Header. A website-style bar with a circular avatar, brand title, and nav links. Tap to drop or drag to size; double-click the avatar to set it.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'header' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
        <circle cx="7" cy="12" r="2.2" />
        <path d="M14 10.5h5M14 13.5h5" />
      </svg>
    ),
  },
  // --- Devices (spec/09) ------------------------------------------------------
  {
    id: 'devices:browser',
    blurb: 'A desktop web page frame',
    section: 'devices',
    label: 'Add web browser',
    caption: 'Browser',
    description: 'Browser window. Wireframe a web page or a web-app screen.',
    filled: true,
    action: { type: 'shape', kind: 'browser' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2" y="3" width="14" height="12" rx="1.5" />
        <path d="M2 7 L16 7" />
      </svg>
    ),
  },
  {
    id: 'devices:monitor',
    blurb: 'A full-screen desktop layout',
    section: 'devices',
    label: 'Add computer monitor',
    caption: 'Monitor',
    description: 'Desktop monitor with stand. Wireframe a desktop app.',
    filled: true,
    action: { type: 'shape', kind: 'monitor' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2" y="2.5" width="14" height="9" rx="1" />
        <path d="M6 15.5 L12 15.5" />
        <path d="M9 11.5 L9 15.5" />
      </svg>
    ),
  },
  {
    id: 'devices:laptop',
    blurb: 'A portable-screen view',
    section: 'devices',
    label: 'Add laptop',
    description: 'Laptop. Screen plus keyboard base.',
    filled: true,
    action: { type: 'shape', kind: 'laptop' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3.5" y="3" width="11" height="8" rx="1" />
        <path d="M1.5 14 L16.5 14 L15 11 L3 11 Z" />
      </svg>
    ),
  },
  {
    id: 'devices:phone',
    blurb: 'A mobile app or page',
    section: 'devices',
    label: 'Add phone',
    description: 'Phone. Wireframe a mobile screen.',
    filled: true,
    action: { type: 'shape', kind: 'phone' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="5.5" y="1.5" width="7" height="15" rx="1.6" />
      </svg>
    ),
  },
  {
    id: 'devices:tablet',
    blurb: 'A larger touch layout',
    section: 'devices',
    label: 'Add tablet',
    description: 'Tablet. Larger than a phone, smaller than a laptop screen.',
    filled: true,
    action: { type: 'shape', kind: 'tablet' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="2" width="12" height="14" rx="1.2" />
      </svg>
    ),
  },
  {
    id: 'devices:smartwatch',
    blurb: 'A compact wearable screen',
    section: 'devices',
    label: 'Add smartwatch',
    caption: 'Watch',
    description: 'Smartwatch. A wrist-device frame for watch-app wireframes.',
    filled: true,
    action: { type: 'shape', kind: 'smartwatch' },
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="5.5" y="4" width="7" height="10" rx="2.2" />
        <path d="M7 4 V1.8 M11 4 V1.8 M7 14 V16.2 M11 14 V16.2 M12.5 8 H14" />
      </svg>
    ),
  },
];

export function tilesInSection(section: PaletteTileSection): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === section);
}

// The Tools tab's grouped view (spec/09 "Sub-categories"): the tools-section
// tiles carrying the given group, in catalogue order.
export function tilesInToolGroup(group: ToolGroupId): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === 'tools' && t.toolGroup === group);
}

export function tileById(id: string): PaletteTileDef | undefined {
  return PALETTE_TILES.find((t) => t.id === id);
}

// The tile's short human name: the explicit caption where one is set,
// otherwise derived from the action label the same way IconButton derives
// its tile caption ("Add web browser" → "Web browser", "Pencil (freehand)"
// → "Pencil"). Used by the edit-favourites dialog rows.
export function tileDisplayName(def: PaletteTileDef): string {
  if (def.caption) return def.caption;
  const base = def.label
    .replace(/^add\s+/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * The tiles behind a palette CATEGORY id, which is not the same thing as a
 * section id.
 *
 * Most categories are a section. Three are not: Write, Draw and Behaviour are
 * tool GROUPS inside the tools section (spec/110), so `tilesInSection('write')`
 * is empty and a caller that assumed otherwise silently showed nothing. The
 * Edit Favourites dialog assumed exactly that and dropped all three.
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
