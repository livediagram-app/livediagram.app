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
  typeIn,
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

export interface ListingFilter {
  type?: string;
  status?: string;
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

export function planListing(state: PlanState, filter: ListingFilter = {}): PlanListing {
  const { plan } = state;
  const live = state.items
    .filter((i) => !isTrashed(i) && !isArchived(i))
    .sort((a, b) => compareRank(a.rank, b.rank) || a.key - b.key);
  const label = (id: string) => typeIn(plan.types, id).label;
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
  // A status filter takes a column name too.
  const wanted = filter.status
    ? (plan.statuses.find(
        (s) => s.status === filter.status || s.name.toLowerCase() === filter.status!.toLowerCase(),
      )?.status ?? filter.status)
    : undefined;
  const items = [...state.items]
    .filter(
      (i) =>
        !filter.type ||
        i.type === filter.type ||
        label(i.type).toLowerCase() === filter.type.toLowerCase(),
    )
    .filter((i) => !wanted || itemStatus(i) === wanted)
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
