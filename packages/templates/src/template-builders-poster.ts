// Event Poster template (kind `event-poster`, docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates"): one A3 portrait page advertising a made-up community event, the
// Riverside Night Market, that opens in Illustrate ready to print. The page reads top to bottom
// the way a poster is read from across a street: a night-sky band bleeding off the top edge with a
// string of festoon lights, the organiser, the big title and the promise; then three cards for
// when, what time and where, lifted half over the band's edge; a photo slot with a "last year"
// badge; three highlights, each on its own sticker; and an amber strip along the foot with the
// practical small print.
//
// The colours are the poster's own (a navy band, amber accents, a cream sheet), locked against the
// theme so the design survives a theme switch; the photo is an empty image placeholder
// (imageId: null), so the template ships no bytes.
//
// Pure: () -> Element[], placed on the poster's page (eventPosterPages) whatever centre is passed.

import { pageMargin, type Element, type IllustratePage } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { CARD_SHADOW, iconDisc, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';

// The poster's palette.
const NIGHT = '#1e1b4b';
const AMBER = '#f59e0b';
const GOLD = '#fcd34d';
const CREAM = '#fffbeb';
const PAPER = '#ffffff';
const INK = '#1e1b4b';
const MUTED = '#57534e';
const MIST = '#e0e7ff';
// The festoon bulbs, in turn along the string.
const BULBS = ['#fcd34d', '#f472b6', '#5eead4', '#fb923c'];

const DETAILS = [
  { iconId: 'calendar', label: 'WHEN', value: 'Sat 17 October', note: 'And every third Saturday' },
  { iconId: 'clock', label: 'WHAT TIME', value: '5pm until 11pm', note: 'Music from 6pm' },
  { iconId: 'map-pin', label: 'WHERE', value: 'Canal Wharf', note: 'Riverside, by the old mill' },
] as const;

const HIGHLIGHTS = [
  {
    stickerId: 'emoji-pizza',
    title: '40 food stalls',
    body: 'Sri Lankan hoppers, wood-fired pizza and churros to finish.',
  },
  {
    stickerId: 'emoji-music',
    title: 'Live music',
    body: 'Three local bands and a brass band to close the night.',
  },
  {
    stickerId: 'emoji-art-palette',
    title: 'Makers and vintage',
    body: 'Prints, ceramics, plants and pre-loved clothes.',
  },
] as const;

const POSTER_PAGE = templatePage(1, 'a3', 'portrait', 'Poster', {
  fill: { kind: 'solid', color: CREAM },
});

/** The poster's page: one A3 portrait sheet on cream. */
export function eventPosterPages(): IllustratePage[] {
  return [POSTER_PAGE];
}

// Where the night band ends and the detail cards sit, in units of the content box.
const BAND_BOTTOM = 56;
const CARD_TOP = 49;
const CARD_H = 19;

// The band: navy bleeding off the top and sides, a sagging string of bulbs, the moon, the
// organiser, the title and the promise.
function band(k: Kit, bleed: number): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const bulb = u * 2.6;
  const count = 15;
  const bulbs = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    // A gentle catenary: the string dips in the middle.
    const x = -bleed / 2 + t * (W + bleed) - bulb / 2;
    const y = -bleed / 2 + u * 5 * (1 - (2 * t - 1) ** 2);
    return k.shape('circle', x, y, bulb, bulb, {
      label: '',
      ...lockedFill(BULBS[i % BULBS.length]!),
    });
  });
  return [
    panel(k, -bleed, -bleed, W + bleed * 2, u * BAND_BOTTOM + bleed, NIGHT, {
      borderRadius: 'none',
    }),
    ...bulbs,
    k.shape('sticker', W - u * 15, u * 9, u * 14, u * 14, {
      stickerId: 'emoji-crescent-moon',
      rotation: 12,
    }),
    k.text(0, u * 11, W * 0.8, u * 4, 'RIVERSIDE COMMUNITY ASSOCIATION PRESENTS', {
      textBold: true,
      textScale: 1.1,
      textColor: GOLD,
    }),
    { ...k.title(0, u * 15, W * 0.86, u * 18, 'Night Market'), textColor: PAPER },
    k.text(
      0,
      u * 34,
      W * 0.8,
      u * 10,
      'Street food, live music and local makers under the lanterns',
      { textSize: 'lg', textColor: MIST },
    ),
  ];
}

// The three detail cards, lifted over the band's lower edge.
function details(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const gap = u * 3;
  const cardW = (W - gap * 2) / 3;
  const pad = u * 3;
  const d = u * 7;
  const top = u * CARD_TOP;
  return DETAILS.flatMap((c, i) => {
    const x = i * (cardW + gap);
    const textX = x + pad;
    const textW = cardW - pad * 2;
    return [
      panel(k, x, top, cardW, u * CARD_H, PAPER, {
        strokeColor: '#fde68a',
        shadow: CARD_SHADOW,
      }),
      ...iconDisc(k, c.iconId, textX, top + pad, d, AMBER, PAPER),
      k.text(textX + d + u * 2, top + pad + u * 1.6, textW - d - u * 2, u * 4, c.label, {
        textSize: 'sm',
        textBold: true,
        textColor: '#b45309',
      }),
      k.text(textX, top + pad + d + u * 1.5, textW, u * 4, c.value, {
        textBold: true,
        textScale: 1.25,
        textColor: INK,
      }),
      k.text(textX, top + pad + d + u * 5.5, textW, u * 3.5, c.note, {
        textSize: 'sm',
        textColor: MUTED,
      }),
    ];
  });
}

// The photo slot and its badge, then the three highlights under a rule.
function body(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const photoTop = u * (CARD_TOP + CARD_H + 5);
  const photoH = u * 32;
  const badgeW = u * 40;
  const highlightsTop = photoTop + photoH + u * 6;
  const gap = u * 4;
  const colW = (W - gap * 2) / 3;
  const s = u * 10;
  return [
    k.image(0, photoTop, W, photoH),
    k.shape('stadium', u * 3, photoTop + photoH - u * 9, badgeW, u * 6, {
      label: 'Last year: 3,000 neighbours came',
      textSize: 'sm',
      textBold: true,
      textColor: INK,
      ...lockedFill(GOLD),
    }),
    ...HIGHLIGHTS.flatMap((h, i) => {
      const x = i * (colW + gap);
      return [
        k.shape('sticker', x, highlightsTop, s, s, {
          stickerId: h.stickerId,
          rotation: [-8, 6, -4][i]!,
        }),
        k.text(x, highlightsTop + s + u * 2, colW, u * 5, h.title, {
          textBold: true,
          textScale: 1.2,
          textColor: INK,
        }),
        k.text(x, highlightsTop + s + u * 8, colW, u * 10, h.body, {
          textColor: MUTED,
        }),
      ];
    }),
  ];
}

// The amber strip along the foot, bleeding off the bottom and sides, with the small print.
function footer(k: Kit, bleed: number): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H - u * 6;
  return [
    panel(k, -bleed, top, W + bleed * 2, H - top + bleed, AMBER, { borderRadius: 'none' }),
    k.text(0, top + (H - top + bleed - u * 5) / 2, W, u * 5, FOOTER_LINE, {
      textBold: true,
      textColor: INK,
      textAlignX: 'center',
      textAlignY: 'middle',
    }),
  ];
}

const FOOTER_LINE = 'Free entry · Family friendly · Dogs welcome · riversidenightmarket.org';

export function buildEventPoster(): Element[] {
  const [k] = pageKits(eventPosterPages());
  const bleed = pageMargin(POSTER_PAGE);
  return [...band(k!, bleed), ...details(k!), ...body(k!), ...footer(k!, bleed)];
}
