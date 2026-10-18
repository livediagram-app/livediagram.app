// Posters layouts, part two (docs/specs/007-editor/pages-mode.md "Layouts"): a research
// poster and a we're hiring poster. Pure builders on the shared kit: the page's content box in,
// uncoloured elements out, a tall page stacking and a squarer or wide one setting side by side.
import type { Element } from '@livediagram/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconDisc, iconRow } from './page-layout-parts';
import {
  column,
  eyebrow,
  fitTitle,
  hairline,
  isSplit,
  matchedTitles,
  type Block,
} from './page-layouts-set-posters-kit';

// A research poster's section: a tinted heading bar over its body.
function sectionHead(k: Kit, x: number, y: number, w: number, label: string) {
  return k.shape('square', x, y, w, k.u * 8, {
    label,
    textBold: true,
    textSize: 'lg',
    textAlignX: 'left',
    borderRadius: 'md',
  });
}

type Section = (x: number, w: number) => Block;

// A section of running text, its body taking a share of the column's room.
const textSection =
  (k: Kit, title: string, body: string, weight = 1): Section =>
  (x, w) => ({
    h: k.u * 22,
    grow: weight,
    draw: (y, h) => [
      sectionHead(k, x, y, w, title),
      k.text(x, y + k.u * 11, w, h - k.u * 11, body),
    ],
  });

function research(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // Three columns unless the page is clearly taller than wide.
  const cols = W >= H * 0.95 ? 3 : 2;
  const logo = u * 14;
  const titleW = W - logo - u * 6;
  const header: Block[] = [
    {
      h: u * 14,
      grow: 1,
      max: u * 26,
      draw: (y, h) => [
        ...matchedTitles(k, [
          [0, y, titleW, h / 2, 'Street trees cool'],
          [0, y + h / 2, titleW, h / 2, 'summer streets by 4°C'],
        ]),
        k.image(W - logo, y, logo, logo),
      ],
    },
    {
      h: u * 12,
      gap: u * 2,
      draw: (y) => [
        k.text(0, y, W, u * 6, 'Priya Natarajan, Owen Hughes and Mei Lin Tan', {
          textBold: true,
        }),
        k.text(0, y + u * 6, W, u * 6, 'School of Geography, University of Leeds · ICUC 2026'),
      ],
    },
  ];
  const headH = cols === 3 ? u * 28 : Math.min(u * 46, H * 0.26);
  const top = headH + u * 6;
  const gap = u * 5;
  const colW = (W - gap * (cols - 1)) / cols;
  const intro = textSection(
    k,
    'Introduction',
    'Cities run hotter than the land around them. How much do street trees cool the pavements we walk on?',
  );
  const methods = textSection(
    k,
    'Methods',
    '120 sensors on 40 streets\nA reading every 10 minutes\nJune to August 2025',
  );
  const conclusions = textSection(
    k,
    'Conclusions',
    'Each 10% of canopy cut the peak by 0.8°C. Plant the hottest streets first.',
  );
  const results: Section = (x, w) => ({
    h: u * 30,
    grow: 2,
    draw: (y, h) => [
      sectionHead(k, x, y, w, 'Results'),
      k.text(x, y + u * 11, w, u * 6, 'Peak °C by canopy cover', {
        textBold: true,
      }),
      k.shape('bar-chart', x, y + u * 18, w, h - u * 26, {
        pieSlices: [
          { label: 'Under 10%', value: 34.1 },
          { label: '10 to 25%', value: 32.6 },
          { label: '25 to 50%', value: 31.2 },
          { label: 'Over 50%', value: 30.0 },
        ],
        chartLegend: true,
        chartLegendPosition: 'bottom',
      }),
      k.text(x, y + h - u * 6, w, u * 6, 'Source: our sensors, 2025'),
    ],
  });
  const finding: Section = (x, w) => ({
    h: u * 24,
    draw: (y, h) => [
      k.shape('square', x, y, w, h, { label: '', borderRadius: 'lg' }),
      k.text(x + u * 4, y + u * 3, w - u * 8, u * 6, 'KEY FINDING', {
        textBold: true,
        letterSpacing: 0.2,
      }),
      fitTitle(k, x + u * 4, y + u * 8, w - u * 8, h * 0.4, '4.1°C cooler'),
      k.text(
        x + u * 4,
        y + u * 8 + h * 0.4,
        w - u * 8,
        Math.max(u * 5, h * 0.6 - u * 10),
        'at the 3pm peak',
      ),
    ],
  });
  // The references, and a slot for a code that links to the full paper.
  const references: Section = (x, w) => {
    const qr = u * 14;
    return {
      h: u * 26,
      draw: (y, h) => [
        sectionHead(k, x, y, w, 'References'),
        k.text(x, y + u * 11, w - qr - u * 4, h - u * 11, 'Oke (1982)\nBowler et al. (2010)'),
        k.image(x + w - qr, y + u * 11, qr, qr),
      ],
    };
  };
  const columns: Section[][] =
    cols === 3
      ? [
          [intro, methods],
          [results, finding],
          [conclusions, references],
        ]
      : [
          [intro, methods, conclusions],
          [results, finding, references],
        ];
  return [
    ...column(0, headH, header, u * 3),
    hairline(k, 0, headH + u * 1.5, W, u * 1),
    ...columns.flatMap((sections, c) => {
      const x = c * (colW + gap);
      return column(
        top,
        H - top,
        sections.map((s) => s(x, colW)),
        u * 6,
      );
    }),
  ];
}

const ROLES = [
  ['Robotics Engineer', 'Engineering · Full time · Hybrid'],
  ['Product Designer', 'Design · Full time · Bristol'],
  ['Field Technician', 'Operations · Full time · On site'],
] as const;

const PERKS = [
  ['heart', 'Private healthcare'],
  ['clock', 'Four-day week option'],
  ['award', '£2k learning budget'],
] as const;

function hiring(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const split = isSplit(k);
  const leftW = split ? W * 0.46 : W;
  // The headline over two lines, a disc with a person-plus icon beside it.
  const headline: Block = {
    h: u * 26,
    grow: 1,
    max: u * 40,
    draw: (y, h) => {
      const d = Math.min(h * 0.9, leftW * 0.3);
      const tw = leftW - d - u * 4;
      return [
        fitTitle(k, 0, y, tw, h / 2, "We're"),
        fitTitle(k, 0, y + h / 2, tw, h / 2, 'hiring.'),
        ...iconDisc(k, leftW - d, y + (h - d) / 2, d, 'user-plus').els,
      ];
    },
  };
  const lead = (w: number): Block => ({
    h: u * 12,
    gap: u * 2,
    draw: (y, h) => [
      k.text(0, y, w, h, 'Join 40 people building robots that sort recycling.', {
        textSize: 'lg',
      }),
    ],
  });
  const role = (x: number, w: number, i: number): Block => ({
    h: u * 13,
    grow: 1,
    max: u * 20,
    gap: i === 0 ? undefined : u * 3,
    draw: (y, h) => {
      const icon = Math.min(u * 7, h * 0.5);
      const [name, meta] = ROLES[i]!;
      const ty = y + (h - u * 13) / 2;
      return [
        k.shape('square', x, y, w, h, { label: '', borderRadius: 'lg' }),
        k.text(x + u * 4, ty + u * 1, w - icon - u * 12, u * 6, name, {
          textBold: true,
          // A narrow card takes the name a size down, so it stays on one line.
          textSize: w > u * 60 ? 'lg' : 'md',
        }),
        k.text(x + u * 4, ty + u * 7, w - icon - u * 12, u * 6, meta),
        k.shape('icon', x + w - icon - u * 4, y + (h - icon) / 2, icon, icon, {
          iconId: 'arrow-right',
        }),
      ];
    },
  });
  const perksAcross = (y: number, h: number): Element[] => {
    const cw = W / PERKS.length;
    const icon = u * 7;
    return PERKS.flatMap(([iconId, line], i) =>
      iconRow(k, i * cw, y + (h - icon) / 2, cw - u * 3, icon, iconId, line, { lineH: h }),
    );
  };
  const perksDown = (y: number, h: number): Element[] => {
    const rowH = h / PERKS.length;
    const icon = Math.min(u * 7, rowH * 0.8);
    return PERKS.flatMap(([iconId, line], i) =>
      iconRow(k, 0, y + i * rowH + (rowH - icon) / 2, leftW, icon, iconId, line),
    );
  };
  const cta = (w: number): Block => ({
    h: u * 15,
    draw: (y, h) => [
      k.shape('banner', 0, y, w, h, {
        label: 'Apply by 30 November',
        pageSubtitle: 'acmerobotics.com/careers',
        borderRadius: 'md',
      }),
    ],
  });
  const kicker: Block = {
    h: u * 6,
    draw: (y) => [eyebrow(k, 0, y, leftW, 'ACME ROBOTICS · BRISTOL')],
  };
  if (split) {
    const rightX = leftW + u * 8;
    const rightW = W - rightX;
    return [
      ...column(
        0,
        H,
        [kicker, headline, lead(leftW), { h: u * 24, draw: perksDown }, cta(leftW)],
        u * 4,
      ),
      ...column(
        0,
        H,
        [
          { h: u * 6, draw: (y) => [eyebrow(k, rightX, y, rightW, 'OPEN ROLES')] },
          ...ROLES.map((_, i) => ({ ...role(rightX, rightW, i), max: u * 34 })),
        ],
        u * 4,
      ),
    ];
  }
  return column(
    0,
    H,
    [
      kicker,
      headline,
      lead(W * 0.9),
      ...ROLES.map((_, i) => ({ ...role(0, W, i), gap: i === 0 ? u * 5 : u * 3 })),
      { h: u * 12, gap: u * 5, draw: perksAcross },
      { ...cta(W), gap: u * 5 },
    ],
    u * 4,
  );
}

export const buildResearch = (b: LayoutBox) => research(kit(b));
export const buildHiring = (b: LayoutBox) => hiring(kit(b));
