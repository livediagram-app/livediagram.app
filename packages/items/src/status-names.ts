import { TRASHED_FROM_FIELD, type PlanBoardSetup } from './board';
import type { Item } from './item';
import type { ItemPatchOf } from './store';

// One name, one status (docs/specs/026-plan/plan-board.md "The board set-up"): a status's name as columns compare
// it, and the status a name already belongs to, so a new column, a placed board or a renamed column reuses the
// status of that name instead of making a second one the cards would be split across.

// A name as statuses compare it: case and spacing (and punctuation) aside, so "To do", "to-do" and "TO  DO" match.
// Letters and digits of any script count ("完成", "Готово"), so a name in any language is matched, not dropped.
export function statusKey(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// The status already named `name` among `names` (status id to name, in the document's order), or undefined.
export function statusNamed(
  name: string,
  names: Iterable<readonly [string, string]>,
): { status: string; name: string } | undefined {
  const key = statusKey(name);
  if (!key) return undefined;
  for (const [status, n] of names) if (statusKey(n) === key) return { status, name: n };
  return undefined;
}

// The states that share a name (as names compare) with an earlier one, each mapped to that earliest one: what a
// document merges (docs/specs/026-plan/plan-board.md "One name, one state"). `names` is status id to name in
// document order (tab order, then board and column order), so every client picks the same state to keep.
export function duplicateStatuses(names: Iterable<readonly [string, string]>): Map<string, string> {
  const first = new Map<string, string>();
  const merged = new Map<string, string>();
  for (const [status, name] of names) {
    const key = statusKey(name);
    if (!key) continue;
    const keep = first.get(key);
    if (keep === undefined) first.set(key, status);
    else if (keep !== status) merged.set(status, keep);
  }
  return merged;
}

// A board with merged states taken to the states they merge into: each column's state remapped, a column whose
// state an earlier column already holds dropped (the earlier keeps its place, name and limits). The same setup
// back when nothing on it merges.
export function mergeBoardStatuses(
  setup: PlanBoardSetup,
  merged: ReadonlyMap<string, string>,
): PlanBoardSetup {
  if (!setup.columns.some((c) => merged.has(c.status))) return setup;
  const seen = new Set<string>();
  const columns = setup.columns.flatMap((c) => {
    const status = merged.get(c.status) ?? c.status;
    if (seen.has(status)) return [];
    seen.add(status);
    return [status === c.status ? c : { ...c, status }];
  });
  return { ...setup, columns };
}

// The cards in merged states moved to the states they merge into, as one write's patches: a card's state, and a
// trashed card's state to restore to.
export function mergedStatusPatches(
  items: Iterable<Item>,
  merged: ReadonlyMap<string, string>,
): ItemPatchOf[] {
  const out: ItemPatchOf[] = [];
  for (const it of items) {
    const set: Record<string, string> = {};
    for (const key of ['status', TRASHED_FROM_FIELD]) {
      const from = it.fields[key];
      const to = typeof from === 'string' ? merged.get(from) : undefined;
      if (to) set[key] = to;
    }
    if (Object.keys(set).length) out.push({ id: it.id, patch: { set } });
  }
  return out;
}
