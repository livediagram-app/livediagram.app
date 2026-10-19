// Slide pictures (docs/specs/007-editor/pages-mode.md "Slide layouts", Pictures): the slides led
// by a picture, as a slide app lays them out. Most set the picture to the slide's own edges (a
// full bleed: the kit's bleed reaches past the content box to the page's edge) and keep the words
// inside the margins. Pure builders on the slide kit, in units of the slide's height, so a 16:9
// and a 4:3 slide both fit.
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import {
  bleedImage,
  bullets,
  card,
  columns,
  eyebrow,
  rule,
  slideHeading,
  slideType,
} from './slide-layout-kit';

// The hero slide's panel and the words on it: its own colours, so they read on any picture
// whatever the theme.
const SCRIM = '#0b1220';
const SCRIM_OPACITY = 0.78;
const ON_SCRIM = '#ffffff';

/** An eyebrow, a two-line title, a rule, a lead and three points, down a column `w` wide. */
function storyColumn(k: Kit, x: number, w: number): Element[] {
  const { height: H } = k.box;
  const { u } = k;
  const top = H * 0.1;
  return [
    eyebrow(k, x, top, w, 'OUR APPROACH'),
    k.text(x, top + u * 8, w, u * 22, 'Start small, learn fast, then scale', {
      ...slideType(k, 7.4),
      textBold: true,
      textAlignY: 'middle',
    }),
    rule(k, x, top + u * 33),
    k.text(
      x,
      top + u * 37,
      w,
      u * 14,
      'Three habits that turned a pilot into a programme.',
      slideType(k, 4.2),
    ),
    ...bullets(
      k,
      x,
      top + u * 53,
      w,
      H - top - u * 53,
      ['Ship something every week', 'Measure what people do', 'Double down on what works'],
      3.8,
    ),
  ];
}

/** Words on the left half, a picture filling the right half to the slide's edges. */
export function splitImageRightSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const mid = W / 2;
  return [...storyColumn(k, 0, mid - u * 9), bleedImage(k, mid, -b, mid + b, H + 2 * b)];
}

/** A picture filling the left two-fifths to the slide's edges, the words to its right. */
export function splitImageLeftSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const imageW = W * 0.42;
  const x = imageW + u * 9;
  return [bleedImage(k, -b, -b, imageW + b, H + 2 * b), ...storyColumn(k, x, W - x)];
}

/** A picture across the top of the slide, edge to edge; the title and a paragraph side by side
 *  under it. */
export function imageBandSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const bandH = H * 0.56;
  const y = bandH + u * 9;
  const titleW = W * 0.44;
  const x = titleW + u * 8;
  return [
    bleedImage(k, -b, -b, W + 2 * b, bandH + b),
    eyebrow(k, 0, y, titleW, 'CHAPTER TWO'),
    k.text(0, y + u * 7, titleW, H - y - u * 7, 'The year we went global', {
      ...slideType(k, 7.2),
      textBold: true,
    }),
    k.text(
      x,
      y + u * 7,
      W - x,
      H - y - u * 7,
      'Four new markets, two new offices and a team that doubled, all in twelve months.',
      slideType(k, 4.4),
    ),
  ];
}

/** A picture filling the whole slide; a dark panel down its left, to the slide's edges, holding
 *  an eyebrow, a large title, a rule and a line in white. The picture's own middle stays clear, so
 *  an empty one still shows its Select Image under the panel's edge. */
export function heroImageSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const panelW = W * 0.4;
  const w = panelW - u * 8;
  const top = H * 0.22;
  const white = { textColor: ON_SCRIM } as const;
  return [
    bleedImage(k, -b, -b, W + 2 * b, H + 2 * b),
    k.shape('square', -b, -b, panelW + b, H + 2 * b, {
      label: '',
      borderRadius: 'none',
      fillColor: SCRIM,
      strokeColor: 'transparent',
      opacity: SCRIM_OPACITY,
    }),
    { ...eyebrow(k, 0, top, w, 'INTRODUCING'), ...white },
    k.text(0, top + u * 8, w, u * 32, 'A new way to work together', {
      ...slideType(k, 7.6),
      ...white,
      textBold: true,
      textAlignY: 'middle',
    }),
    rule(k, 0, top + u * 43),
    k.text(0, top + u * 48, w, u * 12, 'Everything your team needs, in one place.', {
      ...slideType(k, 4.2),
      ...white,
    }),
  ];
}

/** A picture filling the slide, a card on its right holding a title, a line and three points. */
export function imageSideCardSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  // Narrow enough to leave an empty picture's Select Image (its middle) clear on a 4:3 slide too.
  const cardW = W * 0.38;
  const x = W - cardW;
  const pad = u * 6;
  const inner = cardW - 2 * pad;
  return [
    bleedImage(k, -b, -b, W + 2 * b, H + 2 * b),
    card(k, x, 0, cardW, H),
    eyebrow(k, x + pad, pad, inner, 'FIELD NOTES'),
    k.text(x + pad, pad + u * 7, inner, u * 20, 'What we saw on the ground', {
      ...slideType(k, 5.4),
      textBold: true,
      textAlignY: 'middle',
    }),
    rule(k, x + pad, pad + u * 30),
    ...bullets(
      k,
      x + pad,
      pad + u * 35,
      inner,
      H - 2 * pad - u * 35,
      ['Queues halved by noon', 'Staff free to help', 'Shoppers stayed longer'],
      3.6,
    ),
  ];
}

/** A title, then pictures side by side, each with a name and a caption under it. */
function gallery(k: Kit, title: string, items: readonly (readonly [string, string])[]): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, title);
  const captionH = u * 19;
  const imageH = H - head.top - captionH;
  return [
    ...head.els,
    ...columns(W, items.length, u * 6).flatMap(({ at, size }, i) => {
      const [name, line] = items[i]!;
      const y = head.top + imageH;
      return [
        k.image(at, head.top, size, imageH - u * 4),
        k.text(at, y, size, u * 7, name, { ...slideType(k, 4.4), textBold: true }),
        k.text(at, y + u * 8, size, u * 11, line, slideType(k, 3.4)),
      ];
    }),
  ];
}

/** Three pictures side by side, each with a name and a caption. */
export function threeImagesSlide(k: Kit): Element[] {
  return gallery(k, 'Three places we built', [
    ['Lisbon', 'Our first studio, by the river.'],
    ['Nairobi', 'Home to the mobile team.'],
    ['Seoul', 'Opened this spring.'],
  ]);
}

/** Two pictures side by side to compare, each with a name and a caption. */
export function twoImagesSlide(k: Kit): Element[] {
  return gallery(k, 'Then and now', [
    ['2019', 'One room, four desks and a whiteboard.'],
    ['2026', 'Three floors, two hundred people.'],
  ]);
}

/** A title and a line on the left; one large picture and two small ones beside it. */
export function imageMosaicSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const textW = W * 0.32;
  const gap = u * 3;
  const x = textW + u * 7;
  const bigW = (W - x - gap) * 0.58;
  const smallX = x + bigW + gap;
  const smallW = W - smallX;
  const smallH = (H - gap) / 2;
  return [
    eyebrow(k, 0, H * 0.2, textW, 'GALLERY'),
    k.text(0, H * 0.2 + u * 8, textW, u * 26, 'Moments from the week', {
      ...slideType(k, 6.6),
      textBold: true,
      textAlignY: 'middle',
    }),
    rule(k, 0, H * 0.2 + u * 37),
    k.text(0, H * 0.2 + u * 42, textW, u * 20, 'Workshops, demos and one very long lunch.', {
      ...slideType(k, 3.8),
    }),
    k.image(x, 0, bigW, H),
    k.image(smallX, 0, smallW, smallH),
    k.image(smallX, smallH + gap, smallW, smallH),
  ];
}

/** A picture filling the right of the slide; on the left a large quotation mark, the quote and
 *  who said it. */
export function quoteImageSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u, bleed: b } = k;
  const imageW = W * 0.38;
  const w = W - imageW - u * 10;
  const top = H * 0.14;
  return [
    k.title(0, top, u * 14, u * 18, '“'),
    k.text(0, top + u * 18, w, u * 36, 'It changed how the whole team plans its week.', {
      ...slideType(k, 6.4),
      textBold: true,
    }),
    rule(k, 0, top + u * 57),
    k.text(0, top + u * 61, w, u * 7, 'Sam Rivera', { ...slideType(k, 4.2), textBold: true }),
    k.text(0, top + u * 69, w, u * 6, 'Operations Lead, Example Co', slideType(k, 3.4)),
    bleedImage(k, W - imageW, -b, imageW + b, H + 2 * b),
  ];
}
