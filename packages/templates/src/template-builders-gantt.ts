// Gantt-chart template builder. Kept in its own module (like the
// board / wireframe / logo builders) so template-builders.ts stays
// lean and this situational starter only ships when picked.
//
// Layout: a month header row (Jan..Dec) across the top, then six
// "milestone" rows. Each row is a full-width track with a right-
// aligned label on the left and a coloured duration bar that steps
// further right each row (the classic cascading Gantt look). Geometry
// is lifted from a hand-built reference diagram and re-centred on the
// supplied canvas point. Colours are explicit so the chart reads
// correctly under the neutral brand theme. The header + track fills
// flatten to the chosen theme's element palette when one is applied
// (see recolourElementForTheme), but the per-milestone bar fills are
// pinned with `themeLockFill` so they stay distinct under every theme —
// a single themed element-fill would merge all six bars into one block
// and the timeline would stop reading as separate tasks.

import { createShape, createText, type Element } from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

const STROKE = '#334155';
const TEXT = '#0f172a';
const TRACK_FILL = '#e2e8f0';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Month grid geometry, declared up front so the milestone bars can snap to
// real month columns rather than carrying hand-tuned offsets. Each month
// column is MONTH.dx wide starting at MONTH.x0 (chart-centre relative).
const HEADER = { x: -295, y: -239, w: 1086, h: 59 };
const MONTH = { y: -230, x0: -287, dx: 89, w: 89, h: 38 };

// A believable product-launch plan: real phase names with durations that
// overlap and cascade the way a delivery plan actually does (build phases
// run long and in parallel, QA tails the build, launch closes it out).
// `start`/`months` index the month grid so every bar lines up with the
// header; widths vary by phase length instead of a uniform block. Fills are
// medium-saturation and distinct so adjacent tasks stay legible (the bars
// carry no text, so contrast is against the light track).
const ROWS: {
  trackY: number;
  label: string;
  labelY: number;
  start: number; // first month column (0 = Jan)
  months: number; // phase length in months → bar width
  barY: number;
  fill: string;
}[] = [
  {
    trackY: -175,
    label: 'Research & discovery',
    labelY: -171,
    start: 0,
    months: 2,
    barY: -170,
    fill: '#4f86c6',
  },
  {
    trackY: -105,
    label: 'Design & prototyping',
    labelY: -101,
    start: 1,
    months: 3,
    barY: -100,
    fill: '#7d6bb0',
  },
  {
    trackY: -35,
    label: 'Frontend build',
    labelY: -32,
    start: 3,
    months: 4,
    barY: -30,
    fill: '#c98a3b',
  },
  {
    trackY: 36,
    label: 'Backend & API',
    labelY: 40,
    start: 4,
    months: 4,
    barY: 41,
    fill: '#6a9b5e',
  },
  {
    trackY: 106,
    label: 'QA & testing',
    labelY: 110,
    start: 7,
    months: 3,
    barY: 113,
    fill: '#b5605f',
  },
  {
    trackY: 176,
    label: 'Launch & marketing',
    labelY: 181,
    start: 9,
    months: 3,
    barY: 182,
    fill: '#4a9c97',
  },
];
const TRACK = { x: -790, w: 1580, h: 62 };
const LABEL = { x: -790, w: 495, h: 59 };
const BAR_H = 47;

// Borderless filled rectangle (header / track / bar). strokeWidth 'none'
// keeps the bars flat; the stroke colour is still carried so a themed
// re-colour has something to map. `lockFill` pins the fill so it survives
// a theme change (used for the milestone bars, whose distinct colours
// carry meaning); header + track leave it off and adopt the theme fill.
function rect(x: number, y: number, w: number, h: number, fill: string, lockFill = false): Element {
  return {
    ...createShape('square', x, y),
    width: w,
    height: h,
    fillColor: fill,
    strokeColor: STROKE,
    textColor: TEXT,
    strokeWidth: 'none',
    strokeStyle: 'solid',
    borderRadius: 'none',
    ...(lockFill ? { themeLockFill: true } : {}),
  };
}

// The chart ships pre-layered (spec/74 "Layered templates"): the month
// header + tracks + row labels form a fixed "Grid" scaffold layer, with
// the duration bars users slide and stretch on a "Bars" content layer.
export function buildGanttChart(cx: number, cy: number): Element[] {
  const elements: Element[] = [];

  // Header background + month column labels.
  elements.push({
    ...rect(cx + HEADER.x, cy + HEADER.y, HEADER.w, HEADER.h, TRACK_FILL),
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });
  MONTHS.forEach((m, i) => {
    elements.push({
      ...createText(cx + MONTH.x0 + i * MONTH.dx, cy + MONTH.y),
      width: MONTH.w,
      height: MONTH.h,
      label: m,
      textSize: 'md',
      textColor: TEXT,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
  });

  // Milestone rows: track, right-aligned label, then the duration bar
  // on top of the track.
  for (const r of ROWS) {
    elements.push({
      ...rect(cx + TRACK.x, cy + r.trackY, TRACK.w, TRACK.h, TRACK_FILL),
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createText(cx + LABEL.x, cy + r.labelY),
      width: LABEL.w,
      height: LABEL.h,
      label: r.label,
      textSize: 'sm',
      textColor: TEXT,
      textAlignX: 'right',
      textAlignY: 'middle',
      padding: 'md',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    const barX = MONTH.x0 + r.start * MONTH.dx;
    const barW = r.months * MONTH.dx;
    elements.push({
      ...rect(cx + barX, cy + r.barY, barW, BAR_H, r.fill, true),
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  }

  return elements;
}
