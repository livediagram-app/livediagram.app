// Slide data (docs/specs/007-editor/pages-mode.md "Slide layouts", Data): numbers sized for
// a room, besides Big Number, Key Stats, Chart Story, Comparison, KPI Dashboard and Market Share.
// Every one owes its source a line at the foot. Pure builders on the slide kit, in units of the
// slide's height.
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { card, columns, numberDisc, over, rule, slideHeading, slideType } from './slide-layout-kit';

// The source line's height at the slide's foot, and the gap above it.
const SOURCE = 6;
const FOOT = SOURCE + 4;

function source(k: Kit, label: string): Element {
  return k.text(0, k.box.height - k.u * SOURCE, k.box.width, k.u * SOURCE, label, {
    ...slideType(k, 2.8),
    textAlignY: 'bottom',
  });
}

/** Three figures across, every one fitted as the longest so they stand the same size. */
export function threeStatsSlide(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'The year in three numbers');
  const stats = [
    ['86k', 'active teams', '+24% on last year'],
    ['4.8', 'average rating', 'from 2,300 reviews'],
    ['12m', 'diagrams made', 'one every 2.6 seconds'],
  ] as const;
  const longest = stats.map(([f]) => f).reduce((a, b) => (b.length > a.length ? b : a));
  const top = head.top + u * 6;
  const figH = u * 26;
  return [
    ...head.els,
    ...columns(W, stats.length, u * 8).flatMap(({ at, size }, i) => {
      const [figure, caption, note] = stats[i]!;
      // Fitted as the longest figure, then given its own: all three the same size.
      const fitted = k.title(at, top, size, figH, longest);
      return [
        { ...fitted, label: figure },
        rule(k, at, top + figH + u * 3, 10),
        k.text(at, top + figH + u * 7, size, u * 8, caption, {
          ...slideType(k, 4.6),
          textBold: true,
        }),
        k.text(at, top + figH + u * 16, size, u * 8, note, slideType(k, 3.6)),
      ];
    }),
    source(k, 'Source: product analytics, October 2025 to September 2026.'),
  ];
}

/** One chart filling the slide, and the figure it is there to show on a card beside it. */
export function bigChartSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Sign-ups by month', 'Steady growth since the spring relaunch.');
  const chartH = H - head.top - u * FOOT;
  const cardW = Math.max(W * 0.26, u * 34);
  const chartW = W - cardW - u * 6;
  const pad = u * 5;
  return [
    ...head.els,
    k.shape('bar-chart', 0, head.top, chartW, chartH, {
      pieSlices: [
        { label: 'Apr', value: 420 },
        { label: 'May', value: 460 },
        { label: 'Jun', value: 510 },
        { label: 'Jul', value: 540 },
        { label: 'Aug', value: 610 },
        { label: 'Sep', value: 680 },
      ],
      chartLegend: false,
      // Values name each column under its baseline, which the legend would otherwise do.
      chartValues: true,
    }),
    card(k, chartW + u * 6, head.top, cardW, chartH),
    k.title(chartW + u * 6 + pad, head.top + pad, cardW - 2 * pad, u * 18, '+62%'),
    k.text(
      chartW + u * 6 + pad,
      head.top + pad + u * 20,
      cardW - 2 * pad,
      chartH - 2 * pad - u * 20,
      'more sign-ups in September than in April',
      slideType(k, 3.8),
    ),
    source(k, 'Source: sign-up records, April to September 2026.'),
  ];
}

/** A trend on the left, three numbered things it tells us on the right. */
export function chartInsightsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'What the trend tells us');
  const chartW = W * 0.56;
  const chartH = H - head.top - u * FOOT;
  const x = chartW + u * 7;
  const w = W - x;
  const insights = [
    'Usage doubles in the weeks before a launch',
    'Weekends stay flat, so it is a work tool',
    'The dip in August is the holidays, not churn',
  ];
  const rowH = chartH / insights.length;
  const d = Math.min(u * 10, rowH * 0.7);
  return [
    ...head.els,
    k.shape('line-chart', 0, head.top, chartW, chartH, {
      chartVariant: 'area',
      chartLegend: false,
      lineCategories: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
      lineSeries: [{ name: 'Weekly active', values: [12, 15, 21, 18, 27, 34] }],
    }),
    ...insights.flatMap((line, i) => {
      const y = head.top + i * rowH;
      return [
        ...numberDisc(k, x, y + (rowH - d) / 2, d, String(i + 1)),
        k.text(x + d + u * 4, y, w - d - u * 4, rowH, line, {
          ...slideType(k, 3.8),
          textAlignY: 'middle',
        }),
      ];
    }),
    source(k, 'Source: weekly active users, January to November 2026.'),
  ];
}

/** Three goals and how far along each is: a ring per goal, its name and target under it. */
export function goalsProgressSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Where we are against our goals');
  const goals = [
    [72, 'Customers', '7,200 of 10,000'],
    [45, 'Revenue', '£4.5M of £10M'],
    [90, 'Hiring', '27 of 30 roles'],
  ] as const;
  const avail = H - head.top - u * FOOT;
  const cols = columns(W, goals.length, u * 8);
  // As large as the room under the heading allows, never wider than its column (a 4:3 slide).
  const side = Math.min(avail - u * 20, u * 46, cols[0]!.size);
  return [
    ...head.els,
    ...cols.flatMap(({ at, size }, i) => {
      const [progress, name, note] = goals[i]!;
      const ringX = at + (size - side) / 2;
      const y = head.top;
      return [
        k.shape('progress-ring', ringX, y, side, side, { progress, label: '' }),
        over(k, ringX, y, side, side, `${progress}%`, side / u / 5),
        k.text(at, y + side + u * 4, size, u * 8, name, {
          ...slideType(k, 4.6),
          textBold: true,
          textAlignX: 'center',
        }),
        k.text(at, y + side + u * 12, size, u * 7, note, {
          ...slideType(k, 3.4),
          textAlignX: 'center',
        }),
      ];
    }),
    source(k, 'Source: company plan, figures to the end of September 2026.'),
  ];
}
