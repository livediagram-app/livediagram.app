// More Data layouts (docs/specs/007-editor/pages-mode.md "Layouts"), category 'data':
// pure builders on the shared kit (page-layout-kit.ts), laid out in proportions of the page's
// content box so each fits every size and orientation, in the tab's theme. A KPI dashboard and a
// trend story here; a market share breakdown and a stat mosaic in page-layouts-set-data-2.ts.
import type { Element } from '@liveplanner/document';
import { heading, kit, type Kit } from './page-layout-kit';
import { CROSS_ROSE, SOURCE_H, sourceLine, TICK_GREEN } from './page-layout-parts';
import type { PageLayout } from './page-layouts';
import { buildMarketShare, buildStatMosaic, figureTitle } from './page-layouts-set-data-2';

export type DataSetLayoutId = 'kpi-dashboard' | 'trend-story' | 'market-share' | 'stat-mosaic';

// The room a source line takes at the page's foot, with the gap above it.
const FOOT = SOURCE_H + 4;

// Each metric: its name, the figure, the change and whether that change is good news, the
// icon the change reads by, and the six months its sparkline runs over.
const KPIS = [
  ['Revenue', '£2.4M', '+18%', true, 'trending-up', [1.5, 1.7, 1.6, 1.9, 2.1, 2.4]],
  ['Active users', '86k', '+9%', true, 'trending-up', [64, 69, 71, 75, 80, 86]],
  ['Churn', '2.1%', '-0.4 pts', true, 'trending-down', [3.1, 2.9, 2.8, 2.5, 2.3, 2.1]],
  ['Support tickets', '1,240', '+6%', false, 'trending-up', [980, 1010, 1100, 1060, 1180, 1240]],
] as const;

function kpiDashboard(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Q3 at a glance', 'Four numbers we steer by, against Q2.');
  // Four across on a wide page, one per row on a long one (a story), else two by two.
  const cols = W >= H * 1.3 ? 4 : H > W * 1.6 ? 1 : 2;
  const rows = KPIS.length / cols;
  const gap = u * 4;
  const cardW = (W - gap * (cols - 1)) / cols;
  const cardH = (H - u * FOOT - head.top - gap * (rows - 1)) / rows;
  const pad = u * 4;
  const longest = KPIS.map(([, f]) => f).reduce((a, b) => (b.length > a.length ? b : a));
  // A card much wider than tall sets its figure beside the sparkline, else over it.
  const beside = cardW > cardH * 1.5;
  return [
    ...head.els,
    ...KPIS.flatMap(([name, figure, change, good, icon, spark], i) => {
      const x = (i % cols) * (cardW + gap);
      const y = head.top + Math.floor(i / cols) * (cardH + gap);
      const innerW = cardW - 2 * pad;
      const innerH = cardH - 2 * pad;
      const textW = beside ? innerW * 0.48 : innerW;
      const nameH = u * 6;
      const figH = Math.min(u * 16, (beside ? innerH : innerH * 0.5) - nameH - u * 8);
      const deltaY = y + pad + nameH + figH + u * 1;
      const iconS = u * 5;
      const colour = good ? TICK_GREEN : CROSS_ROSE;
      const sparkX = beside ? x + pad + textW + u * 4 : x + pad;
      const sparkY = beside ? y + pad : deltaY + u * 8;
      const sparkW = beside ? innerW - textW - u * 4 : innerW;
      const sparkH = beside ? innerH : y + cardH - pad - sparkY;
      return [
        k.shape('square', x, y, cardW, cardH, { borderRadius: 'lg', label: '' }),
        k.text(x + pad, y + pad, textW, nameH, name, { textBold: true }),
        // Every card's figure the same size: fitted as the longest, then given its own.
        { ...figureTitle(k, x + pad, y + pad + nameH, textW, figH, longest), label: figure },
        k.shape('icon', x + pad, deltaY + u * 0.5, iconS, iconS, {
          iconId: icon,
          strokeColor: colour,
        }),
        k.text(x + pad + iconS + u * 2, deltaY, textW - iconS - u * 2, u * 6, change, {
          textColor: colour,
          textBold: true,
          textAlignY: 'middle',
        }),
        k.shape('line-chart', sparkX, sparkY, sparkW, sparkH, {
          chartVariant: 'area',
          chartLegend: false,
          lineCategories: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
          lineSeries: [{ name, values: [...spark] }],
        }),
      ];
    }),
    sourceLine(k, 'Source: finance and product analytics, July to September 2026.'),
  ];
}

// The year's weekly bookings by month, this year against last, and three moments worth naming.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const THIS_YEAR = [5.9, 6.2, 9.8, 12.4, 13.1, 13.6, 11.2, 11.9, 14.8, 18.4, 17.6, 18.1];
const LAST_YEAR = [5.2, 5.5, 6.1, 6.4, 6.6, 6.9, 5.8, 6.0, 6.7, 7.1, 7.0, 7.4];
const MOMENTS = [
  ['March', 'App launch', 'Bookings near double in three weeks.'],
  ['July', 'Summer dip', 'Holidays, as every year. Smaller than last.'],
  ['October', 'Referrals live', 'Our best month yet: 18.4k a week.'],
] as const;

function trendStory(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // The headline and lead on the left, the year's one figure set big on the right.
  const figW = W * (k.wide ? 0.3 : 0.36);
  const headW = W - figW - u * 6;
  const titleH = u * 9;
  const leadH = u * 14;
  const top = titleH + leadH + u * 6;
  const head: Element[] = [
    k.title(0, 0, headW, titleH, 'Bookings took off'),
    k.text(0, titleH + u * 2, headW, leadH, 'Weekly bookings, 2026 against 2025.', {
      textSize: 'lg',
    }),
    { ...figureTitle(k, W - figW, 0, figW, u * 15, '+207%'), textAlignX: 'right' },
    k.text(W - figW, u * 16, figW, u * 7, 'since January', {
      textSize: 'lg',
      textAlignX: 'right',
    }),
  ];
  const bottom = H - u * FOOT;
  // The moments, each a disc holding its month, its name and a note: in a column beside the
  // chart on a wide page, stacked under it on a long one, else three across under it.
  const mode = k.wide ? 'side' : H > W * 1.6 ? 'stacked' : 'across';
  const d = u * 11;
  const nameH = u * 7;
  const noteH = u * 12;
  const gap = u * 5;
  const sideX = W * 0.62 + u * 6;
  const momentsH =
    mode === 'side'
      ? 0
      : mode === 'stacked'
        ? MOMENTS.length * (nameH + noteH) + (MOMENTS.length - 1) * u * 4
        : d + u * 2 + nameH + noteH;
  const chartW = mode === 'side' ? W * 0.62 : W;
  const chartH = bottom - top - (mode === 'side' ? 0 : momentsH + u * 6);
  const chart = k.shape('line-chart', 0, top, chartW, chartH, {
    lineCategories: [...MONTHS],
    lineSeries: [
      { name: '2026', values: [...THIS_YEAR] },
      { name: '2025', values: [...LAST_YEAR] },
    ],
    chartLegend: true,
    chartLegendPosition: 'top',
  });
  const colW = (W - gap * (MOMENTS.length - 1)) / MOMENTS.length;
  const moments = MOMENTS.flatMap(([month, name, note], i) => {
    const disc = (x: number, y: number) =>
      k.shape('circle', x, y, d, d, { label: month.slice(0, 3), textBold: true, textSize: 'md' });
    if (mode === 'across') {
      const x = i * (colW + gap);
      const y = bottom - momentsH;
      return [
        disc(x, y),
        k.text(x, y + d + u * 2, colW, nameH, name, { textSize: 'lg', textBold: true }),
        k.text(x, y + d + u * 2 + nameH, colW, noteH, note),
      ];
    }
    // Beside or under the chart: the disc to the left of its name and note.
    const x = mode === 'side' ? sideX : 0;
    const w = W - x - d - u * 4;
    const step = mode === 'side' ? (bottom - top) / MOMENTS.length : nameH + noteH + u * 4;
    const y = (mode === 'side' ? top : bottom - momentsH) + i * step;
    return [
      disc(x, y),
      k.text(x + d + u * 4, y, w, nameH, name, {
        textSize: 'lg',
        textBold: true,
        textAlignY: 'middle',
      }),
      k.text(x + d + u * 4, y + nameH, w, noteH, note),
    ];
  });
  return [
    ...head,
    chart,
    ...moments,
    sourceLine(k, 'Source: booking system, 1 Jan to 31 Dec 2026.'),
  ];
}

export const DATA_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'kpi-dashboard',
    category: 'data',
    label: 'KPI Dashboard',
    description: 'Four metric cards, each a figure, its change and a sparkline',
    build: (b) => kpiDashboard(kit(b)),
  },
  {
    id: 'trend-story',
    category: 'data',
    label: 'Trend Story',
    description: 'A year on a line chart against last year, and three moments that moved it',
    build: (b) => trendStory(kit(b)),
  },
  {
    id: 'market-share',
    category: 'data',
    label: 'Market Share',
    description: 'A doughnut of who holds what, a table of shares and how they moved',
    build: buildMarketShare,
  },
  {
    id: 'stat-mosaic',
    category: 'data',
    label: 'Stat Mosaic',
    description: 'A playful grid of tiles in mixed sizes: figures, a ring, stars and a chart',
    build: buildStatMosaic,
  },
];
