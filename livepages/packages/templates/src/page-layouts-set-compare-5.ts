// Compare layouts, part five (docs/specs/007-editor/pages-mode.md "Layouts"): Scorecard and
// Venn. Same contract as page-layouts.ts: the page's content box in, uncoloured elements out, in
// proportions of the box so each fits every size and orientation; a wide page sets things side by
// side where a stack would be squashed.
import type { Element } from '@livepages/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { SOURCE_H, sourceLine } from './page-layout-parts';

const FOOT = SOURCE_H + 4;
const CENTRED = { textAlignX: 'center' } as const;

// ── Scorecard ───────────────────────────────────────────────────────────

const CRITERIA = ['Ease of use', 'Features', 'Support', 'Value'] as const;
// Each option, its overall score (the mean of its stars) and its stars (of five) per criterion.
const SCORED = [
  ['Northwind', '4.8', [5, 5, 5, 4]],
  ['Bluebird', '3.8', [4, 4, 3, 4]],
  ['Atlas', '3.0', [3, 4, 2, 3]],
] as const;
// A rating's five stars, drawn centred in its box: as wide as this many times its height, they
// fill it and sit flush left.
const STARS_PER_HEIGHT = 4.5;

function scorecard(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // Three cards down the page where it is clearly taller than wide; three across otherwise.
  const rows = H > W * 1.2;
  const head = rows
    ? heading(k, 'How the three compare', 'Our panel scored each tool out of five.')
    : heading(k, 'How the three compare');
  const bottom = H - u * FOOT;
  const badgeW = u * 24;
  const badgeH = u * 7;
  const top = head.top + badgeH / 2;
  const gap = u * 4;
  const pad = u * 4;
  const nameH = u * 8;
  const els: Element[] = [...head.els];
  // A criterion: its name, then its stars, beside it where the room allows or under it.
  const criterion = (x: number, y: number, w: number, h: number, label: string, stars: number) => {
    const inline = w >= u * 44;
    const starH = Math.min(u * 5, inline ? h * 0.8 : h * 0.45);
    const starW = starH * STARS_PER_HEIGHT;
    return [
      k.text(x, y, inline ? w - starW - u * 2 : w, inline ? h : h - starH - u, label, {
        textAlignY: inline ? 'middle' : 'bottom',
      }),
      k.shape(
        'rating',
        inline ? x + w - starW : x,
        inline ? y + (h - starH) / 2 : y + h - starH,
        starW,
        starH,
        { rating: stars },
      ),
    ];
  };
  // The overall score set large over what it is out of, centred in its box.
  const score = (x: number, y: number, w: number, h: number, value: string) => [
    { ...k.title(x, y, w, h * 0.72, value), ...CENTRED },
    k.text(x, y + h * 0.72, w, h * 0.28, 'out of 5', { textAlignY: 'middle', ...CENTRED }),
  ];
  const card = (x: number, y: number, w: number, h: number, i: number) =>
    k.shape('square', x, y, w, h, {
      label: '',
      borderRadius: 'lg',
      strokeWidth: i === 0 ? 'extra-thick' : 'thin',
    });
  const badge = (x: number, y: number) =>
    k.shape('stadium', x, y, badgeW, badgeH, {
      label: 'Top score',
      textBold: true,
      strokeWidth: 'thick',
    });
  const rule = (x: number, y: number, w: number, h: number) =>
    k.shape('square', x, y, w, h, { label: '', borderRadius: 'full' });
  if (!rows) {
    // Each card: the name, the overall score set large, a rule, then the criteria down the card.
    const cardW = (W - gap * 2) / 3;
    const cardH = bottom - top;
    const innerW = cardW - pad * 2;
    // The criteria give way where the card is short, so the score keeps its size.
    const critH = Math.min(
      innerW >= u * 44 ? u * 8 : u * 11,
      (cardH - pad * 2 - nameH - u * 2 - u * 16 - u * 5) / CRITERIA.length,
    );
    const listH = CRITERIA.length * critH;
    SCORED.forEach(([name, value, stars], i) => {
      const x = i * (cardW + gap);
      const scoreY = top + pad + nameH + u * 2;
      const listTop = top + cardH - pad - listH;
      const scoreH = Math.min(u * 26, listTop - u * 5 - scoreY);
      els.push(
        card(x, top, cardW, cardH, i),
        k.text(x + pad, top + pad, innerW, nameH, name, {
          textSize: 'lg',
          textBold: true,
          textAlignY: 'middle',
          ...CENTRED,
        }),
        ...score(x + pad, scoreY + (listTop - u * 5 - scoreY - scoreH) / 2, innerW, scoreH, value),
        rule(x + (cardW - u * 14) / 2, listTop - u * 3, u * 14, u * 0.8),
        ...CRITERIA.flatMap((c, j) =>
          criterion(x + pad, listTop + j * critH, innerW, critH - u, c, stars[j]!),
        ),
      );
      if (i === 0) els.push(badge(x + (cardW - badgeW) / 2, top - badgeH / 2));
    });
  } else {
    // Each card: the overall score at the left, a rule, then the name and the criteria two by two.
    const cardH = (bottom - top - gap * 2) / 3;
    const scoreW = W * 0.26;
    SCORED.forEach(([name, value, stars], i) => {
      const y = top + i * (cardH + gap);
      const scoreH = Math.min(cardH - pad * 2, scoreW * 1.1);
      const textX = pad + scoreW + u * 8;
      const textW = W - pad - textX;
      const listTop = y + pad + nameH + u * 2;
      const rowH = (y + cardH - pad - listTop) / 2;
      const half = (textW - u * 4) / 2;
      els.push(
        card(0, y, W, cardH, i),
        ...score(pad, y + (cardH - scoreH) / 2, scoreW, scoreH, value),
        rule(pad + scoreW + u * 4, y + pad, u * 0.8, cardH - pad * 2),
        k.text(textX, y + pad, textW, nameH, name, {
          textSize: 'lg',
          textBold: true,
          textAlignY: 'middle',
        }),
        ...CRITERIA.flatMap((c, j) =>
          criterion(
            textX + (j % 2) * (half + u * 4),
            listTop + Math.floor(j / 2) * rowH,
            half,
            Math.min(rowH - u * 2, u * 12),
            c,
            stars[j]!,
          ),
        ),
      );
      if (i === 0) els.push(badge(W - pad - badgeW, y - badgeH / 2));
    });
  }
  els.push(sourceLine(k, 'Source: scored by a panel of eight, October 2026.'));
  return els;
}

// ── Venn ────────────────────────────────────────────────────────────────

const SET_A = ['Running', ['Needs only shoes', 'Easy on the wallet', 'Hard on the knees']] as const;
const SET_B = ['Cycling', ['Covers more ground', 'Gentle on joints', 'Gets you to work']] as const;
const SHARED = ['Both', ['Heart health', 'A clear head', 'Fun with friends']] as const;
// How far apart the two circles' centres sit, as a share of their diameter.
const VENN_STEP = 0.62;
const VENN_OPACITY = 0.55;

function venn(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Running or cycling?', 'What sets them apart, and what they share.');
  const room = H - head.top;
  // Side by side or one over the other, whichever lets the circles grow larger.
  const across = Math.min(room, W / (1 + VENN_STEP));
  const down = Math.min(W, room / (1 + VENN_STEP));
  const beside = across >= down;
  const D = Math.max(across, down);
  const step = D * VENN_STEP;
  const spanW = beside ? D + step : D;
  const spanH = beside ? D : D + step;
  const x0 = (W - spanW) / 2;
  const y0 = head.top + (room - spanH) / 2;
  const a = { x: x0, y: y0 };
  const b = beside ? { x: x0 + step, y: y0 } : { x: x0, y: y0 + step };
  const circle = (p: { x: number; y: number }) =>
    k.shape('circle', p.x, p.y, D, D, { label: '', opacity: VENN_OPACITY, strokeWidth: 'thick' });
  const nameH = u * 8;
  const lineH = u * 6;
  // A region's words: its name in bold over its points, centred in the box given.
  const words = (
    x: number,
    y: number,
    w: number,
    name: string,
    points: readonly string[],
    big: boolean,
  ) => {
    const blockH = nameH + u * 2 + points.length * lineH;
    const top = y - blockH / 2;
    return [
      big
        ? { ...k.title(x, top, w, nameH, name), ...CENTRED }
        : k.text(x, top, w, nameH, name, {
            textSize: 'lg',
            textBold: true,
            textAlignY: 'middle',
            ...CENTRED,
          }),
      ...points.map((p, i) =>
        k.text(x, top + nameH + u * 2 + i * lineH, w, lineH, p, {
          textAlignY: 'middle',
          ...CENTRED,
        }),
      ),
    ];
  };
  const lens = D - step;
  const els: Element[] = [...head.els, circle(a), circle(b)];
  if (beside) {
    // Each set's own words in its crescent, the shared ones in the lens between.
    const cy = y0 + D / 2;
    const ownW = step * 0.82;
    els.push(
      ...words(x0 + D * 0.12, cy, ownW - D * 0.06, SET_A[0], SET_A[1], true),
      ...words(
        x0 + D + step - D * 0.12 - (ownW - D * 0.06),
        cy,
        ownW - D * 0.06,
        SET_B[0],
        SET_B[1],
        true,
      ),
      ...words(x0 + step, cy, lens, SHARED[0], SHARED[1], false),
    );
  } else {
    const ownW = D * 0.7;
    const x = x0 + (D - ownW) / 2;
    els.push(
      ...words(x, y0 + step / 2 + D * 0.04, ownW, SET_A[0], SET_A[1], true),
      ...words(x, y0 + D + step / 2 - D * 0.04, ownW, SET_B[0], SET_B[1], true),
      ...words(x0 + D * 0.15, y0 + step + lens / 2, D * 0.7, SHARED[0], SHARED[1], false),
    );
  }
  return els;
}

export const buildScorecard = (b: LayoutBox) => scorecard(kit(b));
export const buildVenn = (b: LayoutBox) => venn(kit(b));
