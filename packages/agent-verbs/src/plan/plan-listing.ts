// The plan as list_items and `item ls` answer it (docs/specs/026-plan/plan-agents.md "Reading the plan"): each board
// with its columns and the numbers of the cards in them, the items with their column's name, and the card types
// with their fields, so one read gives everything a write names.
import {
  boardShowsType,
  compareRank,
  isArchived,
  isTrashed,
  itemStatus,
  itemTitle,
  resolveStatus,
  resolveType,
  statusKey,
  TRASH_STATUS,
  type Item,
  type ItemTypeDef,
  type PlanBoardOutline,
} from '@livediagram/items';
import type { PlanState } from './plan-state';

export const NO_BOARD_HINT =
  'This document has no Plan board yet. Add one with add_board (a preset such as kanban, or columns by name), ' +
  'or start a document from a Plan template (kanban, project-planner, bug-triage...).';

export interface ListedColumn {
  name: string;
  status: string;
  wipLimit?: number;
  cards: string[];
}

export interface ListedBoard {
  title: string;
  tab: string;
  tabId: string;
  kind: PlanBoardOutline['kind'];
  takes: string[] | 'every type';
  columns: ListedColumn[];
}

export interface ListedItem {
  ref: string;
  id: string;
  type: string;
  status: string | null;
  column: string | null;
  title: string;
  fields: Record<string, unknown>;
}

export interface ListedType {
  id: string;
  name: string;
  fields: string[];
  custom: {
    id: string;
    name: string;
    kind: string;
    options?: readonly string[];
    linkType?: string;
  }[];
}

export interface PlanListing {
  boards: ListedBoard[];
  notOnBoard: string[];
  count: number;
  items: ListedItem[];
  types: ListedType[];
  hint?: string;
}

// What list_items and `item ls` narrow by, as given: a card type and a column, each by name or id.
export interface ListingFilter {
  type?: string;
  status?: string;
}

// The same narrowing resolved to ids, by the names change_items takes (resolveType, resolveStatus), so a filter
// reads a column or type exactly as a write does.
export interface ResolvedListingFilter {
  type?: string;
  status?: string;
}

export type ListingFilterRefusal = { ok: false; code: string; message: string };

// Resolves a listing's filter, or refuses a name the document does not have with the names it does. Trashed cards
// are listed too, so "Trash" (the Trash's own status) is a column a filter may name.
export function resolveListingFilter(
  state: PlanState,
  filter: ListingFilter,
): ({ ok: true } & ResolvedListingFilter) | ListingFilterRefusal {
  const out: ResolvedListingFilter = {};
  if (filter.type) {
    const t = resolveType(filter.type, state.plan.types);
    if (!t.ok) return { ok: false, code: t.code, message: t.message };
    out.type = t.type.id;
  }
  if (filter.status) {
    if (filter.status === TRASH_STATUS || statusKey(filter.status) === statusKey('Trash'))
      out.status = TRASH_STATUS;
    else if (state.plan.statuses.length === 0)
      return {
        ok: false,
        code: 'status_unknown',
        message: `No column "${filter.status}": the document has no Plan board yet, so no card is in a column.`,
      };
    else {
      const s = resolveStatus(filter.status, state.plan.statuses);
      if (!s.ok) return { ok: false, code: s.code, message: s.message };
      out.status = s.status;
    }
  }
  return { ok: true, ...out };
}

const ref = (item: Item) => `#${item.key}`;

function columnName(status: string | undefined, state: PlanState): string | null {
  if (!status) return null;
  if (status === TRASH_STATUS) return 'Trash';
  return state.plan.statuses.find((s) => s.status === status)?.name ?? null;
}

// An item's fields with its custom fields under their names ("Severity"), as writes name them; a custom field its
// type no longer has keeps its id.
function namedFields(item: Item, types: readonly ItemTypeDef[]): Record<string, unknown> {
  const custom = types.find((t) => t.id === item.type)?.custom ?? [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item.fields)) {
    const label = custom.find((f) => f.id === key)?.label;
    // A name a built-in or another field already uses keeps the id, so nothing is overwritten.
    out[label && !(label in item.fields) && !(label in out) ? label : key] = value;
  }
  return out;
}

export function listedType(t: ItemTypeDef): ListedType {
  return {
    id: t.id,
    name: t.label,
    fields: t.fields.filter((f) => !f.startsWith('f-')),
    custom: (t.custom ?? []).map((f) => ({
      id: f.id,
      name: f.label,
      kind: f.kind,
      ...(f.options ? { options: f.options } : {}),
      ...(f.linkType ? { linkType: f.linkType } : {}),
    })),
  };
}

// The plan, narrowed by a filter resolveListingFilter resolved.
export function planListing(state: PlanState, filter: ResolvedListingFilter = {}): PlanListing {
  const { plan } = state;
  const live = state.items
    .filter((i) => !isTrashed(i) && !isArchived(i))
    .sort((a, b) => compareRank(a.rank, b.rank) || a.key - b.key);
  const onABoard = new Set<string>();
  const boards = plan.boards.map((b): ListedBoard => {
    const filed = b.kind === 'board';
    return {
      title: b.title,
      tab: b.tabName,
      tabId: b.tabId,
      kind: b.kind,
      // A type the catalogue lacks is named by its id, not the fallback "Item".
      takes: b.types
        ? b.types.map((id) => plan.types.find((t) => t.id === id)?.label ?? id)
        : 'every type',
      columns: b.columns.map((c) => {
        const cards = filed
          ? live.filter(
              (i) =>
                itemStatus(i) === c.status &&
                boardShowsType({ addTypes: b.types ?? undefined }, i.type, plan.types),
            )
          : [];
        for (const i of cards) onABoard.add(i.id);
        return {
          name: c.name,
          status: c.status,
          ...(c.wipLimit ? { wipLimit: c.wipLimit } : {}),
          cards: cards.map(ref),
        };
      }),
    };
  });
  const items = [...state.items]
    .filter((i) => !filter.type || i.type === filter.type)
    .filter((i) => !filter.status || itemStatus(i) === filter.status)
    .sort((a, b) => a.key - b.key)
    .map((i) => ({
      ref: ref(i),
      id: i.id,
      type: i.type,
      status: itemStatus(i) ?? null,
      column: columnName(itemStatus(i), state),
      title: itemTitle(i),
      fields: namedFields(i, plan.types),
    }));
  return {
    boards,
    notOnBoard: live.filter((i) => !onABoard.has(i.id)).map(ref),
    count: items.length,
    items,
    types: plan.types.map(listedType),
    ...(plan.boards.length === 0 ? { hint: NO_BOARD_HINT } : {}),
  };
}
