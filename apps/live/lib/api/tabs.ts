// Per-tab calls: lazy load, upsert (the autosave path), comment append,
// cross-diagram link, and delete.
import type { TabSummary } from '@livediagram/api-schema';
import { normalizeTable, type Tab } from '@livediagram/diagram';
import { dedupeInFlight } from '../dedupe';
import { getGuestSelfSig } from '../local-identity';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  stripUiTabFields,
  type TabResponse,
} from './core';

// Full tab payload, including elements + per-tab metadata. Pulled
// lazily when the user opens a tab; the diagram-summary fetch only
// carries TabSummary rows.
async function _apiLoadTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null,
): Promise<Tab | null> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, {
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  const body = await expectOkOrNull<TabResponse>(res, 'load tab');
  if (!body) return null;
  const { tab } = body;
  const { diagramId: _did, orderIndex: _oi, updatedAt: _ua, ...clientTab } = tab;
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
  return clientTab;
}
export const apiLoadTab = dedupeInFlight(
  _apiLoadTab,
  (ownerId, diagramId, tabId, shareCode) => `${ownerId}␟${diagramId}␟${tabId}␟${shareCode ?? ''}`,
);

// Upsert a single tab. The active edit path — autosave hits this
// instead of shipping every tab on every keystroke.
//
// `allowEmpty` opts into overwriting a tab whose stored row has content
// with an empty one. The server refuses that by default (spec/13
// data-loss backstop) so a never-loaded placeholder PUT can't wipe a
// real row. The caller sets it only when the tab's content was
// authoritatively loaded — i.e. a genuine reset-canvas / delete-all,
// never an unfetched placeholder. Forwarded as `X-Allow-Empty: 1`.
export async function apiSaveTab(
  ownerId: string,
  diagramId: string,
  tab: Tab,
  shareCode: string | null = null,
  opts: { allowEmpty?: boolean } = {},
): Promise<void> {
  const headers = new Headers(await apiHeaders(ownerId, { share: shareCode, body: true }));
  if (opts.allowEmpty) headers.set('X-Allow-Empty', '1');
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tab.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(stripUiTabFields(tab)),
  });
  await expectOkVoid(res, 'save tab');
}

// Last-ditch `beforeunload` flush of pending tab/meta writes (spec/13),
// so a fast edit -> reload doesn't lose changes. Lives here at the
// persistence boundary rather than inline in useAutosave so the editor
// hook holds no raw fetch — the debounced save already goes through
// apiSaveTab/apiDeleteTab/apiSaveDiagramMeta; this is the same set of
// writes for the unload moment.
//
// Why it can't reuse those async helpers: a `beforeunload` handler can't
// await, and the Clerk token provider (apiHeaders) is async — so this
// path builds headers synchronously and uses `keepalive: true` to let
// each request outlive the teardown. The synchronous header is
// `X-Owner-Id` (the guest identity); the Bearer token isn't retrievable
// without awaiting, exactly as the previous inline version did it. The
// debounced save carries the correct hybrid identity for the common
// (non-unload) case. Callers pass an already-diffed change set
// (computeTabSaveDiff); empty sets fire nothing.
export function flushDiagramSavesBeacon(args: {
  ownerId: string;
  diagramId: string;
  shareCode: string | null;
  changedTabs: Tab[];
  deletedIds: string[];
  // Tabs whose content is authoritative in memory — only these may
  // authorise an empty-body overwrite (X-Allow-Empty), mirroring the
  // debounced path's spec/13 data-loss backstop.
  loadedTabIds: Set<string>;
  orderChanged: boolean;
  nameChanged: boolean;
  name: string;
  tabs: Tab[];
}): void {
  const base: Record<string, string> = { 'X-Owner-Id': args.ownerId };
  // The guest signature is a synchronous localStorage read, so unlike the
  // Bearer token it CAN ride the unload beacon. Without it these writes
  // 401 (signature_required) once guest-sig enforcement is on, silently
  // losing the final debounce window's edits — the exact loss this flush
  // exists to prevent.
  const sig = getGuestSelfSig();
  if (sig) base['X-Owner-Sig'] = sig;
  if (args.shareCode) base['X-Share-Code'] = args.shareCode;
  const jsonHeaders = { ...base, 'Content-Type': 'application/json' };
  for (const t of args.changedTabs) {
    const headers = args.loadedTabIds.has(t.id)
      ? { ...jsonHeaders, 'X-Allow-Empty': '1' }
      : jsonHeaders;
    void fetch(`${API_BASE}/diagrams/${args.diagramId}/tabs/${t.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(stripUiTabFields(t)),
      keepalive: true,
    }).catch(() => {});
  }
  for (const tabId of args.deletedIds) {
    void fetch(`${API_BASE}/diagrams/${args.diagramId}/tabs/${tabId}`, {
      method: 'DELETE',
      headers: base,
      keepalive: true,
    }).catch(() => {});
  }
  if (args.orderChanged || args.nameChanged) {
    void fetch(`${API_BASE}/diagrams/${args.diagramId}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: args.name,
        tabs: args.tabs.map((t) => ({ id: t.id, folder: t.folder })),
      }),
      keepalive: true,
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
  diagramId: string,
  tabId: string,
  elementId: string,
  text: string,
  shareCode: string | null = null,
): Promise<{
  id: string;
  text: string;
  createdAt: number;
  authorName: string;
  authorColor: string;
}> {
  const res = await fetch(
    `${API_BASE}/diagrams/${encodeURIComponent(diagramId)}/tabs/${encodeURIComponent(tabId)}/comments`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify({ elementId, text }),
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
  diagramId: string,
  tabId: string,
  commentId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/diagrams/${encodeURIComponent(diagramId)}/tabs/${encodeURIComponent(tabId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      headers: await apiHeaders(ownerId, { share: shareCode }),
    },
  );
  await expectOkVoid(res, 'delete comment');
}

// Link an existing tab into another of the caller's diagrams
// (spec/17). After this returns, the tab body is shared: edits
// from either diagram write to the same `tabs.data` row. Returns
// the target diagram's summary view of the now-attached tab so
// the caller can update its TabBar without a full diagram
// refetch.
export async function apiLinkTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
): Promise<TabSummary> {
  const res = await fetch(
    `${API_BASE}/diagrams/${encodeURIComponent(diagramId)}/tabs/${encodeURIComponent(tabId)}/link`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId),
    },
  );
  return expectOk<{ tab: TabSummary }>(res, 'link tab').then((b) => b.tab);
}

export async function apiDeleteTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<void> {
  return apiDelete(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, ownerId, {
    action: 'delete tab',
    share: shareCode,
  });
}
