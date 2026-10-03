// The slide deck template (docs/specs/008-canvas/canvas-and-palette.md "Templates on pages"): a
// six-slide seed pitch that opens in Illustrate, one Slide (16:9) page per slide. The storyboard,
// which used to share this file as the other framed-panel design template, moved to
// ./template-builders-storyboard once each grew its own narrative.
//
// Pure: () -> Element[], placed on the deck's pages (slideDeckPages) whatever centre is passed.

import type { Element, IllustratePage } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { pageKits, templatePage } from './template-page-kit';

// Slide deck: the arc every good deck follows (title, problem, solution, traction, team, the ask)
// for a made-up start-up, Relay, which lets hospital nurses swap shifts in one tap. Each slide is
// its own page: a bold kicker naming its beat, one headline that makes the point, a body built
// from the element that suits it (pain rows beside the one number that hurts, a three-step
// process, a KPI row over a growth chart, the founders, the milestone and the use of funds) and a
// footer with the page number. The title slide sits on a dark gradient and the ask on a light one,
// so the deck opens and closes on a colour. What to SAY rides each headline as its note, the part
// a deck outline usually forgets. The footers are the "Frames" scaffold; everything else is
// "Content". Element colours stay theme-owned.
type Slide = { name: string; kicker: string; headline: string; notes: string };

const SLIDES: Slide[] = [
  {
    name: 'Title',
    kicker: 'Seed round · March 2027',
    headline: 'Relay: shift swaps in one tap',
    notes: 'Open with Amara’s night shift: 40 minutes on WhatsApp to swap one Saturday.',
  },
  {
    name: 'Problem',
    kicker: 'The problem',
    headline: 'Swapping one shift takes 14 messages and two days',
    notes: 'Pause on the 14 messages. Everyone in the room has sent one of them.',
  },
  {
    name: 'Solution',
    kicker: 'The solution',
    headline: 'Post a shift, and Relay finds cover in minutes',
    notes: 'Demo it live if the Wi-Fi holds; the screenshots are in the appendix.',
  },
  {
    name: 'Traction',
    kicker: 'Traction',
    headline: 'Live on 38 wards in nine months',
    notes: 'Lead with the 94%: it is the number matrons repeat back to us.',
  },
  {
    name: 'Team',
    kicker: 'The team',
    headline: 'Built by people who worked the rotas',
    notes: 'Thirty seconds, no more. Why us: we lived the problem.',
  },
  {
    name: 'The Ask',
    kicker: 'The ask',
    headline: 'Raising £1.5m to reach 40 hospitals by 2028',
    notes: 'Say the number, then stop talking and wait for the first question.',
  },
];

// The title slide's dark gradient (light ink on it) and the ask's light one.
const TITLE_BACKGROUND = {
  fill: { kind: 'gradient' as const, from: '#1e1b4b', to: '#4c1d95', angle: 160 },
};
const ASK_BACKGROUND = {
  fill: { kind: 'gradient' as const, from: '#e0f2fe', to: '#ede9fe', angle: 160 },
};

/** The deck's pages: one landscape Slide (16:9) page per slide. */
export function slideDeckPages(): IllustratePage[] {
  return SLIDES.map((s, i) =>
    templatePage(
      i + 1,
      'wide',
      'landscape',
      s.name,
      i === 0 ? TITLE_BACKGROUND : i === SLIDES.length - 1 ? ASK_BACKGROUND : undefined,
    ),
  );
}

// Where a content slide's body starts and ends, in units of its content box.
const BODY_TOP = 24;
const FOOTER_H = 5;
const BODY_GAP = 9;

const avatar = (k: Kit, x: number, y: number, d: number): Element => ({
  ...k.image(x, y, d, d),
  borderRadius: 'full',
  aspectLocked: true,
});

// A content slide's kicker and headline (carrying the speaker notes), and its footer.
function chrome(k: Kit, i: number): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const s = SLIDES[i]!;
  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  return [
    k.text(0, 0, W * 0.6, u * 5, s.kicker, { textBold: true }),
    { ...k.title(0, u * 6, W * 0.92, u * 13, s.headline), note: s.notes },
    k.text(0, H - u * FOOTER_H, W * 0.5, u * FOOTER_H, 'Relay · Seed pitch', scaffold),
    k.text(W - u * 30, H - u * FOOTER_H, u * 30, u * FOOTER_H, `${i + 1} / ${SLIDES.length}`, {
      ...scaffold,
      textAlignX: 'right',
    }),
  ];
}

// One body per slide, in deck order. `top` and `bottom` bound a content slide's body.
const SLIDE_BODIES: ((k: Kit, top: number, bottom: number) => Element[])[] = [
  // Title: the mark, the promise, and who is presenting.
  (k) => {
    const { width: W, height: H } = k.box;
    const { u } = k;
    const s = SLIDES[0]!;
    const y = H * 0.28;
    const d = u * 12;
    return [
      k.shape('icon', 0, 0, u * 9, u * 9, { iconId: 'refresh-cw' }),
      k.text(u * 12, u * 1.5, u * 40, u * 6, 'Relay', { textSize: 'lg', textBold: true }),
      k.text(0, y, W * 0.5, u * 5, s.kicker, { textBold: true }),
      { ...k.title(0, y + u * 6, W * 0.62, u * 14, s.headline), note: s.notes },
      k.text(
        0,
        y + u * 22,
        W * 0.5,
        u * 12,
        'Nurses post a shift, Relay finds cover, and the rota stays right.',
        { textSize: 'lg' },
      ),
      avatar(k, 0, H - d, d),
      k.text(d + u * 4, H - d + u * 0.5, W * 0.4, u * 6, 'Amara Okafor', {
        textSize: 'lg',
        textBold: true,
      }),
      k.text(
        d + u * 4,
        H - d + u * 6.5,
        W * 0.4,
        u * 5,
        'Co-founder, and an ICU nurse for nine years',
      ),
      k.shape('sticker', W * 0.7, H * 0.14, u * 50, u * 50, {
        stickerId: 'emoji-rocket',
        rotation: -8,
      }),
    ];
  },
  // Problem: three pains, each on a glyph, beside the one number that hurts.
  (k, top, bottom) => {
    const { width: W } = k.box;
    const { u } = k;
    const leftW = W * 0.56;
    const rowH = (bottom - top) / 3;
    const panelX = W * 0.62;
    const panelW = W - panelX;
    const pains = [
      ['message', 'Swaps run through WhatsApp groups and paper rotas'],
      ['clock', 'Nurses lose three hours a month chasing cover'],
      ['alert-triangle', 'One swap in five is never logged, so the rota is wrong'],
    ] as const;
    return [
      ...pains.flatMap(([iconId, line], r) => [
        k.shape('icon', 0, top + r * rowH, u * 9, u * 9, { iconId }),
        k.text(u * 14, top + r * rowH, leftW - u * 14, rowH - u * 4, line, { textSize: 'lg' }),
      ]),
      k.shape('square', panelX, top, panelW, bottom - top, {
        label: '',
        borderRadius: 'lg',
        colorPreset: 'soft',
      }),
      k.title(panelX + u * 6, top + u * 8, panelW - u * 12, u * 26, '14'),
      k.text(
        panelX + u * 6,
        top + u * 36,
        panelW - u * 12,
        u * 16,
        'messages to swap one Saturday shift, then two days of waiting',
        { textSize: 'lg' },
      ),
    ];
  },
  // Solution: the three-step flow, what happens at each step, and the rule that makes it safe.
  (k, top, bottom) => {
    const { width: W } = k.box;
    const { u } = k;
    const colW = W / 3;
    const calloutH = u * 17;
    const steps = [
      'A nurse posts the shift they cannot work, in one tap.',
      'Relay offers it to colleagues with the right skills and hours.',
      'The ward manager approves, and the rota updates itself.',
    ];
    return [
      k.shape('process', 0, top, W, u * 22, {
        processSteps: ['Post the shift', 'Relay matches', 'Manager approves'],
        textSize: 'lg',
      }),
      ...steps.map((line, i) =>
        k.text(i * colW + u * 3, top + u * 26, colW - u * 6, u * 14, line, {
          textSize: 'lg',
          textAlignX: 'center',
        }),
      ),
      k.shape('callout', 0, bottom - calloutH, W, calloutH, {
        pageTitle: 'Safe by default',
        label: 'Skills, hours and pay grade are checked automatically.',
        textSize: 'lg',
      }),
    ];
  },
  // Traction: the three numbers, then the curve behind them beside what the wards say.
  (k, top, bottom) => {
    const { width: W } = k.box;
    const { u } = k;
    const rowH = u * 20;
    const y = top + rowH + u * 4;
    return [
      k.shape('stat-row', 0, top, W, rowH, {
        borderRadius: 'md',
        stats: [
          { value: '2,900', caption: 'Nurses' },
          { value: '11,400', caption: 'Swaps made' },
          { value: '94%', caption: 'Covered within an hour' },
        ],
      }),
      k.shape('line-chart', 0, y, W * 0.6, bottom - y, {
        lineCategories: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
        lineSeries: [
          { name: 'Swaps a month', values: [120, 260, 410, 690, 940, 1300, 1620, 2100, 2480] },
        ],
        chartLegend: false,
      }),
      k.shape('callout', W * 0.64, y, W * 0.36, bottom - y, {
        pageTitle: 'From the wards',
        label: '“The first rota tool our night shift actually uses.” Matron, St Anne’s',
        textSize: 'lg',
      }),
    ];
  },
  // Team: three founders, avatar over name over role over why-them.
  (k, top) => {
    const { width: W } = k.box;
    const { u } = k;
    const colW = W / 3;
    const d = u * 24;
    const founders = [
      ['Amara Okafor', 'CEO · ex-ICU nurse', 'Nine years on ICU night shifts'],
      ['Tom Reyes', 'CTO · ex-NHS Digital', 'Built the NHS staff app'],
      ['Lena Fischer', 'Sales · ex-Cerner', 'Sold rostering into 60 trusts'],
    ] as const;
    return founders.flatMap(([name, role, why], p) => {
      const x = p * colW;
      const y = top + u * 2;
      const centred = { textAlignX: 'center' as const };
      return [
        avatar(k, x + (colW - d) / 2, y, d),
        k.text(x, y + d + u * 3, colW, u * 7, name, {
          ...centred,
          textSize: 'lg',
          textBold: true,
        }),
        k.text(x, y + d + u * 10, colW, u * 6, role, { ...centred, textBold: true }),
        k.text(x + u * 4, y + d + u * 16, colW - u * 8, u * 10, why, {
          ...centred,
          textSize: 'lg',
        }),
      ];
    });
  },
  // The ask: the milestone the money reaches, where it goes, and what it buys.
  (k, top, bottom) => {
    const { width: W } = k.box;
    const { u } = k;
    return [
      k.title(0, top, W * 0.28, u * 24, '40'),
      k.text(0, top + u * 25, W * 0.28, u * 14, 'hospitals live by 2028, from six today', {
        textSize: 'lg',
      }),
      k.shape('pie-chart', W * 0.32, top, W * 0.34, bottom - top, {
        pieSlices: [
          { label: 'Product', value: 45 },
          { label: 'Sales', value: 35 },
          { label: 'Ops', value: 20 },
        ],
        chartLegend: true,
        chartLegendPosition: 'right',
      }),
      k.text(W * 0.71, top, W * 0.29, u * 6, 'What it buys', { textSize: 'lg', textBold: true }),
      k.shape('checklist', W * 0.71, top + u * 8, W * 0.29, u * 30, {
        checklistItems: [
          { text: 'Hire four engineers', done: false },
          { text: 'Launch in three new trusts', done: false },
          { text: 'Break even in Q3 2028', done: false },
        ],
        textSize: 'lg',
      }),
    ];
  },
];

export function buildSlideDeck(_cx: number, _cy: number): Element[] {
  const kits = pageKits(slideDeckPages());
  const elements = kits.flatMap((k, i) => {
    const top = k.u * BODY_TOP;
    const bottom = k.box.height - k.u * BODY_GAP;
    return i === 0
      ? SLIDE_BODIES[0]!(k, top, bottom)
      : [...chrome(k, i), ...SLIDE_BODIES[i]!(k, top, bottom)];
  });
  // Everything but the footers is the slides' content.
  return elements.map((el) => (el.layerId ? el : { ...el, layerId: TEMPLATE_CONTENT_LAYER_ID }));
}
