// A card's history entry in words (docs/specs/026-plan/items.md "History" "Where it shows"): "moved this from In
// Progress to Review and set Priority to High". Statuses read by their column names, fields by their names in the
// card's type, people by name, values as the panel shows them. Pure: the panel row draws the parts, the strong
// ones in the darker ink.

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
} from '@liveplanner/items';
import { colourName } from '@/components/colour/colour-options';

export type ActivityPart = { text: string; strong?: true };

export type ActivityContext = {
  // The plan's status names, by status id.
  statusNames: ReadonlyMap<string, string>;
  // The plan's card types (a type change names both), and the card's own (its fields' names).
  types: readonly ItemTypeDef[];
  type: ItemTypeDef | undefined;
  // The plan's cards, for a Card field's value (a card id).
  items: ReadonlyMap<string, Item>;
};

// More phrases than this read as the first ones and "N more changes".
const PHRASES_SHOWN = 3;

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

const statusName = (ctx: ActivityContext, status: string | null) =>
  status ? (ctx.statusNames.get(status) ?? status) : '';

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

// One change's phrase.
export function changePhrase(
  ctx: ActivityContext,
  change: ItemHistoryChange,
  entry: Pick<ItemHistoryEntry, 'tag'>,
): ActivityPart[] {
  switch (change.kind) {
    case 'created': {
      const how =
        entry.tag === 'form'
          ? [t('created this card from a form response')]
          : [t('created this card')];
      return change.status ? [...how, t(' in '), s(statusName(ctx, change.status))] : how;
    }
    case 'moved':
      if (!change.from) return [t('moved this to '), s(statusName(ctx, change.to))];
      if (!change.to) return [t('moved this out of '), s(statusName(ctx, change.from))];
      return [
        t('moved this from '),
        s(statusName(ctx, change.from)),
        t(' to '),
        s(statusName(ctx, change.to)),
      ];
    case 'trashed':
      return [t('moved this to the Trash')];
    case 'untrashed':
      return [t('restored this from the Trash')];
    case 'archived':
      return [t('archived this')];
    case 'unarchived':
      return [t('restored this from the Archive')];
    case 'flagged':
      return [t('flagged this')];
    case 'unflagged':
      return [t('removed the flag')];
    case 'type':
      return [
        t('changed the type from '),
        s(typeName(ctx, change.from)),
        t(' to '),
        s(typeName(ctx, change.to)),
      ];
    case 'set':
      if (change.value === undefined) return [t('edited the '), s(fieldName(ctx, change.field))];
      if (change.field === 'title')
        return [t('renamed this to '), s(valueText(ctx, 'title', change.value))];
      return [
        t('set '),
        s(fieldName(ctx, change.field)),
        t(' to '),
        s(valueText(ctx, change.field, change.value)),
      ];
    case 'cleared':
      return [t('cleared '), s(fieldName(ctx, change.field))];
  }
}

// The entry's phrases joined as a sentence: "a, b and c", or the first ones and "N more changes".
export function activityParts(ctx: ActivityContext, entry: ItemHistoryEntry): ActivityPart[] {
  const phrases = entry.changes.map((c) => changePhrase(ctx, c, entry));
  const shown =
    phrases.length > PHRASES_SHOWN
      ? [
          ...phrases.slice(0, PHRASES_SHOWN - 1),
          [t(`made ${phrases.length - (PHRASES_SHOWN - 1)} more changes`)],
        ]
      : phrases;
  const out: ActivityPart[] = [];
  shown.forEach((phrase, i) => {
    if (i > 0) out.push(t(i === shown.length - 1 ? ' and ' : ', '));
    out.push(...phrase);
  });
  return out;
}
