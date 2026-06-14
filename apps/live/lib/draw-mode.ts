import type { ShapeKind } from '@livediagram/diagram';

// Draw-to-size intent. When user-preferences.drawToAdd is on, picking
// any element from the palette stashes the intent here; the canvas
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
  | { type: 'shape'; kind: ShapeKind; iconId?: string; label?: string }
  | { type: 'text' }
  | { type: 'sticky' }
  | { type: 'image' }
  | { type: 'arrow' }
  // Pencil intent: the user picked the freehand tool. Unlike the
  // box intents, this one ignores the drawToAdd preference (the
  // pencil is gestural by definition) and the gesture collects a
  // stream of pointer samples during the drag, simplified +
  // smoothed on release into a FreehandElement (see spec/09 Pencil
  // (freehand) subsection, spec/05 FreehandElement).
  | { type: 'freehand' };

// Title-cased shape label for the draw-to-size mode banner. Avoids the
// "a / an" article problem by reading "Drag to draw {Rectangle}"
// instead of "draw a rectangle / an oval". Two kinds get human-
// friendly aliases (square -> Rectangle, circle -> Oval) to match the
// palette wording the user just clicked; everything else falls back
// to a Capitalised version of the raw kind, which is fine for the
// dozen-or-so other ShapeKind values without anyone having to keep a
// dictionary in sync.
function prettyShapeLabel(kind: ShapeKind): string {
  if (kind === 'square') return 'Rectangle';
  if (kind === 'circle') return 'Oval';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

// Banner copy per draw intent. Shape intents include the kind name
// so the user can see which palette button they queued ("Drag to
// draw Rectangle"); tools read in plain English ("Drag to draw an
// arrow") because there's no kind dimension to disambiguate. The
// freehand variant carries a hint about the auto-close gesture on
// desktop, but that parenthetical overflows the mode banner on a
// phone-width viewport, so mobile gets the bare "Drag to draw"
// (the gesture still auto-closes, the user just doesn't see the
// hint until they try it).
export function drawBannerMessage(intent: PendingDraw, isMobile: boolean): string {
  switch (intent.type) {
    case 'shape':
      return `Tap to drop or drag to draw ${prettyShapeLabel(intent.kind)}`;
    case 'text':
      return 'Tap to drop or drag to place text';
    case 'sticky':
      return 'Tap to drop or drag to draw a sticky note';
    case 'image':
      return 'Tap to drop or drag to draw image bounds';
    case 'arrow':
      return 'Tap to drop or drag to draw an arrow';
    case 'freehand':
      // Freehand is gestural only (no tap-to-drop): it collects the
      // pointer stream, so it keeps the bare "Drag to draw".
      return isMobile ? 'Drag to draw' : 'Drag to draw (release near the start to close)';
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
  if (intent.type === 'freehand') {
    // Pen nib glyph: a tiny diagonal point. Reads as "drawing
    // instrument", same as the palette button below.
    return drawCursorFromGlyph(
      `<path d="M14 22 L20 16 L23 19 L17 25 Z M20 16 L22 14 M14 22 L13 25" stroke="black" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
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
