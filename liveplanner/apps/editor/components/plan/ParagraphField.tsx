'use client';

// A Long Text custom field in the item panel (docs/specs/026-plan/item-types.md "An item type"): rich text, edited
// as the Description is (RichTextField). Its value stays plain text, and its formatting rides beside it as
// `<id>Rich` while any of it is marked. A value with no formatting (written before the field was rich, or plain by a
// form, a sheet or an agent) reads as its text.
import { runsFromPlainText, type TextRun } from '@liveplanner/project';
import {
  ITEM_UNKNOWN_STRING_MAX,
  richFieldOf,
  richRunsOf,
  runsAreMarked,
  type CustomFieldDef,
  type Item,
  type ItemPatch,
} from '@liveplanner/items';
import { RichTextField } from './RichTextField';

export function paragraphRuns(item: Item, field: string): TextRun[] {
  const rich = richRunsOf(item.fields, field);
  if (rich) return rich as unknown as TextRun[];
  const plain = item.fields[field];
  return runsFromPlainText(typeof plain === 'string' ? plain : '');
}

// The write an edit makes: the plain text (the runs' own, so the two always agree) and the runs while any is marked;
// formatting the card had is cleared when none is left. Undefined when the field is emptied: the host clears it.
export function paragraphPatch(item: Item, field: string, runs: TextRun[]): ItemPatch | undefined {
  const plain = runs.map((r) => r.text).join('');
  if (!plain.trim()) return undefined;
  const rich = richFieldOf(field);
  if (runsAreMarked(runs))
    return { set: { [field]: plain, [rich]: runs as unknown as Item['fields'][string] } };
  return { set: { [field]: plain }, ...(rich in item.fields ? { clear: [rich] } : {}) };
}

export function ParagraphField({
  item,
  field,
  canEdit,
  onPatch,
  onEmpty,
}: {
  item: Item;
  field: CustomFieldDef;
  canEdit: boolean;
  onPatch: (patch: ItemPatch) => void;
  // Emptied: the host clears the field (and is where a required field is kept).
  onEmpty: () => void;
}) {
  const name = field.label.toLowerCase();
  return (
    <RichTextField
      runs={paragraphRuns(item, field.id)}
      canEdit={canEdit}
      label={field.label}
      addPrompt={`Add ${name}…`}
      emptyText="None"
      placeholder={`Write ${name}…`}
      maxLength={ITEM_UNKNOWN_STRING_MAX}
      onSave={(_plain, runs) => {
        const patch = paragraphPatch(item, field.id, runs);
        if (patch) onPatch(patch);
        else onEmpty();
      }}
    />
  );
}
