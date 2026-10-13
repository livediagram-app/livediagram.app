// Compare layouts, part four (docs/specs/007-editor/illustrate-pages.md "Layouts"): SWOT and
// Effort vs Impact. Same contract as page-layouts.ts: the page's content box in, uncoloured
// elements out, in proportions of the box so each fits every size and orientation; a wide page
// sets things side by side where a stack would be squashed.
import type { Element, TextElement } from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';

const CENTRED = { textAlignX: 'center' } as const;

// ── SWOT ────────────────────────────────────────────────────────────────

const SWOT = [
  [
    'S',
    'Strengths',
    'award',
    ['Loyal, growing customers', 'Fastest delivery in town', 'A well-loved local brand'],
  ],
  [
    'W',
    'Weaknesses',
    'alert-triangle',
    ['A small marketing budget', 'App rated under 4 stars', 'Relies on two key people'],
  ],
  [
    'O',
    'Opportunities',
    'trending-up',
    ['Two new districts opening', 'Partner with local cafés', 'Demand for green delivery'],
  ],
  [
    'T',
    'Threats',
    'shield',
    ['A national rival arrives', 'Fuel costs keep rising', 'New rules for couriers'],
  ],
] as const;

function swot(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // A wide page sets the four in a row; a very long one (a story) stacks them; anything else is
  // the classic two by two.
  const across = k.wide;
  const stacked = !across && H > W * 1.6;
  const cols = across ? 4 : stacked ? 1 : 2;
  const rows = 4 / cols;
  const head =
    H > W * 1.2
      ? heading(k, 'SWOT analysis', 'Where our delivery app stands this year.')
      : heading(k, 'SWOT analysis');
  const colHeadH = stacked ? 0 : u * 7;
  const footH = across ? 0 : u * 6;
  const gap = u * 4;
  const gridTop = head.top + (colHeadH ? colHeadH + u * 2 : 0);
  const gridBottom = H - (footH ? footH + u * 3 : 0);
  const cardW = (W - gap * (cols - 1)) / cols;
  const cardH = (gridBottom - gridTop - gap * (rows - 1)) / rows;
  const pad = u * 4;
  const innerW = cardW - pad * 2;
  const els: Element[] = [...head.els];
  // What the columns hold: the helpful and the harmful over a two by two, inside and outside
  // the business over a row.
  const colHead = (x: number, w: number, label: string) =>
    k.text(x, head.top, w, colHeadH, label, { textBold: true, textAlignY: 'middle', ...CENTRED });
  if (across) {
    els.push(
      colHead(0, cardW * 2 + gap, 'INSIDE THE BUSINESS'),
      colHead((cardW + gap) * 2, cardW * 2 + gap, 'OUTSIDE IT'),
    );
  } else if (!stacked) {
    els.push(colHead(0, cardW, 'HELPFUL'), colHead(cardW + gap, cardW, 'HARMFUL'));
  }
  const headH = Math.min(u * 12, cardH * 0.24);
  const letterW = headH * 0.8;
  const longest = SWOT.reduce((a, [, n]) => (n.length > a.length ? n : a), '');
  // A card sets its name beside its letter where the longest name still reads at page type
  // there; otherwise (a narrow card in a row of four) under it.
  const besideScale = k.title(0, 0, innerW - letterW - u * 2, headH * 0.62, longest).textScale!;
  const under = besideScale < 0.9;
  const nameH = under ? u * 8 : headH;
  const nameW = under ? innerW : innerW - letterW - u * 2;
  // Every name set at one size: the size the longest fits its box at.
  const { textScale } = k.title(0, 0, nameW, nameH * (under ? 0.9 : 0.62), longest);
  // An icon in the card's corner where the card is wide enough to spare the room.
  const icon = cardW >= u * 60 || under ? Math.min(u * 8, headH * 0.7) : 0;
  SWOT.forEach(([letter, name, iconId, points], i) => {
    const x = (i % cols) * (cardW + gap);
    const y = gridTop + Math.floor(i / cols) * (cardH + gap);
    const nameX = under ? x + pad : x + pad + letterW + u * 2;
    const nameY = under ? y + pad + headH + u : y + pad;
    els.push(
      k.shape('square', x, y, cardW, cardH, { label: '', borderRadius: 'lg', strokeWidth: 'none' }),
      // The quadrant's letter set large, its name beside or under it.
      k.title(x + pad, y + pad, letterW, headH, letter),
      {
        ...k.title(nameX, nameY, under ? nameW : nameW - (icon ? icon + u * 2 : 0), nameH, name),
        textScale,
      },
    );
    if (icon) {
      els.push(
        k.shape('icon', x + cardW - pad - icon, y + pad + (headH - icon) / 2, icon, icon, {
          iconId,
        }),
      );
    }
    // A rule under the heading, then the points sharing the card under it, a dot beside each.
    const ruleY = nameY + nameH + u * 2;
    els.push(
      k.shape('square', x + pad, ruleY, Math.min(u * 16, innerW), u * 0.8, {
        label: '',
        borderRadius: 'full',
      }),
    );
    const listTop = ruleY + u * 3;
    const rowH = (y + cardH - pad - listTop) / points.length;
    const dot = u * 1.8;
    points.forEach((p, r) => {
      const ry = listTop + r * rowH;
      els.push(
        k.shape('circle', x + pad, ry + rowH / 2 - dot / 2, dot, dot, {
          label: '',
          strokeWidth: 'thick',
        }),
        k.text(x + pad + dot + u * 3, ry, innerW - dot - u * 3, rowH, p, {
          textSize: cardW > u * 60 ? 'lg' : 'md',
          textAlignY: 'middle',
        }),
      );
    });
  });
  if (footH) {
    els.push(
      k.text(
        0,
        H - footH,
        W,
        footH,
        stacked
          ? 'Strengths and weaknesses are inside the business; opportunities and threats outside it.'
          : 'Top row: inside the business. Bottom row: outside it.',
        { textAlignY: 'middle' },
      ),
    );
  }
  return els;
}

// ── Effort vs Impact ────────────────────────────────────────────────────

// Each idea, then where it sits: its effort (0 low, 1 high) and its impact (0 low, 1 high).
const IDEAS = [
  ['Fix the sign-up form', 0.18, 0.72],
  ['Weekly email digest', 0.38, 0.62],
  ['Rebuild the mobile app', 0.8, 0.68],
  ['Smarter search', 0.64, 0.6],
  ['Dark mode', 0.32, 0.42],
  ['New icon set', 0.12, 0.34],
  ['Move to a new database', 0.82, 0.38],
] as const;
const QUADRANTS = [
  ['Quick wins', 'Do these first'],
  ['Big bets', 'Plan with care'],
  ['Fill-ins', 'If time allows'],
  ['Money pits', 'Think twice'],
] as const;

function effortImpact(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // The key beside the plot unless the page is clearly taller than wide.
  const beside = W >= H * 0.85;
  const head = beside
    ? heading(k, 'Where to start')
    : heading(k, 'Where to start', 'Seven ideas on one grid. Start top left.');
  const room = H - head.top;
  const keyRowH = u * 7;
  const keyCols = 2;
  const keyH = Math.ceil(IDEAS.length / keyCols) * keyRowH;
  // The plot: square where it can be, beside its key on a wide page, over it on a tall one.
  const plotW = beside ? Math.min(room, W * 0.58) : W;
  const plotH = beside ? room : Math.min(W, room - keyH - u * 6);
  const axisW = u * 7;
  const axisLabelH = u * 7;
  // The four quadrants, inside the axes.
  const qx = axisW + u * 2;
  const qy = axisLabelH + u;
  const qw = plotW - qx;
  const qh = plotH - qy - axisLabelH - u * 3;
  const qGap = u * 1.5;
  const cellW = (qw - qGap) / 2;
  const cellH = (qh - qGap) / 2;
  const top = head.top;
  const els: Element[] = [...head.els];
  QUADRANTS.forEach(([name, hint], i) => {
    const x = qx + (i % 2) * (cellW + qGap);
    const y = top + qy + Math.floor(i / 2) * (cellH + qGap);
    // The names sit at the outer edge: the top two at their top, the bottom two at their foot.
    const lower = i >= 2;
    const nameH = u * 6;
    const hintH = u * 5;
    const ty = lower ? y + cellH - u * 3 - nameH - hintH : y + u * 3;
    els.push(
      k.shape('square', x, y, cellW, cellH, {
        label: '',
        borderRadius: 'md',
        strokeWidth: i === 0 ? 'thick' : 'none',
      }),
      k.text(x + u * 3, ty, cellW - u * 6, nameH, name, { textSize: 'lg', textBold: true }),
      k.text(x + u * 3, ty + nameH, cellW - u * 6, hintH, hint),
    );
  });
  // The axes: a rule up the left and along the foot, an arrow at each far end, and their names.
  const rule = u * 0.8;
  const arrow = u * 5;
  const axisX = axisW - rule;
  const baseY = top + qy + qh + u;
  els.push(
    k.shape('square', axisX, top + arrow, rule, baseY - top - arrow + rule, {
      label: '',
      borderRadius: 'full',
    }),
    k.shape('icon', axisX + rule / 2 - arrow / 2, top, arrow, arrow, { iconId: 'arrow-up' }),
    k.shape('square', axisX, baseY, plotW - axisX - arrow, rule, {
      label: '',
      borderRadius: 'full',
    }),
    k.shape('icon', plotW - arrow, baseY + rule / 2 - arrow / 2, arrow, arrow, {
      iconId: 'arrow-right',
    }),
    k.text(qx, baseY + u * 2, qw - arrow - u * 2, axisLabelH, 'EFFORT', {
      textBold: true,
      textAlignX: 'right',
      textAlignY: 'middle',
    }),
    k.text(qx, top, qw, axisLabelH, 'IMPACT', { textBold: true, textAlignY: 'middle' }),
  );
  const d = Math.min(u * 8, cellW * 0.22, Math.max(u * 5, (cellH - u * 16) * 0.9));
  // Each idea at its effort and impact, kept clear of its quadrant's name: placed within the
  // room its quadrant leaves beside the name band.
  const band = u * 16;
  IDEAS.forEach(([, effort, impact], i) => {
    const right = effort >= 0.5;
    const upper = impact >= 0.5;
    const fx = (effort - (right ? 0.5 : 0)) / 0.5;
    const fy = (impact - (upper ? 0.5 : 0)) / 0.5;
    const cellX = qx + (right ? cellW + qGap : 0);
    const cellY = top + qy + (upper ? 0 : cellH + qGap);
    const x0 = cellX + d / 2 + u * 2;
    const x1 = cellX + cellW - d / 2 - u * 2;
    const y0 = upper ? cellY + band + d / 2 : cellY + d / 2 + u * 2;
    const y1 = upper ? cellY + cellH - d / 2 - u * 2 : cellY + cellH - band - d / 2;
    const cx = x0 + fx * (x1 - x0);
    const cy = y1 >= y0 ? y1 - fy * (y1 - y0) : (y0 + y1) / 2;
    els.push(
      k.shape('circle', cx - d / 2, cy - d / 2, d, d, {
        label: `${i + 1}`,
        textBold: true,
        strokeWidth: 'thick',
      }),
    );
  });
  // The key: each idea's number and name.
  const keyX = beside ? plotW + u * 8 : 0;
  const keyY = beside ? top : top + plotH + u * 6;
  const keyW = beside ? W - keyX : W;
  const kCols = beside ? 1 : keyCols;
  const kRowH = beside ? Math.min(u * 11, room / IDEAS.length) : keyRowH;
  const colW = keyW / kCols;
  const kd = Math.min(u * 6, kRowH * 0.8);
  const perCol = Math.ceil(IDEAS.length / kCols);
  IDEAS.forEach(([name], i) => {
    const x = keyX + Math.floor(i / perCol) * colW;
    const y = keyY + (i % perCol) * kRowH;
    const keyText: Partial<TextElement> = { textAlignY: 'middle' };
    els.push(
      k.shape('circle', x, y + (kRowH - kd) / 2, kd, kd, { label: `${i + 1}`, textBold: true }),
      k.text(x + kd + u * 3, y, colW - kd - u * 4, kRowH, name, keyText),
    );
  });
  return els;
}

export const buildSwot = (b: LayoutBox) => swot(kit(b));
export const buildEffortImpact = (b: LayoutBox) => effortImpact(kit(b));
