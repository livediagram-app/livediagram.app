// A card's history change as a timeline line (docs/specs/026-plan/items.md "History" "Where it shows"): its glyph and a
// short sentence, "Moved [In Progress] → [Review]", "Set Priority to [High]", values as chips (a status with its
// stage, a priority with its colour), the value before the arrow when the card's older history holds it. Statuses read
// by their column names, fields by their names in the card's type, people by name, values as the panel shows them.
// Pure: the Activity tab draws the parts.

import {
  CARD_FIELD_LABELS,
  PRIORITY_LABELS,
  customFieldText,
  dayLabel,
  isPriority,
  type CustomFieldDef,
  type Item,
  type ItemHistoryChange,
  type ItemHistoryEntry,
  type ItemHistoryValue,
  type ItemTypeDef,
  type StatusPhase,
} from '@liveplanner/items';
import { PRIORITY_COLOURS } from '@liveplanner/project';
import { colourName } from '@/components/colour/colour-options';

// A chip's colour: a status's stage (its dot as the Details status pill draws it), or a priority's own colour.
export type ActivityTone = { phase: StatusPhase } | { colour: string };

export type ActivityPart =
  // Words; `strong` a field's name or a title, `muted` an earlier title.
  | { text: string; strong?: true; muted?: true }
  // A value; `old` the value it held before, drawn muted before the arrow.
  | { chip: string; tone?: ActivityTone; old?: true }
  // The arrow between an old value and a new one (read "to").
  | { arrow: true };

export type ActivityGlyph =
  | 'created'
  | 'moved'
  | 'edited'
  | 'renamed'
  | 'cleared'
  | 'flag'
  | 'archive'
  | 'trash'
  | 'restore'
  | 'type';

export type ActivityLine = { glyph: ActivityGlyph; parts: ActivityPart[] };

// What a field held before a change, from the card's older history: a value, `null` empty, `undefined` not known.
export type PreviousValue = ItemHistoryValue | null | undefined;

export type ActivityContext = {
  // The plan's status names, and their stages, by status id.
  statusNames: ReadonlyMap<string, string>;
  statusPhases: ReadonlyMap<string, StatusPhase>;
  // The plan's card types (a type change names both), and the card's own (its fields' names).
  types: readonly ItemTypeDef[];
  type: ItemTypeDef | undefined;
  // The plan's cards, for a Card field's value (a card id).
  items: ReadonlyMap<string, Item>;
};

// The built-in fields' names as the panel shows them.
const BUILT_IN_NAMES: Readonly<Record<string, string>> = {
  ...CARD_FIELD_LABELS,
  title: 'Title',
  status: 'Status',
  color: 'Colour',
  description: 'Description',
};

const custom = (ctx: ActivityContext, field: string): CustomFieldDef | undefined =>
  ctx.type?.custom?.find((f) => f.id === field);

export function fieldName(ctx: ActivityContext, field: string): string {
  return custom(ctx, field)?.label ?? BUILT_IN_NAMES[field] ?? field;
}

const statusName = (ctx: ActivityContext, status: string) => ctx.statusNames.get(status) ?? status;

const typeName = (ctx: ActivityContext, id: string) =>
  ctx.types.find((t) => t.id === id)?.label ?? id;

// A kept value as the panel would show it.
export function valueText(ctx: ActivityContext, field: string, value: ItemHistoryValue): string {
  const def = custom(ctx, field);
  if (def) return customFieldText(def, value, ctx.items) ?? String(value);
  if (field === 'priority' && isPriority(value)) return PRIORITY_LABELS[value];
  if ((field === 'due' || field === 'start') && typeof value === 'string')
    return dayLabel(value, 'medium');
  if (field === 'color' && typeof value === 'string') return colourName(value);
  if (field === 'estimate' && typeof value === 'number')
    return `${value} ${value === 1 ? 'point' : 'points'}`;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

const t = (text: string): ActivityPart => ({ text });
const s = (text: string): ActivityPart => ({ text, strong: true });
const ARROW: ActivityPart = { arrow: true };
const oldMark = (old: boolean) => (old ? { old: true as const } : {});

const statusChip = (ctx: ActivityContext, status: string, old = false): ActivityPart => ({
  chip: statusName(ctx, status),
  tone: { phase: ctx.statusPhases.get(status) ?? 'todo' },
  ...oldMark(old),
});

const typeChip = (ctx: ActivityContext, id: string, old = false): ActivityPart => ({
  chip: typeName(ctx, id),
  ...oldMark(old),
});

// A field's value as a chip: the built-in priority wears its colour.
function valueChip(
  ctx: ActivityContext,
  field: string,
  value: ItemHistoryValue,
  old = false,
): ActivityPart {
  const tone =
    field === 'priority' && !custom(ctx, field) && isPriority(value)
      ? { tone: { colour: PRIORITY_COLOURS[value] } }
      : {};
  return { chip: valueText(ctx, field, value), ...tone, ...oldMark(old) };
}

const sameValue = (a: ItemHistoryValue, b: ItemHistoryValue) =>
  JSON.stringify(a) === JSON.stringify(b);

function setLine(
  ctx: ActivityContext,
  field: string,
  value: ItemHistoryValue | undefined,
  previous: PreviousValue,
): ActivityLine {
  if (value === undefined)
    return { glyph: 'edited', parts: [t('Edited the '), s(fieldName(ctx, field))] };
  // An earlier value the same as this one (two values cut to the same 80 characters) tells nothing.
  const before =
    previous !== undefined && previous !== null && !sameValue(previous, value) ? previous : null;
  if (field === 'title') {
    const now = s(`“${valueText(ctx, 'title', value)}”`);
    return {
      glyph: 'renamed',
      parts:
        before === null
          ? [t('Renamed this card to '), now]
          : [
              t('Renamed '),
              { text: `“${valueText(ctx, 'title', before)}”`, muted: true },
              ARROW,
              now,
            ],
    };
  }
  return {
    glyph: 'edited',
    parts:
      before === null
        ? [t('Set '), s(fieldName(ctx, field)), t(' to '), valueChip(ctx, field, value)]
        : [
            t('Changed '),
            s(fieldName(ctx, field)),
            t(' '),
            valueChip(ctx, field, before, true),
            ARROW,
            valueChip(ctx, field, value),
          ],
  };
}

// One change's line. `previous`: what the field held before, where the card's older history says.
export function changeLine(
  ctx: ActivityContext,
  change: ItemHistoryChange,
  entry: Pick<ItemHistoryEntry, 'tag'>,
  previous?: PreviousValue,
): ActivityLine {
  switch (change.kind) {
    case 'created': {
      const how =
        entry.tag === 'form' ? 'Created this card from a form response' : 'Created this card';
      return {
        glyph: 'created',
        parts: change.status ? [t(`${how} in `), statusChip(ctx, change.status)] : [t(how)],
      };
    }
    case 'moved':
      if (change.from && change.to)
        return {
          glyph: 'moved',
          parts: [
            t('Moved '),
            statusChip(ctx, change.from, true),
            ARROW,
            statusChip(ctx, change.to),
          ],
        };
      if (change.to) return { glyph: 'moved', parts: [t('Moved to '), statusChip(ctx, change.to)] };
      return {
        glyph: 'moved',
        parts: change.from ? [t('Moved out of '), statusChip(ctx, change.from)] : [t('Moved')],
      };
    case 'trashed':
      return { glyph: 'trash', parts: [t('Moved this card to the Trash')] };
    case 'untrashed':
      return { glyph: 'restore', parts: [t('Restored this card from the Trash')] };
    case 'archived':
      return { glyph: 'archive', parts: [t('Archived this card')] };
    case 'unarchived':
      return { glyph: 'restore', parts: [t('Restored this card from the Archive')] };
    case 'flagged':
      return { glyph: 'flag', parts: [t('Flagged this card')] };
    case 'unflagged':
      return { glyph: 'flag', parts: [t('Removed the flag')] };
    case 'type':
      return {
        glyph: 'type',
        parts: [
          t('Changed the type '),
          typeChip(ctx, change.from, true),
          ARROW,
          typeChip(ctx, change.to),
        ],
      };
    case 'set':
      return setLine(ctx, change.field, change.value, previous);
    case 'cleared': {
      const name = s(fieldName(ctx, change.field));
      return {
        glyph: 'cleared',
        parts:
          previous === undefined || previous === null
            ? [t('Cleared '), name]
            : [
                t('Cleared '),
                name,
                t(' (was '),
                valueChip(ctx, change.field, previous, true),
                t(')'),
              ],
      };
    }
  }
}

// A line's plain words, as a test reads it.
export function lineText(line: ActivityLine): string {
  return line.parts.map((p) => ('arrow' in p ? ' → ' : 'chip' in p ? p.chip : p.text)).join('');
}
