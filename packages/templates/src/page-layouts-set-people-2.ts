// People and Ideas layouts, part one (docs/specs/007-editor/pages-mode.md "Layouts"): an org
// chart, testimonials, a speaker line-up and an employee spotlight. Pure builders on the shared kit,
// laid out in proportions of the page's content box so each fits every size and orientation.
import type { Element } from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconRow, SOURCE_H, sourceLine } from './page-layout-parts';
import { avatar, card, clamp, eyebrow, LINE, rule } from './page-layouts-set-people-parts';

const LEAD = ['Hannah Brooks', 'Head of Product'] as const;
const CREWS = [
  ['Marcus Bell', 'Design lead', ['Ines Duarte', 'Kofi Mensah', 'Ruth Adler', 'Jo Byrne']],
  ['Priya Nair', 'Engineering lead', ['Leo Novak', 'Grace Kim', 'Sam Ortiz', 'Ali Haddad']],
  ['Dan Whitfield', 'Research lead', ['Sofia Ruiz', 'Owen Hart', 'Mei Tan', 'Cara Doyle']],
] as const;

// A crew in a card: its lead's photo, name and role, a short rule, then who is in it, a line each
// (two to a line in a wide card).
function crewCard(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  crew: (typeof CREWS)[number],
  d: number,
): Element[] {
  const { u } = k;
  const [name, role, people] = crew;
  const pad = u * 3.5;
  const centred = { textAlignX: 'center' } as const;
  const nameY = y + pad + d + u * 3;
  const listY = nameY + u * 16;
  const cols = w > u * 40 ? 2 : 1;
  const colW = (w - u * 4) / cols;
  const rows = Math.ceil(people.length / cols);
  // The members share the card under the rule: as many rows as fit.
  const rowH = clamp((y + h - pad - listY) / rows, u * 6, u * 10);
  const shown = Math.min(people.length, cols * Math.floor((y + h - pad - listY) / rowH));
  return [
    card(k, x, y, w, h),
    avatar(k, x + (w - d) / 2, y + pad, d),
    k.text(x + u * 2, nameY, w - u * 4, u * 6, name, { textBold: true, ...centred }),
    k.text(x + u * 2, nameY + u * 6, w - u * 4, u * 6, role, centred),
    rule(k, x + (w - u * 10) / 2, nameY + u * 13.5, u * 10, u * 0.8),
    ...people
      .slice(0, shown)
      .map((person, j) =>
        k.text(
          x + u * 2 + (j % cols) * colW,
          listY + Math.floor(j / cols) * rowH,
          colW,
          rowH,
          person,
          { ...centred, textAlignY: 'middle' },
        ),
      ),
  ];
}

function orgChart(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'How the team fits together', 'Product, autumn 2026.');
  const avail = H - head.top;
  const gap = u * 4;
  const colW = (W - gap * 2) / 3;
  const cx = (i: number) => i * (colW + gap) + colW / 2;
  // The lead: a wide card, the photo beside the name.
  const leadH = clamp(avail * 0.2, u * 18, u * 26);
  const leadW = Math.min(W, k.wide ? W * 0.44 : W * 0.7);
  const leadX = (W - leadW) / 2;
  const pad = u * 3;
  const dL = leadH - pad * 2;
  const textX = leadX + pad + dL + u * 4;
  const textW = leadX + leadW - textX - pad;
  const mid = head.top + leadH / 2;
  // The lines down from the lead and across to each crew: one stroke wide, so a line, not a bar.
  const busTop = head.top + leadH;
  const busH = clamp(avail * 0.1, u * 7, u * 12);
  const t = Math.max(2, u * LINE);
  const barY = busTop + busH / 2;
  const crewTop = busTop + busH;
  // A page much taller than wide closes on the team's numbers, so the crews do not stretch.
  const statsH = H > W * 1.6 ? u * 20 : 0;
  const crewH = H - crewTop - (statsH ? statsH + gap : 0);
  const d = Math.min(colW * 0.5, crewH * 0.24, u * 24);
  return [
    ...head.els,
    card(k, leadX, head.top, leadW, leadH),
    avatar(k, leadX + pad, head.top + pad, dL),
    k.text(textX, mid - u * 7.5, textW, u * 7, LEAD[0], {
      textSize: 'lg',
      textBold: true,
      textAlignY: 'bottom',
    }),
    k.text(textX, mid + u * 0.5, textW, u * 6, LEAD[1]),
    rule(k, W / 2 - t / 2, busTop, t, busH / 2),
    rule(k, cx(0) - t / 2, barY - t / 2, cx(2) - cx(0) + t, t),
    ...CREWS.flatMap((crew, i) => [
      rule(k, cx(i) - t / 2, barY, t, busH / 2),
      ...crewCard(k, i * (colW + gap), crewTop, colW, crewH, crew, d),
    ]),
    ...(statsH
      ? [
          k.shape('stat-row', 0, H - statsH, W, statsH, {
            borderRadius: 'md',
            stats: [
              { value: '16', caption: 'People' },
              { value: '3', caption: 'Crews' },
              { value: '4', caption: 'Cities' },
            ],
          }),
        ]
      : []),
  ];
}

const REVIEWS = [
  [
    'Our Monday meeting went from an hour to twenty minutes. Nobody wants to go back.',
    'Rosa Delgado',
    'Practice manager',
    5,
  ],
  [
    'Set up in one afternoon, and every question we had was answered within the hour.',
    'Ken Ito',
    'Coffee shop owner',
    5,
  ],
  [
    'The first tool our whole school actually uses, from the office to the classroom.',
    'Aisha Rahman',
    'Deputy head teacher',
    4,
  ],
] as const;

// A star rating's width over its height: five stars and their gaps.
const STARS_ASPECT = 5.4;

function testimonials(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'What our customers say', 'Rated 4.9 out of 5 from 2,300 reviews.');
  const bottom = H - u * (SOURCE_H + 4);
  const avail = bottom - head.top;
  const gap = u * 4;
  const pad = u * 4;
  const source = sourceLine(k, 'Source: verified reviews, January to September 2026.');
  // Not much taller than wide: three cards side by side, the attribution at each card's foot.
  if (H < W * 1.3) {
    const colW = (W - gap * 2) / 3;
    const d = Math.min(u * 14, colW * 0.3);
    const quoteSize = colW > u * 55 ? 'lg' : 'md';
    const starsH = Math.min(u * 5, (colW - pad * 2) / STARS_ASPECT);
    const quoteY = head.top + pad + starsH + u * 4;
    const textW = colW - pad * 2;
    // A narrow card sets the name and role under the photo, else beside it.
    const under = textW - d - u * 3 < u * 24;
    const footY = bottom - pad - d - (under ? u * 14 : 0);
    return [
      ...head.els,
      ...REVIEWS.flatMap(([quote, name, role, stars], i) => {
        const x = i * (colW + gap);
        const nameX = under ? x + pad : x + pad + d + u * 3;
        const nameW = under ? textW : textW - d - u * 3;
        const nameY = under ? footY + d + u * 2 : footY + d / 2 - u * 6;
        return [
          card(k, x, head.top, colW, avail),
          k.shape('rating', x + pad, head.top + pad, starsH * STARS_ASPECT, starsH, {
            rating: stars,
          }),
          k.text(x + pad, quoteY, textW, footY - quoteY - u * 3, `“${quote}”`, {
            textSize: quoteSize,
            textAlignY: 'middle',
          }),
          avatar(k, x + pad, footY, d),
          k.text(nameX, nameY, nameW, u * 6, name, { textBold: true, textAlignY: 'bottom' }),
          k.text(nameX, nameY + u * 6, nameW, under ? u * 6 : u * 10, role),
        ];
      }),
      source,
    ];
  }
  // Taller: three cards down the page, the photo and its stars beside each quote. A roomy card sets
  // the quote large.
  const cardH = (avail - gap * 2) / 3;
  const starsW = W * 0.24;
  const d = Math.min(cardH - pad * 2 - starsW / STARS_ASPECT - u * 3, starsW);
  const textX = pad + starsW + u * 5;
  const textW = W - textX - pad;
  const quoteH = cardH - pad * 2 - u * 13;
  return [
    ...head.els,
    ...REVIEWS.flatMap(([quote, name, role, stars], i) => {
      const y = head.top + i * (cardH + gap);
      const photoY = y + (cardH - d - u * 3 - starsW / STARS_ASPECT) / 2;
      return [
        card(k, 0, y, W, cardH),
        avatar(k, pad + (starsW - d) / 2, photoY, d),
        k.shape('rating', pad, photoY + d + u * 3, starsW, starsW / STARS_ASPECT, {
          rating: stars,
        }),
        k.text(textX, y + pad, textW, quoteH, `“${quote}”`, {
          textSize: quoteH > u * 17 ? 'lg' : 'md',
          textAlignY: 'middle',
        }),
        k.text(textX, y + cardH - pad - u * 12, textW, u * 6, name, { textBold: true }),
        k.text(textX, y + cardH - pad - u * 6, textW, u * 6, role),
      ];
    }),
    source,
  ];
}

const SPEAKERS = [
  ['10:00', 'Nadia Hussain', 'Design director', 'Small teams, big systems'],
  ['11:30', 'Tom Okoro', 'Accessibility lead', 'Designing for one hand'],
  ['14:00', 'Clara Lindqvist', 'Illustrator and author', 'Drawing what data feels like'],
  ['15:30', 'Ravi Menon', 'Head of research', 'What users never say out loud'],
] as const;

function speakers(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Meet the speakers', 'Design Week 2026 · 14 November, Leeds');
  const ctaH = u * 16;
  const gap = u * 5;
  const cols = k.wide ? 4 : 2;
  const rows = SPEAKERS.length / cols;
  const cellW = (W - gap * (cols - 1)) / cols;
  const cellH = (H - ctaH - gap - head.top - gap * (rows - 1)) / rows;
  // A cell much wider than tall sets the photo beside the words, else above them.
  const side = cellW > cellH * 1.4;
  const wordsH = u * 27;
  const badgeW = u * 15;
  const badgeH = u * 7;
  return [
    ...head.els,
    ...SPEAKERS.flatMap(([time, name, role, talk], i) => {
      const x = (i % cols) * (cellW + gap);
      const y = head.top + Math.floor(i / cols) * (cellH + gap);
      const imgW = side ? Math.min(cellH, cellW * 0.45) : cellW;
      const imgH = side ? cellH : cellH - wordsH;
      const tx = side ? x + imgW + u * 4 : x;
      const tw = side ? cellW - imgW - u * 4 : cellW;
      const ty = side ? y + (cellH - wordsH) / 2 : y + imgH + u * 3;
      return [
        k.image(x, y, imgW, imgH),
        k.shape('stadium', x + u * 2, y + u * 2, badgeW, badgeH, {
          label: time,
          textBold: true,
        }),
        k.text(tx, ty, tw, u * 7, name, { textSize: tw > u * 30 ? 'lg' : 'md', textBold: true }),
        k.text(tx, ty + u * 7, tw, u * 6, role),
        k.text(tx, ty + u * 14, tw, u * 11, `“${talk}”`, { textItalic: true }),
      ];
    }),
    k.shape('banner', 0, H - ctaH, W, ctaH, {
      label: 'Book your seat',
      pageSubtitle: 'Tickets from £25 · designweek.example',
    }),
  ];
}

const ANSWERS = [
  [
    'What does a good day look like?',
    'A customer who was stuck at nine is flying by lunch. I live for that call.',
  ],
  [
    'The best advice you were given?',
    'Write it down, then say it out loud. Half the problem goes away.',
  ],
  ['And outside work?', 'Sea swimming all year round, and a sourdough starter called Gerald.'],
] as const;
const FACTS = [
  ['briefcase', 'Six years with us'],
  ['map-pin', 'Manchester office'],
  ['heart', 'Sea swimmer, all year'],
] as const;

function spotlight(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const intro = (x: number, y: number, w: number) => [
    eyebrow(k, x, y, w, 'EMPLOYEE SPOTLIGHT'),
    k.title(x, y + u * 7, w, u * 12, 'Joy Adeyemi'),
    k.text(x, y + u * 20, w, u * 7, 'Customer success', { textSize: 'lg' }),
  ];
  // The questions in bold, each answer under it, sharing the room from y to the foot. A narrow
  // column sets them a size down so a question keeps to its line.
  const answers = (x: number, y: number, w: number) => {
    const rowH = (H - y) / ANSWERS.length;
    const size = w > u * 70 && rowH >= u * 26 ? 'lg' : 'md';
    const qH = size === 'lg' ? u * 7 : u * 6;
    return ANSWERS.flatMap(([q, a], i) => {
      const ry = y + i * rowH;
      return [
        k.text(x, ry, w, qH, q, { textSize: size, textBold: true }),
        k.text(x, ry + qH + u, w, Math.max(u * 6, rowH - qH - u * 3), a, { textSize: size }),
      ];
    });
  };
  // Wide or not much taller than wide: the photo down the left, the words beside it.
  if (k.wide || H < W * 1.3) {
    const imgW = k.wide ? Math.min(W * 0.4, H * 0.8) : W * 0.4;
    const x = imgW + u * 7;
    const w = W - x;
    return [
      k.image(0, 0, imgW, H),
      ...intro(x, 0, w),
      rule(k, x, u * 31, u * 14, u * 1.2),
      ...answers(x, u * 37, w),
    ];
  }
  // Much taller than wide (a story): the photo across the top, the name and quick facts side by
  // side under it, then the interview.
  if (H > W * 1.6) {
    const imgH = H * 0.3;
    const colW = W * 0.5;
    const top = imgH + u * 7;
    const fx = colW + u * 4;
    const factH = u * 9;
    const ruleY = top + u * 31;
    return [
      k.image(0, 0, W, imgH),
      ...intro(0, top, colW),
      ...FACTS.flatMap(([iconId, line], i) =>
        iconRow(k, fx, top + u * 2 + i * factH, W - fx, factH * 0.7, iconId, line, {
          lineH: factH,
        }),
      ),
      rule(k, 0, ruleY, u * 14, u * 1.2),
      ...answers(0, ruleY + u * 6, W),
    ];
  }
  // Tall: the photo beside the name and three quick facts, the interview under them.
  const imgW = W * 0.42;
  const imgH = Math.max(u * 54, Math.min(imgW * 1.3, H * 0.34));
  const x = imgW + u * 6;
  const w = W - x;
  const factsY = u * 31;
  const factH = Math.min(u * 9, (imgH - factsY) / FACTS.length);
  const ruleY = imgH + u * 7;
  return [
    k.image(0, 0, imgW, imgH),
    ...intro(x, 0, w),
    ...FACTS.flatMap(([iconId, line], i) =>
      iconRow(k, x, factsY + i * factH, w, factH * 0.7, iconId, line, { lineH: factH }),
    ),
    rule(k, 0, ruleY, u * 14, u * 1.2),
    ...answers(0, ruleY + u * 6, W),
  ];
}

export const buildOrgChart = (b: LayoutBox) => orgChart(kit(b));
export const buildTestimonials = (b: LayoutBox) => testimonials(kit(b));
export const buildSpeakers = (b: LayoutBox) => speakers(kit(b));
export const buildSpotlight = (b: LayoutBox) => spotlight(kit(b));
