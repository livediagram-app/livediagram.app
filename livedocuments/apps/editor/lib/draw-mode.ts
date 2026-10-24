import { shapeKindLabel } from './element-names';
import type { ArrowEnds, ComponentKind, EmbedProvider, ShapeKind } from '@livedocuments/document';
import { EMBED_PROVIDER_LABEL } from '@livedocuments/document';

// Draw-to-size intent. Picking any element from the palette
// (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") stashes the intent here; the canvas
// then enters a "drag to define" gesture and forwards the resolved
// start + end points to the editor on pointer-up. Discriminated so
// the canvas can render the right preview per intent (oval for a
// circle shape, line for an arrow, dashed box for text / sticky /
// image, etc.) and the editor's commit handler can mint the right
// element type from the same gesture.
export type PendingDraw =
  // `iconId` (+ seed `label`) ride the shape intent for the `icon` kind, so a
  // palette icon / tech icon draws to size exactly like a shape (tap to drop,
  // drag to size) instead of dropping at a fixed size.
  // `stickerId` rides the same intent for the `sticker` kind (docs/specs/010-palette/stickers.md), the
  // way `iconId` does for `icon`.
  | {
      type: 'shape';
      kind: ShapeKind;
      iconId?: string;
      stickerId?: string;
      label?: string;
      // A creation-time variant of the kind (packages/document shape-variants.ts): the Callout card, a Funnel.
      variant?: string;
      // What the tile that armed it calls it ("Funnel", "Callout"), for the banner: a variant or a
      // compound kind reads wrong named by its kind alone (a Funnel is a pyramid underneath).
      name?: string;
    }
  | { type: 'text' }
  | { type: 'sticky' }
  | { type: 'image' }
  // Table (docs/specs/008-canvas/canvas-and-palette.md), link card (docs/specs/009-elements/link-cards.md), and the embeds (docs/specs/009-elements/youtube-video.md, docs/specs/009-elements/embed-providers.md)
  // are their own element types rather than ShapeKinds, so each needs its own
  // intent to ride the same gesture. They used to drop at the viewport centre
  // for want of one, which made "draws or drops?" a property of how the
  // element was modelled instead of whether it has a size worth choosing.
  | { type: 'table' }
  | { type: 'link-card' }
  // `provider` rides the intent the way `iconId` does above: the
  // Media tab offers a tile per service and they are all one `video` kind, so
  // the choice has to survive the gesture or "Add Loom" would place a bare
  // embed the user then has to go and re-point.
  | { type: 'video'; provider?: EmbedProvider }
  // `ends` rides the arrow intent for the Line tile (docs/specs/008-canvas/canvas-and-palette.md
  // "Arrows and lines"), which differs from the Arrow only in its heads.
  | { type: 'arrow'; ends?: ArrowEnds }
  // A composite Component (docs/specs/008-canvas/canvas-and-palette.md): banner / hero / header / callout / stat /
  // process / avatar. Draws to size exactly like a shape — a tap drops it at
  // its natural size, a drag scales the whole group to the dragged box.
  | { type: 'component'; kind: ComponentKind }
  // Polygon tool (docs/specs/008-canvas/polygon-tool.md): click-to-place vertices rather than a
  // drag gesture. The canvas accumulates clicked points; closing on
  // the start vertex or double-click / Enter commits a
  // straight-edged FreehandElement.
  | { type: 'polygon' };

/** The choices a tile hands `addShape` along with its kind: they ride the shape intent through the gesture. */
export type AddShapeOptions = Pick<Extract<PendingDraw, { type: 'shape' }>, 'variant' | 'name'>;

// The shape the banner names ("Click to drop or drag to draw Square"), as the tile the person just picked names it,
// else as the palette and the selection badge name it (shapeKindLabel: Square, Circle).
function shapeIntentName(intent: Extract<PendingDraw, { type: 'shape' }>): string {
  return intent.name ?? shapeKindLabel(intent.kind);
}

// User-facing component names for the draw-mode banner.
const COMPONENT_LABELS: Record<ComponentKind, string> = {
  banner: 'Banner',
  hero: 'Hero',
  header: 'Header',
  callout: 'Callout',
  stat: 'Stat row',
  process: 'Process steps',
  avatar: 'Avatar',
};

// Whether a freshly drawn element drops straight into typing: a text box is
// only useful once typed into.
export function opensForTyping(intent: PendingDraw): boolean {
  return intent.type === 'text';
}

// Banner copy per draw intent. Shape intents include the kind name
// so the user can see which palette button they queued ("Drag to
// draw Rectangle"); tools read in plain English ("Drag to draw an
// arrow") because there's no kind dimension to disambiguate.
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
    case 'table':
      return `${press} to drop or drag to draw a table`;
    case 'link-card':
      return `${press} to drop or drag to draw a link card`;
    case 'video':
      // Names the service the tile promised (docs/specs/009-elements/embed-providers.md) rather than saying
      // "video" for all six, so the banner confirms which one is queued. The
      // 16:9 note is the one surprising thing about this drag, so it earns
      // its place on desktop; a phone-width banner can't hold it.
      return isMobile
        ? `${press} to drop or drag to draw ${EMBED_PROVIDER_LABEL[intent.provider ?? 'website']}`
        : `${press} to drop or drag to draw ${EMBED_PROVIDER_LABEL[intent.provider ?? 'website']} (stays 16:9)`;
    case 'arrow':
      // The Line is the arrow without its heads, and its tile says Line (docs/specs/008-canvas/canvas-and-palette.md).
      return intent.ends === 'none'
        ? `${press} to drop or drag to draw a line`
        : `${press} to drop or drag to draw an arrow`;
    case 'component':
      return `${press} to drop or drag to draw ${COMPONENT_LABELS[intent.kind]}`;
    case 'polygon':
      // The close / finish affordances overflow a phone-width banner.
      return isMobile
        ? 'Tap to place points'
        : 'Click to place points, click the start to close, double-click to finish';
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
// image, arrow. Reads the same crosshair-at-(4, 4) shape as
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
  if (intent.type === 'table') {
    // A 3x3 grid: a box with one vertical and one horizontal rule, and a
    // filled top band for the header row the factory turns on.
    return drawCursorFromGlyph(
      `<rect x="13" y="13" width="12" height="10" rx="1" fill="none" stroke="black" stroke-width="1.3" /><path d="M13 16.5 H25" stroke="black" stroke-width="1.3" /><path d="M17 16.5 V23 M21 16.5 V23 M13 20 H25" stroke="black" stroke-width="1" />`,
    );
  }
  if (intent.type === 'link-card') {
    // A card with a chain link on it — matches the palette tile's bookmark
    // reading rather than repeating the plain image rectangle.
    return drawCursorFromGlyph(
      `<rect x="12" y="14" width="13" height="9" rx="1.5" fill="none" stroke="black" stroke-width="1.3" /><path d="M16 18.5 a1.8 1.8 0 0 1 1.8 -1.8 h1.4 M21 18.5 a1.8 1.8 0 0 1 -1.8 1.8 h-1.4" stroke="black" stroke-width="1.2" stroke-linecap="round" fill="none" /><path d="M17 20.5 H20.5" stroke="black" stroke-width="1.2" stroke-linecap="round" />`,
    );
  }
  if (intent.type === 'video') {
    // A 16:9 frame with a play triangle — one glyph for all six providers.
    // Painting a per-provider mark here would mean six more inline SVGs to
    // read at 12px, and the banner already names the service.
    return drawCursorFromGlyph(
      `<rect x="12" y="14.5" width="14" height="8" rx="1.5" fill="none" stroke="black" stroke-width="1.3" /><path d="M17.5 16.8 L21.5 18.5 L17.5 20.2 Z" fill="black" />`,
    );
  }
  if (intent.type === 'polygon') {
    // Open polygon with vertex dots: reads as "place points".
    return drawCursorFromGlyph(
      `<path d="M14 23 L16 15 L23 13 L24 20 L19 24 Z" stroke="black" stroke-width="1.3" stroke-linejoin="round" fill="none" /><circle cx="16" cy="15" r="1.3" fill="black" /><circle cx="23" cy="13" r="1.3" fill="black" /><circle cx="19" cy="24" r="1.3" fill="black" />`,
    );
  }
  if (intent.type === 'component') {
    // Stacked blocks (a header bar over a content block) — the same glyph the
    // Components palette category uses, so the queued cursor matches the tile.
    return drawCursorFromGlyph(
      `<rect x="13" y="13" width="11" height="3.5" rx="1" fill="none" stroke="black" stroke-width="1.3" /><rect x="13" y="18" width="11" height="6" rx="1" fill="none" stroke="black" stroke-width="1.3" />`,
    );
  }
  // Arrow: a tiny line with a head at the right end.
  return drawCursorFromGlyph(
    `<path d="M13 18 L23 18 M20 15.5 L23 18 L20 20.5" stroke="black" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
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
