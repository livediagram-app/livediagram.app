// A view's Statuses setting (docs/specs/026-plan/plan-views.md "Statuses"): the statuses a chart counts, by id;
// absent counts every card. Pure: validation, the views that take it, the cards it keeps and the statuses to offer.
import { itemStatus, type Item } from './item';
import { ITEM_STATUS_MAX } from './limits';
import { isArchived, isTrashed, statusLabel } from './board';
import type { PlanViewId } from './plan-views';

// The most statuses a view names: every column of a document's boards fits several times over.
export const PLAN_VIEW_STATUSES_MAX = 64;

// The views that count by status and so take the setting.
export const STATUS_FILTER_VIEWS: readonly PlanViewId[] = ['workload', 'priority-matrix'];

export function viewTakesStatuses(view: PlanViewId): boolean {
  return STATUS_FILTER_VIEWS.includes(view);
}

// A stored list: 1 to PLAN_VIEW_STATUSES_MAX distinct, non-empty status ids, each at most ITEM_STATUS_MAX long.
export function isPlanViewStatuses(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= PLAN_VIEW_STATUSES_MAX &&
    value.every((s) => typeof s === 'string' && !!s.trim() && s.length <= ITEM_STATUS_MAX) &&
    new Set(value).size === value.length
  );
}

// The cards a view counts: those in a named status, or every card when it names none. A card with no status is
// left out while statuses are named.
export function cardsInStatuses(
  items: ReadonlyMap<string, Item>,
  statuses: readonly string[] | undefined,
): ReadonlyMap<string, Item> {
  if (!statuses || statuses.length === 0) return items;
  const keep = new Set(statuses);
  return new Map(
    [...items].filter(([, it]) => {
      const s = itemStatus(it);
      return s !== undefined && keep.has(s);
    }),
  );
}

// The statuses to offer: those some live card holds, in the order the document's boards name them, then any
// other, each with its name as a column calls it.
export function viewStatusOptions(
  items: Iterable<Item>,
  statusNames?: ReadonlyMap<string, string>,
): { id: string; label: string }[] {
  const held = new Set<string>();
  for (const it of items) {
    if (isArchived(it) || isTrashed(it)) continue;
    const s = itemStatus(it);
    if (s) held.add(s);
  }
  const ordered = [...(statusNames?.keys() ?? [])].filter((s) => held.has(s));
  const rest = [...held].filter((s) => !statusNames?.has(s));
  return [...ordered, ...rest].map((id) => ({ id, label: statusLabel(id, statusNames) }));
}
