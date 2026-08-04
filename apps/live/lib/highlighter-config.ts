// The highlighter's settings (spec/81): the colour and the stroke strength the
// NEXT marker strokes commit with.
//
// Split out of HighlighterBannerControls when the marker became a held tool
// rather than a one-shot arm, so its choices sit where the Eraser's, Laser's
// and Spotlight's do — in a `lib/*-config` module the panel renders and the
// commit path reads, rather than inside the one component that happened to
// draw them first.
//
// Session-local by design, like the other tool panels: the marker resets to
// yellow / medium on a fresh editor load, the way a real pen cup does. Nothing
// here is stored on the diagram or sent to the api.

export type HighlighterWidth = number;

// The marker cup: yellow (the default) plus the classic set. Fixed hexes, not
// theme colours — a highlighter that changed colour with the tab's palette
// would stop being recognisable as a highlight.
export const HIGHLIGHTER_COLORS: readonly { id: string; label: string }[] = [
  { id: '#fde047', label: 'Yellow' },
  { id: '#86efac', label: 'Green' },
  { id: '#f9a8d4', label: 'Pink' },
  { id: '#93c5fd', label: 'Blue' },
  { id: '#fdba74', label: 'Orange' },
];

// Stroke strengths, in canvas px.
export const HIGHLIGHTER_WIDTHS: readonly { id: string; label: string; px: number }[] = [
  { id: 'thin', label: 'Thin', px: 8 },
  { id: 'medium', label: 'Medium', px: 14 },
  { id: 'bold', label: 'Bold', px: 22 },
];

/** The preset id for a width in px, or null when it sits off every preset. */
export function highlighterWidthId(px: number): string | null {
  return HIGHLIGHTER_WIDTHS.find((w) => w.px === px)?.id ?? null;
}

/** The px for a preset id, falling back to Medium for an unknown one. */
export function highlighterWidthPx(id: string): number {
  return HIGHLIGHTER_WIDTHS.find((w) => w.id === id)?.px ?? 14;
}
