import type { ComponentKind, ShapeKind } from '@livediagram/diagram';
import { PickerIcon, RevealIcon, TimerIcon } from '@/components/palette/palette-icons';

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
  | 'tools'
  | 'data'
  | 'media'
  | 'components'
  | 'devices'
  | 'icons'
  | 'technology';

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
type PaletteTileAction =
  | { type: 'shape'; kind: ShapeKind }
  | { type: 'text' }
  | { type: 'freehand' }
  // Marker variant of the pencil (spec/81) and the click-to-place
  // vertex tool (spec/84) — separate action types so each tile maps
  // to its own arm-handler and pressed state.
  | { type: 'highlighter' }
  | { type: 'shape-pen' }
  | { type: 'video' }
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
export const TOOL_GROUPS: { id: ToolGroupId; label: string; description: string }[] = [
  {
    id: 'write',
    label: 'Write',
    description: 'The wordy elements: pages, text, sticky notes, and annotations.',
  },
  {
    // Split back out from a combined "Write & Draw" (spec/110): once both were
    // one click from the category picker rather than two inside Tools, the
    // pairing bought nothing and the combined list ran to eight rows.
    id: 'draw',
    label: 'Draw',
    description: 'The gesture tools: pencil, highlighter, polygon, and arrows.',
  },
  // Behaviour (spec/103): elements that DO something when someone interacts
  // with them, rather than elements that say something. Last, because a
  // diagram is drawn before it is wired up.
  {
    id: 'behaviour',
    label: 'Behaviour',
    description:
      'Elements that do something when pressed: switch a mode, portal across the canvas, start a timer or vote, cover something up, or pick at random.',
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
    section: 'tools',
    toolGroup: 'write',
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
    shortcut: 'S',
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
    section: 'data',
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
    // Selection Mode button (spec/103): a control you press to change your own
    // selection mode — Avatar by default, so a diagram can invite people to
    // walk it. The tile id is NOT renamed with the label: it is persisted in
    // saved favourites, and changing it would silently drop the tile from
    // anyone who had favourited it.
    id: 'tools:mode-button',
    blurb: 'Switches your selection mode',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add selection mode button',
    caption: 'Selection Mode',
    description:
      'A button on the canvas that switches whoever presses it into a selection mode. Avatar by default; pick another from the element menu.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button' },
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
        {/* A square button, sunk under a pointer that is pressing it: the two
            halves of what the element is. The press lines sell the click. */}
        <rect x="1.6" y="2.4" width="11" height="11" rx="2.6" />
        <path d="M4.4 6.1h5.4M4.4 8.6h3.4" strokeWidth="1.2" />
        <path d="M1.1 4.2 A2.6 2.6 0 0 1 3.4 2" strokeWidth="1" opacity="0.55" />
        <path
          d="M9.8 8.7 L16.9 12.1 L13.6 13 L15.4 16.2 L14 17 L12.2 13.8 L10 16 Z"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    ),
  },
  {
    // Portal (spec/104): step in here, come out of the portal it is linked to.
    // The tile id keeps its original 'door' word because it is persisted in
    // saved favourites — renaming it would silently drop the tile for anyone
    // who had favourited it.
    id: 'tools:door',
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
    // Session button (spec/105): starts a timer / vote / poll for the room.
    id: 'tools:session-button',
    blurb: 'Starts a timer, vote or poll',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add session button',
    caption: 'Session',
    description:
      'A button that starts a session tool for everyone: a countdown timer, a dot vote, or a poll you write in advance.',
    filled: true,
    action: { type: 'shape', kind: 'session-button' },
    icon: <TimerIcon />,
  },
  {
    // Reveal zone (spec/106): a cover you click to see what is underneath.
    id: 'tools:reveal',
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
    // Picker (spec/107): rolls a person or a written option.
    id: 'tools:picker',
    blurb: 'Picks someone or something at random',
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
    id: 'media:video',
    blurb: 'A YouTube video that plays here',
    caption: 'Video',
    section: 'media',
    label: 'Add video',
    description:
      'A YouTube video. Double-click to set its link; it plays inline when you press play.',
    action: { type: 'video' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        {/* The YouTube lozenge + triangle, so the tile names the service
            rather than showing a generic film glyph. */}
        <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
        <path d="M10.5 8.75 16 12l-5.5 3.25z" fill="#ffffff" />
      </svg>
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
    id: 'tools:lane',
    blurb: 'A titled band that carries its steps',
    caption: 'Lane',
    section: 'tools',
    toolGroup: 'draw',
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
    section: 'tools',
    toolGroup: 'draw',
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
    // Blocks, not Write: an annotation is a MARKER you drop on the diagram
    // that happens to hold text, not a surface you write on like Text, a
    // sticky or a Page. Grouping it with the writing surfaces implied you
    // compose in it.
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
    section: 'components',
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
    section: 'components',
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
