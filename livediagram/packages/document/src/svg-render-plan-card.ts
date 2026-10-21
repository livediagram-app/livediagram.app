// A Plan card face in exports and api or MCP images (docs/specs/026-plan/plan-board.md "Both elements everywhere"),
// drawn from its type's Display at the board's card size as the canvas draws it (docs/specs/026-plan/item-types.md
// "Card display"): Minimal one line, Compact a title over one row, Detailed a header, the title on up to three lines,
// what sits under it (custom fields, labels, the description) and a footer. A field shows only when the card has a
// value for it. The face measures itself, so a board stacks cards as tall as they need.

import {
  cardFieldsAt,
  checklistProgress,
  customFieldText,
  dayLabel,
  isCustomCardField,
  isFlagged,
  isPriority,
  itemAssignee,
  itemCommentCount,
  itemLabels,
  itemTitle,
  itemVoteTotal,
  typeCardDisplay,
  typeCardLayout,
  typeIn,
  ITEM_TYPES,
  type CardField,
  type CardSize,
  type CardSlot,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import { FLAG_COLOUR, PRIORITY_COLOURS, type PlanPalette } from './plan-palette';
import { r2, xmlEscape } from './svg-render-primitives';
import { personDisc, text as faceText, wrapLines } from './svg-render-face-kit';
import { initialsOf } from './names';

const PRIORITY_LABEL: Readonly<Record<string, string>> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Geometry: the inset, a row of bits, the gap between bits, the title's line height per size.
const PAD = 12;
const ROW_H = 20;
const BIT_GAP = 6;
const TITLE_PX = 13;
const TITLE_LINE = 17;
const BIT_PX = 11;
const CHAR_EM = 0.56;

type Bit =
  | { kind: 'text'; text: string; color: string; weight?: number; pill?: boolean; dot?: string }
  | { kind: 'person'; name: string; color: string }
  | { kind: 'lines'; lines: string[]; color: string };

const bitWidth = (b: Bit): number =>
  b.kind === 'person'
    ? 20
    : b.kind === 'lines'
      ? 0
      : b.text.length * BIT_PX * CHAR_EM + (b.pill ? 14 : 0) + (b.dot ? 12 : 0);

export type CardFaceContext = {
  palette: PlanPalette;
  types?: readonly ItemTypeDef[];
  // The board's own card fields: a built-in shows only when the board lists it, as on the canvas.
  boardFields?: readonly CardField[];
  size?: CardSize;
  items?: ReadonlyMap<string, Item>;
  // A standalone card element's own height: its frame keeps the element's bounds rather than its measured need.
  height?: number;
};

// One field's bit, or null when the card has nothing for it.
function bitOf(
  f: CardField,
  item: Item,
  type: ItemTypeDef,
  ctx: CardFaceContext,
  width: number,
): Bit | null {
  const p = ctx.palette;
  const v = item.fields[f];
  switch (f) {
    case 'key':
      return { kind: 'text', text: `#${item.key}`, color: type.color, weight: 600 };
    case 'type':
      return { kind: 'text', text: type.label, color: type.color, weight: 600, dot: type.color };
    case 'priority':
      return isPriority(v)
        ? { kind: 'text', text: PRIORITY_LABEL[v] ?? v, color: p.muted, dot: PRIORITY_COLOURS[v] }
        : null;
    case 'start':
      return typeof v === 'string'
        ? { kind: 'text', text: `Starts ${dayLabel(v)}`, color: p.muted, pill: true }
        : null;
    case 'due':
      return typeof v === 'string'
        ? { kind: 'text', text: `Due ${dayLabel(v)}`, color: p.muted, pill: true }
        : null;
    case 'estimate':
      return typeof v === 'number'
        ? { kind: 'text', text: `Est ${v}`, color: p.muted, pill: true }
        : null;
    case 'checklist': {
      const progress = checklistProgress(item);
      return progress
        ? { kind: 'text', text: `✓ ${progress.done}/${progress.total}`, color: p.muted, pill: true }
        : null;
    }
    case 'comments': {
      const n = itemCommentCount(item);
      return n > 0 ? { kind: 'text', text: `💬 ${n}`, color: p.muted } : null;
    }
    case 'votes': {
      const n = itemVoteTotal(item);
      return n > 0 ? { kind: 'text', text: `▲ ${n}`, color: p.muted } : null;
    }
    case 'assignee': {
      const who = itemAssignee(item);
      return who ? { kind: 'person', name: who.name, color: who.color } : null;
    }
    case 'labels': {
      const labels = itemLabels(item);
      return labels.length
        ? { kind: 'text', text: labels.join(' · '), color: p.muted, pill: true }
        : null;
    }
    case 'description':
      return typeof v === 'string' && v.trim()
        ? { kind: 'lines', lines: wrapLines(v.trim(), width - PAD * 2, 12, 2), color: p.muted }
        : null;
    default: {
      // A custom field: its name and its value, a linked card's title for a Card field.
      if (!isCustomCardField(f)) return null;
      const def = (type.custom ?? []).find((c) => c.id === f);
      const value = def ? customFieldText(def, item.fields[def.id], ctx.items) : null;
      return def && value
        ? { kind: 'text', text: `${def.label}: ${value}`, color: p.text, pill: true }
        : null;
    }
  }
}

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
  const show = (f: CardField) =>
    isCustomCardField(f)
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
  let h: number;
  if (size === 'minimal') {
    const lead = bits('lead');
    const trail = bits('trail');
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
  } else if (size === 'compact') {
    const lead = bits('lead');
    const leadW = lead.reduce((s, b) => s + bitWidth(b) + BIT_GAP, 0);
    row(lead, x + PAD, y + 9, x + PAD + leadW);
    const lines = titleLines(2, w - PAD * 2 - leadW);
    lines.forEach((line, i) => {
      if (!measureOnly)
        out.push(
          faceText(x + PAD + leadW, y + 23 + i * TITLE_LINE, line, {
            size: TITLE_PX,
            color: p.text,
            weight: 600,
          }),
        );
    });
    let cy = y + 10 + lines.length * TITLE_LINE + 4;
    const trail = bits('trail');
    const trailW = rightRow(trail, x + w - PAD, cy);
    cy += Math.max(row(bits('row'), x + PAD, cy, x + w - PAD - trailW), trail.length ? ROW_H : 0);
    h = cy - y + 8;
  } else {
    let cy = y + 9;
    const headEnd = bits('headEnd');
    const head = bits('head');
    const flagW = flagged ? 14 : 0;
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
    cy += Math.max(headH, headEnd.length || flagged ? ROW_H : 0) + 4;
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
    const footEnd = bits('footEnd');
    const footEndW = rightRow(footEnd, x + w - PAD, cy);
    cy += Math.max(
      row(bits('foot'), x + PAD, cy, x + w - PAD - footEndW),
      footEnd.length ? ROW_H : 0,
    );
    h = cy - y + 8;
  }
  if (measureOnly) return { svg: '', height: h };
  if (ctx.height !== undefined) h = ctx.height;
  const frame =
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="8" fill="${p.card}" stroke="${p.border}" stroke-width="1"/>` +
    `<rect x="${r2(x)}" y="${r2(y)}" width="4" height="${r2(h)}" rx="2" fill="${type.color}"/>`;
  return { svg: frame + out.join(''), height: h };
}

// `s` cut to the characters `room` holds at a bit's size, ending in an ellipsis when cut; nothing when not even two
// fit (the shared wrapLines keeps at least eight, which a narrow pill cannot hold).
function fitChars(s: string, room: number): string {
  const fits = Math.floor((room + 1) / (BIT_PX * CHAR_EM));
  if (s.length <= fits) return s;
  return fits < 2 ? '' : `${s.slice(0, fits - 1).trimEnd()}…`;
}

function drawBit(
  b: Exclude<Bit, { kind: 'lines' }>,
  x: number,
  y: number,
  w: number,
  border: string,
): string {
  if (b.kind === 'person')
    return personDisc(x + 10, y + 10, 10, b.color, { initials: initialsOf(b.name), fill: b.color });
  const parts: string[] = [];
  let tx = x;
  if (b.pill)
    parts.push(
      `<rect x="${r2(x)}" y="${r2(y + 1)}" width="${r2(w)}" height="18" rx="9" fill="none" stroke="${xmlEscape(border)}" stroke-width="1"/>`,
    );
  if (b.pill) tx += 7;
  if (b.dot) {
    parts.push(`<circle cx="${r2(tx + 4)}" cy="${r2(y + 10)}" r="4" fill="${xmlEscape(b.dot)}"/>`);
    tx += 12;
  }
  const room = Math.max(0, w - (tx - x) - (b.pill ? 7 : 0));
  const text = fitChars(b.text, room);
  parts.push(
    faceText(tx, y + 14, text, {
      size: BIT_PX,
      color: b.color,
      ...(b.weight ? { weight: b.weight } : {}),
    }),
  );
  return parts.join('');
}
