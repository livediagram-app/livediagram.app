// The card type an import's cards are (docs/specs/026-plan/tracker-import.md "The card type"): one per source, its
// fields the built-ins the file fills and a custom field per extra, its statuses the board's columns. A plan that
// already has the type keeps it, gaining the fields and statuses it lacks, so a second import reuses it.
import type { ItemFieldId } from '../item-types';
import type { CustomFieldDef, ItemTypeDef } from '../item-types';
import { ITEM_TYPE_CATALOGUE_VERSION, ITEM_TYPES_MAX, slugOf } from '../type-catalogue';
import { validateItemTypeCatalogue } from '../type-catalogue';
import { statusKey } from '../status-names';
import type { TrackerExtra, TrackerSource } from './tracker-model';
import { TRACKER_CHOICE_MAX } from './tracker-model';

export const TRACKER_TYPE_IDS: Readonly<Record<TrackerSource, string>> = {
  trello: 'trello-card',
  asana: 'asana-task',
  jira: 'jira-issue',
  linear: 'linear-issue',
};

export const TRACKER_TYPE_LABELS: Readonly<Record<TrackerSource, string>> = {
  trello: 'Trello Card',
  asana: 'Asana Task',
  jira: 'Jira Issue',
  linear: 'Linear Issue',
};

const LOOKS: Readonly<Record<TrackerSource, Pick<ItemTypeDef, 'glyph' | 'color' | 'newTitle'>>> = {
  trello: { glyph: 'kanban', color: '#2563eb', newTitle: 'New card' },
  asana: { glyph: 'checklist', color: '#db2777', newTitle: 'New task' },
  jira: { glyph: 'ticket', color: '#0891b2', newTitle: 'New issue' },
  linear: { glyph: 'target', color: '#7c3aed', newTitle: 'New issue' },
};

// The built-in fields an import may fill, in the order the type offers them; Title, Description and Status always,
// Comments always (people go on talking about imported cards).
export const TRACKER_FIELD_ORDER: readonly ItemFieldId[] = [
  'assignee',
  'priority',
  'estimate',
  'start',
  'due',
  'labels',
  'checklist',
];

function customField(extra: TrackerExtra, id: string): CustomFieldDef {
  return {
    id,
    label: extra.label,
    kind: extra.kind,
    ...(extra.kind === 'choice' ? { options: [...(extra.options ?? [])] } : {}),
    ...(extra.several ? { multiple: true } : {}),
  };
}

// A custom field id for `label` no field of the type has yet.
function freeFieldId(label: string, taken: Set<string>): string {
  const base = `f-${slugOf(label, 28) || 'field'}`;
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

export interface TrackerTypeResult {
  type: ItemTypeDef;
  // Whether the plan lacked it (a new type), else it is the plan's own, merged.
  isNew: boolean;
  // Each extra's custom field id on the type, by extra key; an extra whose field there is of another kind is absent.
  fieldOf: ReadonlyMap<string, CustomFieldDef>;
  // The custom fields the type gains, by id.
  newFields: ReadonlySet<string>;
  // Whether the catalogue can take it.
  fits: boolean;
}

// The type for `source`, from the built-ins `used`, the `extras` and the board's `statuses`, merged into the plan's
// own when `types` holds it.
export function trackerCardType(
  source: TrackerSource,
  used: ReadonlySet<ItemFieldId>,
  extras: readonly TrackerExtra[],
  statuses: readonly string[],
  types: readonly ItemTypeDef[],
): TrackerTypeResult {
  const id = TRACKER_TYPE_IDS[source];
  const existing = types.find((t) => t.id === id);
  const builtIns: string[] = [
    'title',
    'description',
    'status',
    ...TRACKER_FIELD_ORDER.filter((f) => used.has(f)),
    'comments',
  ];
  const base: ItemTypeDef = existing ?? {
    id,
    label: TRACKER_TYPE_LABELS[source],
    ...LOOKS[source],
    fields: [],
    custom: [],
    statuses: [],
  };
  const fields = [...base.fields];
  for (const f of builtIns) if (!fields.includes(f)) fields.push(f);
  const custom = [...(base.custom ?? [])];
  const taken = new Set(custom.map((c) => c.id));
  const fieldOf = new Map<string, CustomFieldDef>();
  const newFields = new Set<string>();
  for (const extra of extras) {
    const at = custom.findIndex((c) => statusKey(c.label) === statusKey(extra.label));
    if (at < 0) {
      const made = customField(extra, freeFieldId(extra.label, taken));
      custom.push(made);
      fields.push(made.id);
      fieldOf.set(extra.key, made);
      newFields.add(made.id);
      continue;
    }
    const own = custom[at]!;
    if (own.kind !== extra.kind) continue;
    // A Choice the plan has gains the options it lacks, as many as a Choice holds.
    if (own.kind === 'choice') {
      const options = [...(own.options ?? [])];
      for (const o of extra.options ?? [])
        if (!options.includes(o) && options.length < TRACKER_CHOICE_MAX) options.push(o);
      custom[at] = { ...own, options };
    }
    if (!fields.includes(own.id)) fields.push(own.id);
    fieldOf.set(extra.key, custom[at]!);
  }
  const ownStatuses = [...(base.statuses ?? [])];
  for (const s of statuses) if (!ownStatuses.includes(s)) ownStatuses.push(s);
  const type: ItemTypeDef = { ...base, fields, custom, statuses: ownStatuses };
  const others = types.filter((t) => t.id !== id);
  const fits =
    (!!existing || others.length < ITEM_TYPES_MAX) &&
    validateItemTypeCatalogue({
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: existing ? types.map((t) => (t.id === id ? type : t)) : [...types, type],
    }).ok;
  return { type, isNew: !existing, fieldOf, newFields, fits };
}
