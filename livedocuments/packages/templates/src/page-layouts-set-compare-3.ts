// Compare layouts, part three (docs/specs/007-editor/pages-mode.md "Layouts"): Spectrum
// and Three Options. Same contract as page-layouts.ts: the page's content box in,
// uncoloured elements out, in proportions of the box so each fits every size and orientation; a
// wide page sets things side by side where a stack would be squashed.
import type { Element } from '@livedocuments/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { CROSS_ROSE, iconDisc, iconRow, TICK_GREEN } from './page-layout-parts';

const CENTRED = { textAlignX: 'center' } as const;

// ── Spectrum ────────────────────────────────────────────────────────────

// Each option, its icon, a line on it, and where it sits from simple (0) to powerful (1).
const SPECTRUM = [
  ['clipboard', 'Shared list', 'A checklist everyone can tick', 0.04],
  ['layers', 'Task board', 'Cards moving across columns', 0.27],
  ['calendar', 'Project planner', 'Dates, owners and a timeline', 0.5],
  ['briefcase', 'Portfolio suite', 'Many projects in one view', 0.74],
  ['settings', 'Custom build', 'Made around your process', 0.96],
] as const;
// The option the page recommends: its disc is drawn heavier and badged.
const PICK = 2;
// What changes from one end of the scale to the other.
const TRADE_OFFS = [
  ['SET-UP TIME', 'Minutes', 'Weeks'],
  ['COST PER PERSON', 'Free', '£30 a month'],
  ['ROOM TO CUSTOMISE', 'A little', 'Everything'],
] as const;

function spectrum(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // A page clearly taller than wide has room for a lead line, and closes on why the pick wins.
  const tall = H > W * 1.2;
  const head = tall
    ? heading(k, 'From simple to powerful', 'Five ways to run a project.')
    : heading(k, 'From simple to powerful');
  const calloutH = u * 22;
  // A rail across the page, each option's disc on it at its place, its words above or below in
  // turn so neighbours never collide; the two ends named under the rail's ends.
  const d = Math.min(u * 14, W * 0.12);
  const nameH = u * 7;
  const noteH = u * 10;
  const labelH = nameH + u + noteH;
  const badgeH = u * 7;
  const endH = u * 7;
  const blockH = badgeH + u * 2 + labelH + u * 4 + d + u * 4 + labelH + u * 6 + endH;
  // A tall page with room to spare adds what changes along the scale, a row each; the spare
  // room is shared out evenly round the scale and the rows.
  const tradeRowH = u * 14;
  const tradeH = TRADE_OFFS.length * tradeRowH;
  const free = H - head.top - blockH;
  const trades = tall && free >= tradeH + u * 2;
  // Without the rows, a tall page closes on why the pick wins instead.
  const callout = tall && !trades && free >= calloutH + u * 8;
  const spare = Math.max(0, free - (trades ? tradeH : callout ? calloutH + u * 8 : 0));
  const y0 = head.top + spare / (trades ? 3 : 2);
  const railY = y0 + badgeH + u * 2 + labelH + u * 4 + d / 2;
  const railH = u * 2.4;
  const railW = W - d;
  const labelW = Math.min(railW * 0.4, u * 50);
  const els: Element[] = [
    ...head.els,
    k.shape('square', 0, railY - railH / 2, W, railH, { label: '', borderRadius: 'full' }),
  ];
  SPECTRUM.forEach(([iconId, name, note, at], i) => {
    const cx = d / 2 + at * railW;
    const disc = iconDisc(k, cx - d / 2, railY - d / 2, d, iconId);
    if (i === PICK) disc.disc.strokeWidth = 'extra-thick';
    els.push(...disc.els);
    const lx = Math.min(Math.max(0, cx - labelW / 2), W - labelW);
    const align = lx === 0 ? 'left' : lx === W - labelW ? 'right' : 'center';
    const above = i % 2 === 0;
    // The name sits nearest the rail, the note beyond it.
    // The pick's words rise to make room for its badge, between them and its disc.
    const lift = i === PICK ? badgeH + u * 2 : 0;
    const nameY = above ? railY - d / 2 - u * 4 - nameH - lift : railY + d / 2 + u * 4 + lift;
    const noteY = above ? nameY - u - noteH : nameY + nameH + u;
    els.push(
      k.text(lx, nameY, labelW, nameH, name, {
        textSize: 'lg',
        textBold: true,
        textAlignY: 'middle',
        textAlignX: align,
      }),
      k.text(lx, noteY, labelW, noteH, note, {
        textAlignY: above ? 'bottom' : 'top',
        textAlignX: align,
      }),
    );
    if (i === PICK) {
      const bw = u * 22;
      els.push(
        k.shape(
          'stadium',
          cx - bw / 2,
          above ? railY - d / 2 - u * 3 - badgeH : railY + d / 2 + u * 3,
          bw,
          badgeH,
          {
            label: 'Our pick',
            textBold: true,
            strokeWidth: 'thick',
          },
        ),
      );
    }
  });
  const endY = y0 + blockH - endH;
  const arrow = u * 5;
  els.push(
    k.shape('icon', 0, endY + (endH - arrow) / 2, arrow, arrow, { iconId: 'arrow-left' }),
    k.text(arrow + u * 2, endY, W / 2 - arrow - u * 2, endH, 'Simple, quick to start', {
      textBold: true,
      textAlignY: 'middle',
    }),
    k.text(W / 2, endY, W / 2 - arrow - u * 2, endH, 'Powerful, takes set-up', {
      textBold: true,
      textAlignX: 'right',
      textAlignY: 'middle',
    }),
    k.shape('icon', W - arrow, endY + (endH - arrow) / 2, arrow, arrow, { iconId: 'arrow-right' }),
  );
  if (trades) {
    const top = y0 + blockH + spare / 3;
    const valW = W * 0.3;
    TRADE_OFFS.forEach(([name, from, to], i) => {
      const y = top + i * tradeRowH;
      const lineY = y + u * 8;
      const lineH = u * 6;
      els.push(
        k.text(0, y, W, u * 6, name, { textBold: true, textAlignY: 'middle', ...CENTRED }),
        k.text(0, lineY, valW, lineH, from, { textSize: 'lg', textAlignY: 'middle' }),
        k.shape(
          'square',
          valW + u * 2,
          lineY + lineH / 2 - u * 0.4,
          W - valW * 2 - u * 4,
          u * 0.8,
          {
            label: '',
            borderRadius: 'full',
          },
        ),
        k.text(W - valW, lineY, valW, lineH, to, {
          textSize: 'lg',
          textAlignX: 'right',
          textAlignY: 'middle',
        }),
      );
    });
  }
  if (callout) {
    els.push(
      k.callout(0, H - calloutH, W, calloutH, {
        pageTitle: 'Why the middle',
        label: 'Enough structure for a team of twelve, without a week of set-up.',
        textSize: 'md',
      }),
    );
  }
  return els;
}

// ── Three Options ───────────────────────────────────────────────────────

// Each option: its letter, its name, what it costs and takes, two points for it and one against.
const OPTIONS = [
  [
    'A',
    'Sell online',
    '£20k · 3 months',
    ['Reaches the whole country', 'Open all hours'],
    'Delivery eats the margin',
  ],
  [
    'B',
    'Open a second shop',
    '£90k · 9 months',
    ['Our customers asked for it', 'Doubles the walk-ins'],
    'A big lease to sign',
  ],
  [
    'C',
    'Supply local cafés',
    '£8k · 6 weeks',
    ['Steady weekly orders', 'Uses the ovens at night'],
    'Lower price per loaf',
  ],
] as const;
// The option the page recommends: its card is drawn heavier and badged.
const RECOMMENDED = 0;

function threeOptions(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // A page clearly taller than wide has room for a lead line.
  const head =
    H > W * 1.2
      ? heading(k, 'Where do we grow next?', 'Three options for the bakery.')
      : heading(k, 'Where do we grow next?');
  const badgeW = u * 30;
  const badgeH = u * 7;
  const top = head.top + badgeH / 2;
  const gap = u * 4;
  const pad = u * 4;
  const discD = u * 9;
  const els: Element[] = [...head.els];
  const badge = (x: number, y: number) =>
    k.shape('stadium', x, y, badgeW, badgeH, {
      label: 'Recommended',
      textBold: true,
      strokeWidth: 'thick',
    });
  // An option's points: two ticks for it and a cross against it, a row each.
  const points = (
    x: number,
    y: number,
    w: number,
    rowH: number,
    pros: readonly string[],
    con: string,
  ) =>
    [
      ...pros.map((p) => [p, 'check', TICK_GREEN] as const),
      [con, 'x', CROSS_ROSE] as const,
    ].flatMap(([line, iconId, color], i) =>
      iconRow(k, x, y + i * rowH, w, u * 5, iconId, line, { iconColor: color, lineH: rowH }),
    );
  const disc = (x: number, y: number, letter: string) =>
    k.shape('circle', x, y, discD, discD, {
      label: letter,
      textBold: true,
      textSize: 'lg',
      strokeWidth: 'thick',
    });
  const card = (x: number, y: number, w: number, h: number, i: number) =>
    k.shape('square', x, y, w, h, {
      label: '',
      borderRadius: 'lg',
      strokeWidth: i === RECOMMENDED ? 'extra-thick' : 'thin',
    });
  const bold = { textBold: true, textAlignY: 'middle' } as const;
  // Three across where each column keeps a useful width: the letter, the name, what it costs,
  // an image, then the points.
  if (W >= H * 0.8) {
    const cardW = (W - gap * 2) / 3;
    const cardH = H - top;
    const innerW = cardW - pad * 2;
    const pointH = u * 9;
    OPTIONS.forEach(([letter, name, cost, pros, con], i) => {
      const x = i * (cardW + gap);
      const y = top + pad;
      const nameY = y + discD + u * 3;
      const costY = nameY + u * 12;
      const imgY = costY + u * 8;
      const pointsY = top + cardH - pad - 3 * pointH;
      els.push(
        card(x, top, cardW, cardH, i),
        disc(x + pad, y, letter),
        k.text(x + pad, nameY, innerW, u * 12, name, { textSize: 'lg', textBold: true }),
        k.text(x + pad, costY, innerW, u * 6, cost, bold),
        k.image(x + pad, imgY, innerW, pointsY - u * 3 - imgY),
        ...points(x + pad, pointsY, innerW, pointH, pros, con),
      );
      if (i === RECOMMENDED) els.push(badge(x + (cardW - badgeW) / 2, top - badgeH / 2));
    });
    return els;
  }
  // Three cards down the page: the image at the left with what it costs under it; the letter
  // and the name, then the points, beside it.
  const cardH = (H - top - gap * 2) / 3;
  OPTIONS.forEach(([letter, name, cost, pros, con], i) => {
    const y = top + i * (cardH + gap);
    const imgW = W * 0.3;
    const costH = u * 7;
    const textX = pad + imgW + u * 5;
    const textW = W - pad - textX;
    const pointsY = y + pad + discD + u * 3;
    const pointH = (y + cardH - pad - pointsY) / 3;
    els.push(
      card(0, y, W, cardH, i),
      k.image(pad, y + pad, imgW, cardH - pad * 2 - costH - u),
      k.text(pad, y + cardH - pad - costH, imgW, costH, cost, { ...bold, ...CENTRED }),
      disc(textX, y + pad, letter),
      k.text(textX + discD + u * 3, y + pad, textW - discD - u * 3, discD, name, {
        textSize: 'lg',
        ...bold,
      }),
      ...points(textX, pointsY, textW, pointH, pros, con),
    );
    if (i === RECOMMENDED) els.push(badge(W - pad - badgeW, y - badgeH / 2));
  });
  return els;
}

export const buildSpectrum = (b: LayoutBox) => spectrum(kit(b));
export const buildThreeOptions = (b: LayoutBox) => threeOptions(kit(b));
