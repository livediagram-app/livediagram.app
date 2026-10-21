// The item panel's card trail (docs/specs/026-plan/plan-board.md "Open an item": Breadcrumb). Pure, so the slice, the host and the header read one set of rules.
import { isTrashed, type Item } from '@livediagram/items';

// How a card was opened from inside the item panel: each steps the trail rather than starting a new one, and
// is the `type` of its `Plan · Opened` event.
export type ItemOpenVia = 'Parent' | 'ChildCard' | 'Breadcrumb';

// The most cards the trail remembers (spec): bounds its memory however long someone wanders.
export const ITEM_TRAIL_MAX = 8;
// Earlier crumbs the header shows before folding the rest into "…": what fits a 60rem header, and a phone's.
export const ITEM_TRAIL_SHOWN = 3;
export const ITEM_TRAIL_SHOWN_PHONE = 1;

// The trail after opening `id` from inside the panel: back to it when it is already there (the crumbs after it
// drop), else appended, the oldest dropped past the cap.
export function stepTrail(trail: readonly string[], id: string): string[] {
  const at = trail.indexOf(id);
  if (at >= 0) return trail.slice(0, at + 1);
  const next = [...trail, id];
  return next.length > ITEM_TRAIL_MAX ? next.slice(next.length - ITEM_TRAIL_MAX) : next;
}

// The trail as drawn, ending on the open card: cards trashed or deleted meanwhile leave it, and a trail that
// does not end on the open card (opened some other way) is just that card.
export function liveTrail(
  trail: readonly string[],
  openId: string,
  items: ReadonlyMap<string, Item>,
): Item[] {
  const ids = trail[trail.length - 1] === openId ? trail : [openId];
  return ids.flatMap((id) => {
    const item = items.get(id);
    return item && !isTrashed(item) ? [item] : [];
  });
}

// The earlier crumbs the header shows, nearest the current card, and how many fold into "…" before them.
export function visibleTrail<T>(
  earlier: readonly T[],
  shown: number,
): { folded: number; crumbs: readonly T[] } {
  const folded = Math.max(0, earlier.length - shown);
  return { folded, crumbs: earlier.slice(folded) };
}
