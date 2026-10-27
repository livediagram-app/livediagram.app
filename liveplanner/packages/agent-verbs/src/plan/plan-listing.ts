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
  CURRENCY_DEFAULT,
  ratingScaleOf,
  detailsLabelOf,
  isCustomCardField,
  namedDisplay,
  PARENT_FIELD_ID,
  tabsOf,
  typeCardLayout,
  type Item,
  type ItemTypeDef,
  type PlanStatusName,
  type PlanBoardOutline,
} from '@liveplanner/items';
import type { PlanState } from './plan-state';

export const NO_BOARD_HINT =
  'This plan has no board yet. Add one with add_board (a preset such as kanban, or columns by name), ' +
  'or start a plan from a template (kanban, project-planner, bug-triage...).';

interface ListedColumn {
  name: string;
  status: string;
  wipLimit?: number;
  // Its cards count as done (docs/specs/026-plan/plan-board.md "Done columns").
  done?: true;
  cards: string[];
}

interface ListedBoard {
  title: string;
  tab: string;
  tabId: string;
  kind: PlanBoardOutline['kind'];
  takes: string[] | 'every type';
  columns: ListedColumn[];
}

interface ListedItem {
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
  color: string;
  glyph: string;
  fields: string[];
  custom: {
    id: string;
    name: string;
    kind: string;
    options?: readonly string[];
    linkType?: string;
    currency?: string;
    // A Rating field's top score.
    scale?: number;
    onCard?: boolean;
  }[];
  // The column a new card of it starts in, by name.
  defaultStatus?: string;
  // What its cards show per size, by place and field name, as change_card_types takes it.
  display: Record<string, Record<string, string[]>>;
  tabs: { name: string; fields: string[] }[];
  detailsLabel: string;
}

interface PlanListing {
  boards: ListedBoard[];
  notOnBoard: string[];
  count: number;
  items: ListedItem[];
  types: ListedType[];
  hint?: string;
}

// What list_items and `item ls` narrow by, as given: a card type and a column, each by name or id.
interface ListingFilter {
  type?: string;
  status?: string;
}

// The same narrowing resolved to ids, by the names change_items takes (resolveType, resolveStatus), so a filter
// reads a column or type exactly as a write does.
interface ResolvedListingFilter {
  type?: string;
  status?: string;
}

type ListingFilterRefusal = { ok: false; code: string; message: string };

// Resolves a listing's filter, or refuses a name the project does not have with the names it does. Trashed cards
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
        message: `No column "${filter.status}": the plan has no board yet, so no card is in a column.`,
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
// type no longer has keeps its id. A card link (Parent, a Card field) reads as its card's number and title
// ("#12 Fix login"), which writes take back.
function namedFields(
  item: Item,
  types: readonly ItemTypeDef[],
  byId: ReadonlyMap<string, Item>,
): Record<string, unknown> {
  const custom = types.find((t) => t.id === item.type)?.custom ?? [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item.fields)) {
    const field = custom.find((f) => f.id === key);
    const label = field?.label;
    const linked =
      (key === PARENT_FIELD_ID || field?.kind === 'card') && typeof value === 'string'
        ? byId.get(value)
        : undefined;
    // A name a built-in or another field already uses keeps the id, so nothing is overwritten.
    out[label && !(label in item.fields) && !(label in out) ? label : key] = linked
      ? `#${linked.key} ${itemTitle(linked)}`
      : value;
  }
  return out;
}

// A card type as list_items answers it: everything change_card_types sets, by the names it takes. Its Default
// State by column name when `statuses` has it.
export function listedType(t: ItemTypeDef, statuses: readonly PlanStatusName[] = []): ListedType {
  const fieldName = (f: string) => (t.custom ?? []).find((c) => c.id === f)?.label ?? f;
  const status = t.defaultStatus;
  return {
    id: t.id,
    name: t.label,
    color: t.color,
    glyph: t.glyph,
    fields: t.fields.filter((f) => !isCustomCardField(f)),
    custom: (t.custom ?? []).map((f) => ({
      id: f.id,
      name: f.label,
      kind: f.kind,
      ...(f.options ? { options: f.options } : {}),
      ...(f.linkType ? { linkType: f.linkType } : {}),
      ...(f.kind === 'currency' ? { currency: f.currency ?? CURRENCY_DEFAULT } : {}),
      ...(f.kind === 'rating' ? { scale: ratingScaleOf(f) } : {}),
      ...(f.onCard ? { onCard: true } : {}),
    })),
    ...(status ? { defaultStatus: statuses.find((s) => s.status === status)?.name ?? status } : {}),
    display: namedDisplay(t, (size) => typeCardLayout(t, size)),
    tabs: tabsOf(t).map((tab) => ({ name: tab.label, fields: tab.fields.map(fieldName) })),
    detailsLabel: detailsLabelOf(t),
  };
}

// Each of `types` listed against the plan's columns.
export const listedTypes = (types: readonly ItemTypeDef[], statuses: readonly PlanStatusName[]) =>
  types.map((t) => listedType(t, statuses));

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
          ...(c.done ? { done: true as const } : {}),
          cards: cards.map(ref),
        };
      }),
    };
  });
  const byId = new Map(state.items.map((i) => [i.id, i]));
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
      fields: namedFields(i, plan.types, byId),
    }));
  return {
    boards,
    notOnBoard: live.filter((i) => !onABoard.has(i.id)).map(ref),
    count: items.length,
    items,
    types: listedTypes(plan.types, plan.statuses),
    ...(plan.boards.length === 0 ? { hint: NO_BOARD_HINT } : {}),
  };
}
