'use client';

// An item's description in the item panel (docs/specs/026-plan/plan-board.md "Working on a board"): the panel's rich
// text (RichTextField), saved as `descriptionRich` with `description` as its plain-text mirror, in one write.
import { runsFromPlainText, type TextRun } from '@liveplanner/project';
import { DESCRIPTION_RICH_FIELD, type Item, type ItemPatch } from '@liveplanner/items';
import { RichTextField } from './RichTextField';

export function descriptionRuns(item: Item): TextRun[] {
  const rich = item.fields[DESCRIPTION_RICH_FIELD];
  if (Array.isArray(rich) && rich.length > 0) return rich as unknown as TextRun[];
  const plain = item.fields['description'];
  return runsFromPlainText(typeof plain === 'string' ? plain : '');
}

// The write a description edit makes: both fields, or both cleared when it is emptied.
export function descriptionPatch(plain: string, runs: TextRun[]): ItemPatch {
  if (!plain.trim()) return { clear: ['description', DESCRIPTION_RICH_FIELD] };
  return {
    set: {
      description: plain,
      [DESCRIPTION_RICH_FIELD]: runs as unknown as Item['fields'][string],
    },
  };
}

export function ItemDescription({
  item,
  canEdit,
  onPatch,
}: {
  item: Item;
  canEdit: boolean;
  onPatch: (patch: ItemPatch) => void;
}) {
  return (
    <RichTextField
      runs={descriptionRuns(item)}
      canEdit={canEdit}
      label="Description"
      addPrompt="Add a description…"
      emptyText="No description"
      placeholder="Write the why and the what…"
      onSave={(plain, runs) => onPatch(descriptionPatch(plain, runs))}
    />
  );
}
