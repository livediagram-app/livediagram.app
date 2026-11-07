// What a Community post's link may see of a plan, and what a copy taken through it carries
// (docs/specs/025-community/community.md "Viewing a post's plan"): the plan's content, never its conversation or
// the people working on it. Every read the link may make (the plan, a tab, the cards, the sheets, the card image and
// each tab's image) and the copy apply these same rules, so what a stranger sees and what they take are one thing.
//
// - A tab: comment threads, cell comments, assigned actions and votes go as every app's do
//   (@liveworkspace/community/app redactTabForCommunity), and a Participant's adder key (`addedBy`) with them.
// - A card: who it is assigned to, every People field (any value that is a person or a list of people), its votes
//   (built-in and a type's own Votes fields), its comment thread and comment count, and who made and last changed it
//   (one neutral person). A Time Spent field keeps its entries' minutes and loses who tracked them.
// - A form's response card keeps its title (and the column it sits in) only: every answer it carries goes.
// - A sheet: who last changed it, and a sheet a form sends its responses to keeps its heading row only.
//
// Pure, so the reads, the copy and the drawing apply the same rule. Never mutates what it is given.

import { redactTabForCommunity } from '@liveworkspace/community/app';
import { FROM_FORM_FIELD, type FormDefinition } from '@liveplanner/forms';
import {
  customFieldOf,
  isItemPerson,
  typeIn,
  typesOf,
  type Item,
  type ItemFields,
  type ItemFieldValue,
  type ItemPerson,
  type ItemTypeCatalogue,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { SheetJson } from '@liveplanner/sheets';

// Who made and last changed every card and sheet a stranger sees: nobody in particular.
export const COMMUNITY_PERSON: ItemPerson = { id: '', name: 'Someone', color: '#94a3b8' };

// The built-in fields that hold people, votes or a conversation.
const PEOPLE_FIELDS = new Set(['assignee', 'votes', 'comments']);
// The custom field kinds that do (docs/specs/026-plan/item-types.md "Custom field kinds").
const PEOPLE_KINDS = new Set(['person', 'votes', 'comments']);
// The fields a form's response card keeps (docs/specs/030-forms/forms.md "What a response makes"): its title, and the
// status that puts it in its column. Every other field is an answer.
const RESPONSE_KEEPS = ['title', 'status'] as const;
// A response card's maker, as the form names it (forms/respond.ts formPerson).
const FORM_PERSON_PREFIX = 'form:';

// A person, or a list holding one: a People field's value whatever field it sits in.
function holdsPeople(value: ItemFieldValue): boolean {
  if (isItemPerson(value)) return true;
  return Array.isArray(value) && value.some((v) => isItemPerson(v));
}

type TimeValueLike = { people: unknown; entries: { by: string }[]; running: unknown };

// A Time Spent value (@liveplanner/items time-tracking.ts): `{ people, entries, running }`.
function isTimeValue(value: ItemFieldValue): value is ItemFieldValue & TimeValueLike {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['people'] === 'object' && Array.isArray(v['entries']) && Array.isArray(v['running'])
  );
}

// The minutes stay, and who tracked them goes: one neutral id per person, per field, nothing running.
function anonymiseTime(value: TimeValueLike): ItemFieldValue {
  const ids = new Map<string, string>();
  const neutral = (by: string) => {
    if (!ids.has(by)) ids.set(by, `p${ids.size + 1}`);
    return ids.get(by)!;
  };
  return {
    people: {},
    entries: value.entries.map((e) => ({ ...e, by: neutral(e.by) })),
    running: [],
  };
}

// A form's response card (forms/respond.ts): made by the form, or carrying the response it came from.
export function isResponseCard(item: Pick<Item, 'fields' | 'createdBy'>): boolean {
  return (
    item.fields[FROM_FORM_FIELD] !== undefined ||
    (typeof item.createdBy?.id === 'string' && item.createdBy.id.startsWith(FORM_PERSON_PREFIX))
  );
}

function fieldsForCommunity(item: Item, type: ItemTypeDef): ItemFields {
  if (isResponseCard(item)) {
    const kept: ItemFields = {};
    for (const f of RESPONSE_KEEPS) if (item.fields[f] !== undefined) kept[f] = item.fields[f];
    return kept;
  }
  const out: ItemFields = {};
  for (const [id, value] of Object.entries(item.fields)) {
    if (PEOPLE_FIELDS.has(id)) continue;
    const kind = customFieldOf(type, id)?.kind;
    if (kind && PEOPLE_KINDS.has(kind)) continue;
    if (holdsPeople(value)) continue;
    out[id] = isTimeValue(value) ? anonymiseTime(value) : value;
  }
  return out;
}

// One card as a stranger sees it, against the plan's card types.
// A D1 text column read off an untyped row, or the fallback when it is null or not text.
const textOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

export function redactItemForCommunity(item: Item, types: readonly ItemTypeDef[]): Item {
  const { openComments: _count, ...rest } = item;
  return {
    ...rest,
    fields: fieldsForCommunity(item, typeIn(types, item.type)),
    createdBy: COMMUNITY_PERSON,
    updatedBy: COMMUNITY_PERSON,
  };
}

export function redactItemsForCommunity(
  items: readonly Item[],
  catalogue: ItemTypeCatalogue | null | undefined,
): Item[] {
  const types = typesOf(catalogue);
  return items.map((item) => redactItemForCommunity(item, types));
}

// A stored card row, as a copy carries it (plan-content.ts exportPlanCopy): `fields`, `created_by` and `updated_by`
// are its JSON. A row whose fields do not parse is carried with none rather than unredacted.
export function redactItemRowForCommunity(
  row: Record<string, unknown>,
  types: readonly ItemTypeDef[],
): Record<string, unknown> {
  let fields: ItemFields = {};
  let createdBy: ItemPerson = COMMUNITY_PERSON;
  try {
    const parsed: unknown = JSON.parse(textOr(row['fields'], '{}'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      fields = parsed as ItemFields;
    const by: unknown = JSON.parse(textOr(row['created_by'], 'null'));
    if (isItemPerson(by)) createdBy = by;
  } catch {
    fields = {};
  }
  const item = { type: textOr(row['type'], ''), fields, createdBy } as Item;
  const person = JSON.stringify(COMMUNITY_PERSON);
  return {
    ...row,
    fields: JSON.stringify(fieldsForCommunity(item, typeIn(types, item.type))),
    created_by: person,
    updated_by: person,
  };
}

type TabLike = {
  elements?: object[];
  vote?: { votes?: Record<string, string[]>; startedBy?: string };
};

// A tab as a stranger sees it: every app's rule, and no Participant's adder key.
export function redactPlanTabForCommunity<T extends TabLike>(tab: T): T {
  const out = redactTabForCommunity(tab);
  if (!Array.isArray(out.elements)) return out;
  return {
    ...out,
    elements: out.elements.map((el) => {
      if (!('addedBy' in el)) return el;
      const { addedBy: _adder, ...rest } = el as { addedBy?: unknown };
      return rest;
    }),
  };
}

// The same over a tab's stored `data` JSON, for the copy. Data that does not parse, or has no elements, is copied
// as an empty tab rather than unredacted. A Form tab's form stays: its questions are the plan's content, its link and
// its responses are not in it.
export function redactPlanTabDataForCommunity(data: string): string {
  try {
    const parsed = JSON.parse(data) as TabLike;
    if (!Array.isArray(parsed.elements)) return JSON.stringify({ ...parsed, elements: [] });
    return JSON.stringify(redactPlanTabForCommunity(parsed));
  } catch {
    return JSON.stringify({ elements: [] });
  }
}

// The sheets the plan's forms send their responses to (a Form tab's `form.sheet`), by id.
export function responseSheetIds(tabs: readonly { data?: string; form?: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const tab of tabs) {
    let form: Partial<FormDefinition> | null = null;
    if (tab.form && typeof tab.form === 'object') form = tab.form;
    else if (typeof tab.data === 'string' && tab.data.includes('"form"')) {
      try {
        const parsed = JSON.parse(tab.data) as { form?: unknown };
        if (parsed.form && typeof parsed.form === 'object') form = parsed.form;
      } catch {
        form = null;
      }
    }
    const sheetId = form?.sheet?.sheetId;
    if (typeof sheetId === 'string') ids.add(sheetId);
  }
  return ids;
}

// A sheet as a stranger sees it: nobody named as its last writer, and a form's response sheet with its heading row
// alone (its first row), every response below it gone.
export function redactSheetForCommunity(
  sheet: SheetJson,
  responseSheets: ReadonlySet<string>,
): SheetJson {
  const out: SheetJson = { ...sheet, updatedBy: COMMUNITY_PERSON };
  if (!responseSheets.has(sheet.id)) return out;
  const heading = sheet.layout.rows[0];
  return { ...out, cells: sheet.cells.filter((c) => c.r === heading) };
}

// A response sheet's cell rows, as a copy carries them (`sheet_cells`): the heading row's alone.
export function redactSheetCellRowsForCommunity(
  cells: readonly Record<string, unknown>[],
  sheets: readonly Record<string, unknown>[],
  responseSheets: ReadonlySet<string>,
): Record<string, unknown>[] {
  if (responseSheets.size === 0) return [...cells];
  const heading = new Map<string, string | undefined>();
  for (const s of sheets) {
    const id = String(s['id']);
    if (!responseSheets.has(id)) continue;
    try {
      const layout = JSON.parse(textOr(s['layout'], '{}')) as { rows?: string[] };
      heading.set(id, layout.rows?.[0]);
    } catch {
      heading.set(id, undefined);
    }
  }
  return cells.filter((c) => {
    const sheetId = String(c['sheet_id']);
    if (!heading.has(sheetId)) return true;
    return c['row_id'] === heading.get(sheetId);
  });
}
