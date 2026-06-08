// Per-tab calls: lazy load, upsert (the autosave path), comment append,
// cross-diagram link, and delete.
import type { TabSummary } from '@livediagram/api-schema';
import { normalizeTable, type Tab } from '@livediagram/diagram';
import { dedupeInFlight } from '../dedupe';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  stripTemplateChosen,
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
export async function apiSaveTab(
  ownerId: string,
  diagramId: string,
  tab: Tab,
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tab.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(stripTemplateChosen(tab)),
  });
  await expectOkVoid(res, 'save tab');
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
