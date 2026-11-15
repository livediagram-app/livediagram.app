// The type editor's card templates as a draft (docs/specs/026-plan/item-types.md "Editing a type": Templates): added,
// renamed, moved and removed in place, their values written by the card panel's own field controls through a
// stand-in card, and checked the way Save needs them. Pure: the Templates tab draws it.
import {
  CARD_TEMPLATES_BYTES,
  CARD_TEMPLATES_MAX,
  ITEM_FIELDS_BYTES,
  cardTemplatesBytes,
  fieldsByteSize,
  newCardTemplateId,
  richFieldOf,
  templateTakes,
  type CardTemplate,
  type Item,
  type ItemFieldValue,
  type ItemFields,
  type ItemPatch,
  type ItemTypeDef,
} from '@liveplanner/items';

export const NEW_TEMPLATE_NAME = 'New Template';

// A template added this session, until Save gives it an id from its name.
const DRAFT_ID = 'draft-';

// The name a new template takes: "New Template", or "New Template 2", 3... while one has it.
export function newTemplateName(templates: readonly CardTemplate[]): string {
  const taken = new Set(templates.map((t) => t.name.trim().toLowerCase()));
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? NEW_TEMPLATE_NAME : `${NEW_TEMPLATE_NAME} ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

// `templates` with a new, empty one at the end (none past CARD_TEMPLATES_MAX): the list and the new one's id.
export function addTemplate(templates: readonly CardTemplate[]): {
  templates: CardTemplate[];
  id: string | null;
} {
  if (templates.length >= CARD_TEMPLATES_MAX) return { templates: [...templates], id: null };
  let n = templates.length + 1;
  while (templates.some((t) => t.id === `${DRAFT_ID}${n}`)) n += 1;
  const id = `${DRAFT_ID}${n}`;
  return { templates: [...templates, { id, name: newTemplateName(templates), fields: {} }], id };
}

// One template changed by `edit`, the rest as they are.
export function withTemplate(
  templates: readonly CardTemplate[],
  id: string,
  edit: (t: CardTemplate) => CardTemplate,
): CardTemplate[] {
  return templates.map((t) => (t.id === id ? edit(t) : t));
}

// `id` moved one place up (-1) or down (1); unchanged at an end.
export function moveTemplate(
  templates: readonly CardTemplate[],
  id: string,
  by: -1 | 1,
): CardTemplate[] {
  const from = templates.findIndex((t) => t.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= templates.length) return [...templates];
  const next = [...templates];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

// `templates` without `id`, and the template to choose next: the one after it, else the one before, else none.
export function removeTemplate(
  templates: readonly CardTemplate[],
  id: string,
): { templates: CardTemplate[]; next: string | null } {
  const at = templates.findIndex((t) => t.id === id);
  const rest = templates.filter((t) => t.id !== id);
  return { templates: rest, next: (rest[at] ?? rest[at - 1])?.id ?? null };
}

// A field's value set (undefined: cleared, with its formatting).
export function withFieldValue(
  fields: ItemFields,
  key: string,
  value: ItemFieldValue | undefined,
): ItemFields {
  const next = { ...fields };
  if (value === undefined) {
    delete next[key];
    delete next[richFieldOf(key)];
  } else next[key] = value;
  return next;
}

// A card panel write (a description, a Long Text) applied to a template's values.
export function withPatch(fields: ItemFields, patch: ItemPatch): ItemFields {
  const next = { ...fields, ...patch.set };
  for (const key of patch.clear ?? []) delete next[key];
  return next;
}

// The fields the editor shows for a template of `type`, in the type's order: those a template holds, less the title
// (which heads it).
export function templateFieldsOf(type: Pick<ItemTypeDef, 'fields' | 'custom'>): string[] {
  return type.fields.filter((f) => f !== 'title' && templateTakes(type, f));
}

const NOBODY = { id: '', name: '', color: '#64748b' };

// A stand-in card holding the template's values, so the card panel's own field controls draw and edit them. Never
// stored or sent.
export function templateItem(type: Pick<ItemTypeDef, 'id'>, template: CardTemplate): Item {
  return {
    id: `template-${template.id}`,
    type: type.id,
    key: 0,
    rank: '',
    fields: template.fields,
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    createdBy: NOBODY,
    updatedBy: NOBODY,
  };
}

// The templates as Save stores them: each added this session takes `tp-` and a slug of its name, in order, so
// "Bug Report" gets `tp-bug-report`; a stored template keeps its id.
export function settledTemplates(templates: readonly CardTemplate[]): CardTemplate[] {
  const taken = templates.filter((t) => !t.id.startsWith(DRAFT_ID)).map((t) => t.id);
  return templates.map((t) => {
    if (!t.id.startsWith(DRAFT_ID)) return { ...t, name: t.name.trim() };
    const id = newCardTemplateId(t.name, taken);
    taken.push(id);
    return { ...t, id, name: t.name.trim() };
  });
}

// What a name says under its field: blank, or another template's in the type (case aside).
export function templateNameProblem(
  templates: readonly CardTemplate[],
  template: CardTemplate,
): string | null {
  const name = template.name.trim().toLowerCase();
  if (!name) return 'Give the template a name.';
  return templates.some((t) => t.id !== template.id && t.name.trim().toLowerCase() === name)
    ? 'Another template has this name.'
    : null;
}

export type TemplatesProblem = { message: string; templateId?: string };

// The first thing about the templates that stops Save: a blank or clashing name, a template past a card's 16 KB, the
// plan's templates past their 128 KB (`otherBytes`: every other type's).
export function templatesProblem(
  templates: readonly CardTemplate[],
  otherBytes: number,
): TemplatesProblem | null {
  const names = templates.map((t) => t.name.trim().toLowerCase());
  const blank = templates.find((t) => !t.name.trim());
  if (blank) return { message: 'Give every template a name.', templateId: blank.id };
  const clash = templates.find((_, i) => names.indexOf(names[i]!) !== i);
  if (clash) return { message: 'Two templates have the same name.', templateId: clash.id };
  const big = templates.find((t) => fieldsByteSize(t.fields) > ITEM_FIELDS_BYTES);
  if (big)
    return { message: `${big.name.trim()} holds more than 16 KB: shorten it.`, templateId: big.id };
  if (otherBytes + cardTemplatesBytes([{ templates: [...templates] }]) > CARD_TEMPLATES_BYTES)
    return { message: 'The plan’s card templates hold more than 128 KB: shorten or remove one.' };
  return null;
}
