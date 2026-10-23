// Deleting the plan open in the editor (docs/specs/013-workspace/trash.md "Deleting"): from the command palette or
// any menu in the Explorer panel. The plan is tombstoned first (lib/project-tombstones.ts), so neither the autosave
// debounce nor the unload flush can write it back while it goes to the Trash; then the editor leaves for the
// Explorer, which offers the Undo on arrival. The handoff lives in sessionStorage for one page load and only for a
// moment, so a later visit offers nothing.
import { indexClient } from '@/lib/index-client';
import { markProjectDeleted, unmarkProjectDeleted } from '@/lib/project-tombstones';
import { track } from '@/lib/telemetry';

const HANDOFF_KEY = 'liveplanner:deleted-project';
const HANDOFF_MAX_AGE_MS = 30_000;

type Handoff = { id: string; name?: string; at: number };

export type TrashedPlan = { id: string; title: string | null };

/**
 * The open plan to the Trash, then to the Explorer with its Undo. Resolves false, with the plan writable again,
 * when the index refuses; the caller says so.
 */
export async function trashOpenPlan(
  id: string,
  name: string | null | undefined,
  leave: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  markProjectDeleted(id);
  try {
    await indexClient.deleteItem(id);
  } catch {
    unmarkProjectDeleted(id);
    return false;
  }
  track('Project', 'Deleted');
  handOffDeleteUndo(id, name);
  leave('/explorer');
  return true;
}

export function handOffDeleteUndo(id: string, name?: string | null, now = Date.now()): void {
  try {
    const handoff: Handoff = { id, at: now, ...(name ? { name } : {}) };
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Storage off: the plan is still in the Trash.
  }
}

/** The handed-over delete, taken (read once and cleared); null when there is none or it is stale. */
export function takeDeleteUndo(now = Date.now()): TrashedPlan | null {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(HANDOFF_KEY);
    const h = JSON.parse(raw) as Partial<Handoff>;
    if (typeof h.id !== 'string' || typeof h.at !== 'number') return null;
    if (now - h.at > HANDOFF_MAX_AGE_MS || now < h.at) return null;
    return { id: h.id, title: typeof h.name === 'string' ? h.name : null };
  } catch {
    return null;
  }
}

// Taken once per page load and kept, so a remount (or Strict Mode's second call) sees the same answer.
let arrival: { taken: boolean; plan: TrashedPlan | null } = { taken: false, plan: null };

/** The plan deleted just before this page opened, for the Explorer's Undo; null on the server or when none. */
export function arrivedTrashed(): TrashedPlan | null {
  if (typeof window === 'undefined') return null;
  if (!arrival.taken) arrival = { taken: true, plan: takeDeleteUndo() };
  return arrival.plan;
}
