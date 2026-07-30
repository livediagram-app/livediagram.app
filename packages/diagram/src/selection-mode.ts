// The selection modes a Mode Button element can switch someone into
// (spec/103). The editor's own `CanvasTool` union is the same vocabulary, but it
// lives in the live app; this is the DATA half — what a saved element may carry
// — so it belongs with the model, where validation can reach it.
//
// Kept deliberately as the full set: a button that hands someone the Eraser is
// odd but not our call to forbid, and the author picks from a menu that names
// each one.

export const SELECTION_MODES = [
  'select',
  'pan',
  'laser',
  'spotlight',
  'avatar',
  'eraser',
  'format',
  'isometric',
] as const;

export type SelectionMode = (typeof SELECTION_MODES)[number];

// The mode a Mode Button switches to when it carries none — the reason the
// element exists (spec/101 walkthroughs), so it is the default rather than
// Select.
export const DEFAULT_BUTTON_MODE: SelectionMode = 'avatar';

export function isSelectionMode(value: unknown): value is SelectionMode {
  return typeof value === 'string' && (SELECTION_MODES as readonly string[]).includes(value);
}

// Shape kinds that are a FIXED SIZE: a control, not a box you draw. They get no
// resize handles, ignore a drag-to-draw's size, and are left alone when a
// multi-selection is scaled — a button that is 40px on one diagram and 400 on
// another stops looking like part of the product.
export const FIXED_SIZE_SHAPES: ReadonlySet<string> = new Set(['mode-button']);

export function isFixedSizeShape(kind: string): boolean {
  return FIXED_SIZE_SHAPES.has(kind);
}

// The Selection Mode button's original default skin (spec/103): a solid brand
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
