// An agent's card template changes (docs/specs/026-plan/plan-agents.md "Card templates"): `add`'s `templates`, and
// `set`'s `removeTemplates`, `editTemplates` and `addTemplates`, applied to a type after the change's own field edits.
// Values are named and written as change_items writes a card's, then held to what a template may hold, and the type's
// list is checked the way the api checks it ('refuse'), so a refusal comes here, by name, before anything is saved.
import {
  CARD_TEMPLATE_NAME_MAX,
  CARD_TEMPLATES_MAX,
  newCardTemplateId,
  readCardTemplates,
  templateTakes,
  type CardTemplate,
} from './card-templates';
import type { Item, ItemFields } from './item';
import type { ItemTypeDef } from './item-types';
import {
  ITEM_CHECKLIST_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_LABELS_MAX,
  ITEM_TITLE_MAX,
} from './limits';
import { markdownFields } from './markdown-fields';
import { fieldKeyOf, resolveFields } from './plan-names';
import type { PlanStatusName } from './plan-outline';
import { isRichFieldKey, richFieldOf } from './rich-text-field';
import { templateOf } from './template-names';
import { Refused, invalid } from './type-change-refused';

// A new template: its name, and its values by field name as change_items takes a card's.
export interface TemplateInput {
  name: string;
  fields?: Readonly<Record<string, unknown>>;
}

// A template changed in place, named by id or name: renamed, values given set over its own, `clear` taken off.
export interface TemplateEdit {
  template: string;
  name?: string;
  fields?: Readonly<Record<string, unknown>>;
  clear?: readonly string[];
}

export interface TemplateChanges {
  templates?: readonly TemplateInput[];
  addTemplates?: readonly TemplateInput[];
  editTemplates?: readonly TemplateEdit[];
  removeTemplates?: readonly string[];
}

export interface TemplateNaming {
  statuses: readonly PlanStatusName[];
  items: readonly Item[];
}

// What a template holds, as a refusal says it.
const HOLDS =
  'a template holds the title, description, checklist, labels and custom fields, never a status, an assignee, ' +
  'dates or a Calculated, Time Spent, Comments, Votes, Card or Image field’s value';

// A field's name on `type`, for a refusal: a custom field's own, else its key.
const nameOf = (type: ItemTypeDef, key: string) =>
  type.custom?.find((f) => f.id === key)?.label ?? key;

// `input` as a template stores it: named fields resolved, Markdown made plain text and runs, and every key one a
// template may hold. `had` is the template's values before, whose stale formatting `clear` names.
function valuesOf(
  input: Readonly<Record<string, unknown>>,
  type: ItemTypeDef,
  naming: TemplateNaming,
  where: string,
  had: ItemFields = {},
): { set: ItemFields; clear: string[] } {
  const named = resolveFields(input, type, naming);
  if (!named.ok) throw new Refused({ code: named.code, message: `${where}: ${named.message}` });
  const { set, clear } = markdownFields(named.fields, type, had);
  for (const key of Object.keys(set)) {
    if (!templateTakes(type, key))
      throw invalid(`${where} can't hold ${nameOf(type, key)}: ${HOLDS}.`);
    // A built-in the type doesn't offer would be dropped on the next read: refused by name instead.
    if (!isRichFieldKey(key) && !type.fields.includes(key))
      throw new Refused({
        code: 'field_unknown',
        message: `${where} can't hold ${key}: ${type.label} cards have no such field (add it with addFields).`,
      });
  }
  // A field that holds several given as empty leaves it out, as a new card does.
  return { set: set as ItemFields, clear: [...clear, ...(named.clear ?? [])] };
}

// The words for a refusal of a type's templates (`reason` as readCardTemplates or the catalogue check gives it), or
// null when the reason is not about templates.
export function templateProblem(type: ItemTypeDef | undefined, reason: string): string | null {
  if (reason === 'templates')
    return 'The plan’s card templates would hold more than 128 KB: shorten or remove one.';
  if (!type) return null;
  if (reason.endsWith('.templates'))
    return `${type.label} can hold at most ${CARD_TEMPLATES_MAX} templates.`;
  const at = /\.templates\[(\d+)\](\.\w+)?$/.exec(reason);
  if (!at) return null;
  const template = type.templates?.[Number(at[1])];
  const name = template?.name?.trim() ? `${template.name} on ${type.label}` : type.label;
  if (at[2] === '.name')
    return `${name}: a template's name is 1 to ${CARD_TEMPLATE_NAME_MAX} characters, unique in its type.`;
  if (at[2] === '.fields')
    return (
      `${name}: a value breaks a card’s rule (a title up to ${ITEM_TITLE_MAX} characters, a description up to ` +
      `${ITEM_DESCRIPTION_MAX.toLocaleString('en-GB')}, up to ${ITEM_LABELS_MAX} labels and ${ITEM_CHECKLIST_MAX} checklist rows).`
    );
  if (at[2] === '.id') return `${name}: two templates have one id.`;
  return `${name} holds more than 16 KB: shorten it.`;
}

// `type` with the change's template edits made, its list checked as the api checks it.
export function withTemplateChanges(
  type: ItemTypeDef,
  change: TemplateChanges,
  naming: TemplateNaming,
): ItemTypeDef {
  const adds = [...(change.templates ?? []), ...(change.addTemplates ?? [])];
  const edits = change.editTemplates ?? [];
  const removes = change.removeTemplates ?? [];
  if (!adds.length && !edits.length && !removes.length) return type;
  const must = (name: string, list: readonly CardTemplate[]) => {
    const found = templateOf({ ...type, templates: [...list] }, name);
    if (!found.ok) throw new Refused(found);
    return found.template;
  };
  let list: CardTemplate[] = [...(type.templates ?? [])];
  for (const name of removes) {
    const gone = must(name, list);
    list = list.filter((t) => t.id !== gone.id);
  }
  for (const edit of edits) {
    const was = must(edit.template, list);
    const where = `${was.name} on ${type.label}`;
    const values = edit.fields
      ? valuesOf(edit.fields, type, naming, where, was.fields)
      : { set: {}, clear: [] };
    const next: ItemFields = { ...was.fields };
    for (const key of values.clear) delete next[key];
    Object.assign(next, values.set);
    for (const raw of edit.clear ?? []) {
      const named = fieldKeyOf(raw, type);
      if (!named.ok) throw new Refused({ code: named.code, message: `${where}: ${named.message}` });
      delete next[named.key];
      delete next[richFieldOf(named.key)];
    }
    const renamed = edit.name === undefined ? was : { ...was, name: edit.name.trim() };
    list = list.map((t) => (t.id === was.id ? { ...renamed, fields: next } : t));
  }
  for (const input of adds) {
    const name = input.name.trim();
    const where = `${name || 'A new template'} on ${type.label}`;
    const { set } = input.fields ? valuesOf(input.fields, type, naming, where) : { set: {} };
    const id = newCardTemplateId(
      name,
      list.map((t) => t.id),
    );
    list = [...list, { id, name, fields: set }];
  }
  const next: ItemTypeDef = { ...type, templates: list };
  const read = readCardTemplates(list, next, 'types[0]', 'refuse');
  if (typeof read === 'string') throw invalid(templateProblem(next, read)!);
  if (read.length) return { ...type, templates: read };
  const { templates: _none, ...rest } = type;
  return rest;
}
