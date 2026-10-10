// A column's settings asking to open on another column (docs/specs/026-plan/plan-board.md "A column's own
// settings"): + Add Column After closes its popover and asks the new column's head to open its own, named
// fresh. The new head reads the request when it mounts (the set-up change draws it), or as it is made should
// the head already be on screen. One request at a time; the head that takes it clears it.
let pending: string | null = null;
const listeners = new Set<() => void>();

export function requestColumnSettings(columnId: string): void {
  pending = columnId;
  for (const l of listeners) l();
}

// The request for `columnId`, taken (cleared) when it matches.
export function takeColumnSettingsRequest(columnId: string): boolean {
  if (pending !== columnId) return false;
  pending = null;
  return true;
}

export function subscribeColumnSettingsRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
