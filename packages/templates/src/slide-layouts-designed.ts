// More designed slides (docs/specs/007-editor/pages-mode.md "Slide layouts"): the arrangements a
// slide app offers that the other category files lack, filed across Openers, Content, Data and
// Closers. Several set a picture or a panel to the slide's own edges (a full bleed). Pure builders
// on the slide kit, in units of the slide's height, so a 16:9 and a 4:3 slide both fit.
import type { Element } from '@liveplanner/document';
import type { Kit } from './page-layout-kit';
import {
  bleedImage,
  bleedPanel,
  bullets,
  card,
  columns,
  eyebrow,
  numberDisc,
  over,
  rule,
  slideHeading,
  slideType,
} from './slide-layout-kit';

/** A picture filling the left of the slide; the agenda's four numbered parts to its right. */
export function agendaImageSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const imageW = W * 0.36;
  const x = imageW + u * 10;
  const w = W - x;
  const items = ['Where we are', 'What we learned', 'What we propose', 'Questions'];
  const top = u * 22;
  const rowH = (H - top) / items.length;
  const d = Math.min(u * 11, rowH * 0.7);
  return [
    bleedImage(k, -b, -b, imageW + b, H + 2 * b),
    k.title(x, 0, w, u * 13, 'Agenda'),
    ...items.flatMap((name, i) => {
      const y = top + i * rowH + (rowH - d) / 2;
      return [
        ...numberDisc(k, x, y, d, String(i + 1)),
        k.text(x + d + u * 5, y, w - d - u * 5, d, name, {
          ...slideType(k, 4.6),
          textAlignY: 'middle',
        }),
      ];
    }),
  ];
}

/** A panel down the left edge of the slide holding the title, five points to its right. */
export function sidebarTitleSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const panelW = W * 0.36;
  const inner = panelW - u * 6;
  const x = panelW + u * 10;
  // Five rows at their full height (bullets' 14 units each), centred down the slide, and the
  // title centred with them.
  const listH = Math.min(H, u * 70);
  const top = (H - u * 33) / 2;
  return [
    bleedPanel(k, -b, -b, panelW + b, H + 2 * b),
    eyebrow(k, 0, top, inner, 'PART ONE'),
    k.text(0, top + u * 7, inner, u * 26, 'What we heard', {
      ...slideType(k, 7.6),
      textBold: true,
      textAlignY: 'top',
    }),
    ...bullets(k, x, (H - listH) / 2, W - x, listH, [
      'People want fewer tools, not more',
      'Setup takes longer than the work',
      'Sharing is where things break',
      'Mobile matters more each month',
      'Price is rarely the blocker',
    ]),
  ];
}

/** Two options on cards side by side, each a name, a line and three points, a "vs" between. */
export function compareCardsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Two ways forward');
  const gap = u * 12;
  const cols = columns(W, 2, gap);
  const pad = u * 6;
  const cardH = H - head.top;
  const d = u * 10;
  const options = [
    ['Build', 'Our own team, our own pace', ['Full control', 'Slower start', 'Costs up front']],
    [
      'Partner',
      'Their platform, our brand',
      ['Live in a month', 'Less control', 'Costs as we grow'],
    ],
  ] as const;
  return [
    ...head.els,
    ...options.flatMap(([name, line, points], i) => {
      const { at, size } = cols[i]!;
      const inner = size - 2 * pad;
      return [
        card(k, at, head.top, size, cardH),
        k.text(at + pad, head.top + pad, inner, u * 10, name, {
          ...slideType(k, 6),
          textBold: true,
        }),
        k.text(at + pad, head.top + pad + u * 11, inner, u * 7, line, slideType(k, 3.6)),
        ...bullets(
          k,
          at + pad,
          head.top + pad + u * 21,
          inner,
          cardH - 2 * pad - u * 21,
          points,
          3.8,
        ),
      ];
    }),
    k.shape('circle', (W - d) / 2, head.top + (cardH - d) / 2, d, d, { label: '' }),
    over(k, (W - d) / 2, head.top + (cardH - d) / 2, d, d, 'vs', 3.6),
  ];
}

/** A title and a lead line at the top, the rest of the slide left for what you put there. */
export function titleOnlySlide(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  return [
    k.title(0, 0, W * 0.86, u * 11, 'Slide title'),
    k.text(0, u * 12.5, W * 0.86, u * 8, 'Add a diagram, a chart or a picture below.', {
      ...slideType(k, 4),
    }),
    rule(k, 0, u * 23),
  ];
}

/** A picture filling the left of the slide; one large figure, what it counts and why to its right. */
export function statImageSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const imageW = W * 0.45;
  const x = imageW + u * 10;
  const w = W - x;
  const top = H * 0.14;
  return [
    bleedImage(k, -b, -b, imageW + b, H + 2 * b),
    eyebrow(k, x, top, w, 'THIS YEAR'),
    k.title(x, top + u * 7, w, u * 30, '3.2M'),
    rule(k, x, top + u * 40),
    k.text(x, top + u * 45, w, u * 9, 'meals delivered by volunteers', {
      ...slideType(k, 4.8),
      textBold: true,
    }),
    k.text(x, top + u * 55, w, u * 14, 'Up from 1.9M last year, across 40 cities.', {
      ...slideType(k, 3.8),
    }),
    k.text(x, H - u * 6, w, u * 6, 'Source: say where this number comes from.', {
      ...slideType(k, 2.8),
      textAlignY: 'bottom',
    }),
  ];
}

/** Three people side by side: a round photo, a name, a role and a line on each. */
export function teamThreeSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Meet the team');
  const people = [
    ['Alex Morgan', 'Product', 'Turns questions into plans.'],
    ['Jordan Lee', 'Design', 'Makes the complex feel simple.'],
    ['Priya Shah', 'Engineering', 'Ships it, and keeps it running.'],
  ] as const;
  const cols = columns(W, people.length, u * 8);
  // As large as the column holds, the whole group (photo, name, role and line) centred down the
  // room under the title.
  const d = Math.min(u * 44, cols[0]!.size * 0.82);
  const groupH = d + u * 27;
  const y = head.top + Math.max(0, (H - head.top - groupH) / 2);
  const center = { textAlignX: 'center' } as const;
  return [
    ...head.els,
    ...cols.flatMap(({ at, size }, i) => {
      const [name, role, line] = people[i]!;
      return [
        { ...k.image(at + (size - d) / 2, y, d, d), borderRadius: 'full' as const },
        k.text(at, y + d + u * 4, size, u * 8, name, {
          ...slideType(k, 4.6),
          ...center,
          textBold: true,
        }),
        k.text(at, y + d + u * 12, size, u * 6, role, { ...slideType(k, 3.4), ...center }),
        k.text(at, y + d + u * 19, size, u * 8, line, {
          ...slideType(k, 3.2),
          ...center,
        }),
      ];
    }),
  ];
}
