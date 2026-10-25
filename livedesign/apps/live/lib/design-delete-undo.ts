// Deleting the design open in the editor (docs/specs/013-workspace/trash.md "Deleting"): from the command palette or
// any menu in the Explorer panel. The design is tombstoned first (lib/design-tombstones.ts), so neither the autosave
// debounce nor the unload flush can write it back while it goes to the Trash; then the editor leaves for the
// Explorer, which offers the Undo on arrival. The handoff lives in sessionStorage for one page load and only for a
// moment, so a later visit offers nothing.
import { explorerHref } from '@liveworkspace/workbench/lib/explorer-href';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { markDesignDeleted, unmarkDesignDeleted } from '@/lib/design-tombstones';
import { track } from '@/lib/telemetry';

const HANDOFF_KEY = 'livedesign:deleted-design';
const HANDOFF_MAX_AGE_MS = 30_000;

type Handoff = { id: string; name?: string; at: number };

export type TrashedDesign = { id: string; title: string | null };

/**
 * The open design to the Trash, then to the Explorer with its Undo. Resolves false, with the design writable again,
 * when the index refuses; the caller says so.
 */
export async function trashOpenDesign(
  id: string,
  name: string | null | undefined,
  leave: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  markDesignDeleted(id);
  try {
    await indexClient.deleteItem(id);
  } catch {
    unmarkDesignDeleted(id);
    return false;
  }
  track('Document', 'Deleted');
  handOffDeleteUndo(id, name);
  // The Explorer is on liveworkspace.app: the design rides in its address there, for the Undo.
  const params = new URLSearchParams({ trashed: id });
  if (name) params.set('title', name);
  leave(explorerHref('', `?${params}`));
  return true;
}

export function handOffDeleteUndo(id: string, name?: string | null, now = Date.now()): void {
  try {
    const handoff: Handoff = { id, at: now, ...(name ? { name } : {}) };
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Storage off: the design is still in the Trash.
  }
}

/** The handed-over delete, taken (read once and cleared); null when there is none or it is stale. */
export function takeDeleteUndo(now = Date.now()): TrashedDesign | null {
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
let arrival: { taken: boolean; design: TrashedDesign | null } = { taken: false, design: null };

/** The design deleted just before this page opened, for the Explorer's Undo; null on the server or when none. */
export function arrivedTrashed(): TrashedDesign | null {
  if (typeof window === 'undefined') return null;
  if (!arrival.taken) arrival = { taken: true, design: takeDeleteUndo() };
  return arrival.design;
}
