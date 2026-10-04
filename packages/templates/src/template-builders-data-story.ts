// Data Story template (kind `data-story`, docs/specs/007-editor/templates-by-mode.md "Illustrate
// templates"): one A4 portrait infographic that tells one story in numbers, a year at a made-up
// branch library, Elm Street Library, that opens in Illustrate ready to print or post. It reads
// the way a good infographic is read, biggest number first:
//
//   - a kicker, the headline and a one-line lead;
//   - a deep teal band with the headline stat set huge, what it means and a growth badge;
//   - a pictogram row, ten people with seven of them filled in: "7 in 10 neighbours";
//   - a then-and-now table (2016 against 2026) beside a small bar chart of what was lent;
//   - a rule and the source line at the foot.
//
// The colours are the story's own (deep teal and coral on a pale wash) and locked against the
// theme, so the page looks the same in light and dark.
//
// Pure: () -> Element[], placed on the story's page (dataStoryPages) whatever centre is passed.

import type { Element, IllustratePage } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { CARD_SHADOW, glyph, iconDisc, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';

const TEAL = '#134e4a';
const SEA = '#0d9488';
const CORAL = '#f97316';
const INK = '#0f172a';
const MUTED = '#475569';
const PAPER = '#ffffff';
const MIST = '#ccfbf1';
// An unfilled pictogram: the disc and its glyph, quiet against the page.
const EMPTY_DISC = '#e2e8f0';
const EMPTY_INK = '#94a3b8';

const HEADLINE = { value: '184,302', caption: 'visits through our doors in 2026' } as const;
const HEADLINE_NOTE = 'That is 620 people for every day we were open, more than ever before.';

// The pictogram: ten neighbours, this many of them card holders.
const CARD_HOLDERS = 7;

// Then and now: what changed in ten years.
const THEN_YEAR = '2016';
const NOW_YEAR = '2026';
const CHANGES = [
  ["Kids' events", '120', '410'],
  ['E-book loans', '9,400', '41,700'],
  ['Volunteers', '14', '63'],
  ['Hours a week', '38', '52'],
] as const;

// What was lent, in thousands of loans.
const LOANS = [
  ['Books', 96, '#0f766e'],
  ['E-books', 42, '#14b8a6'],
  ['Audiobooks', 17, '#5eead4'],
  ['Things', 9, CORAL],
] as const;

const SOURCE = 'Source: Elm Street Library annual report, January 2027 · Figures rounded';

const STORY_PAGE = templatePage(1, 'a4', 'portrait', 'Data Story', {
  fill: { kind: 'gradient', from: '#f0fdfa', to: '#fff7ed', angle: 160 },
});

/** The story's page: one A4 portrait sheet on a pale teal-to-peach wash. */
export function dataStoryPages(): IllustratePage[] {
  return [STORY_PAGE];
}

// Where each band starts, in units of the content box (148 units tall).
const HERO_TOP = 25;
const HERO_H = 34;
const PICTO_TOP = 64;
const CARDS_TOP = 89;
const CARDS_H = 49;

// The kicker, the headline and the lead.
function masthead(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  return [
    k.text(0, 0, W * 0.8, u * 4, 'ELM STREET LIBRARY · 2026 IN NUMBERS', {
      textBold: true,
      textColor: SEA,
    }),
    { ...k.title(0, u * 5, W, u * 11, 'A year at your local library'), textColor: INK },
    k.text(0, u * 17, W * 0.9, u * 5, 'How one small branch served a town of 26,000 people.', {
      textScale: 1.1,
      textColor: MUTED,
    }),
  ];
}

// The headline stat: the band, the number set huge, what it counts and means, and the badge.
function hero(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const top = u * HERO_TOP;
  const pad = u * 6;
  return [
    panel(k, 0, top, W, u * HERO_H, TEAL, { shadow: CARD_SHADOW }),
    { ...k.title(pad, top + u * 3, W * 0.62, u * 15, HEADLINE.value), textColor: PAPER },
    k.text(pad, top + u * 18, W * 0.6, u * 5, HEADLINE.caption, {
      textBold: true,
      textScale: 1.15,
      textColor: MIST,
    }),
    k.text(pad, top + u * 24, W * 0.58, u * 8, HEADLINE_NOTE, {
      textSize: 'sm',
      textScale: 1.15,
      textColor: '#99f6e4',
    }),
    k.shape('sticker', W - u * 26, top + u * 4, u * 18, u * 18, {
      stickerId: 'emoji-books',
      rotation: -8,
    }),
    k.shape('stadium', W - u * 31, top + u * 24, u * 26, u * 6, {
      label: 'Up 23% on 2025',
      textSize: 'sm',
      textBold: true,
      textColor: INK,
      ...lockedFill('#fed7aa'),
    }),
  ];
}

// Ten neighbours, the card holders filled in coral, the rest left pale.
function pictogram(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const top = u * PICTO_TOP;
  const gap = u * 2;
  const d = (W - gap * 9) / 10;
  const rowTop = top + u * 7;
  return [
    k.text(0, top, W, u * 5, '7 in 10 neighbours hold a library card', {
      textBold: true,
      textScale: 1.25,
      textColor: INK,
    }),
    ...Array.from({ length: 10 }, (_, i) => {
      const held = i < CARD_HOLDERS;
      return iconDisc(
        k,
        'user',
        i * (d + gap),
        rowTop,
        d,
        held ? CORAL : EMPTY_DISC,
        held ? PAPER : EMPTY_INK,
      );
    }).flat(),
    k.text(0, rowTop + d + u * 2, W, u * 4, '18,400 card holders, 3,100 of them new this year', {
      textSize: 'sm',
      textScale: 1.15,
      textColor: MUTED,
    }),
  ];
}

// Then and now: a card with the two years as columns and a row per change, the new year in coral.
function thenAndNow(k: Kit, x: number, w: number): Element[] {
  const { u } = k;
  const top = u * CARDS_TOP;
  const pad = u * 4;
  const colW = u * 13;
  const nowX = x + w - pad - colW;
  const thenX = nowX - u * 11;
  const headTop = top + u * 12;
  const rowsTop = headTop + u * 5;
  const rowH = (u * CARDS_H - (rowsTop - top) - u * 3) / CHANGES.length;
  const els: Element[] = [
    panel(k, x, top, w, u * CARDS_H, PAPER, { strokeColor: '#e2e8f0', shadow: CARD_SHADOW }),
    glyph(k, 'trending-up', x + pad, top + u * 3.5, u * 5, CORAL),
    k.text(x + pad + u * 7, top + u * 3.5, w - pad * 2 - u * 7, u * 5, 'Then and now', {
      textBold: true,
      textScale: 1.1,
      textColor: INK,
    }),
    k.text(thenX, headTop, u * 9, u * 4, THEN_YEAR, {
      textSize: 'sm',
      textBold: true,
      textColor: EMPTY_INK,
      textAlignX: 'right',
    }),
    k.text(nowX, headTop, colW, u * 4, NOW_YEAR, {
      textSize: 'sm',
      textBold: true,
      textColor: CORAL,
      textAlignX: 'right',
    }),
  ];
  CHANGES.forEach(([label, then, now], i) => {
    const y = rowsTop + i * rowH;
    const mid = y + (rowH - u * 4) / 2;
    if (i % 2 === 0) {
      els.push(panel(k, x + u * 2, y, w - u * 4, rowH, '#f8fafc', { borderRadius: 'md' }));
    }
    els.push(
      k.text(x + pad, mid, thenX - x - pad, u * 4, label, {
        textSize: 'sm',
        textScale: 1.1,
        textColor: INK,
      }),
      k.text(thenX, mid, u * 9, u * 4, then, {
        textSize: 'sm',
        textScale: 1.1,
        textColor: MUTED,
        textAlignX: 'right',
      }),
      k.text(nowX, mid, colW, u * 4, now, {
        textBold: true,
        textColor: CORAL,
        textAlignX: 'right',
      }),
    );
  });
  return els;
}

// What was lent: a card with a small bar chart of loans by type.
function lent(k: Kit, x: number, w: number): Element[] {
  const { u } = k;
  const top = u * CARDS_TOP;
  const pad = u * 4;
  const chartTop = top + u * 13;
  return [
    panel(k, x, top, w, u * CARDS_H, PAPER, { strokeColor: '#e2e8f0', shadow: CARD_SHADOW }),
    glyph(k, 'bar-chart', x + pad, top + u * 3.5, u * 5, SEA),
    k.text(x + pad + u * 7, top + u * 3.5, w - pad * 2 - u * 7, u * 5, 'What we lent', {
      textBold: true,
      textScale: 1.1,
      textColor: INK,
    }),
    k.text(x + pad, top + u * 9, w - pad * 2, u * 3.5, 'Loans in 2026, in thousands', {
      textSize: 'sm',
      textColor: MUTED,
    }),
    k.shape('bar-chart', x + pad, chartTop, w - pad * 2, top + u * CARDS_H - chartTop - u * 3, {
      pieSlices: LOANS.map(([label, value, color]) => ({ label, value, color })),
      chartLegend: true,
      chartLegendPosition: 'bottom',
    }),
  ];
}

// The rule and the source line along the foot.
function foot(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  return [
    panel(k, 0, H - u * 7, W, u * 0.4, '#cbd5e1', { borderRadius: 'none' }),
    k.text(0, H - u * 4.5, W, u * 4, SOURCE, { textSize: 'sm', textColor: MUTED }),
  ];
}

export function buildDataStory(): Element[] {
  const [k] = pageKits(dataStoryPages());
  const { width: W } = k!.box;
  const gap = k!.u * 4;
  const cardW = (W - gap) / 2;
  return [
    ...masthead(k!),
    ...hero(k!),
    ...pictogram(k!),
    ...thenAndNow(k!, 0, cardW),
    ...lent(k!, cardW + gap, cardW),
    ...foot(k!),
  ];
}
