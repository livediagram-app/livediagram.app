// Slide content (docs/specs/007-editor/pages-mode.md "Slide layouts", Content): the slides a
// talk's body is made of, besides Title and Bullets, Two Columns, Image and Text, Statement and
// Quote. Pure builders on the slide kit, in units of the slide's height.
import type { Element } from '@liveplanner/document';
import type { Kit } from './page-layout-kit';
import {
  bullets,
  card,
  columns,
  eyebrow,
  iconDisc,
  rule,
  slideHeading,
  slideType,
} from './slide-layout-kit';

/** Three points side by side, each an icon in a disc, a heading and a line. */
export function threePointsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Three reasons it works');
  const points = [
    ['zap', 'Fast', 'Set up in minutes, not weeks, with nothing to install.'],
    ['shield', 'Safe', 'Your data stays yours, encrypted end to end.'],
    ['users', 'Shared', 'Everyone works on the same page, live.'],
  ] as const;
  const d = u * 18;
  return [
    ...head.els,
    ...columns(W, points.length, u * 8).flatMap(({ at, size }, i) => {
      const [icon, name, line] = points[i]!;
      const y = head.top + u * 4;
      return [
        ...iconDisc(k, at, y, d, icon),
        k.text(at, y + d + u * 5, size, u * 9, name, { ...slideType(k, 5.6), textBold: true }),
        k.text(at, y + d + u * 15, size, H - (y + d + u * 15), line, slideType(k, 3.8)),
      ];
    }),
  ];
}

/** A picture filling the slide, with a caption card over its lower left. */
export function fullImageSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const cardW = Math.min(W * 0.58, u * 92);
  const cardH = u * 30;
  const x = u * 5;
  const y = H - cardH - u * 5;
  const pad = u * 5;
  return [
    k.image(0, 0, W, H),
    card(k, x, y, cardW, cardH),
    k.title(x + pad, y + pad, cardW - 2 * pad, u * 10, 'Where it all started'),
    k.text(
      x + pad,
      y + pad + u * 12,
      cardW - 2 * pad,
      cardH - 2 * pad - u * 12,
      'One line on what to notice in this picture.',
      slideType(k, 3.8),
    ),
  ];
}

/** The one thing to remember, large on a card, and three points that back it. */
export function takeawaySlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const cardW = W * 0.5;
  const pad = u * 7;
  const x = cardW + u * 8;
  const w = W - x;
  return [
    card(k, 0, 0, cardW, H),
    eyebrow(k, pad, pad, cardW - 2 * pad, 'KEY TAKEAWAY'),
    rule(k, pad, pad + u * 9),
    k.text(
      pad,
      pad + u * 14,
      cardW - 2 * pad,
      H - 2 * pad - u * 14,
      'Small teams that ship weekly learn four times faster.',
      {
        ...slideType(k, 7),
        textBold: true,
      },
    ),
    k.text(x, H * 0.12, w, u * 9, 'Why we think so', { ...slideType(k, 5), textBold: true }),
    ...bullets(
      k,
      x,
      H * 0.12 + u * 13,
      w,
      H * 0.88 - u * 13,
      [
        'Feedback arrives in days, not quarters',
        'Smaller bets mean cheaper mistakes',
        'Momentum keeps the team close',
      ],
      4,
    ),
  ];
}

/** Four ideas on cards, two by two, each an icon, a heading and a line. */
export function fourIdeasSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Four ideas worth trying');
  const ideas = [
    ['message', 'Ask first', 'Talk to five customers before you build.'],
    ['clock', 'Timebox it', 'Two weeks, then decide on what you learned.'],
    ['bar-chart', 'Measure one thing', 'Pick the number that tells you it worked.'],
    ['star', 'Share the wins', 'Show the team what changed, every Friday.'],
  ] as const;
  const gap = u * 4;
  const rows = columns(H - head.top, 2, gap);
  const cols = columns(W, 2, gap);
  const pad = u * 4.5;
  return [
    ...head.els,
    ...ideas.flatMap(([icon, name, line], i) => {
      const c = cols[i % 2]!;
      const r = rows[Math.floor(i / 2)]!;
      const y = head.top + r.at;
      const d = Math.min(u * 16, r.size - 2 * pad);
      const tx = c.at + pad + d + u * 4;
      const tw = c.size - (tx - c.at) - pad;
      return [
        card(k, c.at, y, c.size, r.size),
        ...iconDisc(k, c.at + pad, y + (r.size - d) / 2, d, icon),
        // Room for a heading to take two lines on a 4:3 slide's narrower cards.
        k.text(tx, y + pad, tw, u * 11, name, { ...slideType(k, 4.2), textBold: true }),
        k.text(tx, y + pad + u * 12, tw, r.size - 2 * pad - u * 12, line, slideType(k, 3.4)),
      ];
    }),
  ];
}
