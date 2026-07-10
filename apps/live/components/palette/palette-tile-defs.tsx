import type { ComponentKind, ShapeKind } from '@livediagram/diagram';

// The shared palette tile catalogue (spec/78): every creation tile across
// the Shapes / Tools / Data / Components / Devices categories as one data
// entry — label, glyph, tinting flags, and an action descriptor that
// PaletteTileGrid maps to the editor's add-handlers. The category tabs and
// the Favourites grid all render from this one catalogue, so a tile is
// defined once and Favourites can never drift from the home tabs.
//
// Pure data: a flat catalogue, exempt from the file-size target (see
// CLAUDE.md) — extend it in place rather than splitting it.

export type PaletteTileSection = 'shapes' | 'tools' | 'data' | 'components' | 'devices';

export const PALETTE_TILE_SECTIONS: { id: PaletteTileSection; label: string }[] = [
  { id: 'shapes', label: 'Shapes' },
  { id: 'tools', label: 'Tools' },
  { id: 'data', label: 'Data' },
  { id: 'components', label: 'Components' },
  { id: 'devices', label: 'Devices' },
];

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
export type PaletteTileAction =
  | { type: 'shape'; kind: ShapeKind }
  | { type: 'text' }
  | { type: 'freehand' }
  | { type: 'arrow' }
  | { type: 'sticky' }
  | { type: 'table' }
  | { type: 'image' }
  | { type: 'annotation' }
  | { type: 'link-card' }
  | { type: 'component'; kind: ComponentKind };

export type PaletteTileDef = {
  // Stable id, persisted in the favourites list — never rename one without
  // accepting that saved favourites referencing it fall back silently.
  id: string;
  section: PaletteTileSection;
  label: string;
  // Overrides the caption derived from `label` where that runs too long
  // for the tile (see IconButton).
  caption?: string;
  description: string;
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
    id: 'tools:text',
    section: 'tools',
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
    section: 'tools',
    label: 'Pencil (freehand)',
    description:
      'Sketch a freehand stroke. Drag to draw; release near the start to close the shape.',
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
    id: 'tools:arrow',
    section: 'tools',
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
    section: 'tools',
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
    section: 'tools',
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
    id: 'tools:image',
    section: 'tools',
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
    id: 'tools:avatar',
    section: 'tools',
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
    id: 'tools:user',
    section: 'tools',
    label: 'Add user',
    description: 'User / actor. Use-case and architecture diagrams.',
    action: { type: 'shape', kind: 'actor' },
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
        <circle cx="9" cy="4" r="2.4" />
        <path d="M9 6.4 L9 11.5" />
        <path d="M4.8 8.4 L13.2 8.4" />
        <path d="M9 11.5 L6 15.5" />
        <path d="M9 11.5 L12 15.5" />
      </svg>
    ),
  },
  {
    id: 'tools:frame',
    section: 'tools',
    label: 'Add frame',
    description: 'Frame. A titled container you draw around a cluster of elements.',
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
    section: 'tools',
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
    section: 'tools',
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
    section: 'tools',
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
