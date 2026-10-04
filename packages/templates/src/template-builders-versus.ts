// Versus template (kind `versus`, docs/specs/007-editor/templates-by-mode.md "Illustrate
// templates"): one Portrait post (4:5) page that sets two options side by side, the great office
// debate of Tea against Coffee, ready to post. The page is split down the middle, each half in
// its option's colour and bleeding off its edges:
//
//   - a kicker across the top, each option's sticker and name over its half, and a dark "VS"
//     badge on the seam;
//   - five matched rows, each a topic pill on the seam with a point for each side under it, a
//     tick for a pro and a warning for a con, so the two can be read across;
//   - a dark verdict card along the foot.
//
// The colours are the post's own (sage for tea, roast for coffee) and locked against the theme.
//
// Pure: () -> Element[], placed on the post's page (versusPages) whatever centre is passed.

import { pageMargin, type Element, type IllustratePage } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { CARD_SHADOW, glyph, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';

const DARK = '#111827';
const PAPER = '#ffffff';
const AMBER = '#fbbf24';

// Each side: its sticker, name, wash, accent and ink.
const SIDES = [
  { stickerId: 'emoji-tea', name: 'Tea', wash: '#dcfce7', accent: '#15803d', ink: '#14532d' },
  {
    stickerId: 'emoji-coffee',
    name: 'Coffee',
    wash: '#fde8cc',
    accent: '#9a3412',
    ink: '#431407',
  },
] as const;

// A point for one side: what it says and whether it counts for (a pro) or against (a con).
type Point = { text: string; pro: boolean };

const ROWS: readonly { topic: string; tea: Point; coffee: Point }[] = [
  {
    topic: 'Caffeine',
    tea: { text: 'A gentle lift, about 45mg a cup', pro: true },
    coffee: { text: 'The real jolt, about 95mg a cup', pro: true },
  },
  {
    topic: 'Taste',
    tea: { text: 'Endless variety, from Earl Grey to mint', pro: true },
    coffee: { text: 'Rich and roasty, a new bean every week', pro: true },
  },
  {
    topic: 'The ritual',
    tea: { text: 'A kettle break that turns into a chat', pro: true },
    coffee: { text: 'A café run with the whole team', pro: true },
  },
  {
    topic: 'Cost',
    tea: { text: 'About 5p a bag, even the good ones', pro: true },
    coffee: { text: '£3.40 for a flat white on the way in', pro: false },
  },
  {
    topic: 'The catch',
    tea: { text: 'Goes cold the moment a call starts', pro: false },
    coffee: { text: 'The 3pm crash is very real', pro: false },
  },
];

const VERDICT = 'Tea for the long afternoons, coffee for the early starts. Why not both?';

const VERSUS_PAGE = templatePage(1, 'social', 'portrait', 'Versus', {
  fill: { kind: 'solid', color: '#f8fafc' },
});

/** The post's page: one Portrait post (4:5) page, split between the two sides' washes. */
export function versusPages(): IllustratePage[] {
  return [VERSUS_PAGE];
}

// The bands, in units of the content box (129 units tall).
const ROWS_TOP = 35;
const ROW_H = 14.6;
const VERDICT_H = 19;

// The two halves bleeding off the page, the kicker, each side's sticker and name, and the badge.
function split(k: Kit, bleed: number): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const half = W / 2;
  const s = u * 13;
  const badge = u * 15;
  return [
    ...SIDES.flatMap((side, i) => {
      const x = i * half;
      return [
        panel(k, i === 0 ? -bleed : half, -bleed, half + bleed, H + bleed * 2, side.wash, {
          borderRadius: 'none',
        }),
        k.shape('sticker', x + (half - s) / 2, u * 6, s, s, {
          stickerId: side.stickerId,
          rotation: i === 0 ? -8 : 8,
        }),
        {
          ...k.title(x + u * 4, u * 21, half - u * 8, u * 11, side.name),
          textColor: side.ink,
          textAlignX: 'center' as const,
        },
      ];
    }),
    k.text(0, 0, W, u * 4, 'THE GREAT OFFICE DEBATE', {
      textBold: true,
      textScale: 1.2,
      textColor: DARK,
      textAlignX: 'center',
    }),
    k.shape('circle', half - badge / 2, u * 13, badge, badge, {
      label: 'VS',
      textBold: true,
      textSize: 'lg',
      textColor: PAPER,
      strokeWidth: 'thick',
      shadow: CARD_SHADOW,
      ...lockedFill(DARK, PAPER),
    }),
  ];
}

// One side's point in a row: its tick or warning, then the words.
function point(k: Kit, x: number, y: number, w: number, p: Point, side: number): Element[] {
  const { u } = k;
  const g = u * 4;
  const accent = SIDES[side]!.accent;
  return [
    glyph(
      k,
      p.pro ? 'check-circle' : 'alert-triangle',
      x,
      y + u * 0.2,
      g,
      p.pro ? accent : '#dc2626',
    ),
    k.text(x + g + u * 2, y, w - g - u * 2, u * 7.5, p.text, {
      textScale: 1.1,
      textColor: SIDES[side]!.ink,
    }),
  ];
}

// The matched rows: a topic pill on the seam, each side's point under it.
function rows(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const half = W / 2;
  const pillW = u * 24;
  return ROWS.flatMap((r, i) => {
    const y = u * (ROWS_TOP + i * ROW_H);
    const pointsTop = y + u * 6.5;
    return [
      k.shape('stadium', half - pillW / 2, y, pillW, u * 5, {
        label: r.topic,
        textSize: 'md',
        textBold: true,
        textColor: DARK,
        shadow: CARD_SHADOW,
        ...lockedFill(PAPER),
      }),
      ...point(k, u * 1, pointsTop, half - u * 5, r.tea, 0),
      ...point(k, half + u * 4, pointsTop, half - u * 5, r.coffee, 1),
    ];
  });
}

// The verdict: a dark card along the foot with the call and a handshake.
function verdict(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H - u * VERDICT_H;
  const pad = u * 5;
  const s = u * 13;
  return [
    panel(k, 0, top, W, u * VERDICT_H, DARK, { shadow: CARD_SHADOW }),
    k.text(pad, top + u * 3, W * 0.6, u * 4, 'THE VERDICT', {
      textBold: true,
      textScale: 1.1,
      textColor: AMBER,
    }),
    k.text(pad, top + u * 8, W - pad * 2 - s - u * 3, u * 9, VERDICT, {
      textBold: true,
      textScale: 1.2,
      textColor: PAPER,
    }),
    k.shape('sticker', W - pad - s + u * 2, top + (u * VERDICT_H - s) / 2, s, s, {
      stickerId: 'emoji-handshake',
      rotation: 8,
    }),
  ];
}

export function buildVersus(): Element[] {
  const [k] = pageKits(versusPages());
  const bleed = pageMargin(VERSUS_PAGE);
  return [...split(k!, bleed), ...rows(k!), ...verdict(k!)];
}
