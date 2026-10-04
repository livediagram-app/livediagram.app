// Year in Review template (kind `year-in-review`, docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates"): a four-page A4 report for a made-up eight-person design team, Harbour
// Studio, looking back on 2026, that opens in Illustrate ready to export and send round.
//
//   1. Cover: a deep teal-to-navy sheet with the year set huge, the report's title, a one-line
//      summary and a team-photo slot.
//   2. Numbers: six headline numbers on pastel cards, each with its glyph, over a bar chart of
//      projects shipped each quarter.
//   3. Timeline: seven moments down a rail, a coloured month pill and a dot on the rail for each,
//      the moment and a line about it on a card beside it.
//   4. Thanks: a warm sheet with the thank-you, a quote from the studio lead, a team-photo slot
//      and everyone's names.
//
// The report's colours are its own and locked against the theme; the photos are empty image
// placeholders (imageId: null), so the template ships no bytes. The words live in
// template-year-review-data.ts.
//
// Pure: () -> Element[], placed on the report's pages (yearInReviewPages) whatever centre is
// passed.

import type { Element, IllustratePage } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { CARD_SHADOW, glyph, iconDisc, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';
import { MOMENTS, STATS, TEAM, YEAR, STUDIO, QUARTERS } from './template-year-review-data';

const INK = '#0f172a';
const MUTED = '#475569';
const TEAL = '#0d9488';
const PAPER = '#ffffff';
// The quarters' bars, deepening through the year.
const QUARTER_TEALS = ['#5eead4', '#2dd4bf', '#14b8a6', '#0f766e'];

/** The report's pages: four A4 portrait sheets, the cover dark, the thanks warm. */
export function yearInReviewPages(): IllustratePage[] {
  return [
    templatePage(1, 'a4', 'portrait', 'Cover', {
      fill: { kind: 'gradient', from: '#134e4a', to: '#1e1b4b', angle: 160 },
    }),
    templatePage(2, 'a4', 'portrait', 'Numbers', { fill: { kind: 'solid', color: '#f8fafc' } }),
    templatePage(3, 'a4', 'portrait', 'Timeline', { fill: { kind: 'solid', color: '#f8fafc' } }),
    templatePage(4, 'a4', 'portrait', 'Thanks', {
      fill: { kind: 'gradient', from: '#fef3c7', to: '#fce7f3', angle: 160 },
    }),
  ];
}

// A content page's kicker and headline, and its running footer with the page number.
function chrome(k: Kit, page: number, kicker: string, headline: string): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  return [
    k.text(0, 0, W * 0.7, u * 4, kicker, { textBold: true, textColor: TEAL }),
    { ...k.title(0, u * 5, W * 0.9, u * 10, headline), textColor: INK },
    k.text(0, H - u * 4, W * 0.7, u * 4, `${STUDIO} · Year in Review ${YEAR}`, {
      textSize: 'sm',
      textColor: MUTED,
    }),
    k.text(W - u * 20, H - u * 4, u * 20, u * 4, `${page} / 4`, {
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'right',
    }),
  ];
}

// 1. The cover: the studio, the year set huge, the title, the summary and the photo.
function cover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const photoTop = u * 84;
  return [
    ...iconDisc(k, 'sun', 0, 0, u * 8, '#5eead4', '#134e4a'),
    k.text(u * 11, u * 2, W * 0.6, u * 4, STUDIO.toUpperCase(), {
      textBold: true,
      textScale: 1.1,
      textColor: '#99f6e4',
    }),
    { ...k.title(-u * 1, u * 14, W, u * 36, YEAR), textColor: PAPER },
    k.shape('sticker', W - u * 20, u * 16, u * 16, u * 16, {
      stickerId: 'emoji-sparkles',
      rotation: 10,
    }),
    { ...k.title(0, u * 51, W * 0.8, u * 9, 'Our Year in Review'), textColor: '#ccfbf1' },
    k.text(
      0,
      u * 62,
      W * 0.9,
      u * 16,
      'Forty-two projects, our first app, two new faces and a lot of good coffee. This is the year we had.',
      { textScale: 1.2, textColor: '#cbd5e1' },
    ),
    k.image(0, photoTop, W, H - photoTop - u * 10),
    k.text(
      0,
      H - u * 5,
      W,
      u * 5,
      'For the team, our clients and everyone who helped · January 2027',
      {
        textSize: 'sm',
        textColor: '#94a3b8',
      },
    ),
  ];
}

// 2. The numbers: a 2 x 3 grid of pastel cards, then the quarters as a bar chart.
function numbers(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = u * 20;
  const gap = u * 4;
  const cardW = (W - gap) / 2;
  const cardH = u * 21;
  const d = u * 8;
  const chartTop = top + (cardH + gap) * 3 + u * 2;
  const els: Element[] = [...chrome(k, 2, 'THE YEAR IN NUMBERS', 'What we did in 2026')];
  STATS.forEach((s, i) => {
    const x = (i % 2) * (cardW + gap);
    const y = top + Math.floor(i / 2) * (cardH + gap);
    els.push(
      panel(k, x, y, cardW, cardH, s.tint),
      ...iconDisc(k, s.iconId, x + u * 4, y + (cardH - d) / 2, d, s.ink, PAPER),
      { ...k.title(x + u * 15, y + u * 2.5, cardW - u * 18, u * 9, s.value), textColor: s.ink },
      k.text(x + u * 15, y + u * 12, cardW - u * 18, u * 8, s.caption, {
        textSize: 'sm',
        textScale: 1.25,
        textColor: INK,
      }),
    );
  });
  els.push(
    k.text(0, chartTop, W, u * 4, 'Projects shipped each quarter', {
      textBold: true,
      textColor: INK,
    }),
    k.shape('bar-chart', 0, chartTop + u * 5, W, H - chartTop - u * 11, {
      pieSlices: QUARTERS.map(([label, value], i) => ({ label, value, color: QUARTER_TEALS[i] })),
      chartLegend: true,
      chartLegendPosition: 'bottom',
    }),
  );
  return els;
}

// 3. The timeline: a rail down the left, a month pill and a dot per moment, a card beside each.
function timeline(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = u * 20;
  const bottom = H - u * 8;
  const rowH = (bottom - top) / MOMENTS.length;
  const pillW = u * 12;
  const railX = pillW + u * 4;
  const dot = u * 4;
  const cardX = railX + u * 6;
  const cardH = rowH - u * 2.5;
  const els: Element[] = [
    ...chrome(k, 3, 'TIMELINE', 'Moments that made the year'),
    panel(k, railX - u * 0.5, top + u * 2, u * 1, bottom - top - u * 4, '#cbd5e1', {
      borderRadius: 'full',
    }),
  ];
  MOMENTS.forEach((m, i) => {
    const y = top + i * rowH;
    const mid = y + cardH / 2;
    els.push(
      k.shape('stadium', 0, mid - u * 2.75, pillW, u * 5.5, {
        label: m.month,
        textSize: 'sm',
        textBold: true,
        textColor: PAPER,
        ...lockedFill(m.color),
      }),
      k.shape('circle', railX - dot / 2, mid - dot / 2, dot, dot, {
        label: '',
        strokeWidth: 'thick',
        ...lockedFill(PAPER, m.color),
      }),
      panel(k, cardX, y, W - cardX, cardH, PAPER, {
        strokeColor: '#e2e8f0',
        shadow: CARD_SHADOW,
      }),
      glyph(k, m.iconId, W - u * 10, y + (cardH - u * 6) / 2, u * 6, m.color),
      k.text(cardX + u * 4, y + u * 2.2, W - cardX - u * 16, u * 4.5, m.title, {
        textBold: true,
        textColor: INK,
      }),
      k.text(cardX + u * 4, y + u * 7.2, W - cardX - u * 16, cardH - u * 8.5, m.note, {
        textSize: 'sm',
        textScale: 1.15,
        textColor: MUTED,
      }),
    );
  });
  return els;
}

// 4. The thanks: the headline, the studio lead's quote on a card, the team photo and the names.
function thanks(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const quoteTop = u * 22;
  const quoteH = u * 42;
  const photoTop = quoteTop + quoteH + u * 6;
  const photoH = u * 44;
  const namesTop = photoTop + photoH + u * 7;
  const avatar = u * 10;
  return [
    ...chrome(k, 4, 'THANK YOU', 'Thank you, all of you'),
    panel(k, 0, quoteTop, W, quoteH, PAPER, { shadow: CARD_SHADOW }),
    k.text(u * 5, quoteTop + u * 1, u * 14, u * 14, '“', {
      textSize: 'lg',
      textScale: 3.4,
      textBold: true,
      textColor: TEAL,
    }),
    k.text(
      u * 6,
      quoteTop + u * 13,
      W - u * 12,
      u * 14,
      'The best work we did this year started with someone saying: what if we tried?',
      { textSize: 'lg', textItalic: true, textColor: INK },
    ),
    {
      ...k.image(u * 6, quoteTop + quoteH - avatar - u * 4, avatar, avatar),
      borderRadius: 'full',
      aspectLocked: true,
    },
    k.text(u * 19, quoteTop + quoteH - avatar - u * 3, W * 0.6, u * 4.5, 'Ines Duarte', {
      textBold: true,
      textColor: INK,
    }),
    k.text(u * 19, quoteTop + quoteH - avatar + u * 2, W * 0.6, u * 4, 'Studio Lead', {
      textSize: 'sm',
      textScale: 1.15,
      textColor: MUTED,
    }),
    k.image(0, photoTop, W, photoH),
    k.shape('sticker', W - u * 14, photoTop - u * 6, u * 15, u * 15, {
      stickerId: 'emoji-clinking-glasses',
      rotation: 8,
    }),
    k.text(0, namesTop, W, u * 5, `Here’s to ${Number(YEAR) + 1}`, {
      textSize: 'lg',
      textBold: true,
      textColor: INK,
    }),
    k.text(0, namesTop + u * 6, W, u * 8, TEAM, { textColor: MUTED }),
  ];
}

export function buildYearInReview(): Element[] {
  const [c, n, t, th] = pageKits(yearInReviewPages());
  return [...cover(c!), ...numbers(n!), ...timeline(t!), ...thanks(th!)];
}
