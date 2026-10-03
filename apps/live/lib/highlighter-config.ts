// The highlighter's recipe at creation (docs/specs/008-canvas/highlighter.md): what a stroke drawn
// from the Draw category's Highlighter tile commits with, and what the live draw preview paints.
//
// Fixed rather than chosen: the tile is a one-shot arm like the pens, with no panel. A committed
// stroke is recoloured from its context menu like any element. Marker yellow regardless of theme:
// a highlighter that changed colour with the tab's palette would stop reading as a highlight.
export const HIGHLIGHTER_COLOR = '#fde047';

// Marker width in canvas px. The renderers' `penWidth ?? 14` fallback, so a new stroke never
// needs to write `penWidth`.
export const HIGHLIGHTER_WIDTH = 14;
