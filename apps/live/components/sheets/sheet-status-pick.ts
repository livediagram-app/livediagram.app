// Which totals the status bar shows (docs/specs/029-sheets/sheet.md "Selection"): the viewer's own pick, kept in their
// browser and shared by every Sheet on the page, set from the bar's own menu or the Sheet's settings.
import { useSyncExternalStore } from 'react';

export const STATS = ['Sum', 'Average', 'Count', 'Min', 'Max'] as const;
export type Stat = (typeof STATS)[number];
const DEFAULT_PICK: readonly Stat[] = ['Sum', 'Average', 'Count'];
const PICK_KEY = 'livediagram:sheet-status-stats';

let pick: readonly Stat[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly Stat[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PICK_KEY) ?? 'null') as unknown;
    if (Array.isArray(raw)) {
      const kept = STATS.filter((s) => raw.includes(s));
      if (kept.length) return kept;
    }
  } catch {
    // No storage (a private window, blocked site data): the default pick.
  }
  return DEFAULT_PICK;
}

export function statusPick(): readonly Stat[] {
  pick ??= read();
  return pick;
}

// Turn one total on or off; the last one shown stays.
export function toggleStatusPick(stat: Stat): void {
  const now = statusPick();
  const next = now.includes(stat)
    ? now.filter((s) => s !== stat)
    : STATS.filter((s) => s === stat || now.includes(s));
  if (!next.length) return;
  pick = next;
  try {
    localStorage.setItem(PICK_KEY, JSON.stringify(next));
  } catch {
    // Kept for this page only.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useStatusPick(): readonly Stat[] {
  return useSyncExternalStore(subscribe, statusPick, () => DEFAULT_PICK);
}

// For tests: forget the pick read so far.
export function resetStatusPick(): void {
  pick = null;
}
