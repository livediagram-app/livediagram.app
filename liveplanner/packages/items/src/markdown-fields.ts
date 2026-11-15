// A description, and a Long Text custom field (docs/specs/026-plan/plan-agents.md "Naming things as people do"), as
// an agent writes it is Markdown: stored as its plain text and its formatting (`descriptionRich`, `<id>Rich`). Text
// with nothing marked drops formatting the card had, so the panel never shows an old text over the new one. Shared by
// change_items and the card templates change_card_types writes.
import type { ItemTypeDef } from './item-types';
import { richFieldOf } from './rich-text-field';
import { descriptionFromMarkdown } from './rich-text-markdown';

// The fields that take Markdown on `type`: the description and each Long Text field.
function markdownKeysOf(type: Pick<ItemTypeDef, 'custom'>): string[] {
  return [
    'description',
    ...(type.custom ?? []).filter((f) => f.kind === 'longtext').map((f) => f.id),
  ];
}

// `fields` with each Markdown value stored as its plain text and runs; `clear` names the formatting `had` holds that a
// value written without Markdown leaves stale.
export function markdownFields(
  fields: Readonly<Record<string, unknown>>,
  type: Pick<ItemTypeDef, 'custom'>,
  had: Readonly<Record<string, unknown>> = {},
): { set: Record<string, unknown>; clear: string[] } {
  const set = { ...fields };
  const clear: string[] = [];
  for (const key of markdownKeysOf(type)) {
    const markdown = fields[key];
    if (typeof markdown !== 'string') continue;
    const { plain, runs } = descriptionFromMarkdown(markdown);
    set[key] = plain;
    const rich = richFieldOf(key);
    if (runs) set[rich] = runs;
    else if (rich in had) clear.push(rich);
  }
  return { set, clear };
}
