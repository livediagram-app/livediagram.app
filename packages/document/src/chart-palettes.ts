// Chart palettes (docs/specs/009-elements/pie-chart.md).
//
// A chart's colours were a two-level fallback: a per-slice / per-series
// override, else the categorical ramp derived from the tab's theme. That left
// no way to say "this chart is greys" or "this one is a heatmap" short of
// opening the data editor and setting a colour on every row by hand, and a
// row added later still came out in the theme's colours.
//
// A palette is stored as an ID on the element, so it keeps applying as the
// data grows, and it slots in as the middle rung of the same fallback: a
// per-datum colour still wins (a slice you coloured on purpose stays that
// colour), and a chart with no palette still follows the theme, so nothing
// existing changes appearance.
//
// The ids are stored, so they are permanent: rename a `name`, never an `id`.

export type ChartPaletteId =
  'vivid' | 'ocean' | 'forest' | 'sunset' | 'berry' | 'earth' | 'grey' | 'contrast';

export type ChartPalette = {
  id: ChartPaletteId;
  /** Title Case, shown on the preset tile. */
  name: string;
  /** Cycled by index, so the order is the reading order of a legend. */
  colors: readonly string[];
};

// Eight colours each: past that a legend is unreadable anyway, and a chart
// with more series than this wants a different chart.
export const CHART_PALETTES: readonly ChartPalette[] = [
  {
    // The built-in categorical ramp (PIE_PALETTE), named so it can be picked
    // deliberately rather than only landed on.
    id: 'vivid',
    name: 'Vivid',
    colors: [
      '#0ea5e9',
      '#f59e0b',
      '#22c55e',
      '#ef4444',
      '#a855f7',
      '#14b8a6',
      '#ec4899',
      '#84cc16',
    ],
  },
  {
    // Sequential-ish runs: neighbouring series stay related, which suits a
    // chart of one measure over several groups.
    id: 'ocean',
    name: 'Ocean',
    colors: [
      '#0c4a6e',
      '#0369a1',
      '#0ea5e9',
      '#38bdf8',
      '#7dd3fc',
      '#134e4a',
      '#0d9488',
      '#5eead4',
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: [
      '#14532d',
      '#166534',
      '#16a34a',
      '#4ade80',
      '#a3e635',
      '#65a30d',
      '#3f6212',
      '#bef264',
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: [
      '#7c2d12',
      '#c2410c',
      '#f97316',
      '#fb923c',
      '#fbbf24',
      '#f43f5e',
      '#e11d48',
      '#fda4af',
    ],
  },
  {
    id: 'berry',
    name: 'Berry',
    colors: [
      '#4c1d95',
      '#6d28d9',
      '#a855f7',
      '#c084fc',
      '#db2777',
      '#ec4899',
      '#f472b6',
      '#f0abfc',
    ],
  },
  {
    // Muted and warm: the palette for a chart that sits inside a document
    // rather than on a dashboard.
    id: 'earth',
    name: 'Earth',
    colors: [
      '#78350f',
      '#a16207',
      '#ca8a04',
      '#d97706',
      '#78716c',
      '#a8a29e',
      '#57534e',
      '#bfa094',
    ],
  },
  {
    // For print, and for a chart whose point is the shape of the data rather
    // than which series is which.
    id: 'grey',
    name: 'Grey',
    colors: [
      '#0f172a',
      '#334155',
      '#475569',
      '#64748b',
      '#94a3b8',
      '#cbd5e1',
      '#e2e8f0',
      '#f1f5f9',
    ],
  },
  {
    // Maximally separated hues, for the chart someone has to read from the
    // back of a room.
    id: 'contrast',
    name: 'Contrast',
    colors: [
      '#1d4ed8',
      '#dc2626',
      '#facc15',
      '#15803d',
      '#9333ea',
      '#0891b2',
      '#ea580c',
      '#000000',
    ],
  },
];

const BY_ID = new Map(CHART_PALETTES.map((p) => [p.id, p]));

/** The colours for a stored id, or undefined for an absent / unknown one, so
 *  the caller falls through to the theme's palette exactly as before. */
export function chartPaletteColors(id: string | undefined): readonly string[] | undefined {
  return id ? BY_ID.get(id as ChartPaletteId)?.colors : undefined;
}

export function isChartPaletteId(id: string | undefined): id is ChartPaletteId {
  return id !== undefined && BY_ID.has(id as ChartPaletteId);
}
