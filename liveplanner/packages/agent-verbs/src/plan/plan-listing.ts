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
  typeStatusesOf,
  typeCardLayout,
  type Item,
  type ItemFieldValue,
  type ItemTypeDef,
  type PlanStatusName,
  type PlanBoardOutline,
  boardSortText,
  sortCards,
  linkTypesOf,
  calculatedValuesOf,
  childIndexOf,
  doneStatusesOf,
  hasCalculatedFields,
  showsAsPercent,
  typeIn,
  fieldCardIds,
  fieldPeople,
  holdsSeveral,
  formulaProblem,
  formulaResultOf,
  formulaScopeOf,
  isFormulaField,
  shownFormula,
  aggregateOf,
  isLookupField,
  isRollupField,
  calculatedResultOf,
  readableFieldsOf,
  rollupProblem,
  durationMinutes,
  durationText,
  isTimeSpent,
  readTimeValue,
  timePerson,
  type CalculatedValue,
  type CustomFieldDef,
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
  // Sort Cards, as "Priority (Highest First)": its columns list their cards in that order.
  sortBy?: string[];
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
  // Each Time Spent field's entries and running timers, by the field's name (docs/specs/026-plan/item-types.md "Time
  // Spent"); only on a card with any.
  time?: Record<string, ListedTime>;
}

// A Time Spent field's time as agents read it: who by name, the time as text, when as ISO times.
interface ListedTime {
  entries: { by: string; time: string; at: string }[];
  running: { by: string; since: string }[];
}

// A card's Time Spent fields with any time, by name; undefined when none has.
function listedTime(
  item: Item,
  type: ItemTypeDef | undefined,
): Record<string, ListedTime> | undefined {
  let out: Record<string, ListedTime> | undefined;
  for (const f of type?.custom ?? []) {
    if (!isTimeSpent(f) || !type!.fields.includes(f.id)) continue;
    const value = readTimeValue(item.fields[f.id]);
    if (value.entries.length === 0 && value.running.length === 0) continue;
    const name = (id: string) => timePerson(value, id).name;
    (out ??= {})[f.label] = {
      entries: value.entries.map((e) => ({
        by: name(e.by),
        time: durationText(e.minutes),
        at: new Date(e.at).toISOString(),
      })),
      running: value.running.map((r) => ({
        by: name(r.by),
        since: new Date(r.start).toISOString(),
      })),
    };
  }
  return out;
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
    // Every card type a Card field links to, linkType first.
    linkTypes?: readonly string[];
    currency?: string;
    // A Rating field's top score.
    scale?: number;
    // A Calculated field's calculation; such a field is read-only (docs/specs/026-plan/item-types.md "Calculated
    // fields").
    calculation?: string;
    // A Formula's expression with field names, its result kind, and why it stopped working (docs/specs/026-plan/
    // item-types.md "Formula fields").
    formula?: string;
    result?: string;
    formulaError?: string;
    // A Rollup's or Lookup's Card field and field by name ("all" for every child), a Rollup's calculation, and why
    // it stopped working (docs/specs/026-plan/item-types.md "Rollup and Lookup fields").
    through?: string;
    aggregate?: string;
    source?: string;
    error?: string;
    // A share drawn as a Percent field is (docs/specs/026-plan/item-types.md "Percent").
    showAs?: 'percent';
    // A Duration field that tracks time, read-only to agents (docs/specs/026-plan/item-types.md "Time Spent").
    timeSpent?: true;
    readOnly?: true;
    onCard?: boolean;
    // A card of the type must have a value for it (docs/specs/026-plan/item-types.md "Required fields").
    required?: boolean;
    // A Person field that tells its person when a card is theirs (item-types.md "Notifies").
    notifies?: boolean;
    multiple?: boolean;
  }[];
  // The Assignee tells no one (item-types.md "Notifies"); given only when switched off.
  assigneeNotifies?: false;
  // The column a new card of it starts in, by name.
  defaultStatus?: string;
  // The columns its cards may move into, by name, in its order (docs/specs/026-plan/item-types.md "The statuses a
  // type uses"); a status no board names is left out.
  statuses: string[];
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

// A Formula as an agent reads it: its expression with names (as change_card_types takes it back), its result, and
// why it stopped working when it has.
function listedFormula(f: CustomFieldDef, t: ItemTypeDef) {
  const problem = formulaProblem(f, t);
  return {
    formula: shownFormula(f.formula ?? '', formulaScopeOf(t)),
    result: formulaResultOf(f),
    ...(problem ? { formulaError: problem } : {}),
  };
}

// A Rollup or Lookup as an agent reads it (docs/specs/026-plan/item-types.md "Rollup and Lookup fields"): the Card
// field it reads through and the field it reads, by name (as change_card_types takes them back; "all" for every
// child), a Rollup's calculation, its result, and why it stopped working when it has.
function listedRollup(f: CustomFieldDef, t: ItemTypeDef, types: readonly ItemTypeDef[]) {
  const rollup = isRollupField(f);
  const nameOf = (id: string | undefined): string | undefined => {
    if (id === undefined) return undefined;
    for (const ty of types) {
      const hit = readableFieldsOf(ty).find((r) => r.id === id);
      if (hit) return hit.name;
    }
    return id;
  };
  const problem = rollupProblem(f, t, types);
  return {
    through: rollup && !f.through ? 'all' : nameOf(f.through),
    ...(rollup ? { aggregate: aggregateOf(f) } : {}),
    ...(f.source ? { source: nameOf(f.source) } : {}),
    result: calculatedResultOf(f),
    ...(f.result === 'currency' ? { currency: f.currency ?? CURRENCY_DEFAULT } : {}),
    ...(problem ? { error: problem } : {}),
  };
}

// An item's fields with its custom fields under their names ("Severity"), as writes name them; a custom field its
// type no longer has keeps its id. A card link (Parent, a Card field) reads as its card's number and title
// ("#12 Fix login"), which writes take back. A Calculated field's value, worked out (`calculated`), is listed too.
function namedFields(
  item: Item,
  types: readonly ItemTypeDef[],
  byId: ReadonlyMap<string, Item>,
  calculated?: Record<string, CalculatedValue>,
): Record<string, unknown> {
  const custom = types.find((t) => t.id === item.type)?.custom ?? [];
  const out: Record<string, unknown> = {};
  const fields = calculated ? { ...item.fields, ...calculated } : item.fields;
  for (const [key, value] of Object.entries(fields)) {
    const field = custom.find((f) => f.id === key);
    const label = field?.label;
    // A name a built-in or another field already uses keeps the id, so nothing is overwritten.
    out[label && !(label in fields) && !(label in out) ? label : key] = listedValue(
      key,
      field,
      value,
      byId,
    );
  }
  return out;
}

// A field's value as list_items reads it: a card link as "#12 Fix login", and a field that holds several as a comma
// list of its cards or people's names (docs/specs/026-plan/item-types.md "Holds Several"); the rest as stored.
function listedValue(
  key: string,
  field: CustomFieldDef | undefined,
  value: unknown,
  byId: ReadonlyMap<string, Item>,
): unknown {
  const linkText = (id: string) => {
    const linked = byId.get(id);
    return linked ? `#${linked.key} ${itemTitle(linked)}` : id;
  };
  if (holdsSeveral(field) && field!.kind === 'card')
    return fieldCardIds(field, value).map(linkText).join(', ');
  if (holdsSeveral(field))
    return fieldPeople(field, value)
      .map((p) => p.name)
      .join(', ');
  if ((key === PARENT_FIELD_ID || field?.kind === 'card') && typeof value === 'string')
    return linkText(value);
  // "2h 30m"; a Time Spent field its total (docs/specs/026-plan/item-types.md "Duration").
  if (field?.kind === 'duration') {
    const m = durationMinutes(field, value as ItemFieldValue);
    return m === undefined ? null : durationText(m);
  }
  return value;
}

const withTime = (time: Record<string, ListedTime> | undefined) => (time ? { time } : {});

// A card type as list_items answers it: everything change_card_types sets, by the names it takes. Its Default
// State by column name when `statuses` has it.
export function listedType(
  t: ItemTypeDef,
  statuses: readonly PlanStatusName[] = [],
  // The catalogue, naming the fields a Rollup or Lookup reads on other types.
  types: readonly ItemTypeDef[] = [t],
): ListedType {
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
      ...(f.linkType ? { linkType: f.linkType, linkTypes: linkTypesOf(f) } : {}),
      ...(f.kind === 'currency' ? { currency: f.currency ?? CURRENCY_DEFAULT } : {}),
      ...(f.kind === 'rating' ? { scale: ratingScaleOf(f) } : {}),
      ...(f.kind === 'calculated' ? { calculation: f.calculation } : {}),
      ...(isFormulaField(f) ? listedFormula(f, t) : {}),
      ...(isRollupField(f) || isLookupField(f) ? listedRollup(f, t, types) : {}),
      ...(f.kind === 'calculated' && showsAsPercent(f) ? { showAs: 'percent' as const } : {}),
      ...(isTimeSpent(f) ? { timeSpent: true as const } : {}),
      ...(f.kind === 'calculated' || isTimeSpent(f) ? { readOnly: true as const } : {}),
      ...(f.onCard ? { onCard: true } : {}),
      ...(f.required ? { required: true } : {}),
      ...(f.notifies ? { notifies: true } : {}),
      ...(holdsSeveral(f) ? { multiple: true } : {}),
    })),
    ...(t.assigneeNotifies === false ? { assigneeNotifies: false as const } : {}),
    ...(status ? { defaultStatus: statuses.find((s) => s.status === status)?.name ?? status } : {}),
    statuses: typeStatusesOf(
      t,
      statuses.map((s) => s.status),
    ).flatMap((id) => statuses.filter((s) => s.status === id).map((s) => s.name)),
    display: namedDisplay(t, (size) => typeCardLayout(t, size)),
    tabs: tabsOf(t).map((tab) => ({ name: tab.label, fields: tab.fields.map(fieldName) })),
    detailsLabel: detailsLabelOf(t),
  };
}

// Each of `types` listed against the plan's columns.
export const listedTypes = (types: readonly ItemTypeDef[], statuses: readonly PlanStatusName[]) =>
  types.map((t) => listedType(t, statuses, types));

// The plan, narrowed by a filter resolveListingFilter resolved.
export function planListing(state: PlanState, filter: ResolvedListingFilter = {}): PlanListing {
  const { plan } = state;
  const live = state.items
    .filter((i) => !isTrashed(i) && !isArchived(i))
    .sort((a, b) => compareRank(a.rank, b.rank) || a.key - b.key);
  const onABoard = new Set<string>();
  const byId = new Map(state.items.map((i) => [i.id, i]));
  const isDone = doneStatusesOf(plan.boards);
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
      ...(b.sortBy ? { sortBy: boardSortText(b.sortBy, plan.types) } : {}),
      columns: b.columns.map((c) => {
        const cards = filed
          ? sortCards(
              live.filter(
                (i) =>
                  itemStatus(i) === c.status &&
                  boardShowsType({ addTypes: b.types ?? undefined }, i.type, plan.types),
              ),
              b.sortBy,
              plan.types,
              byId,
              isDone,
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
  // Calculated fields (docs/specs/026-plan/item-types.md "Calculated fields"), worked out from what was read, and only
  // when a type has one.
  const calc = hasCalculatedFields(plan.types)
    ? { index: childIndexOf(state.items, plan.types), isDone }
    : null;
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
      fields: namedFields(
        i,
        plan.types,
        byId,
        calc
          ? calculatedValuesOf(
              i,
              typeIn(plan.types, i.type),
              calc.index,
              calc.isDone,
              byId,
              plan.types,
            )
          : undefined,
      ),
      ...withTime(
        listedTime(
          i,
          plan.types.find((t) => t.id === i.type),
        ),
      ),
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
