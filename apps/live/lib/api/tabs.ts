// Per-tab calls: lazy load, upsert (the autosave path), comment append,
// cross-document link, and delete.
import {
  CHANGESET_SEEN_HEADER,
  DOCUMENT_OPEN_HEADER,
  type TabResponse,
  type TabSummary,
} from '@livediagram/api-schema';
import { normalizeTable, type CommentMention, type Tab } from '@livediagram/document';
import { dedupeInFlight } from '../dedupe';
import {
  isOfflineId,
  isOfflineIdSync,
  offlineDeleteTab,
  offlineLoadTab,
  offlineSaveDocumentMeta,
  offlineSaveTab,
} from '../offline/offline-store';
import { offlineRecordOpen } from '../offline/offline-opens';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  getLastKnownToken,
  getSessionSharePassword,
  identityHeaders,
  tabForWire,
  apiFetch,
} from './core';

// Full tab payload, including elements + per-tab metadata. Pulled
// lazily when the user opens a tab; the document-summary fetch only
// carries TabSummary rows.
//
// `open` declares this read an open of the document, for the reader's
// Home (docs/specs/013-workspace/explorer-home.md "Opens"): only the
// editor's first-tab read sets it, never a resync, a duplicate, Take
// Offline, the Drive mirror or an embed.
//
// The tab's revision rides beside it (docs/specs/024-agents/agent-changesets.md "The tab revision",
// CS41), never inside it: the editor's tabs hold content only, and the revision tells the changeset
// feed what the loaded content already holds. An offline tab has no revision (0).
async function _apiLoadTabRevisioned(
  ownerId: string,
  documentId: string,
  tabId: string,
  shareCode: string | null,
  opts: { open?: boolean } = {},
): Promise<{ tab: Tab; rev: number } | null> {
  // Offline Mode (docs/specs/006-document/offline-mode.md): an offline document's tabs come from IndexedDB,
  // and this browser counts its opens, since the server never sees it (offline-opens.ts).
  if (await isOfflineId(documentId)) {
    if (opts.open) void offlineRecordOpen(documentId, Date.now());
    const tab = await offlineLoadTab(documentId, tabId);
    return tab ? { tab, rev: 0 } : null;
  }
  const res = await apiFetch(`${API_BASE}/documents/${documentId}/tabs/${tabId}`, {
    headers: await apiHeaders(ownerId, {
      share: shareCode,
      ...(opts.open ? { extra: { [DOCUMENT_OPEN_HEADER]: '1' } } : {}),
    }),
  });
  const body = await expectOkOrNull<TabResponse>(res, 'load tab');
  if (!body) return null;
  const { tab } = body;
  const { documentId: _did, orderIndex: _oi, updatedAt: _ua, rev, ...clientTab } = tab;
  void _did;
  void _oi;
  void _ua;
  // Coerce any table to a rectangular grid on load: this is the single
  // boundary where stored elements enter the editor, so a legacy / hand-
  // edited row with a ragged `cells` array can't reach the renderer and
  // break the grid. No-op for the common case (the editor only ever
  // writes rectangular tables).
  if (clientTab.elements.some((el) => el.type === 'table')) {
    clientTab.elements = clientTab.elements.map((el) =>
      el.type === 'table' ? normalizeTable(el) : el,
    );
  }
  // An api older than tab revisions answers none: nothing held, so every changeset is news.
  return { tab: clientTab, rev: typeof rev === 'number' ? rev : 0 };
}
export const apiLoadTabRevisioned = dedupeInFlight<
  Parameters<typeof _apiLoadTabRevisioned>,
  { tab: Tab; rev: number } | null
>(
  _apiLoadTabRevisioned,
  // The open marker is part of the key: an unmarked load already in flight must not swallow the
  // editor's marked one, or the open would never be recorded.
  (ownerId, documentId, tabId, shareCode, opts) =>
    `${ownerId}␟${documentId}␟${tabId}␟${shareCode ?? ''}␟${opts?.open ? 'open' : ''}`,
);

// The tab alone, for callers that need no revision (a duplicate, Take Offline, the Drive mirror).
export async function apiLoadTab(
  ...args: Parameters<typeof _apiLoadTabRevisioned>
): Promise<Tab | null> {
  return (await apiLoadTabRevisioned(...args))?.tab ?? null;
}

// Upsert a single tab. The active edit path — autosave hits this
// instead of shipping every tab on every keystroke.
//
// `allowEmpty` opts into overwriting a tab whose stored row has content
// with an empty one. The server refuses that by default (docs/specs/006-document/per-tab-storage.md
// data-loss backstop) so a never-loaded placeholder PUT can't wipe a
// real row. The caller sets it only when the tab's content was
// authoritatively loaded — i.e. a genuine reset-canvas / delete-all,
// never an unfetched placeholder. Forwarded as `X-Allow-Empty: 1`.
export async function apiSaveTab(
  ownerId: string,
  documentId: string,
  tab: Tab,
  shareCode: string | null = null,
  // `roomCursor`: where this client stood in the realtime room when it took
  // the snapshot, so the api merges only the room's answers it hadn't seen
  // (docs/specs/012-collaboration/collab-race-hardening.md phase 3).
  // `changesetSeen`: the highest changeset revision applied to this tab here, so the api merges
  // only the changesets this editor has not (docs/specs/024-agents/agent-changesets.md).
  opts: {
    allowEmpty?: boolean;
    roomCursor?: { epoch: string; seq: number } | null;
    changesetSeen?: number;
  } = {},
): Promise<number | null> {
  if (await isOfflineId(documentId)) {
    await offlineSaveTab(documentId, tab, Date.now());
    return null;
  }
  const headers = new Headers(await apiHeaders(ownerId, { share: shareCode, body: true }));
  if (opts.allowEmpty) headers.set('X-Allow-Empty', '1');
  if (opts.roomCursor) {
    headers.set('X-Room-Cursor', `${opts.roomCursor.epoch}:${opts.roomCursor.seq}`);
  }
  if (opts.changesetSeen !== undefined) {
    headers.set(CHANGESET_SEEN_HEADER, String(opts.changesetSeen));
  }
  const res = await apiFetch(`${API_BASE}/documents/${documentId}/tabs/${tab.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(tabForWire(tab)),
  });
  await expectOkVoid(res, 'save tab');
  return savedRevOf(res);
}

// The revision a save wrote, from the tab the api echoes; null when the answer names none.
async function savedRevOf(res: Response): Promise<number | null> {
  try {
    const body = (await res.json()) as { tab?: { rev?: unknown } };
    const rev = body.tab?.rev;
    return typeof rev === 'number' ? rev : null;
  } catch {
    return null;
  }
}

// Last-ditch `beforeunload` flush of pending tab/meta writes (docs/specs/006-document/per-tab-storage.md),
// so a fast edit -> reload doesn't lose changes. Lives here at the
// persistence boundary rather than inline in useAutosave so the editor
// hook holds no raw fetch — the debounced save already goes through
// apiSaveTab/apiDeleteTab/apiSaveDocumentMeta; this is the same set of
// writes for the unload moment.
//
// Why it can't reuse those async helpers: a `beforeunload` handler can't
// await, and the Clerk token provider (apiHeaders) is async — so this
// path builds headers synchronously and uses `keepalive: true` to let
// each request outlive the teardown. Identity comes from the sync
// sources: the Bearer token apiHeaders cached on its last fetch for
// signed-in sessions, else X-Owner-Id + guest signature. The debounced
// save carries the freshly-fetched hybrid identity for the common
// (non-unload) case. Callers pass an already-diffed change set
// (computeTabSaveDiff); empty sets fire nothing.
// The keepalive bodies an unload flush sends at most: browsers allow 64 KB in all per page; the rest is
// headroom for another keepalive request in flight. Safe range: 32 KB to 63 KB.
export const KEEPALIVE_BUDGET_BYTES = 60 * 1024;

export function flushDocumentSavesBeacon(args: {
  ownerId: string;
  documentId: string;
  shareCode: string | null;
  changedTabs: Tab[];
  deletedIds: string[];
  // Tabs whose content is authoritative in memory — only these may
  // authorise an empty-body overwrite (X-Allow-Empty), mirroring the
  // debounced path's docs/specs/006-document/per-tab-storage.md data-loss backstop.
  loadedTabIds: Set<string>;
  orderChanged: boolean;
  nameChanged: boolean;
  name: string;
  tabs: Tab[];
  // The seen changeset revision per tab, as the debounced save sends it.
  changesetSeen?: ReadonlyMap<string, number>;
}): void {
  // Offline Mode (docs/specs/006-document/offline-mode.md): best-effort flush to IndexedDB. A beforeunload
  // handler can't await, so these writes may not finish — the 600ms debounced
  // autosave covers all but the final edit window. Sync id check off the cache.
  if (isOfflineIdSync(args.documentId)) {
    const now = Date.now();
    for (const t of args.changedTabs) void offlineSaveTab(args.documentId, t, now);
    for (const tabId of args.deletedIds) void offlineDeleteTab(args.documentId, tabId, now);
    // The rename / tab order too, like the cloud branch below: returning
    // before it lost a rename or reorder made in the last debounce window.
    if (args.orderChanged || args.nameChanged) {
      void offlineSaveDocumentMeta(
        args.documentId,
        { name: args.name, tabs: args.tabs.map((t) => ({ id: t.id, folder: t.folder })) },
        now,
      );
    }
    return;
  }
  // Identity, synchronously (a beforeunload handler can't await):
  // signed-in sessions ride the token apiHeaders cached on its last
  // fetch — the autosave loop refreshes it every ~600ms while editing,
  // so it's seconds old at teardown. Guests ride X-Owner-Id plus the
  // guest signature (a sync localStorage read); without the sig these
  // writes 401 (signature_required) once guest-sig enforcement is on,
  // silently losing the final debounce window's edits — the exact loss
  // this flush exists to prevent. The rule is apiHeaders' own
  // (identityHeaders). A signed-in owner with no cached token has nothing the worker accepts, so
  // skip the flush rather than fire writes that are certain to 401.
  let base: Record<string, string>;
  try {
    base = identityHeaders(args.ownerId, getLastKnownToken());
  } catch {
    console.warn('[save] unload flush skipped: no session token for a signed-in owner');
    return;
  }
  if (args.shareCode) base['X-Share-Code'] = args.shareCode;
  // The share password (docs/specs/013-workspace/share-password.md) is a synchronous session read too —
  // without it an edit-role visitor's flush 403s on a protected
  // document, losing the final debounce window's edits.
  const sharePassword = getSessionSharePassword();
  if (sharePassword) base['X-Share-Password'] = sharePassword;
  const jsonHeaders = { ...base, 'Content-Type': 'application/json' };
  // Browsers refuse keepalive bodies past 64 KB in all (per page), and the refusal was swallowed below, so a
  // large tab's last edits were lost on close. Keepalive while the bodies fit; past that, a plain request,
  // which still lands when the page lives on (hidden, or left for another page of the app).
  let keepaliveLeft = KEEPALIVE_BUDGET_BYTES;
  const keepaliveFor = (body: string | undefined) => {
    const bytes = body ? new TextEncoder().encode(body).length : 0;
    if (bytes > keepaliveLeft) return false;
    keepaliveLeft -= bytes;
    return true;
  };
  for (const t of args.changedTabs) {
    const seen = args.changesetSeen?.get(t.id);
    const headers: Record<string, string> = {
      ...jsonHeaders,
      ...(args.loadedTabIds.has(t.id) ? { 'X-Allow-Empty': '1' } : {}),
      ...(seen !== undefined ? { [CHANGESET_SEEN_HEADER]: String(seen) } : {}),
    };
    const body = JSON.stringify(tabForWire(t));
    void apiFetch(`${API_BASE}/documents/${args.documentId}/tabs/${t.id}`, {
      method: 'PUT',
      headers,
      body,
      keepalive: keepaliveFor(body),
    }).catch(() => {});
  }
  for (const tabId of args.deletedIds) {
    void apiFetch(`${API_BASE}/documents/${args.documentId}/tabs/${tabId}`, {
      method: 'DELETE',
      headers: base,
      keepalive: keepaliveFor(undefined),
    }).catch(() => {});
  }
  if (args.orderChanged || args.nameChanged) {
    const body = JSON.stringify({
      name: args.name,
      tabs: args.tabs.map((t) => ({ id: t.id, folder: t.folder })),
    });
    void apiFetch(`${API_BASE}/documents/${args.documentId}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body,
      keepalive: keepaliveFor(body),
    }).catch(() => {});
  }
}

// Append a comment to one element's thread on a specific tab.
// View-role visitors can call this (the only write path open to
// them): owner / edit-role visitors also could but already get
// the same write via the tab autosave, so the editor only invokes
// this for view-role sessions so a viewer's contribution actually
// persists. Returns the freshly-created comment so the caller can
// merge it into local state without a tab refetch.
export async function apiAddComment(
  ownerId: string,
  documentId: string,
  tabId: string,
  elementId: string,
  text: string,
  shareCode: string | null = null,
  // Teammates the comment @-tags (docs/specs/012-collaboration/comment-mentions.md); cleaned server-side.
  mentions?: CommentMention[],
): Promise<{
  id: string;
  text: string;
  createdAt: number;
  authorName: string;
  authorColor: string;
}> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/comments`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify({ elementId, text, ...(mentions?.length ? { mentions } : {}) }),
    },
  );
  return expectOk<{
    comment: {
      id: string;
      text: string;
      createdAt: number;
      authorName: string;
      authorColor: string;
    };
  }>(res, 'add comment').then((b) => b.comment);
}

// Delete a single comment you authored. The server authorises this on
// the comment's stamped authorId === caller, so a view-role visitor can
// remove their OWN comment (the matching write path to apiAddComment)
// without edit rights. Owner / edit-role sessions persist their
// delete-own through the normal tab autosave, so the editor only calls
// this for view-role; deleting someone else's comment still requires
// edit rights via the tab PUT.
export async function apiDeleteComment(
  ownerId: string,
  documentId: string,
  tabId: string,
  commentId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      headers: await apiHeaders(ownerId, { share: shareCode }),
    },
  );
  await expectOkVoid(res, 'delete comment');
}

// Resolve or reopen a thread through the comment endpoints (docs/specs/024-agents/agent-presence.md "Comments"): the
// path of a session that may comment but not edit, which has no autosave. The thread is named by any of its comments.
export async function apiSetThreadResolved(
  ownerId: string,
  documentId: string,
  tabId: string,
  commentId: string,
  resolved: boolean,
  shareCode: string | null = null,
): Promise<void> {
  const verb = resolved ? 'resolve' : 'reopen';
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/comments/${encodeURIComponent(commentId)}/${verb}`,
    { method: 'POST', headers: await apiHeaders(ownerId, { share: shareCode }) },
  );
  await expectOkVoid(res, `${verb} thread`);
}

// Link an existing tab into another of the caller's documents
// (docs/specs/006-document/tab-document-many-to-many.md). After this returns, the tab body is shared: edits
// from either document write to the same `tabs.data` row. Returns
// the target document's summary view of the now-attached tab so
// the caller can update its TabBar without a full document
// refetch.
export async function apiLinkTab(
  ownerId: string,
  documentId: string,
  tabId: string,
): Promise<TabSummary> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/link`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId),
    },
  );
  return expectOk<{ tab: TabSummary }>(res, 'link tab').then((b) => b.tab);
}

export async function apiDeleteTab(
  ownerId: string,
  documentId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<void> {
  if (await isOfflineId(documentId)) return offlineDeleteTab(documentId, tabId, Date.now());
  return apiDelete(`${API_BASE}/documents/${documentId}/tabs/${tabId}`, ownerId, {
    action: 'delete tab',
    share: shareCode,
  });
}
