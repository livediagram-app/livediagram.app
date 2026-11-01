// Deleting the document open in the editor (docs/specs/013-workspace/trash.md "Deleting"): from the command palette or
// any menu in the Explorer panel. The document is tombstoned first (lib/document-tombstones.ts), so neither the autosave
// debounce nor the unload flush can write it back while it goes to the Trash; then the editor leaves for the
// Explorer, which offers the Undo on arrival. The shared Explorer takes the canvas from its address
// (`?trashed=<id>&title=<name>`, dropped from the address once read); the workbench frame's Explorer takes it from
// sessionStorage, kept for one page load and only for a moment, so a later visit offers nothing.
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { markDocumentDeleted, unmarkDocumentDeleted } from '@/lib/document-tombstones';
import { track } from '@/lib/telemetry';
import { explorerHref } from '@liveworkspace/workbench/lib/explorer-href';

const HANDOFF_KEY = 'livehuddle:deleted-document';
const HANDOFF_MAX_AGE_MS = 30_000;

type Handoff = { id: string; name?: string; at: number };

export type TrashedDocument = { id: string; title: string | null };

/**
 * The open document to the Trash, then to the Explorer with its Undo. Resolves false, with the document writable again,
 * when the index refuses; the caller says so.
 */
export async function trashOpenDocument(
  id: string,
  name: string | null | undefined,
  leave: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  markDocumentDeleted(id);
  try {
    await indexClient.deleteItem(id);
  } catch {
    unmarkDocumentDeleted(id);
    return false;
  }
  track('Document', 'Deleted');
  handOffDeleteUndo(id, name);
  leave(
    explorerHref('', `?${new URLSearchParams({ trashed: id, ...(name ? { title: name } : {}) })}`),
  );
  return true;
}

export function handOffDeleteUndo(id: string, name?: string | null, now = Date.now()): void {
  try {
    const handoff: Handoff = { id, at: now, ...(name ? { name } : {}) };
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Storage off: the document is still in the Trash.
  }
}

/** The handed-over delete, taken (read once and cleared); null when there is none or it is stale. */
export function takeDeleteUndo(now = Date.now()): TrashedDocument | null {
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
let arrival: { taken: boolean; document: TrashedDocument | null } = {
  taken: false,
  document: null,
};

/** The document deleted just before this page opened, for the Explorer's Undo; null on the server or when none. */
export function arrivedTrashed(): TrashedDocument | null {
  if (typeof window === 'undefined') return null;
  if (!arrival.taken) arrival = { taken: true, document: takeDeleteUndo() };
  return arrival.document;
}
