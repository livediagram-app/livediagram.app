// The type editor's layout draft (docs/specs/026-plan/item-types.md "Editing a type"): the type's fields,
// its custom fields and its panel tabs, edited as one draft so a field's removal also leaves its tab.
// Fields are shown grouped by where they show: On the Card (Title, Votes), Details (the panel's side
// column) and each tab. A field moves within its group, or to another group. A tab left with no fields
// is dropped when the type is saved (withoutEmptyTabs), Overview aside.
import {
  OVERVIEW_TAB_ID,
  REQUIRED_TYPE_FIELDS,
  newTabId,
  type CustomFieldDef,
  type ItemTypeTab,
} from '@livediagram/items';

// The fields a tab can hold: never the title (it heads the panel) or votes (they live on the card).
export const NOT_TABBABLE = new Set(['title', 'votes']);

export type LayoutDraft = { fields: string[]; custom: CustomFieldDef[]; tabs: ItemTypeTab[] };

// Where a field shows: Details is `null`, a tab its id.
export type GroupId = string | null;

const isRequired = (f: string) => (REQUIRED_TYPE_FIELDS as readonly string[]).includes(f);

// The type's fields, Title and Status first.
export function orderedFields(fields: readonly string[]): string[] {
  return [...REQUIRED_TYPE_FIELDS, ...fields.filter((f) => !isRequired(f))];
}

// The fields on the card alone: Title, and Votes when the type has it.
export function cardFields(d: LayoutDraft): string[] {
  return orderedFields(d.fields).filter((f) => NOT_TABBABLE.has(f));
}

// The fields Details shows: every tabbable field in no tab, in the type's order.
export function detailFields(d: LayoutDraft): string[] {
  const tabbed = new Set(d.tabs.flatMap((t) => t.fields));
  return orderedFields(d.fields).filter((f) => !NOT_TABBABLE.has(f) && !tabbed.has(f));
}

export function groupFields(d: LayoutDraft, group: GroupId): readonly string[] {
  if (group === null) return detailFields(d);
  return d.tabs.find((t) => t.id === group)?.fields ?? [];
}

// A group's fields that move: all but Title and Status.
export function movableIn(d: LayoutDraft, group: GroupId): string[] {
  return groupFields(d, group).filter((f) => !isRequired(f));
}

const swap = (list: readonly string[], a: string, b: string) =>
  list.map((f) => (f === a ? b : f === b ? a : f));

// A field moved one place within its group, past its movable neighbour; stops at the ends.
export function moveField(d: LayoutDraft, group: GroupId, field: string, by: -1 | 1): LayoutDraft {
  const list = movableIn(d, group);
  const other = list[list.indexOf(field) + by];
  if (!list.includes(field) || !other) return d;
  if (group === null) return { ...d, fields: swap(orderedFields(d.fields), field, other) };
  return {
    ...d,
    tabs: d.tabs.map((t) => (t.id === group ? { ...t, fields: swap(t.fields, field, other) } : t)),
  };
}

// A field filed under a tab (or Details, `null`): taken out of every tab, then added to the chosen one.
export function fileField(
  tabs: readonly ItemTypeTab[],
  field: string,
  tabId: GroupId,
): ItemTypeTab[] {
  return tabs.map((t) => {
    const fields = t.fields.filter((f) => f !== field);
    return { ...t, fields: t.id === tabId ? [...fields, field] : fields };
  });
}

// A field (built in, or a new custom one) added at the end, filed under the group it was added in.
export function addField(
  d: LayoutDraft,
  field: string,
  group: GroupId,
  custom?: CustomFieldDef,
): LayoutDraft {
  return {
    fields: [...orderedFields(d.fields), field],
    custom: custom ? [...d.custom, custom] : d.custom,
    tabs: group === null || NOT_TABBABLE.has(field) ? d.tabs : fileField(d.tabs, field, group),
  };
}

// A field taken off the type: out of its fields, its custom fields and every tab.
export function removeField(d: LayoutDraft, field: string): LayoutDraft {
  return {
    fields: orderedFields(d.fields).filter((f) => f !== field),
    custom: d.custom.filter((f) => f.id !== field),
    tabs: fileField(d.tabs, field, null),
  };
}

export function moveTab(tabs: readonly ItemTypeTab[], i: number, delta: -1 | 1): ItemTypeTab[] {
  const j = i + delta;
  if (j < 0 || j >= tabs.length) return [...tabs];
  const next = [...tabs];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

// A new, unnamed tab at the end; it is named in place.
export function addTab(tabs: readonly ItemTypeTab[]): ItemTypeTab[] {
  const id = newTabId(
    'tab',
    tabs.map((t) => t.id),
  );
  return [...tabs, { id, label: '', fields: [] }];
}

// Overview is kept, like Details: renamed, never removed (docs/specs/026-plan/item-types.md "Tabs").
export const isKeptTab = (t: ItemTypeTab) => t.id === OVERVIEW_TAB_ID;

// What is saved: the tabs that hold a field, and Overview.
export function withoutEmptyTabs(tabs: readonly ItemTypeTab[]): ItemTypeTab[] {
  return tabs.filter((t) => t.fields.length > 0 || isKeptTab(t));
}
