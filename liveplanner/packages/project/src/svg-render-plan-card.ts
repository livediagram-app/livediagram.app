// A Plan card face in exports and api or MCP images (docs/specs/026-plan/plan-board.md "Both elements everywhere"),
// drawn from its type's Display at the board's card size as the canvas draws it (docs/specs/026-plan/item-types.md
// "Card display"): Minimal one line, Detailed a header, the title on up to three lines,
// what sits under it (custom fields, labels, the description) and a footer. A field shows only when the card has a
// value for it. The face measures itself, so a board stacks cards as tall as they need.

import {
  cardFieldsAt,
  isCustomCardField,
  isFlagged,
  itemTitle,
  typeCardDisplay,
  typeCardLayout,
  typeIn,
  ITEM_TYPES,
  type CardField,
  type CardSize,
  type CardSlot,
  type Item,
  AUTOMATIC_CARD_FIELDS,
  openBlockersOf,
} from '@liveplanner/items';
import { FLAG_COLOUR } from './plan-palette';
import { r2 } from './svg-render-primitives';
import { text as faceText, wrapLines } from './svg-render-face-kit';
import {
  BIT_GAP,
  bitOf,
  bitWidth,
  drawBit,
  PAD,
  ROW_H,
  runningBit,
  TITLE_LINE,
  TITLE_PX,
  type Bit,
  type CardFaceContext,
} from './svg-render-plan-card-bits';

export {
  BLOCKED_RED,
  TIMER_RUNNING_GREEN,
  type CardFaceContext,
} from './svg-render-plan-card-bits';

// The face, drawn at (x, y) `w` wide, with the height it took. `measureOnly` skips the markup.
export function planCardFace(
  item: Item,
  x: number,
  y: number,
  w: number,
  ctx: CardFaceContext,
  measureOnly = false,
): { svg: string; height: number } {
  const p = ctx.palette;
  const types = ctx.types ?? ITEM_TYPES;
  const type = typeIn(types, item.type);
  const size: CardSize = ctx.size ?? 'detailed';
  const typeShows = typeCardDisplay(type, size);
  const boardShows = ctx.boardFields ? cardFieldsAt(size, ctx.boardFields) : null;
  // A custom field, and Age and the stamps (newer than the board's old field list), follow the type's Display alone.
  const show = (f: CardField) =>
    isCustomCardField(f) || AUTOMATIC_CARD_FIELDS.includes(f)
      ? typeShows.includes(f)
      : typeShows.includes(f) && (!boardShows || boardShows.includes(f));
  const layout = typeCardLayout(type, size);
  const bits = (slot: CardSlot) =>
    (layout[slot] ?? []).filter(show).flatMap((f) => {
      const b = bitOf(f, item, type, ctx, w);
      return b ? [b] : [];
    });
  const out: string[] = [];
  // A row of bits from `left` to the right, wrapping; returns the rows' height.
  const row = (list: Bit[], left: number, top: number, right: number): number => {
    if (list.length === 0) return 0;
    let cx = left;
    let cy = top;
    for (const b of list) {
      if (b.kind === 'lines') {
        if (cx > left) cy += ROW_H;
        for (const line of b.lines) {
          if (!measureOnly) out.push(faceText(left, cy + 13, line, { size: 12, color: b.color }));
          cy += 16;
        }
        cx = left;
        continue;
      }
      const bw = bitWidth(b);
      if (cx > left && cx + bw > right) {
        cx = left;
        cy += ROW_H + 2;
      }
      if (!measureOnly) out.push(drawBit(b, cx, cy, Math.min(bw, right - cx), p.border));
      cx += bw + BIT_GAP;
    }
    return cy - top + (cx > left ? ROW_H : 0);
  };
  // Bits from the right edge leftwards, on one row.
  // Bits from the right edge leftwards, on one row, never past the card's inset: a bit wider than the room left
  // shrinks to it (its text ends in an ellipsis), and any after it are left off.
  const rightRow = (list: Bit[], right: number, top: number) => {
    const left = x + PAD;
    let cx = right;
    for (const b of [...list].reverse()) {
      if (b.kind === 'lines') continue;
      const room = cx - left;
      if (room < 24) break;
      const bw = Math.min(bitWidth(b), room);
      cx -= bw;
      if (!measureOnly) out.push(drawBit(b, cx, top, bw, p.border));
      cx -= BIT_GAP;
    }
    return right - cx;
  };
  const titleLines = (lines: number, width: number) =>
    wrapLines(itemTitle(item) || 'Untitled', width, TITLE_PX, lines);
  const flagged = isFlagged(item);
  // At every size, whatever the Display, as a running timer shows.
  const openBlockers = ctx.blocking ? openBlockersOf(ctx.blocking, item.id) : 0;
  const blocked: Bit | null = openBlockers ? { kind: 'blocked', count: openBlockers } : null;
  let h: number;
  if (size === 'minimal') {
    const lead = bits('lead');
    const running = runningBit(item, type, p);
    const trail = [...bits('trail'), ...(running ? [running] : []), ...(blocked ? [blocked] : [])];
    const leadW = lead.reduce((s, b) => s + bitWidth(b) + BIT_GAP, 0);
    const trailW = trail.reduce((s, b) => s + bitWidth(b) + BIT_GAP, 0);
    row(lead, x + PAD, y + 8, x + PAD + leadW);
    const lines = titleLines(2, w - PAD * 2 - leadW - trailW);
    lines.forEach((line, i) => {
      if (!measureOnly)
        out.push(
          faceText(x + PAD + leadW, y + 22 + i * TITLE_LINE, line, {
            size: TITLE_PX,
            color: p.text,
            weight: 600,
          }),
        );
    });
    rightRow(trail, x + w - PAD, y + 8);
    h = Math.max(36, 16 + lines.length * TITLE_LINE);
  } else {
    let cy = y + 9;
    const headEnd = bits('headEnd');
    const head = bits('head');
    const flagOnlyW = flagged ? 14 : 0;
    const flagW = flagOnlyW + (blocked ? bitWidth(blocked) + BIT_GAP : 0);
    // The header end sits at the right of the header row when both fit; on a narrow card it takes a row of its own.
    const widthOf = (list: Bit[]) => list.reduce((sum, b) => sum + bitWidth(b) + BIT_GAP, 0);
    const shared = widthOf(head) + widthOf(headEnd) <= w - PAD * 2 - flagW;
    const endW = shared ? rightRow(headEnd, x + w - PAD - flagW, cy) : 0;
    let headH = row(head, x + PAD, cy, x + w - PAD - flagW - endW);
    if (!shared && headEnd.length) {
      const below = cy + Math.max(headH, ROW_H) + 2;
      rightRow(headEnd, x + w - PAD, below);
      headH = below - cy + ROW_H;
    }
    if (flagged && !measureOnly)
      out.push(
        faceText(x + w - PAD, cy + 14, '⚑', { size: 12, color: FLAG_COLOUR, anchor: 'end' }),
      );
    if (blocked && !measureOnly)
      out.push(drawBit(blocked, x + w - PAD - flagOnlyW - bitWidth(blocked), cy, 0, p.border));
    cy += Math.max(headH, headEnd.length || flagged || blocked ? ROW_H : 0) + 4;
    const lines = titleLines(3, w - PAD * 2);
    lines.forEach((line, i) => {
      if (!measureOnly)
        out.push(
          faceText(x + PAD, cy + 13 + i * TITLE_LINE, line, {
            size: TITLE_PX,
            color: p.text,
            weight: 600,
          }),
        );
    });
    cy += lines.length * TITLE_LINE + 6;
    const body = row(bits('body'), x + PAD, cy, x + w - PAD);
    cy += body ? body + 6 : 0;
    const running = runningBit(item, type, p);
    const footEnd = running ? [...bits('footEnd'), running] : bits('footEnd');
    const footEndW = rightRow(footEnd, x + w - PAD, cy);
    cy += Math.max(
      row(bits('foot'), x + PAD, cy, x + w - PAD - footEndW),
      footEnd.length ? ROW_H : 0,
    );
    h = cy - y + 8;
  }
  if (measureOnly) return { svg: '', height: h };
  if (ctx.height !== undefined) h = ctx.height;
  // Marker outlines every card, a Minimal one (36 px, under a frame's least size) included, as on the canvas
  // (PlanCardFace's data-marker-frame; docs/specs/008-canvas/finish.md "Faces: frames and shapes").
  const frame =
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="8" fill="${p.card}" stroke="${p.border}" stroke-width="1" data-marker-frame=""/>` +
    `<rect x="${r2(x)}" y="${r2(y)}" width="4" height="${r2(h)}" rx="2" fill="${type.color}"/>`;
  return { svg: frame + out.join(''), height: h };
}
