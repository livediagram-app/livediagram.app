// Card templates (docs/specs/026-plan/item-types.md "Card templates"): named sets of starting values a card type
// holds, so a new card of that type starts filled in. Stored on the type (`ItemTypeDef.templates`), inside the
// catalogue, and read here against the type's fields: a value for a field the type no longer offers is dropped, and
// every value passes the check a card's field does.
import type { ItemFields } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { fieldsByteSize, validateFields } from './fields';
import { isNewerField } from './newer-fields';
import { DESCRIPTION_RICH_FIELD, isRichFieldKey } from './rich-text-field';
import { cutSlug, slugText, uniqueSlug } from './slug';
import { CARD_TEMPLATE_KEYS, newerKeysOf } from './stored-keys';
import { isObj } from './validate';

export interface CardTemplate {
  // `tp-` and a slug of its first name, unique in its type; never changes, so agents name it whatever it is renamed to.
  id: string;
  // 1 to CARD_TEMPLATE_NAME_MAX characters, unique in its type ignoring case.
  name: string;
  // Its starting values, by field id, each as a card stores it.
  fields: ItemFields;
}

export const CARD_TEMPLATES_MAX = 10;
export const CARD_TEMPLATE_NAME_MAX = 32;
export const CARD_TEMPLATE_ID_PATTERN = /^tp-[a-z0-9-]{1,29}$/;
// Every template a catalogue holds, as JSON, counted apart from the catalogue's own 32 KB so templates never crowd out
// types.
export const CARD_TEMPLATES_BYTES = 131_072;
// One template's values: 16 KB, what a card held before its fields grew to fit a long Long Text (Work Tracker 944), so
// ten templates still fit CARD_TEMPLATES_BYTES and a template stays a starting point.
export const CARD_TEMPLATE_BYTES = 16_384;

// What a read does with a value a template never holds (a status, a Calculated field's...): the api, the newest build,
// refuses it; every other reader keeps it as stored (a newer build may take it), and cardTemplateFields never uses it.
export type CardTemplateMode = 'keep' | 'refuse';

// The built-in fields a template sets: the title and the long-form ones a team fills the same way every time.
const TEMPLATE_BUILT_INS = new Set([
  'title',
  'description',
  DESCRIPTION_RICH_FIELD,
  'checklist',
  'labels',
]);
// Custom field kinds whose values only the plan or its people make, or that point into one plan.
const NEVER_KINDS = new Set(['calculated', 'comments', 'votes', 'card', 'image']);

type TypeFields = Pick<ItemTypeDef, 'fields' | 'custom'>;

// The field a key belongs to: a Rich key's field (`f-stepsRich` → `f-steps`), else the key itself.
const fieldOfKey = (key: string): string => (isRichFieldKey(key) ? key.slice(0, -4) : key);

const customOf = (type: TypeFields, id: string): CustomFieldDef | undefined =>
  type.custom?.find((f) => f.id === id);

// Whether a template may hold a value under `key` for this type.
export function templateTakes(type: TypeFields, key: string): boolean {
  if (TEMPLATE_BUILT_INS.has(key)) return true;
  const field = customOf(type, fieldOfKey(key));
  if (!field || isNewerField(field)) return false;
  if (isRichFieldKey(key)) return field.kind === 'longtext';
  return !NEVER_KINDS.has(field.kind) && field.timeSpent !== true;
}

// A new template's id: `tp-` and a slug of its name, unique among `taken`.
export function newCardTemplateId(name: string, taken: Iterable<string>): string {
  return uniqueSlug(`tp-${cutSlug(slugText(name), 29) || 'template'}`, new Set(taken), 32);
}

// One template's values read against its type: keys of fields the type no longer offers dropped, a blank title
// dropped (the card takes its type's new-card title), and in 'keep' mode a value a template never holds kept only
// while it is one a card could hold. Null when what is left fails the card check.
function readValues(
  input: Record<string, unknown>,
  type: TypeFields,
  mode: CardTemplateMode,
): ItemFields | null {
  const offered = new Set(type.fields);
  const taken: Record<string, unknown> = {};
  const kept: ItemFields = {};
  for (const [key, value] of Object.entries(input)) {
    if (!offered.has(fieldOfKey(key)) || value === undefined) continue;
    if (key === 'title' && typeof value === 'string' && !value.trim()) continue;
    if (templateTakes(type, key)) {
      taken[key] = value;
      continue;
    }
    if (mode === 'refuse') return null;
    const one = validateFields({ [key]: value }, 'patch');
    if (one.ok) Object.assign(kept, one.fields);
  }
  const checked = validateFields(taken, 'patch');
  return checked.ok ? { ...checked.fields, ...kept } : null;
}

// A type's templates as stored (`at` is the type's place, `types[i]`): the list, or the reason it is refused.
export function readCardTemplates(
  input: unknown,
  type: TypeFields,
  at: string,
  mode: CardTemplateMode,
): CardTemplate[] | string {
  if (!Array.isArray(input) || input.length > CARD_TEMPLATES_MAX) return `${at}.templates`;
  const out: CardTemplate[] = [];
  for (const [j, t] of input.entries()) {
    const here = `${at}.templates[${j}]`;
    if (!isObj(t)) return here;
    const id = t['id'];
    if (
      typeof id !== 'string' ||
      !CARD_TEMPLATE_ID_PATTERN.test(id) ||
      out.some((x) => x.id === id)
    )
      return `${here}.id`;
    const name = typeof t['name'] === 'string' ? t['name'].trim() : '';
    if (
      !name ||
      name.length > CARD_TEMPLATE_NAME_MAX ||
      out.some((x) => x.name.toLowerCase() === name.toLowerCase())
    )
      return `${here}.name`;
    const fieldsIn = t['fields'] ?? {};
    if (!isObj(fieldsIn)) return `${here}.fields`;
    const fields = readValues(fieldsIn, type, mode);
    if (!fields) return `${here}.fields`;
    if (fieldsByteSize(fields) > CARD_TEMPLATE_BYTES) return here;
    out.push({ id, name, fields, ...(mode === 'keep' ? newerKeysOf(t, CARD_TEMPLATE_KEYS) : {}) });
  }
  return out;
}

// The values a card started from `template` takes: those the template holds for fields its type offers now, of kinds
// a template sets. Its status, place and number come from where the card is made.
export function cardTemplateFields(type: TypeFields, template: CardTemplate): ItemFields {
  const offered = new Set(type.fields);
  const out: ItemFields = {};
  for (const [key, value] of Object.entries(template.fields)) {
    if (offered.has(fieldOfKey(key)) && templateTakes(type, key)) out[key] = value;
  }
  return out;
}

// The JSON size of every template the types hold, against CARD_TEMPLATES_BYTES.
export function cardTemplatesBytes(types: readonly Pick<ItemTypeDef, 'templates'>[]): number {
  const encoder = new TextEncoder();
  let bytes = 0;
  for (const t of types)
    if (t.templates?.length) bytes += encoder.encode(JSON.stringify(t.templates)).length;
  return bytes;
}

// A type without its templates: what the catalogue's own 32 KB counts.
export function withoutTemplates<T extends Pick<ItemTypeDef, 'templates'>>(type: T): T {
  if (type.templates === undefined) return type;
  const { templates: _templates, ...rest } = type;
  return rest as T;
}
