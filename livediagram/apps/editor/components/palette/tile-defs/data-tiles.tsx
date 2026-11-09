import { Glyph } from '@livediagram/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Data tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const DATA_TILES: PaletteTileDef[] = [
  // --- Data (docs/specs/009-elements/pie-chart.md) -------------------------------------------------------
  {
    id: 'data:pie',
    blurb: 'Proportions of a whole',
    section: 'data',
    label: 'Add Pie Chart',
    caption: 'Pie',
    description: 'A pie chart. Edit its labels + values from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'pie-chart' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24} filled>
        <circle cx="12" cy="12" r="9" opacity="0.25" />
        <path d="M12 12 L12 3 A9 9 0 0 1 20.5 15 Z" />
      </Glyph>
    ),
  },
  {
    id: 'data:bar',
    blurb: 'Compare values side by side',
    section: 'data',
    // Upright bars: a Column chart, as Google Sheets and Excel name it (docs/specs/009-elements/pie-chart.md
    // "Chart types"); its Chart Type menu turns it into a Bar chart (horizontal) or any other type.
    label: 'Add Column Chart',
    caption: 'Column',
    description: 'A column chart. Edit its labels + values from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'bar-chart' },
    icon: (
      <Glyph size={18} units={24} filled>
        <rect x="4" y="12" width="4" height="8" rx="1" opacity="0.45" />
        <rect x="10" y="7" width="4" height="13" rx="1" />
        <rect x="16" y="10" width="4" height="10" rx="1" opacity="0.7" />
      </Glyph>
    ),
  },
  {
    id: 'data:line',
    blurb: 'A trend over time',
    section: 'data',
    label: 'Add Line Chart',
    caption: 'Line',
    description:
      'A multi-series line chart. Edit the data grid or import a CSV from the Data menu.',
    filled: true,
    action: { type: 'shape', kind: 'line-chart' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M4 18 L9 11 L14 14 L20 6" />
      </Glyph>
    ),
  },
  {
    id: 'data:legend',
    blurb: 'A key for your colours',
    section: 'data',
    label: 'Add Legend',
    caption: 'Legend',
    description:
      'A key: a colour-coded dot and a label per row. Edit the colours and words from the Legend menu.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'legend' },
    icon: (
      <Glyph size={18} units={24} strokeLinejoin="miter">
        <circle cx="5" cy="6" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="5" cy="18" r="1.8" fill="currentColor" stroke="none" />
        <path d="M10 6 H20 M10 12 H20 M10 18 H16" />
      </Glyph>
    ),
  },
  {
    id: 'data:progress-bar',
    blurb: 'How far along something is',
    section: 'data',
    label: 'Add Progress Bar',
    caption: 'Progress',
    description: 'Horizontal progress bar. Set the percentage from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'progress-bar' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={18}>
        <rect x="2" y="6.5" width="14" height="5" rx="2.5" />
        <rect x="2" y="6.5" width="8" height="5" rx="2.5" fill="currentColor" stroke="none" />
      </Glyph>
    ),
  },
  {
    id: 'data:progress-ring',
    blurb: 'The same, as a donut meter',
    section: 'data',
    label: 'Add Progress Ring',
    caption: 'Donut',
    description: 'Donut progress ring. Set the percentage from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'progress-ring' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt" strokeLinejoin="miter">
        <circle cx="9" cy="9" r="6" strokeWidth="2.4" opacity="0.3" />
        <path d="M9 3 a6 6 0 0 1 5.2 9" strokeWidth="2.4" strokeLinecap="round" />
      </Glyph>
    ),
  },
  {
    id: 'data:rating',
    blurb: 'A score out of five stars',
    section: 'data',
    label: 'Add Rating',
    caption: 'Rating',
    description: 'A 1–5 star rating. Set the score + an animation from its menu.',
    filled: true,
    action: { type: 'shape', kind: 'rating' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24} filled>
        <path d="M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z" />
      </Glyph>
    ),
  },
];
