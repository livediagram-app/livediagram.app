// Which side of the selected element a quick-connect ring adds to (docs/specs/008-canvas/canvas-and-palette.md
// "Quick add + connect"). Each product's lib/canvas.ts re-exports it beside its own quick-action kinds.
export type QuickConnectDirection = 'right' | 'below' | 'left' | 'above';
