// The bits a Plan card face is made of (docs/specs/026-plan/item-types.md "Card display"): what each card field shows as
// one (bitOf, runningBit), how wide it measures and how it draws, with the face's geometry. svg-render-plan-card.ts
// lays them out into the face.

import {
  checklistProgress,
  customFieldText,
  dayLabel,
  isCustomCardField,
  isPriority,
  itemAssignee,
  itemCommentCount,
  itemLabels,
  itemVoteTotal,
  typeIn,
  ITEM_TYPES,
  type CardField,
  type CardSize,
  type Item,
  type ItemTypeDef,
  type CustomFieldDef,
  type CalculatedValue,
  type IsDoneStatus,
  calculatedText,
  calculatedValue,
  formulaValue,
  isFormulaField,
  childIndexFor,
  cardAgeDays,
  cardAgeText,
  cardAgeTone,
  itemStatus,
  itemStatusSince,
  itemStampPerson,
  itemStampTime,
  stampDay,
  percentShown,
  percentText,
  showsAsPercent,
  isTimeSpent,
  readTimeValue,
  timePerson,
  type BlockingIndex,
} from '@liveplanner/items';
import { lucideLink } from '@liveworkspace/icons/lucide';
import {
  PLAN_PERCENT_BAR,
  PRIORITY_COLOURS,
  planPercentInks,
  type PlanPalette,
} from './plan-palette';
import { r2, xmlEscape } from './svg-render-primitives';
import { personDisc, text as faceText, wrapLines } from './svg-render-face-kit';
import { initialsOf } from '@liveworkspace/model-core/names';

// Age past its thresholds: the board's amber and red (docs/specs/026-plan/item-types.md "Card display").
const AGE_INK = { warn: '#d97706', alert: '#dc2626' } as const;

const PRIORITY_LABEL: Readonly<Record<string, string>> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Geometry: the inset, a row of bits, the gap between bits, the title's line height per size.
export const PAD = 12;
export const ROW_H = 20;
export const BIT_GAP = 6;
export const TITLE_PX = 13;
export const TITLE_LINE = 17;
export const BIT_PX = 11;
export const CHAR_EM = 0.56;

export type Bit =
  | { kind: 'text'; text: string; color: string; weight?: number; pill?: boolean; dot?: string }
  | { kind: 'person'; name: string; color: string }
  | { kind: 'lines'; lines: string[]; color: string }
  // A share drawn as a Percent field is (docs/specs/026-plan/item-types.md "Percent"): its name, a thin bar, "40%".
  | { kind: 'percent'; label: string; value: number; color: string; fill: string; track: string }
  // Blocked by open cards (docs/specs/026-plan/item-types.md "Blocked By"): the red link glyph and the count.
  | { kind: 'blocked'; count: number };

// The blocked badge: the board's red, and its link glyph's size (the editor's BlockedMark).
export const BLOCKED_RED = '#dc2626';
const BLOCKED_GLYPH = 12;

// The gap either side of a Percent bit's bar.
const PERCENT_GAP = 5;
const charsWidth = (s: string) => s.length * BIT_PX * CHAR_EM;

export const bitWidth = (b: Bit): number =>
  b.kind === 'blocked'
    ? BLOCKED_GLYPH + 3 + charsWidth(String(b.count))
    : b.kind === 'person'
      ? 20
      : b.kind === 'lines'
        ? 0
        : b.kind === 'percent'
          ? charsWidth(b.label) +
            PLAN_PERCENT_BAR.width +
            PERCENT_GAP * 2 +
            charsWidth(percentText(b.value)) +
            14
          : charsWidth(b.text) + (b.pill ? 14 : 0) + (b.dot ? 12 : 0);

export type CardFaceContext = {
  palette: PlanPalette;
  types?: readonly ItemTypeDef[];
  // The board's own card fields: a built-in shows only when the board lists it, as on the canvas.
  boardFields?: readonly CardField[];
  size?: CardSize;
  items?: ReadonlyMap<string, Item>;
  // The board's done columns, for a Calculated field's Children Done (docs/specs/026-plan/item-types.md "Calculated
  // fields"); a lone card element has none in hand, so it draws Child Count alone.
  isDone?: IsDoneStatus;
  // A standalone card element's own height: its frame keeps the element's bounds rather than its measured need.
  height?: number;
  // The moment a card's Age is read at; absent, now.
  now?: number;
  // The plan's Blocked By lookup (blockingIndexOf), made once per board: a blocked card wears the badge.
  blocking?: BlockingIndex;
};

// One field's bit, or null when the card has nothing for it.
export function bitOf(
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
    // The card's stamps (docs/specs/026-plan/items.md "Created and Last Edited"): a day as a muted pill, a person as
    // their disc; nothing for a card stored without one.
    case 'createdAt':
    case 'updatedAt': {
      const at = itemStampTime(item, f);
      return at === undefined
        ? null
        : {
            kind: 'text',
            text: `${f === 'createdAt' ? 'Created' : 'Edited'} ${dayLabel(stampDay(at))}`,
            color: p.muted,
            pill: true,
          };
    }
    case 'createdBy':
    case 'updatedBy': {
      const who = itemStampPerson(item, f);
      return who ? { kind: 'person', name: who.name, color: who.color } : null;
    }
    // How long it has sat in its column: only with the board's done columns in hand (a done card shows none).
    case 'age': {
      const status = itemStatus(item);
      if (!ctx.isDone || status === undefined || ctx.isDone(status)) return null;
      const days = cardAgeDays(itemStatusSince(item), new Date(ctx.now ?? Date.now()));
      const tone = cardAgeTone(days);
      return tone === 'quiet'
        ? { kind: 'text', text: cardAgeText(days), color: p.muted, pill: true }
        : {
            kind: 'text',
            text: cardAgeText(days),
            color: AGE_INK[tone],
            weight: tone === 'alert' ? 700 : 600,
            pill: true,
          };
    }
    case 'description':
      return typeof v === 'string' && v.trim()
        ? { kind: 'lines', lines: wrapLines(v.trim(), width - PAD * 2, 12, 2), color: p.muted }
        : null;
    default: {
      // A custom field: its name and its value, a linked card's title for a Card field.
      if (!isCustomCardField(f)) return null;
      const def = (type.custom ?? []).find((c) => c.id === f);
      // A Votes field draws the built-in's ▲ count of its own votes (item-types.md "Comments and Votes fields").
      if (def?.kind === 'votes') {
        const n = itemVoteTotal(item, def.id);
        return n > 0 ? { kind: 'text', text: `${def.label} ▲ ${n}`, color: p.muted } : null;
      }
      // A Percent field, or a share shown as one, draws its bar (docs/specs/026-plan/item-types.md "Percent").
      if (def && showsAsPercent(def)) {
        const share = percentShown(
          def,
          def.kind === 'calculated'
            ? calculatedOf(def, item, ctx, ctx.types ?? ITEM_TYPES)
            : item.fields[def.id],
        );
        return share === undefined
          ? null
          : {
              kind: 'percent',
              label: def.label,
              value: share,
              color: p.text,
              ...planPercentInks(p),
            };
      }
      const value = !def
        ? null
        : def.kind === 'calculated'
          ? calculatedText(def, calculatedOf(def, item, ctx, ctx.types ?? ITEM_TYPES))
          : customFieldText(def, item.fields[def.id], ctx.items);
      return def && value
        ? { kind: 'text', text: `${def.label}: ${value}`, color: p.text, pill: true }
        : null;
    }
  }
}

// The green of a running timer (docs/specs/026-plan/item-types.md "Time Spent").
export const TIMER_RUNNING_GREEN = '#16a34a';

// While anyone's timer runs on the card, at every size whatever the Display: "Running · Sam" (or "Sam +2") after a
// green dot; null with none running.
export function runningBit(item: Item, type: ItemTypeDef, p: PlanPalette): Bit | null {
  const names: string[] = [];
  for (const f of type.custom ?? []) {
    if (!isTimeSpent(f) || !type.fields.includes(f.id)) continue;
    const value = readTimeValue(item.fields[f.id]);
    for (const r of value.running) {
      const name = timePerson(value, r.by).name;
      if (!names.includes(name)) names.push(name);
    }
  }
  if (names.length === 0) return null;
  const who = names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
  return {
    kind: 'text',
    text: `Running · ${who}`,
    color: p.text,
    pill: true,
    dot: TIMER_RUNNING_GREEN,
  };
}

// A Calculated field's value, worked out from the cards in hand: null without them, and Children Done only with the
// board's done columns (a Rollup's Count Done reads 0 without them). A Formula reads the card itself, so a lone card draws it too (none
// when it can't be worked out; docs/specs/026-plan/item-types.md "Formula fields"); a Rollup or Lookup reads the
// cards ("Rollup and Lookup fields").
function calculatedOf(
  def: CustomFieldDef,
  item: Item,
  ctx: CardFaceContext,
  types: readonly ItemTypeDef[],
): CalculatedValue {
  const type = typeIn(types, item.type);
  if (isFormulaField(def) && !ctx.items) return formulaValue(def, item, type);
  if (!ctx.items) return null;
  return calculatedValue(def, item, childIndexFor(ctx.items, types), ctx.isDone, {
    type,
    items: ctx.items,
    types,
  });
}
// `s` cut to the characters `room` holds at a bit's size, ending in an ellipsis when cut; nothing when not even two
// fit (the shared wrapLines keeps at least eight, which a narrow pill cannot hold).
export function fitChars(s: string, room: number): string {
  const fits = Math.floor((room + 1) / (BIT_PX * CHAR_EM));
  if (s.length <= fits) return s;
  return fits < 2 ? '' : `${s.slice(0, fits - 1).trimEnd()}…`;
}

export function drawBit(
  b: Exclude<Bit, { kind: 'lines' }>,
  x: number,
  y: number,
  w: number,
  border: string,
): string {
  if (b.kind === 'person')
    return personDisc(x + 10, y + 10, 10, b.color, { initials: initialsOf(b.name), fill: b.color });
  if (b.kind === 'percent') return drawPercentBit(b, x, y, w, border);
  if (b.kind === 'blocked') return drawBlockedBit(b.count, x, y);
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

// The blocked badge: the Lucide link glyph in red at 12 px, then its count.
function drawBlockedBit(count: number, x: number, y: number): string {
  const scale = BLOCKED_GLYPH / 24;
  const paths = lucideLink
    .map((prim) => (prim.t === 'path' ? `<path d="${prim.d}"/>` : ''))
    .join('');
  return (
    `<g transform="translate(${r2(x)} ${r2(y + 4)}) scale(${scale})" fill="none" stroke="${BLOCKED_RED}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</g>` +
    faceText(x + BLOCKED_GLYPH + 3, y + 14, String(count), {
      size: BIT_PX,
      color: BLOCKED_RED,
      weight: 600,
    })
  );
}

// A Percent bit: the pill, the field's name, a thin track with the share filled, then "40%". A pill narrower than it
// wants keeps the bar and the share, shortening the name.
function drawPercentBit(
  b: Extract<Bit, { kind: 'percent' }>,
  x: number,
  y: number,
  w: number,
  border: string,
): string {
  const share = percentText(b.value);
  const shareW = charsWidth(share);
  const bar = PLAN_PERCENT_BAR;
  const nameRoom = Math.max(0, w - 14 - bar.width - PERCENT_GAP * 2 - shareW);
  const name = fitChars(b.label, nameRoom);
  const barX = x + 7 + (name ? charsWidth(name) + PERCENT_GAP : 0);
  const barY = y + 10 - bar.height / 2;
  const r = bar.height / 2;
  const fillW = (bar.width * b.value) / 100;
  return (
    `<rect x="${r2(x)}" y="${r2(y + 1)}" width="${r2(w)}" height="18" rx="9" fill="none" stroke="${xmlEscape(border)}" stroke-width="1"/>` +
    (name ? faceText(x + 7, y + 14, name, { size: BIT_PX, color: b.color }) : '') +
    `<rect x="${r2(barX)}" y="${r2(barY)}" width="${bar.width}" height="${bar.height}" rx="${r}" fill="${xmlEscape(b.track)}"/>` +
    (fillW > 0
      ? `<rect x="${r2(barX)}" y="${r2(barY)}" width="${r2(fillW)}" height="${bar.height}" rx="${r}" fill="${xmlEscape(b.fill)}"/>`
      : '') +
    faceText(barX + bar.width + PERCENT_GAP, y + 14, share, {
      size: BIT_PX,
      color: b.color,
      weight: 600,
    })
  );
}
