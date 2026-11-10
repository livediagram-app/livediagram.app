// The Plan board set-up and its projection (docs/specs/026-plan/plan-board.md).
// The board stores only its set-up; what it shows is computed here from the
// item store, so every board (and the api's tab scoping) reads items the same way.

import type { Item } from './item';
import { itemAssignee, itemLabels, itemStatus, itemTitle } from './item';
import { typeIn } from './type-catalogue';
import type { IsDoneStatus } from './calculated-fields';
import { isNotified } from './notify-fields';
import { boardSortComparator } from './board-sort';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { byRank } from './apply';
import { isDoneColumn } from './done-columns';
import {
  UNASSIGNED,
  isArchived,
  isTrashed,
  type PlanBoardSetup,
  type PlanColumn,
  type QuickFilter,
} from './board-model';
import type { LaneHead } from './board-lane-fields';
import { boardLanes, cardsMatchingFilters } from './board-lanes';
import { boardAddTypes } from './board-setup';

// The board's shapes, lanes and set-up live in their own modules; this entry keeps every export.
export * from './board-model';
export {
  NO_LANE,
  laneDropPatch,
  laneFieldOf,
  laneFieldsOf,
  type LaneField,
  type LaneFieldKind,
  type LaneHead,
} from './board-lane-fields';
export { cardsMatchingFilters, inLane, laneGroups, namedStatus, statusLabel } from './board-lanes';
export * from './board-setup';

export interface ProjectedColumn {
  column: PlanColumn;
  count: number;
  overLimit: boolean;
  // One entry per board lane (a single '' lane with no swimlanes).
  lanes: { laneKey: string; items: Item[] }[];
}

export interface BoardProjection {
  columns: ProjectedColumn[];
  lanes: LaneHead[];
  // Whether the board draws rows: false with no swimlanes, or a field lane whose field is gone.
  swimlanes: boolean;
  unplaced: Item[];
  doneCount: number;
  total: number;
  // Sort Cards orders its cards: a card is not reordered by hand in its own cell.
  sorted?: boolean;
}

// A quick filter that lets every card through (none set, or every part empty): a board projected with it shows
// the same cards as one projected with none, so a caller can reuse that projection rather than project twice.
export function isQuickFilterEmpty(quick: QuickFilter | undefined): boolean {
  return (
    !quick ||
    (!quick.mine &&
      !quick.person &&
      !quick.priority &&
      !quick.type &&
      !quick.due &&
      !quick.text?.trim() &&
      !quick.filters?.length)
  );
}

export function quickFilterMatches(
  quick: QuickFilter | undefined,
  item: Item,
  // The project's type catalogue: Only Mine reads each card's notifying Person fields (notify-fields.ts).
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): boolean {
  if (!quick) return true;
  if (quick.mine && !isNotified(typeIn(types, item.type), item, quick.mine)) return false;
  if (quick.person && (itemAssignee(item)?.id ?? UNASSIGNED) !== quick.person) return false;
  if (quick.priority && item.fields['priority'] !== quick.priority) return false;
  if (quick.type && item.type !== quick.type) return false;
  if (quick.due) {
    const due = item.fields['due'];
    if (typeof due !== 'string' || due > quick.due.to) return false;
    if (quick.due.from && due < quick.due.from) return false;
    if (quick.due.finished?.includes(itemStatus(item) ?? '')) return false;
  }
  const text = quick.text?.trim().toLowerCase();
  if (text) {
    const hay = [itemTitle(item), `#${item.key}`, ...itemLabels(item)].join(' ').toLowerCase();
    if (!hay.includes(text)) return false;
  }
  return true;
}

// Whether a state is one of the board's done columns' (a Rollup's Count Done and a Children Done read it).
export function boardIsDone(setup: PlanBoardSetup): IsDoneStatus {
  return (s) =>
    s !== undefined && setup.columns.some((c) => c.status === s && isDoneColumn(setup, c));
}

export function projectBoard(
  setup: PlanBoardSetup,
  items: ReadonlyMap<string, Item>,
  quick?: QuickFilter,
  // The project's type catalogue (docs/specs/026-plan/item-types.md): the order and names of type rows.
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  // Status names from the tab's boards' columns, in order: an All Cards board's status rows.
  statusNames?: ReadonlyMap<string, string>,
): BoardProjection {
  const byStatus = new Map<string, PlanColumn>(setup.columns.map((c) => [c.status, c]));
  const scoped: Item[] = [];
  const unplaced: Item[] = [];
  // An Archive board shows the archived items, every one in its first column; any other board leaves
  // them out altogether.
  const archiveBoard = setup.archive === true;
  // An All Cards board (docs/specs/026-plan/plan-board.md "All Cards") shows every card that is not
  // archived, whatever its status, in its one column.
  const allBoard = setup.allCards === true && !archiveBoard;
  // A board that names its card types shows only those (every type again once none of them is left in the
  // catalogue); the rest stay where they are, unseen here. Resolved once, not per card.
  const shownTypes = setup.addTypes ? new Set(boardAddTypes(setup, types).map((t) => t.id)) : null;
  for (const it of items.values()) {
    if (isTrashed(it)) continue;
    if (isArchived(it) !== archiveBoard) continue;
    if (shownTypes && !shownTypes.has(it.type)) continue;
    if (archiveBoard || allBoard) {
      scoped.push(it);
      continue;
    }
    const status = itemStatus(it);
    if (status === undefined || !byStatus.has(status)) unplaced.push(it);
    else scoped.push(it);
  }
  scoped.sort(byRank);
  // Sort Cards: stable, so rank still orders the cards each level ties.
  const sorted = !!setup.sortBy?.length;
  // The board's done columns, for a Rollup's Count Done and a Children Done it sorts or lanes by.
  const isDone = boardIsDone(setup);
  if (sorted) scoped.sort(boardSortComparator(setup.sortBy!, types, items, isDone));
  unplaced.sort((a, b) => a.key - b.key);

  const groups = boardLanes(setup, scoped, items, types, statusNames, isDone);
  // The Filter widget's field chips, matched once for the whole board rather than per card.
  const chipped = quick?.filters?.length
    ? new Set(
        cardsMatchingFilters(scoped, quick.filters, items, types, statusNames).map((i) => i.id),
      )
    : null;
  const { by, lanes } = groups;

  // Cards in every done column (docs/specs/026-plan/plan-board.md "Done columns").
  let doneCount = 0;
  const columns: ProjectedColumn[] = setup.columns.map((column) => {
    const all =
      archiveBoard || allBoard
        ? column === setup.columns[0]
          ? scoped
          : []
        : scoped.filter((it) => itemStatus(it) === column.status);
    if (isDoneColumn(setup, column)) doneCount += all.length;
    const shown = all.filter(
      (it) => (!chipped || chipped.has(it.id)) && quickFilterMatches(quick, it, types),
    );
    // One pass files each card into every lane it sits in (several, for a field that holds several), in order.
    const byLane = new Map<string, Item[]>(lanes.map((l) => [l.key, []]));
    for (const it of shown)
      for (const key of groups.lanesOfItem.get(it.id)!) byLane.get(key)!.push(it);
    return {
      column,
      count: all.length,
      overLimit: column.wipLimit !== undefined && all.length > column.wipLimit,
      lanes: lanes.map((l) => ({ laneKey: l.key, items: byLane.get(l.key)! })),
    };
  });
  return {
    columns,
    lanes,
    swimlanes: by !== 'none',
    unplaced,
    doneCount,
    total: scoped.length,
    ...(sorted ? { sorted } : {}),
  };
}
