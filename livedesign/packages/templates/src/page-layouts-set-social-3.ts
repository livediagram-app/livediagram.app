// Social posts, part two (docs/specs/007-editor/pages-mode.md "Layouts"): a product
// spotlight, a behind-the-scenes mosaic, a giveaway and a webinar promo. Same contract as page-layouts.ts:
// the page's content box in, uncoloured elements out, built first for Square, Portrait post (4:5)
// and Story (9:16) pages, a tall page stacking and a wide one setting the picture beside the words.
import type { Element } from '@livepages/document';
import type { Kit, LayoutBox } from './page-layout-kit';
import { iconRow } from './page-layout-parts';
import {
  big,
  bigH,
  socialKit,
  handleRow,
  pill,
  pillW,
  spread,
  titleStack,
} from './page-layouts-set-social-parts';

const FOOT = 9;
const GAP = 5;
// A page not much taller than wide (a square) keeps its parts closer, so its pictures keep room.
const COMPACT_GAP = 3.5;
const isSquare = (k: Kit) => !k.wide && k.box.height < k.box.width * 1.15;
const centred = { textAlignX: 'center' } as const;

// A filled disc with a word or figure set large in it, centred: a price, "VS", "WIN".
function badge(k: Kit, kind: 'circle' | 'star', x: number, y: number, d: number, word: string) {
  // A star's body is smaller than its box, so its word sits in a smaller middle.
  const inner = kind === 'star' ? d * 0.36 : d * 0.66;
  const h = inner * 0.62;
  return [
    k.shape(kind, x, y, d, d, { label: '' }),
    ...titleStack(k, x + (d - inner) / 2, y + (d - h) / 2, inner, h, [word], 'center').els,
  ];
}

// --- Product Spotlight ----------------------------------------------------------------------

const PRODUCT_LINE = 'Recycled canvas, a padded laptop sleeve and a pocket for everything.';

function productSpotlight(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const gap = u * GAP;
  const kickerH = bigH(k, 4.2);
  const rateH = u * 7;
  const ctaH = u * 11;
  const rating = (x: number, y: number, w: number) => [
    k.shape('rating', x, y, u * 32, rateH, { rating: 5 }),
    k.text(x + u * 35, y, w - u * 35, rateH, '4.9 from 1,200 reviews', {
      ...big(k, 3.8),
      textAlignY: 'middle',
    }),
  ];
  const ctaW = pillW(k, 'Shop now', 'lg') + u * 6;
  const cta = (x: number, y: number, w: number) => [
    pill(k, x, y, ctaW, ctaH, 'Shop now', 'lg'),
    k.text(x + ctaW + u * 5, y, w - ctaW - u * 5, ctaH, 'Link in bio', {
      ...big(k, 4.2),
      textBold: true,
      textAlignY: 'middle',
    }),
  ];
  const kicker = (x: number, y: number, w: number) =>
    k.text(x, y, w, kickerH, 'NEW IN', { ...big(k, 4.2), textBold: true });
  if (k.wide) {
    // The product filling the left, its price on the image's edge, the words on the right.
    const imgW = W * 0.47;
    const d = Math.min(imgW * 0.36, H * 0.3);
    const x = imgW + u * 10;
    const colW = W - x;
    const lineH = bigH(k, 4.2, 3);
    const name = titleStack(k, 0, 0, colW, H * 0.34, ['The Everyday', 'Tote']);
    // One block centred down the column, the kicker tight over the name, the rest a gap apart.
    const stackYs = [kickerH, name.h, rateH, lineH].reduce<number[]>(
      (acc, h, i) => [...acc, acc[i]! + h + (i === 0 ? u * 2 : gap)],
      [Math.max(0, (H - (kickerH + name.h + rateH + lineH + ctaH + u * 2 + gap * 3)) / 2)],
    );
    return [
      k.image(0, 0, imgW, H),
      ...badge(k, 'circle', imgW - d * 0.6, H - d - u * 8, d, '£48'),
      kicker(x, stackYs[0]!, colW),
      ...titleStack(k, x, stackYs[1]!, colW, H * 0.34, ['The Everyday', 'Tote']).els,
      ...rating(x, stackYs[2]!, colW),
      k.text(x, stackYs[3]!, colW, lineH, PRODUCT_LINE, big(k, 4.2)),
      ...cta(x, stackYs[4]!, colW),
    ];
  }
  // Tall: the product as large as the page allows, the price on its lower edge, then what it is,
  // how people rate it, one line, and the button.
  const lineH = bigH(k, 4.4, 2);
  const name = titleStack(k, 0, 0, W * 0.92, u * 15, ['The Everyday Tote']);
  const imgH = H - kickerH - name.h - rateH - lineH - ctaH - gap * 4 - u * 2;
  const d = Math.min(W * 0.28, u * 30, imgH * 0.5);
  const ys = [imgH + gap];
  for (const h of [kickerH - gap + u * 3, name.h, rateH, lineH])
    ys.push(ys[ys.length - 1]! + h + gap);
  return [
    k.image(0, 0, W, imgH),
    ...badge(k, 'circle', W - d - u * 5, imgH - d * 0.62, d, '£48'),
    kicker(0, ys[0]!, W - d - u * 8),
    ...titleStack(k, 0, ys[1]! - u * 2, W * 0.92, u * 15, ['The Everyday Tote']).els,
    ...rating(0, ys[2]! - u * 2, W),
    k.text(0, ys[3]! - u * 2, W, lineH, PRODUCT_LINE, big(k, 4.4)),
    ...cta(0, H - ctaH, W),
  ];
}

// --- Behind the Scenes ----------------------------------------------------------------------

const BTS_TAG = 'BEHIND THE SCENES';
const BTS_TITLE = ['How a tote', 'gets made'] as const;
const BTS_STEPS = ['Cutting', 'Stitching', 'Packing'] as const;
const BTS_LINE = 'Three people, one workshop in Leeds, about two hours a bag.';

function behindTheScenes(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const gap = u * GAP;
  const footH = u * FOOT;
  const tagH = u * 8;
  const chipH = u * 9;
  // A photo with its step named on a chip in its lower left corner.
  const photo = (x: number, y: number, w: number, h: number, i: number) => {
    const label = `${i + 1}. ${BTS_STEPS[i]}`;
    return [
      k.image(x, y, w, h),
      pill(k, x + u * 3, y + h - chipH - u * 3, Math.min(pillW(k, label), w - u * 6), chipH, label),
    ];
  };
  if (k.wide) {
    // The title down the left, the photos as a mosaic on the right: one large, two stacked.
    const colW = W * 0.34;
    const bottom = H - footH - gap;
    const title = titleStack(k, 0, 0, colW, bottom * 0.4, BTS_TITLE);
    const lineH = bigH(k, 4.2, 3);
    const blockH = tagH + u * 4 + title.h + u * 4 + lineH;
    const y = Math.max(0, (bottom - blockH) / 2);
    const gx = colW + u * 8;
    const gw = W - gx;
    const bigW = (gw - u * 3) * 0.56;
    const smallW = gw - bigW - u * 3;
    const smallH = (H - u * 3) / 2;
    return [
      pill(k, 0, y, pillW(k, BTS_TAG), tagH, BTS_TAG),
      ...titleStack(k, 0, y + tagH + u * 4, colW, bottom * 0.4, BTS_TITLE).els,
      k.text(0, y + tagH + title.h + u * 8, colW, lineH, BTS_LINE, big(k, 4.2)),
      ...photo(gx, 0, bigW, H, 0),
      ...photo(gx + bigW + u * 3, 0, smallW, smallH, 1),
      ...photo(gx + bigW + u * 3, smallH + u * 3, smallW, smallH, 2),
      ...handleRow(k, H - footH, footH, undefined, 0, colW),
    ];
  }
  // Tall: the tag and title, a line, the photos as a mosaic (one across the top, two below) and
  // the handle at the foot. A square page keeps the title smaller and skips the line, so the
  // photos keep their room.
  const square = H < W * 1.15;
  const lineH = square ? 0 : bigH(k, 4.4, 2);
  const titleMax = square ? u * 17 : u * 26;
  const title = titleStack(k, 0, 0, W, titleMax, BTS_TITLE);
  const gridY = tagH + u * 3 + title.h + (square ? 0 : u * 2 + lineH) + gap;
  const gridH = H - gridY - footH - gap;
  const bigH2 = (gridH - u * 3) * 0.58;
  const smallH = gridH - bigH2 - u * 3;
  const smallW = (W - u * 3) / 2;
  return [
    pill(k, 0, 0, pillW(k, BTS_TAG), tagH, BTS_TAG),
    ...titleStack(k, 0, tagH + u * 3, W, titleMax, BTS_TITLE).els,
    ...(square ? [] : [k.text(0, tagH + u * 5 + title.h, W, lineH, BTS_LINE, big(k, 4.4))]),
    ...photo(0, gridY, W, bigH2, 0),
    ...photo(0, gridY + bigH2 + u * 3, smallW, smallH, 1),
    ...photo(smallW + u * 3, gridY + bigH2 + u * 3, smallW, smallH, 2),
    ...handleRow(k, H - footH, footH, { iconId: 'eye', label: 'Full story in bio' }),
  ];
}

// --- Giveaway -------------------------------------------------------------------------------

const PRIZE = 'Win a weekend for two in the Lake District';
const ENTER = ['Follow @northwind', 'Like this post', 'Tag a friend'] as const;
const TERMS = 'Ends Friday 21 November, 6pm. UK only. Full terms in bio.';

function giveaway(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const gap = u * GAP;
  const howH = bigH(k, 4.4);
  const termsH = Math.max(u * 6, 30);
  const disc = u * 10;
  const star = (x: number, y: number, d: number) => badge(k, 'star', x, y, d, 'WIN');
  const how = (x: number, y: number, w: number, align: 'left' | 'center') =>
    k.text(x, y, w, howH, 'How to enter', {
      ...big(k, 4.4),
      textBold: true,
      textAlignX: align,
    });
  const step = (x: number, y: number, i: number) =>
    // A Step number (docs/specs/009-elements/step-number.md) in the theme's accent.
    k.shape('step', x, y, disc, disc, { label: `${i + 1}`, textBold: true, chipLook: 'solid' });
  if (k.wide) {
    // The offer and how to enter down the left, the prize on the right with its star.
    const colW = W * 0.46;
    const prizeH = bigH(k, 4.6, 2);
    const rowH = Math.max(disc, bigH(k, 4));
    const title = titleStack(k, 0, 0, colW, H * 0.24, ['GIVEAWAY']);
    const stepsH = ENTER.length * rowH + (ENTER.length - 1) * u * 3;
    const ys = spread(0, H, [title.h, prizeH, howH, stepsH, termsH], gap);
    const imgX = W * 0.52;
    const d = Math.min((W - imgX) * 0.36, H * 0.34);
    return [
      ...titleStack(k, 0, ys[0]!, colW, H * 0.24, ['GIVEAWAY']).els,
      k.text(0, ys[1]!, colW, prizeH, PRIZE, big(k, 4.6)),
      how(0, ys[2]!, colW, 'left'),
      ...ENTER.flatMap((line, i) => {
        const y = ys[3]! + i * (rowH + u * 3);
        return [
          step(0, y + (rowH - disc) / 2, i),
          k.text(disc + u * 4, y, colW - disc - u * 4, rowH, line, {
            ...big(k, 4),
            textAlignY: 'middle',
          }),
        ];
      }),
      k.text(0, H - termsH, colW, termsH, TERMS, { textAlignY: 'middle' }),
      k.image(imgX, 0, W - imgX, H),
      ...star(W - d - u * 3, u * 3, d),
    ];
  }
  // Tall: the word, the prize, its picture with a star on it, three steps across, the small print.
  const sq = isSquare(k);
  const tight = sq ? u * COMPACT_GAP : gap;
  const prizeH = bigH(k, 4.6, sq ? 1 : 2);
  const titleMax = sq ? u * 14 : u * 22;
  const title = titleStack(k, 0, 0, W, titleMax, ['GIVEAWAY'], 'center');
  const stepH = disc + u * 2 + bigH(k, 3.6, 2);
  const imgH = H - title.h - prizeH - howH - stepH - termsH - tight * 5 - u * 2;
  const ys = spread(0, H, [title.h, prizeH, imgH, howH, stepH, termsH], tight);
  const d = Math.min(W * 0.32, imgH * 0.6);
  const colW = W / 3;
  return [
    ...titleStack(k, 0, ys[0]!, W, titleMax, ['GIVEAWAY'], 'center').els,
    k.text(W * 0.05, ys[1]!, W * 0.9, prizeH, PRIZE, { ...big(k, 4.6), ...centred }),
    k.image(0, ys[2]!, W, imgH),
    ...star(W - d - u * 3, ys[2]! + u * 3, d),
    how(0, ys[3]!, W, 'center'),
    ...ENTER.flatMap((line, i) => [
      step(i * colW + (colW - disc) / 2, ys[4]!, i),
      k.text(i * colW + u, ys[4]! + disc + u * 2, colW - u * 2, bigH(k, 3.6, 2), line, {
        ...big(k, 3.6),
        ...centred,
      }),
    ]),
    k.text(0, H - termsH, W, termsH, TERMS, { ...centred, textAlignY: 'middle' }),
  ];
}

// --- Webinar --------------------------------------------------------------------------------

const WEBINAR_TAG = 'FREE LIVE WEBINAR';
const WEBINAR_TITLE = ['Design systems', 'that scale'] as const;
const WEBINAR_DETAILS = [
  ['calendar', 'Wednesday 26 November'],
  ['clock', '4pm GMT · 45 minutes'],
  ['monitor', 'Online, link sent on sign-up'],
] as const;
const HOST = 'Dr Lena Fischer';
const HOST_ROLE = 'Head of Design, Northwind';
const WEBINAR_CTA = 'Save your seat';

function webinar(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const gap = u * GAP;
  const tagH = u * 8;
  const ctaH = u * 12;
  const rowF = 4.2;
  const rowH = Math.max(bigH(k, rowF), u * 7);
  const detailsH = WEBINAR_DETAILS.length * rowH + (WEBINAR_DETAILS.length - 1) * u * 2;
  const details = (x: number, y: number, w: number) =>
    WEBINAR_DETAILS.flatMap(([iconId, line], i) =>
      iconRow(k, x, y + i * (rowH + u * 2), w, u * 7, iconId, line, {
        lineH: rowH,
        ...big(k, rowF),
      }),
    );
  const hostLabel = (x: number, y: number, w: number) =>
    k.text(x, y, w, u * 6, 'YOUR HOST', { textBold: true, textAlignY: 'middle' });
  const nameH = bigH(k, 4.6);
  const roleH = bigH(k, 3.8);
  if (k.wide) {
    // The talk down the left, the host's portrait and name on the right.
    const colW = W * 0.56;
    const room = H - tagH - detailsH - ctaH - gap * 5;
    const title = titleStack(k, 0, 0, colW, Math.min(room, H * 0.4), WEBINAR_TITLE);
    const ys = spread(0, H, [tagH, title.h, detailsH, ctaH], gap);
    const hostX = W * 0.64;
    const hostW = W - hostX;
    const imgH = H - u * 6 - nameH - roleH - u * 4;
    return [
      pill(k, 0, ys[0]!, pillW(k, WEBINAR_TAG), tagH, WEBINAR_TAG),
      ...titleStack(k, 0, ys[1]!, colW, Math.min(room, H * 0.4), WEBINAR_TITLE).els,
      ...details(0, ys[2]!, colW),
      pill(k, 0, ys[3]!, Math.min(colW, u * 60), ctaH, WEBINAR_CTA, 'lg'),
      k.image(hostX, 0, hostW, imgH),
      hostLabel(hostX, imgH + u * 2, hostW),
      k.text(hostX, imgH + u * 8, hostW, nameH, HOST, { ...big(k, 4.6), textBold: true }),
      k.text(hostX, H - roleH, hostW, roleH, HOST_ROLE, big(k, 3.8)),
    ];
  }
  // Tall: the tag, the talk's title, when and where, the host on a card, and the button.
  // A square drops the "Your host" line and closes up, so the title keeps its size.
  const sq = isSquare(k);
  const tight = sq ? u * COMPACT_GAP : gap;
  const labelH = sq ? 0 : u * 6;
  const pad = u * 4;
  const cardH = pad * 2 + labelH + nameH + roleH + (sq ? 0 : u * 2);
  const room = H - tagH - detailsH - cardH - ctaH - tight * 4;
  const title = titleStack(k, 0, 0, W, Math.min(room, H * 0.36), WEBINAR_TITLE);
  const ys = spread(0, H, [tagH, title.h, detailsH, cardH, ctaH], tight);
  const d = cardH - pad * 2;
  const tx = pad + d + u * 5;
  const tw = W - tx - pad;
  const cardY = ys[3]!;
  const textY = cardY + (cardH - (labelH + nameH + roleH)) / 2;
  return [
    pill(k, 0, ys[0]!, pillW(k, WEBINAR_TAG), tagH, WEBINAR_TAG),
    ...titleStack(k, 0, ys[1]!, W, Math.min(room, H * 0.36), WEBINAR_TITLE).els,
    ...details(0, ys[2]!, W),
    k.shape('square', 0, cardY, W, cardH, { label: '', borderRadius: 'lg' }),
    { ...k.image(pad, cardY + pad, d, d), borderRadius: 'full', aspectLocked: true },
    ...(sq ? [] : [hostLabel(tx, textY, tw)]),
    k.text(tx, textY + labelH, tw, nameH, HOST, { ...big(k, 4.6), textBold: true }),
    k.text(tx, textY + labelH + nameH, tw, roleH, HOST_ROLE, big(k, 3.8)),
    pill(k, 0, H - ctaH, W, ctaH, WEBINAR_CTA, 'lg'),
  ];
}

export const buildProductSpotlight = (b: LayoutBox) => productSpotlight(socialKit(b));
export const buildBehindTheScenes = (b: LayoutBox) => behindTheScenes(socialKit(b));
export const buildGiveaway = (b: LayoutBox) => giveaway(socialKit(b));
export const buildWebinar = (b: LayoutBox) => webinar(socialKit(b));
