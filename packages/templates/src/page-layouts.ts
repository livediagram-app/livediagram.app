// Page layouts (docs/specs/007-editor/infographic-pages.md "Layouts"): ready-made arrangements put
// onto ONE Infographic page, to start from and then edit. Pure builders: the page's content box (the
// page less its margins) in, ordinary elements out, laid out in proportions of the box so a layout
// fits every size and orientation. Elements carry no colours of their own: the tab's theme paints
// them, and a dark page inks them light. A "wide" box (landscape, a slide) gets a side-by-side
// arrangement where a stack would be squashed.
import {
  createImage,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
  type ImageElement,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
} from '@livediagram/document';

export type PageLayoutId =
  | 'title'
  | 'big-number'
  | 'key-stats'
  | 'process'
  | 'timeline'
  | 'comparison'
  | 'chart-story'
  | 'top-tips';

export type LayoutBox = { x: number; y: number; width: number; height: number };

type Kit = {
  box: LayoutBox;
  // The box's short side over 100: the unit every size is measured in.
  u: number;
  wide: boolean;
  shape: (
    kind: ShapeKind,
    x: number,
    y: number,
    w: number,
    h: number,
    extra?: Partial<ShapeElement>,
  ) => ShapeElement;
  text: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    extra?: Partial<TextElement>,
  ) => TextElement;
  // A headline fitted to its box (the fit-to-box size), bold.
  title: (x: number, y: number, w: number, h: number, label: string) => TextElement;
  image: (x: number, y: number, w: number, h: number) => ImageElement;
};

// Wider than this many times its height, a box is laid out side by side.
const WIDE_RATIO = 1.15;

function kit(box: LayoutBox): Kit {
  const r = (n: number) => Math.round(n);
  return {
    box,
    u: Math.min(box.width, box.height) / 100,
    wide: box.width > box.height * WIDE_RATIO,
    shape: (kind, x, y, w, h, extra = {}) => ({
      ...createShape(kind, r(box.x + x), r(box.y + y)),
      width: r(w),
      height: r(h),
      ...extra,
    }),
    text: (x, y, w, h, label, extra = {}) => ({
      ...createText(r(box.x + x), r(box.y + y)),
      width: r(w),
      height: r(h),
      label,
      textSize: 'md',
      textAlignX: 'left',
      textAlignY: 'top',
      ...extra,
    }),
    title: (x, y, w, h, label) => ({
      ...createText(r(box.x + x), r(box.y + y)),
      width: r(w),
      height: r(h),
      label,
      textSize: 'scale',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'middle',
    }),
    image: (x, y, w, h) => ({
      ...createImage(r(box.x + x), r(box.y + y)),
      width: r(w),
      height: r(h),
      objectFit: 'cover',
      borderRadius: 'lg',
      aspectLocked: false,
    }),
  };
}

// The headline every layout but the title page opens with, an optional lead line under it, and
// how far down the content starts.
function heading(k: Kit, label: string, lead?: string): { els: Element[]; top: number } {
  const { u } = k;
  const h = u * 9;
  const els: Element[] = [k.title(0, 0, k.box.width * 0.85, h, label)];
  if (!lead) return { els, top: h + u * 6 };
  els.push(k.text(0, h + u * 2, k.box.width * 0.9, u * 9, lead, { textSize: 'lg' }));
  return { els, top: h + u * 15 };
}

function titlePage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = [
    k.text(0, 0, W * 0.6, u * 5, 'ANNUAL REPORT 2026', { textBold: true }),
    k.title(0, u * 6, k.wide ? W * 0.5 : W, u * 16, 'Your big headline'),
    k.text(
      0,
      u * 25,
      k.wide ? W * 0.45 : W * 0.85,
      u * 12,
      'One line on what this page shows, and why it matters.',
      { textSize: 'lg' },
    ),
  ];
  const footer = k.text(0, H - u * 5, W, u * 5, 'Prepared by your team · October 2026');
  const image = k.wide
    ? k.image(W * 0.52, 0, W * 0.48, H - u * 8)
    : k.image(0, u * 42, W, H - u * 50);
  return [...head, image, footer];
}

function bigNumber(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const body = 'Show the one figure that matters, then say here what it means and why it moved.';
  if (k.wide) {
    return [
      k.title(0, H * 0.18, W * 0.5, H * 0.42, '73%'),
      k.text(0, H * 0.64, W * 0.45, u * 10, 'of teams now ship every week', {
        textSize: 'lg',
        textBold: true,
      }),
      k.text(W * 0.55, H * 0.22, W * 0.45, H * 0.42, body, { textSize: 'lg' }),
      k.shape('progress-bar', W * 0.55, H * 0.7, W * 0.45, u * 5, { progress: 73 }),
    ];
  }
  return [
    k.title(0, H * 0.14, W, H * 0.26, '73%'),
    k.text(0, H * 0.43, W, u * 10, 'of teams now ship every week', {
      textSize: 'lg',
      textBold: true,
    }),
    k.text(0, H * 0.53, W * 0.85, H * 0.18, body, { textSize: 'lg' }),
    k.shape('progress-bar', 0, H * 0.8, W, u * 5, { progress: 73 }),
  ];
}

function keyStats(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'The year in numbers', 'Twelve months, six numbers.');
  const rowH = u * 18;
  const row = (y: number, stats: [string, string][]) =>
    k.shape('stat-row', 0, y, W, rowH, {
      borderRadius: 'md',
      stats: stats.map(([value, caption]) => ({ value, caption })),
    });
  const calloutH = u * 20;
  const rowsEnd = head.top + 2 * rowH + u * 4;
  const chartRoom = H - calloutH - u * 8 - rowsEnd;
  const els: Element[] = [
    ...head.els,
    row(head.top, [
      ['12k', 'Customers'],
      ['94%', 'Would recommend'],
      ['3.2x', 'Growth'],
    ]),
    row(head.top + rowH + u * 4, [
      ['48', 'Countries'],
      ['1.4M', 'Orders'],
      ['24/7', 'Support'],
    ]),
  ];
  // A trend between the figures and the takeaway, where the page has room for one.
  if (chartRoom > u * 24) {
    els.push(
      k.shape('line-chart', 0, rowsEnd + u * 4, W, chartRoom, {
        lineCategories: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
        lineSeries: [{ name: 'Customers', values: [3, 4.2, 5.8, 7.1, 9.6, 12] }],
        chartLegend: false,
      }),
    );
  }
  els.push(
    k.shape('callout', 0, H - calloutH, W, calloutH, {
      pageTitle: 'Takeaway',
      label: 'Say what the numbers mean in one or two sentences.',
      textSize: 'md',
    }),
  );
  return els;
}

const STEPS = [
  ['Plan', 'Agree the goal and who it is for.'],
  ['Build', 'Make the smallest thing that works.'],
  ['Launch', 'Put it in front of real people.'],
  ['Learn', 'Measure what happened, then go again.'],
] as const;

// Numbered discs down the page, a step's name and note beside each, joined by arrows.
function verticalSteps(
  k: Kit,
  top: number,
  rows: readonly (readonly [string, string])[],
  disc: (i: number) => string,
  discSize: TextElement['textSize'] = 'lg',
): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const rowH = (H - top) / rows.length;
  const d = Math.min(rowH * 0.6, u * 16);
  const els: Element[] = [];
  const discs: ShapeElement[] = [];
  rows.forEach(([name, note], i) => {
    const y = top + i * rowH;
    const c = k.shape('circle', 0, y, d, d, { label: disc(i), textBold: true, textSize: discSize });
    discs.push(c);
    els.push(
      c,
      k.text(d + u * 6, y, W - d - u * 6, u * 7, name, { textSize: 'lg', textBold: true }),
      k.text(d + u * 6, y + u * 8, W - d - u * 6, Math.max(u * 4, rowH - u * 9), note),
    );
  });
  for (let i = 1; i < discs.length; i += 1) {
    els.push(createPinnedArrow(discs[i - 1]!.id, 's', discs[i]!.id, 'n'));
  }
  return els;
}

function process(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const head = heading(k, 'How it works', 'Four steps from idea to impact.');
  if (!k.wide) return [...head.els, ...verticalSteps(k, head.top, STEPS, (i) => `${i + 1}`)];
  const procH = u * 22;
  const colW = W / STEPS.length;
  return [
    ...head.els,
    k.shape('process', 0, head.top, W, procH, { processSteps: STEPS.map(([name]) => name) }),
    ...STEPS.map(([, note], i) =>
      k.text(i * colW + u, head.top + procH + u * 4, colW - u * 2, u * 24, note, {
        textAlignX: 'center',
      }),
    ),
    k.shape('callout', 0, k.box.height - u * 20, W, u * 20, {
      pageTitle: 'Why it works',
      label: 'Small steps, real feedback, and a loop that never stops.',
      textSize: 'md',
    }),
  ];
}

const MILESTONES = [
  ['2022', 'Founded', 'Two people and a spare room.'],
  ['2023', 'First customer', 'A local bakery, still with us.'],
  ['2024', 'Series A', 'Funding to build the team.'],
  ['2025', 'Went global', 'Customers in 48 countries.'],
  ['2026', 'What is next', 'Say where you are heading.'],
] as const;

function timeline(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const head = heading(k, 'Our journey', 'From a spare room to 48 countries.');
  if (!k.wide) {
    return [
      ...head.els,
      ...verticalSteps(
        k,
        head.top,
        MILESTONES.map(([, name, note]) => [name, note] as const),
        (i) => MILESTONES[i]![0],
        'md',
      ),
    ];
  }
  const railH = u * 18;
  const n = MILESTONES.length;
  // The rail's own point spacing (RailView): inset by min(44, 12% of its width) each side. The rail
  // is drawn in from the box's sides just enough that the end notes, centred under the end points,
  // stay inside it: inset + pad = half a note = 0.46 of a step.
  const railPad = (w: number) => Math.min(44, w * 0.12);
  let inset = 0;
  for (let i = 0; i < 3; i += 1) {
    const pad = railPad(W - 2 * inset);
    const half = (0.46 * (W - 2 * inset - 2 * pad)) / (n - 1);
    inset = Math.max(0, half - pad);
  }
  const railW = W - 2 * inset;
  const pad = railPad(railW);
  const step = (railW - 2 * pad) / (n - 1);
  const noteW = step * 0.92;
  return [
    ...head.els,
    k.shape('timeline-rail', inset, head.top, railW, railH, {
      railCount: n,
      railLabels: MILESTONES.map(([year]) => year),
    }),
    ...MILESTONES.flatMap(([, name, note], i) => {
      const x = Math.max(0, inset + pad + i * step - noteW / 2);
      const y = head.top + railH + u * 3;
      return [
        k.text(x, y, noteW, u * 7, name, { textBold: true, textAlignX: 'center' }),
        k.text(x, y + u * 8, noteW, u * 16, note, { textAlignX: 'center' }),
      ];
    }),
    k.shape('stat-row', 0, k.box.height - u * 20, W, u * 20, {
      borderRadius: 'md',
      stats: [
        { value: '4', caption: 'Years' },
        { value: '48', caption: 'Countries' },
        { value: '120', caption: 'People' },
      ],
    }),
  ];
}

function comparison(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Before and after', 'What changed when we switched.');
  const gap = u * 6;
  const colW = (W - gap) / 2;
  const verdictH = u * 18;
  const rowsTop = head.top + u * 18;
  const rowH = Math.min(u * 22, (H - verdictH - u * 6 - rowsTop) / 3);
  const icon = Math.min(u * 8, rowH * 0.6);
  const column = (x: number, title: string, iconId: string, lines: string[]) => [
    k.shape('square', x, head.top, colW, u * 12, {
      label: title,
      textBold: true,
      textSize: 'lg',
      borderRadius: 'md',
    }),
    ...lines.flatMap((line, i) => {
      const y = rowsTop + i * rowH;
      return [
        k.shape('icon', x, y, icon, icon, { iconId }),
        k.text(x + icon + u * 4, y, colW - icon - u * 4, rowH - u * 2, line),
      ];
    }),
  ];
  return [
    ...head.els,
    ...column(0, 'Before', 'clock', [
      'Hours of manual work',
      'Data in five places',
      'Answers next week',
    ]),
    ...column(colW + gap, 'After', 'check-circle', [
      'Done in minutes',
      'One source of truth',
      'Answers right now',
    ]),
    k.shape('callout', 0, H - verdictH, W, verdictH, {
      pageTitle: 'The verdict',
      label: 'Sum up the difference in one sentence.',
      textSize: 'md',
    }),
  ];
}

function chartStory(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'What the data says');
  const bars = (w: number, h: number, x: number, y: number) =>
    k.shape('bar-chart', x, y, w, h, {
      pieSlices: [
        { label: 'Q1', value: 32 },
        { label: 'Q2', value: 45 },
        { label: 'Q3', value: 51 },
        { label: 'Q4', value: 68 },
      ],
      chartLegend: false,
    });
  const ring = (side: number, x: number, y: number) =>
    k.shape('progress-ring', x, y, side, side, { progress: 68, label: '68%', textSize: 'lg' });
  const takeaways = [
    ['trending-up', 'Revenue grew every quarter.'],
    ['users', 'Most growth came from referrals.'],
    ['target', 'Next: hit 80% by Q2.'],
  ] as const;
  const rows = (x: number, y: number, w: number, h: number) => {
    const rowH = h / takeaways.length;
    const icon = Math.min(u * 8, rowH * 0.7);
    return takeaways.flatMap(([iconId, line], i) => {
      const ry = y + i * rowH;
      return [
        k.shape('icon', x, ry, icon, icon, { iconId }),
        k.text(x + icon + u * 3, ry, w - icon - u * 3, rowH, line),
      ];
    });
  };
  const avail = H - head.top;
  if (k.wide) {
    const chartW = W * 0.58;
    const sideW = W - chartW - u * 6;
    const side = Math.min(sideW, avail * 0.45);
    const restY = head.top + side + u * 6;
    return [
      ...head.els,
      bars(chartW, avail, 0, head.top),
      ring(side, chartW + u * 6, head.top),
      ...rows(chartW + u * 6, restY, sideW, H - restY),
    ];
  }
  const chartH = avail * 0.5;
  const side = Math.min(W * 0.38, avail - chartH - u * 6);
  const lowerY = head.top + chartH + u * 6;
  return [
    ...head.els,
    bars(W, chartH, 0, head.top),
    ring(side, 0, lowerY),
    ...rows(side + u * 6, lowerY, W - side - u * 6, side),
  ];
}

function topTips(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Five tips to get started');
  const tips = [
    ['zap', 'Start small: one page, one idea.'],
    ['target', 'Lead with the number that matters most.'],
    ['star', 'Use one accent colour, and use it on purpose.'],
    ['clock', 'Cut every word that does not earn its place.'],
    ['check-circle', 'Read it at a glance before you share it.'],
  ] as const;
  const rowH = Math.min(u * 24, (H - head.top) / tips.length);
  const icon = Math.min(u * 12, rowH * 0.6);
  return [
    ...head.els,
    ...tips.flatMap(([iconId, line], i) => {
      const y = head.top + i * rowH;
      return [
        k.shape('icon', 0, y, icon, icon, { iconId }),
        k.text(icon + u * 5, y, W - icon - u * 5, icon, line, {
          textSize: 'lg',
          textAlignY: 'middle',
        }),
      ];
    }),
  ];
}

export type PageLayout = {
  id: PageLayoutId;
  label: string;
  // One line for the picker's tooltip.
  description: string;
  build: (box: LayoutBox) => Element[];
};

export const PAGE_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'title',
    label: 'Title page',
    description: 'A big title, a subtitle, an image and a footer line',
    build: (b) => titlePage(kit(b)),
  },
  {
    id: 'big-number',
    label: 'Big number',
    description: 'One huge figure, its caption and a short paragraph',
    build: (b) => bigNumber(kit(b)),
  },
  {
    id: 'key-stats',
    label: 'Key stats',
    description: 'Two rows of three figures and a takeaway',
    build: (b) => keyStats(kit(b)),
  },
  {
    id: 'process',
    label: 'Process',
    description: 'Four numbered steps, each with a note',
    build: (b) => process(kit(b)),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Five dated milestones, each with a note',
    build: (b) => timeline(kit(b)),
  },
  {
    id: 'comparison',
    label: 'Comparison',
    description: 'Two columns of three points, side by side',
    build: (b) => comparison(kit(b)),
  },
  {
    id: 'chart-story',
    label: 'Chart story',
    description: 'A bar chart, a progress ring and three takeaways',
    build: (b) => chartStory(kit(b)),
  },
  {
    id: 'top-tips',
    label: 'Top tips',
    description: 'Five tips, each an icon beside a line',
    build: (b) => topTips(kit(b)),
  },
];

export function pageLayoutById(id: PageLayoutId): PageLayout {
  return PAGE_LAYOUTS.find((l) => l.id === id)!;
}
