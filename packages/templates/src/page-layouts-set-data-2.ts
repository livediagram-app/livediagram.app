// More Data layouts, continued (docs/specs/007-editor/illustrate-pages.md "Layouts"): a market
// share breakdown and a stat mosaic. Same contract as page-layouts-set-data.ts: the page's
// content box in, uncoloured elements out (a change's green or rose aside), each ending in the
// source line its numbers owe.
import {
  createTable,
  type Element,
  type TableCellStyle,
  type TextElement,
} from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { CROSS_ROSE, SOURCE_H, sourceLine, TICK_GREEN } from './page-layout-parts';

// The room a source line takes at the page's foot, with the gap above it.
const FOOT = SOURCE_H + 4;

// Each slice: its name, its share and how many points it moved on last year.
const SHARES = [
  ['Oat', 41, 6],
  ['Almond', 24, -2],
  ['Soy', 17, -3],
  ['Coconut', 11, -1],
  ['Other', 7, 0],
] as const;

// The chart's own geometry (chart-frame.ts, chart-marks.ts): a bottom legend takes up to a
// third of the box's height, capped at 72px, and the ring's hole is 0.55 of a radius that is
// 0.43 of the plot's short side. The figure in the hole is placed from these.
const LEGEND_SHARE = 0.32;
const LEGEND_MAX_PX = 72;
const RING_RADIUS = 0.43;
const RING_HOLE = 0.55;

function shareTable(k: Kit, x: number, y: number, w: number, h: number): Element {
  const points = (n: number) =>
    n === 0 ? 'No change' : `${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? 'pt' : 'pts'}`;
  const cells = [
    ['Milk', 'Share', 'vs 2025'],
    ...SHARES.map(([name, share, moved]) => [name, `${share}%`, points(moved)]),
  ];
  // The leader's row bold, and each change green when it grew and rose when it shrank.
  const cellStyles: (TableCellStyle | null)[][] = cells.map((row, r) =>
    row.map((_, c) => {
      if (r === 0) return { bold: true };
      const moved = SHARES[r - 1]![2];
      if (c === 2 && moved !== 0) {
        return { textColor: moved > 0 ? TICK_GREEN : CROSS_ROSE, bold: true };
      }
      return r === 1 ? { bold: true } : null;
    }),
  );
  return {
    ...createTable(0, 0),
    x: Math.round(k.box.x + x),
    y: Math.round(k.box.y + y),
    width: Math.round(w),
    height: Math.round(h),
    cells,
    cellStyles,
    // The header bold by cell style rather than a header band, which a dark page inks unreadably.
    headerRow: false,
    zebra: true,
    textSize: 'lg',
  };
}

function marketShare(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Oat rules the milk aisle', 'UK plant milk sales by volume, 2026.');
  const bottom = H - u * FOOT;
  const source = sourceLine(k, 'Source: retail sales panel, 52 weeks to September 2026.');
  // The doughnut and its key, the leader's share set in the hole.
  const doughnut = (x: number, y: number, w: number, h: number): Element[] => {
    const plotH = h - Math.min(h * LEGEND_SHARE, LEGEND_MAX_PX);
    const hole = Math.min(w, plotH) * RING_RADIUS * RING_HOLE;
    const cx = x + w / 2;
    const cy = y + plotH / 2;
    const figW = hole * 1.3;
    const figH = hole * 0.62;
    const capH = Math.min(u * 7, hole * 0.4);
    return [
      k.shape('pie-chart', x, y, w, h, {
        chartVariant: 'doughnut',
        pieSlices: SHARES.map(([label, value]) => ({ label, value })),
        chartLegend: true,
        chartLegendPosition: 'bottom',
      }),
      {
        ...figureTitle(k, cx - figW / 2, cy - (figH + capH) / 2, figW, figH, '41%'),
        textAlignX: 'center',
      },
      k.text(cx - figW / 2, cy - (figH + capH) / 2 + figH, figW, capH, 'is oat', {
        textAlignX: 'center',
        textAlignY: 'middle',
      }),
    ];
  };
  const insight = (x: number, y: number, w: number, h: number) =>
    k.shape('callout', x, y, w, h, {
      pageTitle: 'The story',
      label: 'Oat took six points in a year, most of them from soy.',
      textSize: 'md',
    });
  if (k.wide) {
    // The doughnut on the left; the table and the story share the right, foot to foot.
    const chartW = W * 0.46;
    const colX = chartW + u * 8;
    const colW = W - colX;
    const calloutH = u * 24;
    const tableH = bottom - head.top - calloutH - u * 5;
    return [
      ...head.els,
      ...doughnut(0, head.top, chartW, bottom - head.top),
      shareTable(k, colX, head.top, colW, tableH),
      insight(colX, bottom - calloutH, colW, calloutH),
      source,
    ];
  }
  // Tall: the doughnut over the table, the story under it where the page has the room.
  const tableH = u * 8 * (SHARES.length + 1);
  const calloutH = u * 22;
  const room = bottom - head.top;
  const withCallout = room - tableH - calloutH - u * 10 > room * 0.38;
  const chartH = room - tableH - u * 5 - (withCallout ? calloutH + u * 5 : 0);
  const els: Element[] = [
    ...head.els,
    ...doughnut(0, head.top, W, chartH),
    shareTable(k, 0, head.top + chartH + u * 5, W, tableH),
  ];
  if (withCallout) els.push(insight(0, bottom - calloutH, W, calloutH));
  els.push(source);
  return els;
}

// A figure fitted to its box with room to spare: the headline's fit reckons on a mean glyph,
// and a figure's wide digits and capitals (£2.4M) need more, so it is fitted to a narrower box.
const FIGURE_FIT = 0.8;
export function figureTitle(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): TextElement {
  return { ...k.title(x, y, w * FIGURE_FIT, h, label), width: Math.round(w) };
}

// A tile's place on the mosaic's grid: column, row, and how many of each it spans.
type Cell = readonly [col: number, row: number, cols: number, rows: number];
// The tiles, in the order of the arrangement's cells: the hero, an icon figure, the stars,
// a ring, a day-by-day chart and a second icon figure.
type Grid = { cols: number; rows: number; cells: readonly Cell[] };

// Wide: four by three, the hero and the chart two by two each.
const GRID_WIDE: Grid = {
  cols: 4,
  rows: 3,
  cells: [
    [0, 0, 2, 2],
    [2, 0, 1, 1],
    [3, 0, 1, 1],
    [0, 2, 1, 1],
    [2, 1, 2, 2],
    [1, 2, 1, 1],
  ],
};
// Tall: three by four, the hero top left and the chart under it.
const GRID_TALL: Grid = {
  cols: 3,
  rows: 4,
  cells: [
    [0, 0, 2, 2],
    [2, 0, 1, 1],
    [2, 1, 1, 1],
    [2, 2, 1, 1],
    [0, 2, 2, 2],
    [2, 3, 1, 1],
  ],
};
// Long (a story): two by six, the hero and the chart across the page.
const GRID_LONG: Grid = {
  cols: 2,
  rows: 6,
  cells: [
    [0, 0, 2, 2],
    [0, 2, 1, 1],
    [1, 2, 1, 1],
    [0, 5, 1, 1],
    [0, 3, 2, 2],
    [1, 5, 1, 1],
  ],
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BOARDS_BY_DAY = [62, 88, 79, 71, 54, 23, 19];
const FINISHED = 87;
// Narrower than this many units, a tile's caption is set a size down.
const NARROW_TILE = 36;

type Rect = { x: number; y: number; w: number; h: number };

function statMosaic(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // A page not much taller than wide keeps the height for the tiles.
  const roomy = H > W * 1.2;
  const head = roomy
    ? heading(k, '2026, wrapped', 'A year of our community, in six numbers.')
    : heading(k, '2026, wrapped');
  const grid = k.wide || !roomy ? GRID_WIDE : H > W * 1.6 ? GRID_LONG : GRID_TALL;
  const gap = u * 3;
  const bottom = H - u * FOOT;
  const colW = (W - gap * (grid.cols - 1)) / grid.cols;
  const rowH = (bottom - head.top - gap * (grid.rows - 1)) / grid.rows;
  const rect = ([c, r, cs, rs]: Cell): Rect => ({
    x: c * (colW + gap),
    y: head.top + r * (rowH + gap),
    w: cs * colW + (cs - 1) * gap,
    h: rs * rowH + (rs - 1) * gap,
  });
  const tile = ({ x, y, w, h }: Rect) =>
    k.shape('square', x, y, w, h, { borderRadius: 'lg', label: '' });
  const capH = u * 7;
  // A figure over its one-line caption, filling the room it is given.
  // A narrow tile sets its caption a size down, so it stays on one line; `figW` leaves room
  // beside the figure for a corner mark.
  const figure = (r: Rect, value: string, caption: string, maxFig: number, figW = r.w) => {
    const figH = Math.min(maxFig, r.h - capH);
    const fy = r.y + (r.h - capH - figH) / 2;
    return [
      figureTitle(k, r.x, fy, figW, figH, value),
      k.text(r.x, fy + figH, r.w, capH, caption, {
        textSize: r.w < u * NARROW_TILE ? 'md' : 'lg',
        textAlignY: 'middle',
      }),
    ];
  };
  // A small tile: its mark (an icon) beside the figure on a tile much wider than tall, else in
  // the top right corner with the figure under it.
  const markTile = (r: Rect, iconId: string, value: string, caption: string) => {
    const pad = Math.min(u * 4, r.h * 0.14);
    const inner = { x: r.x + pad, y: r.y + pad, w: r.w - 2 * pad, h: r.h - 2 * pad };
    if (r.w > r.h * 1.6) {
      const side = Math.min(inner.h * 0.7, u * 14);
      return [
        tile(r),
        k.shape('icon', inner.x, inner.y + (inner.h - side) / 2, side, side, { iconId }),
        ...figure(
          { ...inner, x: inner.x + side + u * 4, w: inner.w - side - u * 4 },
          value,
          caption,
          u * 16,
        ),
      ];
    }
    const side = Math.min(u * 8, inner.h * 0.3);
    return [
      tile(r),
      k.shape('icon', inner.x + inner.w - side, inner.y, side, side, { iconId }),
      ...figure(inner, value, caption, u * 16, inner.w - side - u * 2),
    ];
  };
  const [hero, globe, stars, ring, chart, notes] = grid.cells.map(rect);
  const els: Element[] = [...head.els];
  // The hero: an icon, the year's biggest number and what it counts.
  {
    const r = hero!;
    const pad = u * 5;
    const icon = Math.min(u * 12, r.h * 0.2);
    els.push(
      tile(r),
      k.shape('icon', r.x + pad, r.y + pad, icon, icon, { iconId: 'layers' }),
      ...figure(
        { x: r.x + pad, y: r.y + pad + icon, w: r.w - 2 * pad, h: r.h - 2 * pad - icon },
        '1.2M',
        'boards made',
        u * 34,
      ),
    );
  }
  els.push(...markTile(globe!, 'globe', '143', 'countries'));
  els.push(...markTile(notes!, 'edit', '9.6M', 'sticky notes'));
  // The stars: the average review, its stars standing in for a caption.
  {
    const r = stars!;
    const pad = Math.min(u * 4, r.h * 0.14);
    const starH = Math.min(u * 6, r.h * 0.22);
    const figH = Math.min(u * 16, r.h - 2 * pad - starH - u * 2);
    const fy = r.y + (r.h - figH - starH - u * 2) / 2;
    els.push(
      tile(r),
      figureTitle(k, r.x + pad, fy, r.w - 2 * pad, figH, '4.8'),
      k.shape('rating', r.x + pad, fy + figH + u * 2, Math.min(r.w - 2 * pad, starH * 5), starH, {
        rating: 5,
      }),
    );
  }
  // A ring: the share that finished, its caption beside it on a wide tile, under it otherwise.
  {
    const r = ring!;
    const pad = Math.min(u * 4, r.h * 0.14);
    const caption = 'finish their board';
    els.push(tile(r));
    if (r.w > r.h * 1.6) {
      const side = r.h - 2 * pad;
      els.push(
        k.shape('progress-ring', r.x + pad, r.y + pad, side, side, {
          progress: FINISHED,
          label: `${FINISHED}%`,
          textSize: 'lg',
          textBold: true,
        }),
        k.text(r.x + side + pad + u * 4, r.y + pad, r.w - side - 2 * pad - u * 4, side, caption, {
          textSize: 'lg',
          textAlignY: 'middle',
        }),
      );
    } else {
      const side = Math.min(r.w - 2 * pad, r.h - 2 * pad - capH);
      els.push(
        k.shape('progress-ring', r.x + (r.w - side) / 2, r.y + pad, side, side, {
          progress: FINISHED,
          label: `${FINISHED}%`,
          textSize: 'lg',
          textBold: true,
        }),
        k.text(r.x + pad, r.y + pad + side, r.w - 2 * pad, capH, caption, {
          textAlignX: 'center',
          textAlignY: 'middle',
        }),
      );
    }
  }
  // The week: boards made by day, Tuesday the peak.
  {
    const r = chart!;
    const pad = u * 5;
    const titleH = u * 8;
    els.push(
      tile(r),
      k.text(r.x + pad, r.y + pad, r.w - 2 * pad, titleH, 'Busiest day: Tuesday', {
        textSize: 'lg',
        textBold: true,
        textAlignY: 'middle',
      }),
      k.shape(
        'line-chart',
        r.x + pad,
        r.y + pad + titleH + u * 2,
        r.w - 2 * pad,
        r.h - 2 * pad - titleH - u * 2,
        {
          chartVariant: 'area',
          chartLegend: false,
          lineCategories: [...WEEKDAYS],
          lineSeries: [{ name: 'Boards made, thousands', values: [...BOARDS_BY_DAY] }],
        },
      ),
    );
  }
  els.push(sourceLine(k, 'Source: product analytics and app store reviews, 2026.'));
  return els;
}

export const buildMarketShare = (b: LayoutBox) => marketShare(kit(b));
export const buildStatMosaic = (b: LayoutBox) => statMosaic(kit(b));
