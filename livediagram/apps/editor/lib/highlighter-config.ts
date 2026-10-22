// The highlighter's settings (docs/specs/008-canvas/highlighter.md "Settings"): the marker colours
// and widths a stroke can take, shared by the Quick style panel's Highlighter rows, the commit
// path and the live draw preview.
//
// Fixed hexes, not theme colours: a highlight that changed colour with the tab's palette would
// stop reading as a highlight.

export type HighlighterWidthId = 'thin' | 'medium' | 'bold';

export const HIGHLIGHTER_COLORS: readonly { id: string; label: string }[] = [
  { id: '#fde047', label: 'Yellow' },
  { id: '#86efac', label: 'Green' },
  { id: '#f9a8d4', label: 'Pink' },
  { id: '#93c5fd', label: 'Blue' },
  { id: '#fdba74', label: 'Orange' },
];

// Stroke widths, in canvas px.
export const HIGHLIGHTER_WIDTHS: readonly { id: HighlighterWidthId; label: string; px: number }[] =
  [
    { id: 'thin', label: 'Thin', px: 8 },
    { id: 'medium', label: 'Medium', px: 14 },
    { id: 'bold', label: 'Bold', px: 22 },
  ];

// Marker yellow at Medium: where the highlighter starts on every fresh load.
export const HIGHLIGHTER_COLOR = '#fde047';
// The renderers' `penWidth ?? 14` fallback, so a Medium stroke never writes `penWidth`.
export const HIGHLIGHTER_WIDTH = 14;

/** The preset id for a width in px, or null when it sits off every preset. */
export function highlighterWidthId(px: number): HighlighterWidthId | null {
  return HIGHLIGHTER_WIDTHS.find((w) => w.px === px)?.id ?? null;
}

/** The px for a preset id. */
export function highlighterWidthPx(id: HighlighterWidthId): number {
  return HIGHLIGHTER_WIDTHS.find((w) => w.id === id)!.px;
}
