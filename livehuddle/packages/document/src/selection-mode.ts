// The selection modes a Mode Button element can switch someone into
// (docs/specs/009-elements/mode-button.md). The editor's own `CanvasTool` union is the same vocabulary, but it
// lives in the editor app; this is the DATA half — what a saved element may carry
// — so it belongs with the model, where validation can reach it.
//
// In livehuddle Avatar is the one mode a button hands out (docs/specs/009-elements/mode-button.md "Only Avatar"): the
// Select, Hand, Eraser and Format buttons left with the palette's Selection Mode category. A stored button carrying
// one of them loads with the field dropped (./legacy-mode-buttons), so it reads as an Avatar button.

export const SELECTION_MODES = ['avatar'] as const;

export type SelectionMode = (typeof SELECTION_MODES)[number];

// The mode a Mode Button switches to when it carries none — the reason the
// element exists (docs/specs/008-canvas/avatar-mode.md walkthroughs), so it is the default rather than
// Select.
export const DEFAULT_BUTTON_MODE: SelectionMode = 'avatar';

// What each mode is called on a Mode Button's face ("Switch to Avatar"): the
// canvas face and the export both name the destination from here.
export const SELECTION_MODE_LABEL: Record<SelectionMode, string> = {
  avatar: 'Avatar',
};

export function isSelectionMode(value: unknown): value is SelectionMode {
  return typeof value === 'string' && (SELECTION_MODES as readonly string[]).includes(value);
}

// Shape kinds that are a FIXED SIZE: a control, not a box you draw. They get no
// resize handles, ignore a drag-to-draw's size, and are left alone when a
// multi-selection is scaled — a button that is 40px on one canvas and 400 on
// another stops looking like part of the product.
const FIXED_SIZE_SHAPES: ReadonlySet<string> = new Set([
  'mode-button',
]);

export function isFixedSizeShape(kind: string): boolean {
  return FIXED_SIZE_SHAPES.has(kind);
}

// The Selection Mode button's original default skin (docs/specs/009-elements/mode-button.md): a solid brand
// fill with white text. It was replaced by a light button surface, but the
// colours are stored ON the element, so every button authored before the
// change would keep the old slab look forever.
//
// So the exact original trio is treated as "the author never picked colours",
// and such a button renders with today's defaults. An author who genuinely
// wants that blue can pick it again from the menu — at which point it is a
// deliberate choice on a NEW-look button (the text colour differs), and this
// no longer matches.
const LEGACY_BUTTON_SKIN = { fill: '#0ea5e9', stroke: '#0284c7', text: '#ffffff' };

export function isLegacyModeButtonSkin(el: {
  shape?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
}): boolean {
  return (
    el.shape === 'mode-button' &&
    el.fillColor === LEGACY_BUTTON_SKIN.fill &&
    el.strokeColor === LEGACY_BUTTON_SKIN.stroke &&
    el.textColor === LEGACY_BUTTON_SKIN.text
  );
}

// Today's default skin, for the elements above.
export const MODE_BUTTON_SKIN = { fill: '#ffffff', stroke: '#cbd5e1', text: '#0f172a' } as const;
