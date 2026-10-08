// Adding, changing, moving and deleting items by name (docs/specs/026-plan/plan-agents.md "Naming things as people
// do"): each change resolved against the plan (column names, card types, custom fields, people, item numbers) and
// written through the item store's routes, in order, each seeing the ones before it. A refusal stops the batch and
// says what was applied before it. Shared by the MCP's change_items and the CLI's item verbs.
import { ApiError, type ApiClient } from '@livediagram/api-client';
import type { ItemResponse } from '@livediagram/api-schema';
import {
  assignedPeople,
  boardShowsType,
  isItemPerson,
  itemStatus,
  itemSummary,
  resolveFields,
  resolveItem,
  resolveStatus,
  resolveType,
  fieldKeyOf,
  typeIn,
  type Item,
  type ItemTypeDef,
  type Named,
} from '@livediagram/items';
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

export interface ItemChangesResult {
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

// A note for an assignee given by a name nobody on the document has: a name only, not linked to an account.
function personNote(fields: Readonly<Record<string, unknown>>, items: readonly Item[]): string[] {
  const p = fields['assignee'];
  if (!isItemPerson(p) || !p.id.startsWith('n-')) return [];
  if (assignedPeople(items).some((x) => x.id === p.id)) return [];
  return [`${p.name} is a new name on this document, not linked to anyone's account`];
}

const setNote = (set: Readonly<Record<string, unknown>>, clear: readonly string[]) => {
  const parts = [
    ...(Object.keys(set).length ? [`set ${Object.keys(set).join(', ')}`] : []),
    ...(clear.length ? [`cleared ${clear.join(', ')}`] : []),
  ];
  return parts.length ? [parts.join('; ')] : [];
};

export async function applyItemChanges(
  api: ApiClient,
  documentId: string,
  changes: readonly ItemChange[],
  state: PlanState,
): Promise<ItemChangesResult> {
  const base = itemsPath(documentId);
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
  const fieldsFor = (input: Readonly<Record<string, unknown>> | undefined, type: ItemTypeDef) =>
    input ? must(resolveFields(input, type, naming())).fields : {};
  try {
    for (const c of changes) {
      if (c.op === 'add') {
        const type = must(resolveType(c.type ?? 'task', types)).type;
        const fields = fieldsFor(c.fields, type);
        const status = c.status
          ? must(resolveStatus(c.status, state.plan.statuses)).status
          : undefined;
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
        const set = fieldsFor(c.fields, type);
        const clear = (c.clear ?? []).map((k) => must(fieldKeyOf(k, type)).key);
        const { item } = await post(`${base}/${encodeURIComponent(target.id)}`, {
          ...(Object.keys(set).length ? { set } : {}),
          ...(clear.length ? { clear } : {}),
          ...(c.type ? { type: type.id } : {}),
        });
        const notes = [...setNote(set, clear), ...personNote(set, items)];
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
    if (!refusal) throw err;
    return { applied, touched: [...touched.values()], refusal };
  }
  return { applied, touched: [...touched.values()] };
}
