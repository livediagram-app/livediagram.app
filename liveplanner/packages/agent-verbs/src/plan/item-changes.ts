// Adding, changing, moving and deleting items by name (docs/specs/026-plan/plan-agents.md "Naming things as people
// do"): each change resolved against the plan (column names, card types, custom fields, people, item numbers) and
// written through the item store's routes, in order, each seeing the ones before it. A refusal stops the batch and
// says what was applied before it. Shared by the MCP's change_items and the CLI's item verbs.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import type { ItemResponse } from '@liveplanner/api-schema';
import {
  assignedPeople,
  boardShowsType,
  descriptionFromMarkdown,
  DESCRIPTION_RICH_FIELD,
  isItemPerson,
  itemStatus,
  itemSummary,
  resolveFields,
  calculatedWritten,
  resolveItem,
  resolveStatus,
  resolveType,
  fieldKeyOf,
  missingRequiredFields,
  requiredCleared,
  requiredFieldsMessage,
  typeIn,
  type Item,
  type ItemFields,
  type ItemTypeDef,
  type Named,
} from '@liveplanner/items';
import { apiRefusalOf } from './api-refusal';
import { itemsPath } from '../verbs/shared';
import type { PlanState } from './plan-state';

export type ItemChange =
  | {
      op: 'add';
      title: string;
      type?: string;
      status?: string;
      fields?: Readonly<Record<string, unknown>>;
    }
  | {
      op: 'set';
      item: string;
      fields?: Readonly<Record<string, unknown>>;
      clear?: readonly string[];
      type?: string;
    }
  | { op: 'move'; item: string; status: string; before?: string }
  | { op: 'delete'; item: string };

interface ItemChangesResult {
  applied: string[];
  // The items as they stand after the changes, for a caller that answers them.
  touched: Item[];
  refusal?: { code: string; message: string };
}

class Stop extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// A required custom field left empty (docs/specs/026-plan/item-types.md "Required fields"), stopped before the api
// sees it so the refusal names the type and every field.
function requiredStop(type: ItemTypeDef, missing: readonly { label: string }[]): Stop {
  return new Stop(
    'field_required',
    `${requiredFieldsMessage(type, missing)}: give ${missing.length === 1 ? 'it' : 'them'} in fields, by name. ` +
      'list_items marks each required field (required: true).',
  );
}

function must<T extends object>(named: Named<T>): T {
  if (!named.ok) throw new Stop(named.code, named.message);
  return named;
}

// Where a card shows, as its line says it: "in In Progress", "(on no board)", or a warning when the boards with its
// column all leave its card type out, so a write never reads as done when no board shows the card.
function placeOf(item: Item, state: PlanState): string {
  const status = itemStatus(item);
  if (!status) return ' (on no board)';
  const column = state.plan.statuses.find((s) => s.status === status)?.name;
  if (!column) return ' (on no board)';
  const boards = state.plan.boards.filter(
    (b) => b.kind === 'board' && b.columns.some((c) => c.status === status),
  );
  const shown = boards.some((b) =>
    boardShowsType({ addTypes: b.types ?? undefined }, item.type, state.plan.types),
  );
  if (shown) return ` in ${column}`;
  const type = state.plan.types.find((t) => t.id === item.type)?.label ?? item.type;
  return (
    ` in ${column}, but no board with that column takes ${type} cards, so none shows it: ` +
    `add ${type} to ${boards.map((b) => `"${b.title}"`).join(' or ')} with change_board`
  );
}

// "#3 [task] Fix login in In Progress", then what a set changed and any note.
function line(prefix: string, item: Item, state: PlanState, notes: readonly string[] = []): string {
  return `${prefix} ${itemSummary(item)}${placeOf(item, state)}${notes.map((n) => `; ${n}`).join('')}`;
}

// A note for an assignee given by a name nobody on the project has: a name only, not linked to an account.
function personNote(fields: Readonly<Record<string, unknown>>, items: readonly Item[]): string[] {
  const p = fields['assignee'];
  if (!isItemPerson(p) || !p.id.startsWith('n-')) return [];
  if (assignedPeople(items).some((x) => x.id === p.id)) return [];
  return [`${p.name} is a new name on this plan, not linked to anyone's account`];
}

// The most of a value a set line repeats.
const SET_VALUE_MAX = 40;

// A value as a set line reads it back: what was stored, so a value that landed other than meant shows ("Rating =
// ★"). A card link by its number, a person by name, a list by its length.
function storedText(value: unknown, items: readonly Item[]): string {
  if (isItemPerson(value)) return value.name;
  if (Array.isArray(value)) return `${value.length} entr${value.length === 1 ? 'y' : 'ies'}`;
  if (typeof value === 'string') {
    const linked = items.find((i) => i.id === value);
    if (linked) return `#${linked.key}`;
    return JSON.stringify(cut(value.split('\n')[0]!));
  }
  // A number or flag as written; anything else as its JSON, cut.
  return cut(String(JSON.stringify(value)));
}

// A description as an agent writes it is Markdown: stored as its plain text and its formatting. Text with nothing
// marked drops formatting the card had, so the panel never shows an old description over the new one.
function withDescription(
  fields: Record<string, unknown>,
  had: Readonly<Record<string, unknown>> = {},
): { set: Record<string, unknown>; clear: string[] } {
  const markdown = fields['description'];
  if (typeof markdown !== 'string') return { set: fields, clear: [] };
  const { plain, runs } = descriptionFromMarkdown(markdown);
  if (runs)
    return { set: { ...fields, description: plain, [DESCRIPTION_RICH_FIELD]: runs }, clear: [] };
  return {
    set: { ...fields, description: plain },
    clear: DESCRIPTION_RICH_FIELD in had ? [DESCRIPTION_RICH_FIELD] : [],
  };
}

const cut = (text: string) =>
  text.length > SET_VALUE_MAX ? `${text.slice(0, SET_VALUE_MAX - 1)}…` : text;

function setNote(
  written: Readonly<Record<string, unknown>>,
  cleared: readonly string[],
  type: ItemTypeDef,
  items: readonly Item[],
): string[] {
  const name = (key: string) => type.custom?.find((f) => f.id === key)?.label ?? key;
  // The formatting reads back as the description it belongs to.
  const set = Object.fromEntries(
    Object.entries(written).filter(([k]) => k !== DESCRIPTION_RICH_FIELD),
  );
  const clear = cleared.filter((k) => k !== DESCRIPTION_RICH_FIELD);
  const parts = [
    ...(Object.keys(set).length
      ? [
          `set ${Object.entries(set)
            .map(([k, v]) => `${name(k)} = ${storedText(v, items)}`)
            .join(', ')}`,
        ]
      : []),
    ...(clear.length ? [`cleared ${clear.map(name).join(', ')}`] : []),
  ];
  return parts.length ? [parts.join('; ')] : [];
}

export async function applyItemChanges(
  api: ApiClient,
  projectId: string,
  changes: readonly ItemChange[],
  state: PlanState,
): Promise<ItemChangesResult> {
  const base = itemsPath(projectId);
  const types = state.plan.types;
  let items = [...state.items];
  const applied: string[] = [];
  const touched = new Map<string, Item>();
  const keep = (item: Item) => {
    items = [...items.filter((i) => i.id !== item.id), item];
    touched.set(item.id, item);
  };
  const naming = () => ({ statuses: state.plan.statuses, items });
  const post = (path: string, body: unknown) =>
    api.json<ItemResponse>(path, { method: 'POST', body: JSON.stringify(body) });
  // A Calculated field is worked out, never given (docs/specs/026-plan/item-types.md "Calculated fields"): refused
  // before the write, by name.
  const fieldsFor = (input: Readonly<Record<string, unknown>> | undefined, type: ItemTypeDef) => {
    const fields = input ? must(resolveFields(input, type, naming())).fields : {};
    const calculated = calculatedWritten([type], { type: type.id, fields: fields as ItemFields });
    if (calculated) {
      // calculatedWritten names only a field the type has.
      const label = type.custom!.find((f) => f.id === calculated)!.label;
      throw new Stop(
        'field_calculated',
        `${label} is calculated: it can't be set. list_items lists its value, worked out from the cards linking here.`,
      );
    }
    return fields;
  };
  try {
    for (const c of changes) {
      if (c.op === 'add') {
        const type = must(resolveType(c.type ?? 'task', types)).type;
        const fields = withDescription(fieldsFor(c.fields, type)).set;
        const status = c.status
          ? must(resolveStatus(c.status, state.plan.statuses)).status
          : undefined;
        const missing = missingRequiredFields(type, fields as ItemFields);
        if (missing.length) throw requiredStop(type, missing);
        const { item } = await post(base, {
          type: type.id,
          fields: { ...fields, title: c.title },
          ...(status ? { place: { status } } : {}),
        });
        const notes = personNote(fields, items);
        keep(item);
        applied.push(line('+', item, state, notes));
      } else if (c.op === 'set') {
        const target = must(resolveItem(c.item, items)).item;
        const type = c.type ? must(resolveType(c.type, types)).type : typeIn(types, target.type);
        const described = withDescription(fieldsFor(c.fields, type), target.fields);
        const set = described.set;
        // A value a removed field left on the card is cleared by its key, though the type no longer has it.
        const named = (c.clear ?? []).map((k) =>
          k in target.fields && !fieldKeyOf(k, type).ok ? k : must(fieldKeyOf(k, type)).key,
        );
        // Clearing the description clears its formatting with it.
        const clear = [
          ...named,
          ...described.clear,
          ...(named.includes('description') && DESCRIPTION_RICH_FIELD in target.fields
            ? [DESCRIPTION_RICH_FIELD]
            : []),
        ];
        const after: Record<string, (typeof target.fields)[string]> = {
          ...target.fields,
          ...(set as typeof target.fields),
        };
        for (const k of clear) delete after[k];
        const emptied = requiredCleared(type, target.fields, after);
        if (emptied)
          throw new Stop(
            'field_required',
            `${emptied.label} is required on ${type.label} cards: it can be changed, not emptied.`,
          );
        const { item } = await post(`${base}/${encodeURIComponent(target.id)}`, {
          ...(Object.keys(set).length ? { set } : {}),
          ...(clear.length ? { clear } : {}),
          ...(c.type ? { type: type.id } : {}),
        });
        const notes = [...setNote(set, clear, type, items), ...personNote(set, items)];
        keep(item);
        applied.push(line('~', item, state, notes));
      } else if (c.op === 'move') {
        const target = must(resolveItem(c.item, items)).item;
        const status = must(resolveStatus(c.status, state.plan.statuses)).status;
        const before = c.before ? must(resolveItem(c.before, items)).item.id : null;
        const { item } = await post(`${base}/${encodeURIComponent(target.id)}/move`, {
          status,
          before,
        });
        keep(item);
        applied.push(line('→', item, state));
      } else {
        const target = must(resolveItem(c.item, items)).item;
        const res = await api.fetch(`${base}/${encodeURIComponent(target.id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        items = items.filter((i) => i.id !== target.id);
        touched.delete(target.id);
        applied.push(`- ${itemSummary(target)}`);
      }
    }
  } catch (err) {
    const refusal =
      err instanceof Stop ? { code: err.code, message: err.message } : apiRefusalOf(err);
    // An api failure after some changes landed still says which: a retry of the whole batch would
    // otherwise make them twice. Before any landed, it is thrown as ever.
    if (!refusal && applied.length === 0) throw err;
    return {
      applied,
      touched: [...touched.values()],
      refusal: refusal ?? {
        code: 'api_error',
        message: 'The api failed part way; the changes after these were not made.',
      },
    };
  }
  return { applied, touched: [...touched.values()] };
}
