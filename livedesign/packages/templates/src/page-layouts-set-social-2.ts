// Social posts, part one (docs/specs/007-editor/pages-mode.md "Layouts"): a tip of the day,
// a milestone thank-you, an event countdown, a welcome for a new hire and a carousel's cover. Same
// contract as page-layouts.ts: the page's content box in, uncoloured elements out. Built first for
// Square, Portrait post (4:5) and Story (9:16) pages, a tall page stacking one big message down the
// page and a wide one setting it beside its picture, chart or tiles.
import type { Element } from '@livedesign/document';
import type { Kit, LayoutBox } from './page-layout-kit';
import { iconDisc, iconRow } from './page-layout-parts';
import {
  big,
  bigH,
  socialKit,
  handleRow,
  pill,
  pillW,
  rule,
  spread,
  titleStack,
} from './page-layouts-set-social-parts';

// The handle row's height and the gap a column's parts keep, in units.
const FOOT = 9;
const GAP = 5;
// A page not much taller than wide (a square) keeps its parts closer, so its pictures keep room.
const COMPACT_GAP = 3.5;
const gapOf = (k: Kit) => k.u * (!k.wide && k.box.height < k.box.width * 1.15 ? COMPACT_GAP : GAP);
const isSquare = (k: Kit) => !k.wide && k.box.height < k.box.width * 1.15;

const centred = { textAlignX: 'center' } as const;

// --- Tip of the Day -------------------------------------------------------------------------

const TIP_TAG = 'TIP OF THE DAY';
const TIP = ['Check email', 'twice a day,', 'not all day.'] as const;
const TIP_WHY = [
  ['clock', 'Win back hours every week'],
  ['target', 'Stay in deep work for longer'],
  ['smile', 'Fewer pings, calmer days'],
] as const;

function tipOfTheDay(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const topH = u * 12;
  const footH = u * FOOT;
  const gap = u * GAP;
  const top = [
    pill(k, 0, (topH - u * 8) / 2, pillW(k, TIP_TAG), u * 8, TIP_TAG),
    { ...k.title(W - u * 34, 0, u * 34, topH, '#12'), textAlignX: 'right' as const },
  ];
  const foot = handleRow(k, H - footH, footH, { iconId: 'bookmark', label: 'Save for later' });
  const rowF = 4.4;
  // Wide, the reasons sit on a card narrower than the page, so each may wrap onto two lines.
  const rowH = Math.max(bigH(k, rowF, k.wide ? 2 : 1), u * 8);
  const rows = (x: number, y: number, w: number) =>
    TIP_WHY.flatMap(([iconId, line], i) =>
      iconRow(k, x, y + i * (rowH + u * 2), w, u * 8, iconId, line, {
        lineH: rowH,
        ...big(k, rowF),
      }),
    );
  const rowsH = TIP_WHY.length * rowH + (TIP_WHY.length - 1) * u * 2;
  if (k.wide) {
    // The tip down the left, why it works on a card to its right.
    const midTop = topH + gap;
    const midH = H - footH - gap - midTop;
    const leftW = W * 0.52;
    const stack = titleStack(k, 0, 0, leftW, midH, TIP);
    const stackY = midTop + (midH - stack.h) / 2;
    const cardX = W * 0.58;
    const cardW = W - cardX;
    const pad = u * 5;
    const labelH = bigH(k, 4.6);
    const cardH = Math.min(midH, pad * 2 + labelH + u * 3 + rowsH);
    const cardY = midTop + (midH - cardH) / 2;
    return [
      ...top,
      ...titleStack(k, 0, stackY, leftW, midH, TIP).els,
      k.shape('square', cardX, cardY, cardW, cardH, { label: '', borderRadius: 'lg' }),
      k.text(cardX + pad, cardY + pad, cardW - pad * 2, labelH, 'Why it works', {
        ...big(k, 4.6),
        textBold: true,
      }),
      ...rows(cardX + pad, cardY + pad + labelH + u * 3, cardW - pad * 2),
      ...foot,
    ];
  }
  // Tall: the tip set as large as the page allows, a rule, why it works, the handle at the foot.
  const ruleH = u * 1.2;
  const room = H - topH - footH - gap * 4 - ruleH - rowsH;
  const stack = titleStack(k, 0, 0, W, Math.min(room, H * 0.5), TIP);
  const [, stackY, ruleY, rowsY] = spread(0, H, [topH, stack.h, ruleH, rowsH, footH], gap);
  return [
    ...top,
    ...titleStack(k, 0, stackY!, W, Math.min(room, H * 0.5), TIP).els,
    rule(k, 0, ruleY!),
    ...rows(0, rowsY!, W),
    ...foot,
  ];
}

// --- Milestone ------------------------------------------------------------------------------

const MILESTONE_THANKS = 'Thank you for every like, share and kind word.';
const MILESTONE_CAPTION = 'Followers by month, in thousands. Source: our account insights.';

function milestoneChart(k: Kit, x: number, y: number, w: number, h: number): Element {
  return k.shape('line-chart', x, y, w, h, {
    lineCategories: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    lineSeries: [{ name: 'Followers (k)', values: [2.1, 3.4, 4.6, 6.2, 8.1, 10] }],
    chartLegend: false,
  });
}

function milestone(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const footH = u * FOOT;
  const gap = u * GAP;
  const kickerH = bigH(k, 4.4);
  const unitH = bigH(k, 6);
  const capH = u * 7;
  const foot = handleRow(k, H - footH, footH, { iconId: 'heart', label: 'From all of us' });
  if (k.wide) {
    // The figure and the thanks centred down the left, the climb that got there on the right.
    const colW = W * 0.44;
    const bottom = H - footH - gap;
    const thanksH = bigH(k, 4.2, 3);
    const number = titleStack(k, 0, 0, colW, bottom * 0.4, ['10,000']);
    const blockH = kickerH + number.h + unitH + u * 3 + thanksH;
    const y = Math.max(0, (bottom - blockH) / 2);
    const chartX = W * 0.5;
    return [
      k.text(0, y, colW, kickerH, 'WE JUST HIT', { ...big(k, 4.4), textBold: true }),
      ...titleStack(k, 0, y + kickerH, colW, bottom * 0.4, ['10,000']).els,
      k.text(0, y + kickerH + number.h, colW, unitH, 'followers', {
        ...big(k, 6),
        textBold: true,
      }),
      k.text(0, y + kickerH + number.h + unitH + u * 3, colW, thanksH, MILESTONE_THANKS, {
        ...big(k, 4.2),
      }),
      milestoneChart(k, chartX, 0, W - chartX, bottom - capH - u * 2),
      k.text(chartX, bottom - capH, W - chartX, capH, MILESTONE_CAPTION, { textAlignY: 'middle' }),
      ...foot,
    ];
  }
  // Tall: the kicker, the figure as wide as the page, what it counts, the thanks, the climb and
  // the handle, the chart taking whatever room the words leave.
  const thanksH = bigH(k, 4.4, 2);
  const chartFor = (numberH: number) =>
    Math.min(H * 0.34, H - kickerH - numberH - unitH - thanksH - footH - capH - gap * 6 - u * 2);
  // Where the climb has no room (a square), the figure takes it instead.
  const showChart = chartFor(titleStack(k, 0, 0, W, H * 0.24, ['10,000']).h) > u * 16;
  const numberMax = showChart ? H * 0.24 : H * 0.34;
  const number = titleStack(k, 0, 0, W, numberMax, ['10,000'], 'center');
  const chartH = chartFor(number.h);
  const parts = showChart
    ? [kickerH, number.h, unitH, thanksH, chartH + u * 2 + capH, footH]
    : [kickerH, number.h, unitH, thanksH, footH];
  // The words and chart centred as one block above the handle.
  const ys = spread(0, H, [0, ...parts], gap).slice(1);
  const els: Element[] = [
    k.text(0, ys[0]!, W, kickerH, 'WE JUST HIT', { ...big(k, 4.4), textBold: true, ...centred }),
    ...titleStack(k, 0, ys[1]!, W, numberMax, ['10,000'], 'center').els,
    k.text(0, ys[2]! - u * 2, W, unitH, 'followers', { ...big(k, 6), textBold: true, ...centred }),
    k.text(W * 0.06, ys[3]!, W * 0.88, thanksH, MILESTONE_THANKS, { ...big(k, 4.4), ...centred }),
  ];
  if (showChart) {
    els.push(
      milestoneChart(k, 0, ys[4]!, W, chartH),
      k.text(0, ys[4]! + chartH + u * 2, W, capH, MILESTONE_CAPTION, {
        ...centred,
        textAlignY: 'middle',
      }),
    );
  }
  return [...els, ...foot];
}

// --- Countdown ------------------------------------------------------------------------------

const COUNT = [
  ['03', 'DAYS'],
  ['14', 'HOURS'],
  ['22', 'MINUTES'],
] as const;
const COUNT_WHEN = 'Thursday 20 November · 10am GMT';
const COUNT_CTA = 'Turn on reminders';

// Three tiles across `w`, each a number set large over its unit.
function countTiles(k: Kit, x: number, y: number, w: number, h: number): Element[] {
  const { u } = k;
  const gap = u * 4;
  const tileW = (w - gap * 2) / 3;
  const unitH = bigH(k, 3.4);
  return COUNT.flatMap(([n, unit], i) => {
    const tx = x + i * (tileW + gap);
    const numH = h - unitH - u * 6;
    return [
      k.shape('square', tx, y, tileW, h, { label: '', borderRadius: 'lg' }),
      ...titleStack(k, tx + u * 2, y + u * 2, tileW - u * 4, numH, [n], 'center').els,
      k.text(tx, y + h - unitH - u * 3, tileW, unitH, unit, {
        ...big(k, 3.4),
        textBold: true,
        ...centred,
        textAlignY: 'middle',
      }),
    ];
  });
}

function countdown(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const footH = u * FOOT;
  const gap = u * GAP;
  const kickerH = bigH(k, 4.2);
  const ctaH = u * 11;
  const foot = handleRow(k, H - footH, footH, { iconId: 'bell', label: "Don't miss it" });
  const cta = (x: number, y: number) =>
    pill(k, x, y, pillW(k, COUNT_CTA, 'lg'), ctaH, COUNT_CTA, 'lg');
  if (k.wide) {
    // The event down the left, the tiles counting down on the right.
    const colW = W * 0.4;
    const bottom = H - footH - gap;
    const whenH = bigH(k, 4.2, 2);
    const title = titleStack(k, 0, 0, colW, bottom * 0.45, ['Launch', 'day']);
    const blockH = kickerH + u * 2 + title.h + u * 4 + whenH + u * 6 + ctaH;
    const y = Math.max(0, (bottom - blockH) / 2);
    const tilesX = W * 0.46;
    const tilesW = W - tilesX;
    const tileH = Math.min(bottom, ((tilesW - u * 8) / 3) * 1.25);
    return [
      k.text(0, y, colW, kickerH, 'THE COUNTDOWN IS ON', { ...big(k, 4.2), textBold: true }),
      ...titleStack(k, 0, y + kickerH + u * 2, colW, bottom * 0.45, ['Launch', 'day']).els,
      k.text(0, y + kickerH + title.h + u * 6, colW, whenH, COUNT_WHEN, big(k, 4.2)),
      cta(0, y + blockH - ctaH),
      ...countTiles(k, tilesX, (bottom - tileH) / 2, tilesW, tileH),
      ...foot,
    ];
  }
  // Tall: the kicker, the event's name, the tiles as large as the page allows, when, the button.
  const whenH = bigH(k, 4.4);
  const titleMax = isSquare(k) ? u * 13 : u * 20;
  const title = titleStack(k, 0, 0, W, titleMax, ['Launch day'], 'center');
  const room = H - kickerH - title.h - whenH - ctaH - footH - gapOf(k) * 6;
  const tileH = Math.min(room, ((W - u * 8) / 3) * 1.3);
  const ys = spread(0, H, [0, kickerH, title.h, tileH, whenH, ctaH, footH], gapOf(k)).slice(1);
  return [
    k.text(0, ys[0]!, W, kickerH, 'THE COUNTDOWN IS ON', {
      ...big(k, 4.2),
      textBold: true,
      ...centred,
    }),
    ...titleStack(k, 0, ys[1]!, W, titleMax, ['Launch day'], 'center').els,
    ...countTiles(k, 0, ys[2]!, W, tileH),
    k.text(0, ys[3]!, W, whenH, COUNT_WHEN, { ...big(k, 4.4), ...centred }),
    cta((W - pillW(k, COUNT_CTA, 'lg')) / 2, ys[4]!),
    ...foot,
  ];
}

// --- Welcome --------------------------------------------------------------------------------

const WELCOME_TAG = 'PLEASE WELCOME';
const WELCOME_ROLE = 'Senior Designer, Brand team';
const WELCOME_FACTS = [
  ['map-pin', 'From Leeds'],
  ['heart', 'Loves bouldering'],
  ['star', 'Kerning nerd'],
] as const;

function welcome(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const footH = u * FOOT;
  const gap = u * GAP;
  const tagH = u * 8;
  const roleH = bigH(k, 4.4);
  const foot = handleRow(k, H - footH, footH, { iconId: 'message', label: 'Say hi below' });
  const photo = (x: number, y: number, d: number): Element => ({
    ...k.image(x, y, d, d),
    borderRadius: 'full',
    aspectLocked: true,
  });
  if (k.wide) {
    // The photo on the left, who they are and three facts on the right.
    const bottom = H - footH - gap;
    const d = Math.min(bottom, W * 0.4);
    const x = d + u * 8;
    const colW = W - x;
    const factH = Math.max(bigH(k, 4), u * 8);
    const name = titleStack(k, 0, 0, colW, u * 16, ['Priya Shah']);
    const blockH = tagH + u * 4 + name.h + roleH + u * 5 + factH * 3 + u * 4;
    const y = Math.max(0, (bottom - blockH) / 2);
    const factsY = y + tagH + u * 4 + name.h + roleH + u * 5;
    return [
      photo(0, (bottom - d) / 2, d),
      pill(k, x, y, pillW(k, WELCOME_TAG), tagH, WELCOME_TAG),
      ...titleStack(k, x, y + tagH + u * 4, colW, u * 16, ['Priya Shah']).els,
      k.text(x, y + tagH + u * 4 + name.h, colW, roleH, WELCOME_ROLE, big(k, 4.4)),
      ...WELCOME_FACTS.flatMap(([iconId, line], i) =>
        iconRow(k, x, factsY + i * (factH + u * 2), colW, u * 7, iconId, line, {
          lineH: factH,
          ...big(k, 4),
        }),
      ),
      ...foot,
    ];
  }
  // Tall: the tag, the photo as large as the page allows, the name, the role, three facts across.
  const tight = gapOf(k);
  const nameMax = isSquare(k) ? u * 12 : u * 15;
  const name = titleStack(k, 0, 0, W, nameMax, ['Priya Shah'], 'center');
  const icon = u * 8;
  const factLines = isSquare(k) ? 1 : 2;
  const factH = icon + u * 2 + bigH(k, 3.6, factLines);
  const room = H - tagH - name.h - roleH - factH - footH - tight * 5;
  const d = Math.min(W * 0.62, room);
  const ys = spread(0, H, [tagH, d, name.h, roleH, factH, footH], tight);
  const colW = W / 3;
  return [
    pill(k, (W - pillW(k, WELCOME_TAG)) / 2, ys[0]!, pillW(k, WELCOME_TAG), tagH, WELCOME_TAG),
    photo((W - d) / 2, ys[1]!, d),
    ...titleStack(k, 0, ys[2]!, W, nameMax, ['Priya Shah'], 'center').els,
    k.text(0, ys[3]! - tight * 0.6, W, roleH, WELCOME_ROLE, { ...big(k, 4.4), ...centred }),
    ...WELCOME_FACTS.flatMap(([iconId, line], i) => [
      k.shape('icon', i * colW + (colW - icon) / 2, ys[4]!, icon, icon, { iconId }),
      k.text(i * colW + u, ys[4]! + icon + u * 2, colW - u * 2, bigH(k, 3.6, factLines), line, {
        ...big(k, 3.6),
        ...centred,
      }),
    ]),
    ...foot,
  ];
}

// --- Carousel Cover -------------------------------------------------------------------------

const HOOK_TALL = ['7 habits', 'of calm,', 'focused', 'teams'] as const;
const HOOK_WIDE = ['7 habits of', 'calm, focused', 'teams'] as const;
const HOOK_SUB = 'Number 4 changed how we run every meeting.';

function carouselCover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const gap = u * GAP;
  const topH = u * FOOT;
  const kickerH = bigH(k, 4.2);
  const ruleH = u * 1.2;
  // The handle on the left, which slide this is on the right.
  const count = '1 / 7';
  const countW = pillW(k, count, 'lg');
  const top = [...handleRow(k, 0, topH), pill(k, W - countW, 0, countW, topH, count, 'lg')];
  const kicker = (x: number, y: number, w: number) =>
    k.text(x, y, w, kickerH, 'SAVE THIS FOR LATER', { ...big(k, 4.2), textBold: true });
  if (k.wide) {
    // The hook across the left, a big swipe cue on the right.
    const colW = W * 0.68;
    const subH = bigH(k, 4.6, 2);
    const room = H - topH - kickerH - ruleH - subH - gap * 5;
    const hook = titleStack(k, 0, 0, colW, room, HOOK_WIDE);
    const ys = spread(0, H, [topH, kickerH, hook.h, ruleH, subH], gap);
    const d = Math.min(W - colW - u * 10, H * 0.4);
    const discX = W - d;
    const discY = topH + (H - topH - d - bigH(k, 4.6)) / 2;
    return [
      ...top,
      kicker(0, ys[1]!, colW),
      ...titleStack(k, 0, ys[2]!, colW, room, HOOK_WIDE).els,
      rule(k, 0, ys[3]!),
      k.text(0, H - subH, colW, subH, HOOK_SUB, big(k, 4.6)),
      ...iconDisc(k, discX, discY, d, 'arrow-right').els,
      k.text(discX, discY + d + u * 2, d, bigH(k, 4.6), 'Swipe', {
        ...big(k, 4.6),
        textBold: true,
        ...centred,
      }),
    ];
  }
  // Tall: the hook as big as the page allows, a rule, a line that teases the inside, and a swipe
  // cue at the foot pointing on.
  const lines = H > W * 1.15 ? HOOK_TALL : HOOK_WIDE;
  const subH = bigH(k, 4.8, 2);
  const cueD = u * 14;
  const tight = gapOf(k);
  const room = H - topH - kickerH - ruleH - subH - cueD - tight * 5;
  const hook = titleStack(k, 0, 0, W, room, lines);
  const ys = spread(0, H, [topH, kickerH, hook.h, ruleH, subH, cueD], tight);
  const cueW = W * 0.5;
  return [
    ...top,
    kicker(0, ys[1]!, W),
    ...titleStack(k, 0, ys[2]!, W, room, lines).els,
    rule(k, 0, ys[3]!),
    k.text(0, ys[4]!, W * 0.9, subH, HOOK_SUB, big(k, 4.8)),
    k.text(W - cueD - u * 4 - cueW, H - cueD, cueW, cueD, 'Swipe for all 7', {
      ...big(k, 4.8),
      textBold: true,
      textAlignX: 'right',
      textAlignY: 'middle',
    }),
    ...iconDisc(k, W - cueD, H - cueD, cueD, 'arrow-right').els,
  ];
}

export const buildTipOfTheDay = (b: LayoutBox) => tipOfTheDay(socialKit(b));
export const buildMilestone = (b: LayoutBox) => milestone(socialKit(b));
export const buildCountdown = (b: LayoutBox) => countdown(socialKit(b));
export const buildWelcome = (b: LayoutBox) => welcome(socialKit(b));
export const buildCarouselCover = (b: LayoutBox) => carouselCover(socialKit(b));
