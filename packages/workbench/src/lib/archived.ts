// An archived file in an editor (liveworkspace/docs/specs/004-index/one-explorer.md "Archived"): one its owner put in
// Archived never opens. The index refuses its grant as `archived` (only its owner hears that; anyone else hears it is
// missing), and one kept only in this browser carries the mark in This Browser's list. Either way the editor shows
// its archived card in place of the file, and the card's Change Folder goes back to the Explorer's Archived view,
// which opens Change Folder on it.
import type { App } from '@liveworkspace/index-client';
import { isThisBrowserArchived } from '@liveworkspace/explorer/this-browser';
import { explorerHref } from './explorer-href';

/** The index's refusal for an archived item, as the held grants remember it. */
export const ARCHIVED_REFUSAL = 'archived';

/** Where the archived card's Change Folder goes: the Explorer's Archived view, opening Change Folder on `id`. */
export function archivedChangeFolderHref(id: string, origin = ''): string {
  return `${origin}/explorer/archived?move=${encodeURIComponent(id)}`;
}

/** Whether this browser holds `id` archived: asked before the editor opens it, so it never does. */
export function archivedInThisBrowser(app: App, id: string | null): boolean {
  return id !== null && isThisBrowserArchived(app, id);
}

/** Whether a load failed because the item is archived: the api's `409 archived`, the index's refusal relayed for the
 *  owner. Only that exact answer: any other failure is a real load error and keeps its error screen. */
export function isArchivedLoadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const { status, code } = err as { status?: unknown; code?: unknown };
  return status === 409 && code === ARCHIVED_REFUSAL;
}

/** Whether the index refused `id` because it is archived (`refusal` is the app's held-grants reader). */
export function archivedByIndex(
  id: string | null,
  refusal: (id: string) => string | null,
): boolean {
  return id !== null && refusal(id) === ARCHIVED_REFUSAL;
}

// ---------- Archiving the open file ------------------------------------------------------------------------------
// Archived is closed, so the file open in the editor, once archived from the Explorer panel, leaves for the Explorer
// as a deleted one does (one-explorer.md "Archiving the open item"). The Explorer page takes it from its address
// (`?archived=<id>&title=<name>`, dropped once read); a workbench frame's Explorer takes it from sessionStorage, kept
// for one page load and only for a moment, so a later visit says nothing.

/** The address's handoff of a file just archived (its title rides as `title`, as a deleted one's does). */
export const ARCHIVED_PARAM = 'archived';

const HANDOFF_MAX_AGE_MS = 30_000;
const handoffKey = (app: App) => `${app}:archived-open-item`;

export type ArchivedItem = { id: string; title: string | null };
type Handoff = { id: string; name?: string; at: number };

/** Leaves the editor for the Explorer, which says the open file went to Archived. */
export function leaveArchivedItem(
  app: App,
  item: ArchivedItem,
  leave: (href: string) => void = (href) => window.location.assign(href),
  now = Date.now(),
): void {
  const name = item.title || null;
  try {
    const handoff: Handoff = { id: item.id, at: now, ...(name ? { name } : {}) };
    window.sessionStorage.setItem(handoffKey(app), JSON.stringify(handoff));
  } catch {
    // Storage off: the Explorer page still reads the address.
  }
  const search = new URLSearchParams({
    [ARCHIVED_PARAM]: item.id,
    ...(name ? { title: name } : {}),
  });
  leave(explorerHref('', `?${search}`));
}

/** The handed-over archive, taken (read once and cleared); null when there is none or it is stale. */
export function takeArchivedHandoff(app: App, now = Date.now()): ArchivedItem | null {
  try {
    const raw = window.sessionStorage.getItem(handoffKey(app));
    if (raw === null) return null;
    window.sessionStorage.removeItem(handoffKey(app));
    const h = JSON.parse(raw) as Partial<Handoff>;
    if (typeof h.id !== 'string' || typeof h.at !== 'number') return null;
    if (now - h.at > HANDOFF_MAX_AGE_MS || now < h.at) return null;
    return { id: h.id, title: typeof h.name === 'string' ? h.name : null };
  } catch {
    return null;
  }
}

// Taken once per page load and kept, so a remount (or Strict Mode's second call) sees the same answer.
const arrivals = new Map<App, ArchivedItem | null>();

/** The file archived just before this page opened, for the Explorer to say; null on the server or when none. */
export function arrivedArchived(app: App): ArchivedItem | null {
  if (typeof window === 'undefined') return null;
  if (!arrivals.has(app)) arrivals.set(app, takeArchivedHandoff(app));
  return arrivals.get(app) ?? null;
}

/** Forgets what this page load took (tests). */
export function forgetArchivedArrival(): void {
  arrivals.clear();
}

// ---------- Archived from elsewhere while open ---------------------------------------------------------------------
// An archive made anywhere else (another tab, MCP, the CLI) closes the item's room with ITEM_ARCHIVED_CLOSE
// (one-explorer.md "Archived from elsewhere while open"), and every editor on it leaves for the Explorer.

/** The Explorer address's word (`?ended=`) for an item its owner archived while someone else had it open. */
export const ENDED_ARCHIVED = 'archived';

/** Leaves the editor for the Explorer once the open file was archived elsewhere: its owner as for an archive made here
 *  (the Explorer says it moved to Archived), anyone else with `?ended=archived` (it says its owner archived it). */
export function leaveArchivedElsewhere(
  app: App,
  item: ArchivedItem,
  isOwner: boolean,
  leave: (href: string) => void = (href) => window.location.assign(href),
  now = Date.now(),
): void {
  if (isOwner) {
    leaveArchivedItem(app, item, leave, now);
    return;
  }
  leave(explorerHref('', `?ended=${ENDED_ARCHIVED}`));
}
