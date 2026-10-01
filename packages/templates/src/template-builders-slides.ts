// The slide deck template. The storyboard, which used to share this file as
// the other framed-panel design template, moved to
// ./template-builders-storyboard once each grew its own narrative.
//
// Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { textAt, uiAt } from './template-wireframe-kit';

const MUTED = '#64748b';

// Slide deck: a six-slide seed pitch that follows the arc every good deck
// does (title, problem, solution, traction, team, the ask) for a made-up
// start-up, Relay, which lets hospital nurses swap shifts in one tap. Each
// slide is a 16:9 theme-filled card with a muted kicker naming its beat, one bold headline that makes
// the point, a body built from the element that suits it (pain rows with
// glyphs, a three-step process, a KPI stat row over a growth chart, team
// avatars, a use-of-funds pie) and a "2 / 6" page number. Under every slide
// a speaker-notes line (a message glyph + muted text) says what to SAY, which
// is the part a deck outline usually forgets. Frames, page numbers and the
// how-to are the "Frames" scaffold; everything written on or under a slide is
// "Content". Colours stay theme-owned.
type Slide = { kicker: string; headline: string; notes: string };

const SLIDES: Slide[] = [
  {
    kicker: 'Seed round · March 2027',
    headline: 'Relay: shift swaps in one tap',
    notes: 'Open with Amara’s night shift: 40 minutes on WhatsApp to swap one Saturday.',
  },
  {
    kicker: 'The problem',
    headline: 'Swapping one shift takes 14 messages and two days',
    notes: 'Pause on the 14 messages. Everyone in the room has sent one of them.',
  },
  {
    kicker: 'The solution',
    headline: 'Post a shift, and Relay finds cover in minutes',
    notes: 'Demo it live if the Wi-Fi holds; the screenshots are in the appendix.',
  },
  {
    kicker: 'Traction',
    headline: 'Live on 38 wards in nine months',
    notes: 'Lead with the 94%: it is the number matrons repeat back to us.',
  },
  {
    kicker: 'The team',
    headline: 'Built by people who worked the rotas',
    notes: 'Thirty seconds, no more. Why us: we lived the problem.',
  },
  {
    kicker: 'The ask',
    headline: 'Raising £1.5m to reach 40 hospitals by 2028',
    notes: 'Say the number, then stop talking and wait for the first question.',
  },
];

export function buildSlideDeck(cx: number, cy: number): Element[] {
  const slideW = 520;
  const slideH = 292;
  const gapX = 48;
  const notesGap = 12;
  const notesH = 44;
  const gapY = 44;
  const titleH = 44;
  const captionH = 28;
  const headGap = 28;
  const cols = 3;
  const rowPitch = slideH + notesGap + notesH + gapY;
  const totalW = cols * slideW + (cols - 1) * gapX;
  const totalH = titleH + captionH + headGap + 2 * rowPitch - gapY;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const top = y0 + titleH + captionH + headGap;

  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'Relay · seed pitch deck',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: captionH,
      label:
        'Six slides, one story: title, problem, solution, traction, team, the ask. Speaker notes sit under each slide.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    },
  ];

  SLIDES.forEach((slide, i) => {
    const sx = x0 + (i % cols) * (slideW + gapX);
    const sy = top + Math.floor(i / cols) * rowPitch;
    // Offset-positioned factories for this slide's content.
    const ui = uiAt(sx, sy);
    const text = textAt(sx, sy);

    // The slide itself.
    elements.push({
      ...createShape('square', sx, sy),
      width: slideW,
      height: slideH,
      borderRadius: 'sm',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push(
      text(slideW - 88, slideH - 34, 64, 20, `${i + 1} / ${SLIDES.length}`, {
        textColor: MUTED,
        textAlignX: 'right',
        layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
      }),
    );

    const isTitle = i === 0;
    elements.push(
      text(28, isTitle ? 150 : 22, 380, 22, slide.kicker, { textColor: MUTED, textBold: true }),
    );
    elements.push(
      text(28, isTitle ? 96 : 48, 464, isTitle ? 50 : 64, slide.headline, {
        textSize: isTitle ? 'lg' : 'md',
        textBold: true,
        textAlignY: 'top',
      }),
    );
    elements.push(...SLIDE_BODIES[i]!(ui, text));

    // Speaker notes, under the slide where a presenter looks for them.
    const ny = sy + slideH + notesGap;
    elements.push({
      ...createShape('icon', sx, ny + 2),
      width: 20,
      height: 20,
      iconId: 'message',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    elements.push({
      ...createText(sx + 30, ny),
      width: slideW - 30,
      height: notesH,
      label: slide.notes,
      textSize: 'sm',
      textColor: MUTED,
      textItalic: true,
      textAlignX: 'left',
      textAlignY: 'top',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  });

  return elements;
}

type Ui = ReturnType<typeof uiAt>;
type Text = ReturnType<typeof textAt>;

// One body per slide, in deck order, drawn through that slide's own
// factories so every offset is slide-local (the slide is 520 x 292; the
// kicker and headline take its top 112px).
const SLIDE_BODIES: ((ui: Ui, text: Text) => Element[])[] = [
  // Title: the mark, and who is presenting.
  (ui, text) => [
    ui('icon', 28, 36, 44, 44, { iconId: 'refresh-cw' }),
    ui('sticker', 420, 28, 72, 72, { stickerId: 'emoji-rocket' }),
    ui('circle', 28, 220, 40, 40),
    ui('icon', 38, 230, 20, 20, { iconId: 'user' }),
    text(80, 218, 320, 22, 'Amara Okafor', { textBold: true }),
    text(80, 240, 320, 22, 'Co-founder, and an ICU nurse for nine years', { textColor: MUTED }),
  ],
  // Problem: three pains, each on a glyph.
  (ui, text) =>
    (
      [
        ['message', 'Swaps run through WhatsApp groups and paper rotas'],
        ['clock', 'Nurses lose three hours a month chasing cover'],
        ['alert-triangle', 'One swap in five is never logged, so the rota is wrong'],
      ] as const
    ).flatMap(([iconId, line], r) => [
      ui('icon', 28, 128 + r * 44, 24, 24, { iconId }),
      text(64, 126 + r * 44, 420, 28, line),
    ]),
  // Solution: the three-step flow, and the rule that makes it safe.
  (ui, text) => [
    ui('process', 28, 118, 464, 96, {
      processSteps: ['Post the shift', 'Relay matches', 'Manager approves'],
      textSize: 'sm',
    }),
    text(28, 226, 400, 22, 'Skills, hours and pay grade are checked automatically.', {
      textColor: MUTED,
    }),
  ],
  // Traction: the three numbers, then the curve behind them.
  (ui) => [
    ui('stat-row', 28, 92, 464, 76, {
      borderRadius: 'md',
      stats: [
        { value: '2,900', caption: 'Nurses' },
        { value: '11,400', caption: 'Swaps made' },
        { value: '94%', caption: 'Covered within an hour' },
      ],
    }),
    ui('line-chart', 28, 176, 400, 100, {
      lineCategories: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
      lineSeries: [
        { name: 'Swaps a month', values: [120, 260, 410, 690, 940, 1300, 1620, 2100, 2480] },
      ],
      chartLegend: false,
    }),
  ],
  // Team: three founders, avatar over name over why-them.
  (ui, text) =>
    (
      [
        ['Amara Okafor', 'CEO · ex-ICU nurse'],
        ['Tom Reyes', 'CTO · ex-NHS Digital'],
        ['Lena Fischer', 'Sales · ex-Cerner'],
      ] as const
    ).flatMap(([name, role], p) => {
      const x = 28 + p * 160;
      return [
        ui('circle', x + 44, 104, 64, 64),
        ui('icon', x + 60, 120, 32, 32, { iconId: 'user' }),
        text(x, 176, 152, 22, name, { textBold: true, textAlignX: 'center' }),
        text(x, 198, 152, 22, role, { textColor: MUTED, textAlignX: 'center' }),
      ];
    }),
  // The ask: where the money goes, and what it buys.
  (ui) => [
    ui('pie-chart', 28, 116, 220, 150, {
      pieSlices: [
        { label: 'Product', value: 45 },
        { label: 'Sales', value: 35 },
        { label: 'Ops', value: 20 },
      ],
      chartLegend: true,
      chartLegendPosition: 'right',
    }),
    ui('checklist', 268, 120, 224, 112, {
      checklistItems: [
        { text: 'Hire four engineers', done: false },
        { text: 'Launch in three new trusts', done: false },
        { text: 'Break even in Q3 2028', done: false },
      ],
    }),
  ],
];
