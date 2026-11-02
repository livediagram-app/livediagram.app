// What a person has collapsed on a Plan board (docs/specs/026-plan/plan-board.md "Collapse Column", "Swimlanes"): its
// columns (by column id) and its swimlanes (by lane key), each person's own, remembered per board on this browser.
// The pure parts: the storage key, reading a stored value (untrusted: a hand edit or another release's shape reads as
// nothing collapsed, field by field), writing one, and toggling a member. Pure.
import { safeJson } from '@liveworkspace/workbench/lib/local-storage-safe';

export const BOARD_COLLAPSED_PREFIX = 'liveplanner:v2:board-collapsed:';

// The most ids of each kind kept for a board: a board holds up to 12 columns, and its rows are bounded by its cards;
// past this a stored list is cut, so a hand-edited value never costs more than a short read.
export const BOARD_COLLAPSED_MAX = 200;

export type BoardCollapsed = {
  readonly columns: ReadonlySet<string>;
  readonly lanes: ReadonlySet<string>;
};

export const NOTHING_COLLAPSED: BoardCollapsed = { columns: new Set(), lanes: new Set() };

export const boardCollapsedKey = (boardId: string): string => `${BOARD_COLLAPSED_PREFIX}${boardId}`;

function idList(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value.filter((v): v is string => typeof v === 'string').slice(0, BOARD_COLLAPSED_MAX),
  );
}

export function parseBoardCollapsed(raw: string | null): BoardCollapsed {
  if (!raw) return NOTHING_COLLAPSED;
  const value = safeJson(raw);
  if (!value || typeof value !== 'object') return NOTHING_COLLAPSED;
  const record = value as Record<string, unknown>;
  return { columns: idList(record['columns']), lanes: idList(record['lanes']) };
}

// The stored text, or null when nothing is collapsed (the key is then removed).
export function serialiseBoardCollapsed(state: BoardCollapsed): string | null {
  if (!state.columns.size && !state.lanes.size) return null;
  return JSON.stringify({ columns: [...state.columns], lanes: [...state.lanes] });
}

// The set with `id` in it or out of it, flipped; `keep` (the ids still on the board) drops any that went.
export function toggleMember(
  set: ReadonlySet<string>,
  id: string,
  keep?: ReadonlySet<string>,
): ReadonlySet<string> {
  const next = new Set(keep ? [...set].filter((x) => keep.has(x)) : set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
