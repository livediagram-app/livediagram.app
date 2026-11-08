import { WHITEBOARD_SHAPES } from './whiteboard-tool';
import { shapeKindLabel } from './element-names';
import type { ComponentKind, SelectionMode, ShapeKind } from '@livehuddle/document';

// Draw-to-size intent. Picking an element from the palette
// (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") stashes the intent here; the canvas
// then enters a "drag to define" gesture and forwards the resolved
// start + end points to the editor on pointer-up. Discriminated so
// the canvas can render the right preview per intent (oval for a
// circle shape, dashed box for text / sticky / image, etc.) and the
// editor's commit handler can mint the right element type from the
// same gesture. The arrow, the pens, the polygon and the Path and Fill
// tools left with the element engine's part 4
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
export type PendingDraw =
  // `iconId` (+ seed `label`) ride the shape intent for the `icon` kind, so a
  // palette icon / tech icon draws to size exactly like a shape (tap to drop,
  // drag to size) instead of dropping at a fixed size.
  // `stickerId` rides the same intent for the `sticker` kind (docs/specs/010-palette/stickers.md), the
  // way `iconId` does for `icon`.
  // `mode` (docs/specs/009-elements/mode-button.md) rides the same intent for
  // the same reason: each kind is ONE element with a field, and the
  // palette offers a tile per choice rather than one tile you then reconfigure.
  // Carrying the choice on the intent is what lets "Add Hearts" place hearts
  // instead of placing confetti you have to go and change.
  | {
      type: 'shape';
      kind: ShapeKind;
      iconId?: string;
      stickerId?: string;
      label?: string;
      mode?: SelectionMode;
      // A creation-time variant of the kind (packages/document shape-variants.ts): the Callout card, a Funnel.
      variant?: string;
      // What the tile that armed it calls it ("Funnel", "Org Chart"), for the banner: a variant or a
      // compound kind reads wrong named by its kind alone (a Funnel is a pyramid underneath).
      name?: string;
      // A whiteboard shape (docs/specs/023-draw-mode/draw-mode.md "Shapes"): drawn in the board's ink,
      // unfilled, at the default width. Pens never colour it.
      board?: true;
    }
  | { type: 'text' }
  | { type: 'sticky' }
  | { type: 'image' }
  // A link card (docs/specs/009-elements/link-cards.md) is its own element type rather than a ShapeKind, so it needs
  // its own intent to ride the same gesture. It used to drop at the viewport centre
  // for want of one, which made "draws or drops?" a property of how the
  // element was modelled instead of whether it has a size worth choosing.
  | { type: 'link-card' }
  // A composite Component (docs/specs/008-canvas/canvas-and-palette.md): banner / hero / header / callout / stat /
  // process / avatar. Draws to size exactly like a shape — a tap drops it at
  // its natural size, a drag scales the whole group to the dragged box.
  | { type: 'component'; kind: ComponentKind }
  // The Room Builder (docs/specs/009-elements/room-builder.md): click-to-place corners, drawing walls
  // snapped to 45 degrees, always closed into a custom-shaped Room.
  | { type: 'room-walls' };

/** The choices a tile hands `addShape` along with its kind: they ride the shape intent through the gesture. */
export type AddShapeOptions = Pick<
  Extract<PendingDraw, { type: 'shape' }>,
  'mode' | 'variant' | 'name'
>;

// The shape the banner names ("Click to drop or drag to draw Square"), as the tile the person just picked names it.
// Draw mode's dock names its own shapes (Rectangle, Ellipse); everywhere else a shape is named as the palette and
// the selection badge name it (shapeKindLabel: Square, Circle). Its own aliases (square -> Rectangle, circle ->
// Oval) had drifted from both, so a Circle tile armed an "Oval" and a dock Ellipse did too.
function shapeIntentName(intent: Extract<PendingDraw, { type: 'shape' }>): string {
  if (intent.name) return intent.name;
  if (intent.board) {
    const dock = WHITEBOARD_SHAPES.find(
      (s) => s.intent.type === 'shape' && s.intent.kind === intent.kind,
    );
    if (dock) return dock.label;
  }
  return shapeKindLabel(intent.kind);
}

// User-facing component names for the draw-mode banner.
const COMPONENT_LABELS: Record<ComponentKind, string> = {
  avatar: 'Avatar',
};

// A tool that exists on a whiteboard only (docs/specs/023-draw-mode/draw-mode.md "Shapes"): a shape
// armed from the dock. Leaving the board puts it down, so the board's tools and their look never
// carry over a mode switch.
export function isWhiteboardOnlyIntent(intent: PendingDraw | null | undefined): boolean {
  return intent?.type === 'shape' && intent.board === true;
}

// Whether a freshly drawn element drops straight into typing: a text box is only useful once typed into.
export function opensForTyping(intent: PendingDraw): boolean {
  return intent.type === 'text';
}

// Whether a tap places the armed intent (docs/specs/008-canvas/canvas-and-palette.md "Adding elements"): every
// box and component does; the Room Builder's walls are a gesture with no tap.
export function dropsOnTap(intent: PendingDraw | null | undefined): intent is PendingDraw {
  if (!intent) return false;
  return intent.type !== 'room-walls';
}

export function drawBannerMessage(intent: PendingDraw, isMobile: boolean): string {
  // The press that drops names the pointer in use, as the flyout's hint does: a click, or a phone's tap.
  const press = isMobile ? 'Tap' : 'Click';
  switch (intent.type) {
    case 'shape':
      return `${press} to drop or drag to draw ${shapeIntentName(intent)}`;
    case 'text':
      return `${press} to drop or drag to place text`;
    case 'sticky':
      return `${press} to drop or drag to draw a sticky note`;
    case 'image':
      return `${press} to drop or drag to draw image bounds`;
    case 'link-card':
      return `${press} to drop or drag to draw a link card`;
    case 'component':
      return `${press} to drop or drag to draw ${COMPONENT_LABELS[intent.kind]}`;
    case 'room-walls':
      return isMobile ? 'Tap to place corners' : 'Click to place corners, click the start to close';
  }
}

// Per-shape draw-mode cursor. Returns a `cursor:` CSS value, an
// `url(data:image/svg+xml,...)` referencing an inline SVG whose
// hotspot sits at (4, 4): a small crosshair at the pointer tip,
// plus a faded outline of the shape kind in the cursor's lower-
// right so the user can see at a glance which shape is queued.
// `crosshair` is the system fallback for browsers that won't load
// the data URL. Three kinds get explicit outlines (square, circle,
// diamond); everything else uses the plain crosshair branch since
// the banner already shows the shape name.
function drawShapeCursor(kind: ShapeKind): string {
  if (kind === 'square') {
    return drawCursorFromGlyph(
      `<rect x="13" y="13" width="11" height="8" fill="none" stroke="black" stroke-width="1.4" />`,
    );
  }
  if (kind === 'circle') {
    return drawCursorFromGlyph(
      `<ellipse cx="18.5" cy="17" rx="5.5" ry="4" fill="none" stroke="black" stroke-width="1.4" />`,
    );
  }
  if (kind === 'diamond') {
    return drawCursorFromGlyph(
      `<path d="M18.5 12 L24 17 L18.5 22 L13 17 Z" fill="none" stroke="black" stroke-width="1.4" />`,
    );
  }
  // Other shape kinds fall back to the plain crosshair (so a Tab key
  // press never lands them on an undefined cursor): the banner
  // carries the kind name and the palette button is pressed, so the
  // user still sees what's queued.
  return 'crosshair';
}

// Builds a per-tool cursor for non-shape draw intents: text, sticky,
// image, link card. Reads the same crosshair-at-(4, 4) shape as
// drawShapeCursor so every draw-mode pointer has the same anchor,
// then layers a tiny tool-specific glyph in the lower-right. Anything
// the discriminated union adds in future falls back to 'crosshair'
// rather than 'auto' / inherited so the cursor never reads as "not
// in a mode" when one is active.
export function drawIntentCursor(intent: PendingDraw): string {
  if (intent.type === 'shape') return drawShapeCursor(intent.kind);
  if (intent.type === 'text') {
    return drawCursorFromGlyph(
      `<path d="M13 13 H24 M18.5 13 V23 M16 23 H21" stroke="black" stroke-width="1.4" stroke-linecap="round" fill="none" />`,
    );
  }
  if (intent.type === 'sticky') {
    return drawCursorFromGlyph(
      `<path d="M13 13 H21 L24 16 V23 H13 Z M21 13 V16 H24" stroke="black" stroke-width="1.4" stroke-linejoin="round" fill="none" />`,
    );
  }
  if (intent.type === 'image') {
    return drawCursorFromGlyph(
      `<rect x="13" y="14" width="11" height="9" rx="1" fill="none" stroke="black" stroke-width="1.4" /><circle cx="15.5" cy="16.5" r="0.9" fill="black" /><path d="M13 21 L16 18.5 L18.5 20.5 L21 18 L24 20" stroke="black" stroke-width="1.2" stroke-linejoin="round" fill="none" />`,
    );
  }
  if (intent.type === 'link-card') {
    // A card with a chain link on it — matches the palette tile's bookmark
    // reading rather than repeating the plain image rectangle.
    return drawCursorFromGlyph(
      `<rect x="12" y="14" width="13" height="9" rx="1.5" fill="none" stroke="black" stroke-width="1.3" /><path d="M16 18.5 a1.8 1.8 0 0 1 1.8 -1.8 h1.4 M21 18.5 a1.8 1.8 0 0 1 -1.8 1.8 h-1.4" stroke="black" stroke-width="1.2" stroke-linecap="round" fill="none" /><path d="M17 20.5 H20.5" stroke="black" stroke-width="1.2" stroke-linecap="round" />`,
    );
  }
  if (intent.type === 'room-walls') {
    // A floor plan's corner: two thick walls meeting, reads as "place a corner".
    return drawCursorFromGlyph(
      `<path d="M14 25 L14 15 L24 15" stroke="black" stroke-width="2.6" stroke-linejoin="miter" fill="none" /><circle cx="14" cy="15" r="1.4" fill="white" stroke="black" stroke-width="1" />`,
    );
  }
  // The component: stacked blocks (a header bar over a content block), the same glyph the
  // Components palette category uses, so the queued cursor matches the tile.
  return drawCursorFromGlyph(
    `<rect x="13" y="13" width="11" height="3.5" rx="1" fill="none" stroke="black" stroke-width="1.3" /><rect x="13" y="18" width="11" height="6" rx="1" fill="none" stroke="black" stroke-width="1.3" />`,
  );
}

// Shared SVG-cursor builder. Crosshair tip at (4, 4), white halo
// first for visibility on dark canvas backgrounds (graph paper, dark
// mode), black stroke on top so it remains legible on light
// backgrounds too. The glyph is the tool / shape preview, drawn in
// the lower-right of a 28x28 hotspot box.
function drawCursorFromGlyph(glyph: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>` +
    `<path d='M0 4 H8 M4 0 V8' stroke='white' stroke-width='3' stroke-linecap='round' />` +
    `<path d='M0 4 H8 M4 0 V8' stroke='black' stroke-width='1.5' stroke-linecap='round' />` +
    glyph +
    `</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 4 4, crosshair`;
}
