// The figure layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"): a pictogram, a ranking,
// a cycle and a funnel. Same contract as page-layouts.ts: the page's content box in, uncoloured
// elements out, a tall page stacking and a wide one setting side by side. Each figure ends in the
// source line its numbers owe.
import { createPinnedArrow, type Element, type ShapeElement } from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconDisc, SOURCE_H, sourceLine } from './page-layout-parts';

// The room a source line takes at the page's foot, with the gap above it.
const FOOT = SOURCE_H + 4;

// How many of the ten people the pictogram fills, and the faintness of the rest.
const PICTOGRAM_FILLED = 7;
const PICTOGRAM_FAINT = 0.3;

function pictogram(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'How we read the news', 'A survey of 2,000 adults.');
  const caption = 'read the news on their phone before they get out of bed.';
  const source = sourceLine(k, 'Source: say who you asked, and when.');
  const bottom = H - u * FOOT;
  // Ten people, five across and two down, centred in their box: the first seven filled. Where the
  // box is taller than the two rows need, the rows part (up to half a row more) to take it up.
  const people = (x: number, y: number, w: number, h: number) => {
    const cell = Math.min(w / 5, h / 2);
    const rowH = Math.min(h / 2, cell * 1.5);
    const icon = cell * 0.82;
    const gx = x + (w - cell * 5) / 2;
    const gy = y + (h - rowH * 2) / 2;
    return Array.from({ length: 10 }, (_, i) =>
      k.shape(
        'icon',
        gx + (i % 5) * cell + (cell - icon) / 2,
        gy + Math.floor(i / 5) * rowH + (rowH - icon) / 2,
        icon,
        icon,
        i < PICTOGRAM_FILLED ? { iconId: 'user' } : { iconId: 'user', opacity: PICTOGRAM_FAINT },
      ),
    );
  };
  if (k.wide) {
    const colW = W * 0.4;
    const figH = u * 30;
    const capH = u * 22;
    const y = head.top + Math.max(0, (bottom - head.top - figH - capH - u * 4) / 2);
    const gridX = colW + u * 8;
    return [
      ...head.els,
      k.title(0, y, colW, figH, '7 in 10'),
      k.text(0, y + figH + u * 4, colW, capH, caption, { textSize: 'lg' }),
      ...people(gridX, head.top, W - gridX, bottom - head.top),
      source,
    ];
  }
  // Not much taller than wide (a square, a 4:5 post): the figure and its caption side by side in
  // a row, the people filling the room under it.
  if (H < W * 1.3) {
    const figH = u * 22;
    const gridY = head.top + figH + u * 6;
    return [
      ...head.els,
      k.title(0, head.top, W * 0.45, figH, '7 in 10'),
      k.text(W * 0.5, head.top, W * 0.5, figH, caption, { textSize: 'lg', textAlignY: 'middle' }),
      ...people(0, gridY, W, bottom - gridY),
      source,
    ];
  }
  // The figure and its caption together, the people filling the room under them. A long page (a
  // story) sets the caption at the foot instead, so the people sit centred between the two.
  const figH = u * 30;
  const capH = u * 14;
  if (H > W * 1.6) {
    const gridY = head.top + figH + u * 4;
    return [
      ...head.els,
      k.title(0, head.top, W, figH, '7 in 10'),
      ...people(0, gridY, W, bottom - capH - u * 4 - gridY),
      k.text(0, bottom - capH, W, capH, caption, { textSize: 'lg' }),
      source,
    ];
  }
  const gridY = head.top + figH + capH + u * 6;
  return [
    ...head.els,
    k.title(0, head.top, W, figH, '7 in 10'),
    k.text(0, head.top + figH + u * 2, W, capH, caption, { textSize: 'lg' }),
    ...people(0, gridY, W, bottom - gridY),
    source,
  ];
}

const RANKS = [
  ['Dark mode', 92],
  ['Templates', 81],
  ['Live cursors', 74],
  ['PDF export', 60],
  ['Comments', 48],
] as const;

function ranking(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Most loved features', 'What 1,200 people voted for.');
  // The rows share the page down to the source line.
  const rowH = (H - u * FOOT - head.top) / RANKS.length;
  const d = Math.min(u * 12, rowH * 0.7);
  const textX = d + u * 5;
  const valueW = u * 14;
  const max = Math.max(...RANKS.map(([, v]) => v));
  return [
    ...head.els,
    ...RANKS.flatMap(([name, value], i) => {
      const y = head.top + i * rowH;
      const disc = k.shape('circle', 0, y, d, d, {
        label: `${i + 1}`,
        textBold: true,
        textSize: 'lg',
      });
      // Wide: the name beside its bar on one line. Tall: the name over its bar.
      const nameW = k.wide ? W * 0.24 : W - textX;
      const barX = k.wide ? textX + nameW : textX;
      const barH = Math.min(u * 6, d * 0.5);
      const barY = k.wide ? y + (d - barH) / 2 : y + Math.min(u * 8, d * 0.6);
      const barW = ((W - barX - valueW - u * 3) * value) / max;
      return [
        disc,
        k.text(textX, y, nameW, k.wide ? d : u * 7, name, {
          textSize: 'lg',
          textBold: true,
          textAlignY: k.wide ? 'middle' : 'top',
        }),
        k.shape('square', barX, barY, barW, barH, { label: '', borderRadius: 'full' }),
        k.text(barX + barW + u * 3, barY + barH / 2 - u * 4, valueW, u * 8, `${value}%`, {
          textSize: 'lg',
          textAlignY: 'middle',
        }),
      ];
    }),
    sourceLine(k, 'Source: say who voted, and when.'),
  ];
}

// Round the loop clockwise from the top left: a disc each, its icon, a name and a note.
const STAGES = [
  ['search', 'Notice', 'Spot what is not working.'],
  ['edit', 'Plan', 'Pick one change to try.'],
  ['zap', 'Act', 'Make the change, small.'],
  ['bar-chart', 'Check', 'Measure what happened.'],
] as const;

function cycle(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // A page clearly taller than wide has room for a lead line; a square or wide one keeps the
  // height for the loop.
  const tall = H > W * 1.2;
  const head = tall
    ? heading(k, 'The improvement loop', 'Four stages, round and round.')
    : heading(k, 'The improvement loop');
  const nameH = u * 8;
  const noteH = u * 12;
  const textH = nameH + noteH;
  const roomH = H - head.top;
  // Side by side unless clearly taller than wide: the discs a compact square in the middle, each
  // stage's words out to its side. Tall: the words above the top discs and below the bottom ones.
  const beside = W >= H * 0.9;
  // Beside, the loop stays compact so the words either side keep their width; stacked, the loop
  // spans the page's halves and may run taller than wide on a long page.
  const d = beside
    ? Math.min(u * 22, roomH * 0.32, W * 0.19)
    : Math.min(W * 0.28, (roomH - 2 * textH - u * 14) / 2);
  const gapX = beside ? Math.min(d * 0.7, roomH - 2 * d) : W / 2 - d;
  const gapY = beside ? gapX : Math.min(gapX * 1.6, roomH - 2 * textH - u * 6 - 2 * d);
  const loopW = 2 * d + gapX;
  const loopH = 2 * d + gapY;
  const loopX = (W - loopW) / 2;
  const loopY = beside
    ? head.top + (roomH - loopH) / 2
    : head.top + (roomH - loopH - 2 * textH - u * 6) / 2 + textH + u * 3;
  // The discs: top left, top right, bottom right, bottom left.
  const at = [
    [loopX, loopY],
    [loopX + d + gapX, loopY],
    [loopX + d + gapX, loopY + d + gapY],
    [loopX, loopY + d + gapY],
  ] as const;
  const discs: ShapeElement[] = [];
  const els: Element[] = [];
  STAGES.forEach(([iconId, name, note], i) => {
    const [x, y] = at[i]!;
    const { disc, els: discEls } = iconDisc(k, x, y, d, iconId);
    discs.push(disc);
    els.push(...discEls);
    const left = i === 0 || i === 3;
    const top = i < 2;
    if (beside) {
      // Out to the side, level with the disc and reading away from the loop.
      const tw = loopX - u * 6;
      const tx = left ? 0 : loopX + loopW + u * 6;
      const ty = y + d / 2 - textH / 2;
      const align = left ? 'right' : 'left';
      els.push(
        k.text(tx, ty, tw, nameH, name, { textSize: 'lg', textBold: true, textAlignX: align }),
        k.text(tx, ty + nameH, tw, noteH, note, { textAlignX: align }),
      );
    } else {
      // Centred over a top disc or under a bottom one, across its half of the page.
      const tx = left ? 0 : W / 2;
      const ty = top ? y - u * 3 - textH : y + d + u * 3;
      const c = { textAlignX: 'center' } as const;
      els.push(
        k.text(tx, ty, W / 2, nameH, name, { textSize: 'lg', textBold: true, ...c }),
        k.text(tx + u * 2, ty + nameH, W / 2 - u * 4, noteH, note, c),
      );
    }
  });
  // The loop's middle: a turning arrow, sized to the gap between the discs.
  const mid = Math.min(gapX, gapY) * 0.6;
  const arrows = [
    createPinnedArrow(discs[0]!.id, 'e', discs[1]!.id, 'w'),
    createPinnedArrow(discs[1]!.id, 's', discs[2]!.id, 'n'),
    createPinnedArrow(discs[2]!.id, 'w', discs[3]!.id, 'e'),
    createPinnedArrow(discs[3]!.id, 'n', discs[0]!.id, 's'),
  ];
  return [
    ...head.els,
    ...els,
    k.shape('icon', W / 2 - mid / 2, loopY + loopH / 2 - mid / 2, mid, mid, {
      iconId: 'refresh-cw',
    }),
    ...arrows,
  ];
}

const FUNNEL = [
  ['Visited', '48,000'],
  ['Signed up', '12,000'],
  ['Tried it', '3,600'],
  ['Bought', '900'],
] as const;
// The share of each stage that goes on to the next.
const CONVERSIONS = ['25%', '30%', '25%'] as const;
// Each band this much of the widest narrower than the one above it.
const FUNNEL_STEP = 0.2;

function funnel(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'From visit to customer', 'Where people drop off, and how many stay.');
  // The bands centred down the left, each stage's count beside it in a column on the right, the
  // conversion between two bands in the gap that parts them.
  const countW = W * (k.wide ? 0.24 : 0.3);
  const funnelW = W - countW - u * 4;
  const gapH = u * 9;
  const n = FUNNEL.length;
  const bandH = (H - u * FOOT - head.top - gapH * (n - 1)) / n;
  const countH = Math.min(bandH * 0.8, u * 14);
  return [
    ...head.els,
    ...FUNNEL.flatMap(([name, count], i) => {
      const y = head.top + i * (bandH + gapH);
      const w = funnelW * (1 - i * FUNNEL_STEP);
      const els: Element[] = [
        k.shape('square', (funnelW - w) / 2, y, w, bandH, {
          label: name,
          textBold: true,
          textSize: 'lg',
          borderRadius: 'md',
        }),
        {
          ...k.title(W - countW, y + (bandH - countH) / 2, countW, countH, count),
          textAlignX: 'right',
        },
      ];
      if (i > 0) {
        els.push(
          k.text(0, y - gapH, funnelW, gapH, `${CONVERSIONS[i - 1]} go on`, {
            textAlignX: 'center',
            textAlignY: 'middle',
          }),
        );
      }
      return els;
    }),
    sourceLine(k, 'Source: say which months these counts cover.'),
  ];
}

export const buildPictogram = (b: LayoutBox) => pictogram(kit(b));
export const buildRanking = (b: LayoutBox) => ranking(kit(b));
export const buildCycle = (b: LayoutBox) => cycle(kit(b));
export const buildFunnel = (b: LayoutBox) => funnel(kit(b));
