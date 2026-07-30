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
