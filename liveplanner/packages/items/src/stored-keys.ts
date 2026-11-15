// The keys a card type, a panel tab, a custom field and a card template are stored with (docs/specs/026-plan/item-types.md "Settings
// from a newer version"), and the keys a reader keeps that it does not know. Each list is typed to name every key of
// its shape, no more and no less, so adding a key to ItemTypeDef, ItemTypeTab or CustomFieldDef fails the typecheck
// until it is listed here, and listing it fails the project format guard (api-schema project-format.test.ts) until
// PROJECT_FORMAT is bumped. Depends on item-types.ts alone.
import type { CardTemplate } from './card-templates';
import type { CustomFieldDef, ItemTypeDef, ItemTypeTab } from './item-types';
import { isObj } from './validate';

type KeysOf<T> = { readonly [K in keyof Required<T>]: true };

const TYPE_KEYS = {
  id: true,
  label: true,
  newTitle: true,
  glyph: true,
  color: true,
  fields: true,
  custom: true,
  detailsLabel: true,
  detailsGlyph: true,
  tabs: true,
  statuses: true,
  excludedStatuses: true,
  defaultStatus: true,
  display: true,
  assigneeNotifies: true,
  fieldLabels: true,
  colourField: true,
  inherits: true,
  ownFields: true,
  templates: true,
} as const satisfies KeysOf<ItemTypeDef>;

const TAB_KEYS = {
  id: true,
  label: true,
  fields: true,
  glyph: true,
} as const satisfies KeysOf<ItemTypeTab>;

// A card template's keys (docs/specs/026-plan/item-types.md "Card templates").
const TEMPLATE_KEYS = {
  id: true,
  name: true,
  fields: true,
} as const satisfies KeysOf<CardTemplate>;

const FIELD_KEYS = {
  id: true,
  label: true,
  kind: true,
  options: true,
  scale: true,
  linkType: true,
  linkTypes: true,
  currency: true,
  calculation: true,
  formula: true,
  result: true,
  through: true,
  aggregate: true,
  source: true,
  showAs: true,
  timeSpent: true,
  withTime: true,
  onCard: true,
  required: true,
  notifies: true,
  multiple: true,
  blocks: true,
} as const satisfies KeysOf<CustomFieldDef>;

export const ITEM_TYPE_KEYS: readonly string[] = Object.keys(TYPE_KEYS);
export const ITEM_TYPE_TAB_KEYS: readonly string[] = Object.keys(TAB_KEYS);
export const CUSTOM_FIELD_KEYS: readonly string[] = Object.keys(FIELD_KEYS);
export const CARD_TEMPLATE_KEYS: readonly string[] = Object.keys(TEMPLATE_KEYS);

// The most one type's, tab's or field's unknown keys may hold as JSON: far above any setting liveplanner stores, well
// inside the catalogue's own 32 KB. Past it they are dropped, never refused.
export const NEWER_KEYS_MAX_BYTES = 4096;

// The keys of `input` not in `known`, as stored, for a reader to keep: none for a non-object, and none when they would
// pass NEWER_KEYS_MAX_BYTES or cannot be copied.
export function newerKeysOf(input: unknown, known: readonly string[]): Record<string, unknown> {
  if (!isObj(input)) return {};
  const out: Record<string, unknown> = {};
  let any = false;
  for (const [k, v] of Object.entries(input)) {
    if (known.includes(k) || v === undefined) continue;
    out[k] = v;
    any = true;
  }
  if (!any) return {};
  let json: string;
  try {
    json = JSON.stringify(out);
  } catch {
    return {};
  }
  if (new TextEncoder().encode(json).length > NEWER_KEYS_MAX_BYTES) return {};
  return JSON.parse(json) as Record<string, unknown>;
}
