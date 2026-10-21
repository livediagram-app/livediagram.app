// Steps and Time layouts, part 2 (docs/specs/007-editor/pages-mode.md "Layouts"): a
// staircase of rising levels and a customer journey map. Same contract as page-layouts.ts: the
// page's content box in, uncoloured elements out, a tall page stacking and a wide one setting side
// by side. Only the journey's mood faces (stickers) paint their own colours, since there the
// colour is the meaning.
import { createPinnedArrow, type Element, type ShapeElement } from '@liveplanner/document';
import { heading, type Kit } from './page-layout-kit';
import { iconDisc } from './page-layout-parts';

// A faint hairline between rows: a filled sliver at this opacity.
const RULE_FAINT = 0.25;
export function rule(k: Kit, x: number, y: number, w: number, h: number): Element {
  return k.shape('square', x, y, w, h, { label: '', opacity: RULE_FAINT });
}

const LEVELS = [
  ['Survive', 'Order a coffee, ask the way.'],
  ['Get by', 'Small talk without a script.'],
  ['Connect', 'Follow a film with subtitles.'],
  ['Work', 'Run a meeting, write the email.'],
  ['Think', 'Dream in it. Stop translating.'],
] as const;
const STAIR_TITLE = 'Five steps to fluency';
const STAIR_LEAD = 'The five levels most learners climb.';

// Not clearly taller than wide (a square, a 5:4 post, every landscape page), the levels rise as
// columns left to right; a taller page climbs them as cards up the page.
const STAIR_COLUMNS_FROM = 0.85;

export function staircase(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  return W >= H * STAIR_COLUMNS_FROM ? stairColumns(k) : stairCards(k);
}

// Five columns, each taller than the last, standing on the page's foot: a big level number, the
// level's name and its note inside each. The lead sits in the room the low steps leave above them.
function stairColumns(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, STAIR_TITLE);
  const n = LEVELS.length;
  const gap = u * 3;
  const colW = (W - gap * (n - 1)) / n;
  const maxH = H - head.top;
  const minH = Math.min(maxH * 0.55, u * 46);
  const pad = u * 3;
  const heightOf = (i: number) => minH + ((maxH - minH) * i) / (n - 1);
  const els: Element[] = [...head.els];
  LEVELS.forEach(([name, note], i) => {
    const h = heightOf(i);
    const x = i * (colW + gap);
    const y = H - h;
    const inner = colW - 2 * pad;
    els.push(
      k.shape('square', x, y, colW, h, { label: '', borderRadius: 'md' }),
      k.title(x + pad, y + pad, inner, u * 11, `0${i + 1}`),
      k.text(x + pad, y + pad + u * 13, inner, u * 7, name, { textSize: 'lg', textBold: true }),
      k.text(x + pad, y + pad + u * 21, inner, h - pad * 2 - u * 21, note),
    );
  });
  // The lead over the first two steps, clear of the second's top.
  const leadH = maxH - heightOf(1) - u * 5;
  if (leadH > u * 12) {
    els.push(k.text(0, head.top, colW * 2 + gap, leadH, STAIR_LEAD, { textSize: 'lg' }));
  }
  return els;
}

// Five cards climbing from the bottom left to the top right, each a numbered disc, a name and a
// note, joined by arrows; a pin marks the start and a flag the goal in the corners they leave.
function stairCards(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, STAIR_TITLE, STAIR_LEAD);
  const n = LEVELS.length;
  const gap = u * 6;
  const rowH = (H - head.top + gap) / n;
  const cardH = rowH - gap;
  const cardW = W * 0.66;
  const stepX = (W - cardW) / (n - 1);
  const pad = u * 4;
  const d = Math.min(cardH * 0.62, u * 14);
  const nameH = u * 7;
  const noteH = Math.min(u * 10, cardH - nameH - u * 2);
  const cards: ShapeElement[] = [];
  const els: Element[] = [...head.els];
  LEVELS.forEach(([name, note], i) => {
    const x = i * stepX;
    const y = head.top + (n - 1 - i) * rowH;
    const card = k.shape('square', x, y, cardW, cardH, { label: '', borderRadius: 'lg' });
    cards.push(card);
    const tx = x + pad + d + u * 5;
    const tw = cardW - (tx - x) - pad;
    const ty = y + (cardH - nameH - noteH) / 2;
    els.push(
      card,
      // The step's number: a Step number (docs/specs/009-elements/step-number.md) in the theme's accent.
      k.shape('step', x + pad, y + (cardH - d) / 2, d, d, {
        label: `${i + 1}`,
        textBold: true,
        chipLook: 'solid',
      }),
      k.text(tx, ty, tw, nameH, name, { textSize: 'lg', textBold: true }),
      k.text(tx, ty + nameH, tw, noteH, note),
    );
  });
  for (let i = 1; i < cards.length; i += 1) {
    els.push(createPinnedArrow(cards[i - 1]!.id, 'n', cards[i]!.id, 's'));
  }
  // The corners the climb leaves: the goal's flag beside the top card, the start's pin beside
  // the bottom one.
  const mark = Math.min(cardH * 0.8, stepX * 2.4, u * 18);
  const goalY = head.top + (cardH - mark) / 2;
  const startY = head.top + (n - 1) * rowH + (cardH - mark) / 2;
  els.push(
    ...iconDisc(k, (n - 1) * stepX - u * 6 - mark, goalY, mark, 'flag').els,
    ...iconDisc(k, cardW + u * 6, startY, mark, 'map-pin').els,
  );
  return els;
}

// The journey: each stage's icon, what the customer does, where it happens, how it feels (1 low to
// 5 high, with a face to match) and what to fix next.
const JOURNEY = [
  [
    'search',
    'Discover',
    'Sees a post',
    'Instagram',
    3,
    'emoji-thinking-face',
    'Curious',
    'Shareable posts',
  ],
  [
    'sliders',
    'Compare',
    'Reads reviews',
    'Website, reviews',
    2,
    'emoji-confused',
    'Unsure',
    'Clear price table',
  ],
  ['cart', 'Buy', 'Checks out', 'App, email', 4, 'emoji-smile', 'Pleased', 'Save her card'],
  [
    'package',
    'Wait',
    'Waits five days',
    'Tracking page',
    1,
    'emoji-worried',
    'Anxious',
    'Next-day delivery',
  ],
  [
    'heart',
    'Love',
    'Tells friends',
    'Reviews, referrals',
    5,
    'emoji-heart-eyes',
    'Delighted',
    'Reward referrals',
  ],
] as const;
const MOOD_MAX = 5;
const JOURNEY_TITLE = 'The customer journey';

// Not clearly taller than wide (a square too), the stages run across the page; taller, down it.
const JOURNEY_ACROSS_FROM = 0.9;

export function customerJourney(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  return W >= H * JOURNEY_ACROSS_FROM ? journeyAcross(k) : journeyDown(k);
}

// Stages as columns, the journey's lanes as rows under them: a persona heads the lane names, and
// the Feeling lane plots each stage's face at the height of its mood, joined into a line.
function journeyAcross(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, JOURNEY_TITLE);
  const n = JOURNEY.length;
  const labelW = W * 0.14;
  const gap = u * 3;
  const colW = (W - labelW - gap * n) / n;
  const colX = (i: number) => labelW + gap + i * (colW + gap);
  const headerH = u * 13;
  const doingH = u * 8;
  const touchH = u * 10;
  const fixH = u * 14;
  const rowGap = u * 3;
  const feelH = H - head.top - headerH - doingH - touchH - fixH - rowGap * 4;
  const y0 = head.top;
  const doingY = y0 + headerH + rowGap;
  const touchY = doingY + doingH + rowGap;
  const feelY = touchY + touchH + rowGap;
  const fixY = feelY + feelH + rowGap;
  const ruleH = Math.max(1, u * 0.25);
  const avatar = Math.min(headerH, labelW * 0.34);
  const els: Element[] = [
    ...head.els,
    { ...k.image(0, y0 + (headerH - avatar) / 2, avatar, avatar), borderRadius: 'full' },
    k.text(avatar + u * 2, y0, labelW - avatar - u * 2, headerH, 'Maya', {
      textBold: true,
      textAlignY: 'middle',
    }),
  ];
  const lanes = [
    ['Doing', doingY],
    ['Touchpoints', touchY],
    ['Feeling', feelY],
    ['Fix next', fixY],
  ] as const;
  for (const [lane, y] of lanes) {
    els.push(
      rule(k, 0, y - rowGap / 2, W, ruleH),
      k.text(0, y, labelW, u * 7, lane, { textBold: true }),
    );
  }
  const s = Math.min(colW * 0.4, (feelH - u * 7) * 0.55, u * 16);
  const faces: ShapeElement[] = [];
  JOURNEY.forEach(([iconId, stage, doing, touch, mood, face, word, fix], i) => {
    const x = colX(i);
    const fy = feelY + ((MOOD_MAX - mood) / (MOOD_MAX - 1)) * (feelH - s - u * 7);
    const sticker = k.shape('sticker', x + (colW - s) / 2, fy, s, s, { stickerId: face });
    faces.push(sticker);
    els.push(
      k.shape('square', x, y0, colW, headerH, {
        label: stage,
        // The stage's icon beside its name where the column has room for both.
        ...(colW >= u * 20 ? { iconId } : {}),
        textBold: true,
        borderRadius: 'md',
      }),
      k.text(x, doingY, colW, doingH, doing, { textBold: true }),
      k.text(x, touchY, colW, touchH, touch),
      sticker,
      k.text(x, fy + s + u, colW, u * 6, word, { textAlignX: 'center', textBold: true }),
      k.shape('square', x, fixY, colW, fixH, { label: fix, borderRadius: 'md' }),
    );
  });
  for (let i = 1; i < faces.length; i += 1) {
    els.push(createPinnedArrow(faces[i - 1]!.id, 'e', faces[i]!.id, 'w'));
  }
  return els;
}

// Stages as rows down the page: a stage card, what happens and where, and a Feeling column whose
// faces sit further right the better the stage feels, joined down the page into a line.
function journeyDown(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, JOURNEY_TITLE, 'How Maya finds us, buys, and comes back.');
  const n = JOURNEY.length;
  const stageW = W * 0.22;
  const feelW = W * 0.25;
  const midX = stageW + u * 5;
  const midW = W - feelW - u * 5 - midX;
  const feelX = W - feelW;
  const colsH = u * 7;
  const rowsTop = head.top + colsH + u * 3;
  const gap = u * 4;
  const rowH = (H - rowsTop + gap) / n;
  const cardH = rowH - gap;
  const ruleH = Math.max(1, u * 0.25);
  const els: Element[] = [
    ...head.els,
    k.text(0, head.top, stageW, colsH, 'Stage', { textBold: true }),
    k.text(midX, head.top, midW, colsH, 'What happens', { textBold: true }),
    k.text(feelX, head.top, feelW / 2, colsH, 'Low', { textBold: true }),
    k.text(feelX + feelW / 2, head.top, feelW / 2, colsH, 'High', {
      textBold: true,
      textAlignX: 'right',
    }),
    rule(k, 0, rowsTop - u * 2, W, ruleH),
  ];
  const s = Math.min(cardH * 0.8, feelW * 0.45, u * 15);
  const faces: ShapeElement[] = [];
  // Where there is room, each stage's fix goes under where it happens.
  const withFix = cardH >= u * 25;
  JOURNEY.forEach(([iconId, stage, doing, touch, mood, face, , fix], i) => {
    const y = rowsTop + i * rowH;
    const fx = feelX + ((mood - 1) / (MOOD_MAX - 1)) * (feelW - s);
    const fy = y + (cardH - s) / 2;
    const sticker = k.shape('sticker', fx, fy, s, s, { stickerId: face });
    faces.push(sticker);
    const textH = u * 7 + u * 6 + (withFix ? u * 7 : 0);
    const ty = y + Math.max(0, (cardH - textH) / 2);
    els.push(
      k.shape('square', 0, y, stageW, cardH, {
        label: stage,
        iconId,
        iconPosition: 'above',
        textBold: true,
        textSize: 'lg',
        borderRadius: 'md',
      }),
      k.text(midX, ty, midW, u * 7, doing, { textSize: 'lg', textBold: true }),
      k.text(midX, ty + u * 7, midW, u * 6, touch),
      sticker,
    );
    if (withFix)
      els.push(k.text(midX, ty + u * 13, midW, u * 7, `Fix: ${fix}`, { textItalic: true }));
    if (i > 0) els.push(rule(k, midX, y - gap / 2, W - midX, ruleH));
  });
  for (let i = 1; i < faces.length; i += 1) {
    // Over the hairlines, never broken by them.
    els.push({
      ...createPinnedArrow(faces[i - 1]!.id, 's', faces[i]!.id, 'n'),
      routeBehind: false,
    });
  }
  return els;
}
