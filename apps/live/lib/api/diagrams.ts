// Diagram-level calls: load / create / save-meta / delete / list, the
// copy-into-my-files flow, and the "Shared with you" list.
import type { Diagram, DiagramSummary, SharedWithItem } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/diagram';
import { dedupeInFlight } from '../dedupe';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  stripUiTabFields,
  type DiagramResponse,
  type ListResponse,
} from './core';

// The diagram-list row every list surface renders: the Explorer
// panel, the /explorer page, /new, and the editor's diagram-list
// state. A Pick of the wire type so the UI rows can't drift from
// what apiListDiagrams actually returns; surfaces needing more
// fields widen the Pick rather than re-declaring the shape.
export type DiagramListItem = Pick<
  DiagramSummary,
  'id' | 'name' | 'folderId' | 'savedAt' | 'shareCode' | 'ownerId'
>;

// Deduped on `${ownerId}|${id}`: the editor mounts and React Strict
// Mode in dev double-invokes its hydration effect, so this fires
// twice on first paint. With dedup, the second call receives the
// in-flight promise instead of opening a second request to the
// same diagram.
async function _apiLoadDiagram(ownerId: string, id: string): Promise<Diagram | null> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, {
    headers: await apiHeaders(ownerId),
  });
  const body = await expectOkOrNull<DiagramResponse>(res, 'load');
  return body?.diagram ?? null;
}
export const apiLoadDiagram = dedupeInFlight(_apiLoadDiagram, (ownerId, id) => `${ownerId}|${id}`);

// Persist diagram-level metadata: name (rename), tab order, and each
// tab's per-diagram folder (spec/30). Used for tab reorders + rename
// + folder ops — anything that doesn't touch element content. Element
// changes go through apiSaveTab. Callers pass `tabs` (id + order +
// folder); `tabIds` stays accepted as the legacy folder-less shape.
export async function apiSaveDiagramMeta(
  ownerId: string,
  d: {
    id: string;
    name?: string;
    tabs?: { id: string; folder?: string }[];
    tabIds?: string[];
  },
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${d.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify({ name: d.name, tabs: d.tabs, tabIds: d.tabIds }),
  });
  await expectOkVoid(res, 'save diagram meta');
}

// Create a brand-new diagram with an optional initial set of tabs.
// Returns the meta + tab summaries the API stored. The live app uses
// this when the welcome flow commits a fresh id so the very first
// per-tab fetch lands on a populated row.
export async function apiCreateDiagram(
  ownerId: string,
  d: { id: string; name: string; tabs?: Tab[] },
): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      id: d.id,
      name: d.name,
      tabs: (d.tabs ?? []).map(stripUiTabFields),
    }),
  });
  const { diagram } = await expectOk<DiagramResponse>(res, 'create diagram');
  return diagram;
}

export async function apiDeleteDiagram(ownerId: string, id: string): Promise<void> {
  // Owner-gated server-side as of the security fix — without the
  // identity headers the worker would 400 / 403. apiHeaders prefers
  // the Clerk Bearer when a token provider is registered, falls
  // through to X-Owner-Id otherwise (spec/04, spec/11).
  return apiDelete(`${API_BASE}/diagrams/${id}`, ownerId, { action: 'delete diagram' });
}

async function _apiListDiagrams(ownerId: string): Promise<DiagramSummary[]> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    headers: await apiHeaders(ownerId),
  });
  const { diagrams } = await expectOk<ListResponse>(res, 'list');
  return diagrams;
}
export const apiListDiagrams = dedupeInFlight(_apiListDiagrams, (ownerId) => ownerId);

// ---------------------------------------------------------------------
// shared_with — "Shared with you" (migration 0010)
// ---------------------------------------------------------------------

// The "Shared with you" row shape now lives in @livediagram/api-schema
// (the api worker emits it via listSharedWith), imported above and
// re-exported here so the existing `@/lib/api-client` / `./api/diagrams`
// import paths keep resolving unchanged. See that package for the
// per-field rationale.
export type { SharedWithItem };

// List diagrams that have been shared with this owner (i.e. the
// owner previously opened a share link for them and was identified
// to the api at the time). Returns newest-interaction-first.
// Same dedupe rationale as apiListDiagrams: editor + /new +
// /explorer all mount surfaces that fire this on first paint.
async function _apiListSharedWith(ownerId: string): Promise<SharedWithItem[]> {
  const res = await fetch(`${API_BASE}/shared`, { headers: await apiHeaders(ownerId) });
  const { shared } = await expectOk<{ shared: SharedWithItem[] }>(res, 'list shared');
  return shared;
}
export const apiListSharedWith = dedupeInFlight(_apiListSharedWith, (ownerId) => ownerId);

// Dismiss a single "shared with you" row.
export async function apiDismissSharedWith(ownerId: string, diagramId: string): Promise<void> {
  return apiDelete(`${API_BASE}/shared/${diagramId}`, ownerId, {
    action: 'dismiss shared',
    allow404: false,
  });
}

// Copy a diagram (typically one shared with the caller) into the
// caller's own files. Returns the new diagram. Optional shareCode
// covers the "visitor just arrived via share URL, no shared_with
// row yet" path — when present the api worker uses it as the
// authorisation proof instead of looking up shared_with.
export async function apiCopyDiagram(
  ownerId: string,
  sourceId: string,
  opts: { name?: string; shareCode?: string | null } = {},
): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams/${sourceId}/copy`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true, share: opts.shareCode ?? null }),
    body: JSON.stringify({ name: opts.name }),
  });
  const { diagram } = await expectOk<DiagramResponse>(res, 'copy diagram');
  return diagram;
}
