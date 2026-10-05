// Document-level calls: load / create / save-meta / delete / list, the
// copy-into-my-files flow, and the "Shared with you" list.
import type { ItemCreate, ItemTypeCatalogue } from '@livediagram/items';
import {
  DOCUMENT_CONVERSION_HEADER,
  scalableSnapshotSvg,
  svgBackgroundColor,
  type CreationIntent,
  type DocumentConversion,
  type SharedTabsSummary,
} from '@livediagram/api-schema';
import type {
  LiveDoc,
  DocumentListResponse,
  DocumentResponse,
  DocumentSummary,
  SharedWithItem,
} from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import { dedupeInFlight } from '../dedupe';
import {
  isOfflineId,
  offlineListDocuments,
  offlineLoadDocument,
  offlineSaveDocumentMeta,
} from '../offline/offline-store';
import { offlinePurgeExpiredTrash, offlineTrashDocument } from '../offline/offline-trash';
import { rememberRecentDiagrams } from '../recent-diagrams-snapshot';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  tabForWire,
  apiFetch,
} from './core';

// The document-list row every list surface renders: the Explorer
// panel, the /explorer page, /new, and the editor's document-list
// state. A Pick of the wire type so the UI rows can't drift from
// what apiListDocuments actually returns; surfaces needing more
// fields widen the Pick rather than re-declaring the shape.
export type DocumentListItem = Pick<
  DocumentSummary,
  'id' | 'name' | 'folderId' | 'savedAt' | 'shareCode' | 'ownerId'
> & {
  // Provenance (docs/specs/013-workspace/folders.md). Present on real list rows from the API; optional
  // so synthetic rows (shared / team placeholders) can omit it. Absent or
  // null means user-made (no Made by AI badge).
  source?: DocumentSummary['source'];
  // Nothing drawn (docs/specs/006-document/document-snapshots.md): the row asks for no thumbnail. Absent on a
  // synthetic row, which asks as before.
  empty?: DocumentSummary['empty'];
  // The creation intent recorded on the document (docs/specs/013-workspace/default-folders.md
  // "Recorded intent"), which the Explorer filters read. Absent on a row that cannot say (an
  // offline record, a synthetic shared row): it reads as unknown.
  opensIn?: DocumentSummary['opensIn'];
  tabKind?: DocumentSummary['tabKind'];
  templateFamily?: DocumentSummary['templateFamily'];
};

// Deduped on `${ownerId}|${id}`: the editor mounts and React Strict
// Mode in dev double-invokes its hydration effect, so this fires
// twice on first paint. With dedup, the second call receives the
// in-flight promise instead of opening a second request to the
// same document.
async function _apiLoadDocument(ownerId: string, id: string): Promise<LiveDoc | null> {
  // Offline Mode (docs/specs/006-document/offline-mode.md): a document registered offline loads from IndexedDB,
  // never the API. Same for the save / delete / list paths below.
  if (await isOfflineId(id)) return offlineLoadDocument(id);
  const res = await apiFetch(`${API_BASE}/documents/${id}`, {
    headers: await apiHeaders(ownerId),
  });
  const body = await expectOkOrNull<DocumentResponse>(res, 'load');
  return body?.document ?? null;
}
export const apiLoadDocument = dedupeInFlight(
  _apiLoadDocument,
  (ownerId, id) => `${ownerId}|${id}`,
);

// How many of the document's tabs are also in other documents, and how many
// documents (docs/specs/006-document/tab-document-many-to-many.md, "Shared-tab
// notice"). Null for an offline document: its tabs live only in this browser.
export async function apiSharedTabs(
  ownerId: string,
  id: string,
  signal?: AbortSignal,
): Promise<SharedTabsSummary | null> {
  if (await isOfflineId(id)) return null;
  const res = await apiFetch(`${API_BASE}/documents/${id}/shared-tabs`, {
    headers: await apiHeaders(ownerId),
    ...(signal ? { signal } : {}),
  });
  const { sharedTabs } = await expectOk<{ sharedTabs: SharedTabsSummary }>(res, 'shared tabs');
  return sharedTabs;
}

// Persist document-level metadata: name (rename), tab order, and each
// tab's per-document folder (docs/specs/006-document/tab-folders.md). Used for tab reorders + rename
// + folder ops — anything that doesn't touch element content. Element
// changes go through apiSaveTab. Callers pass `tabs` (id + order +
// folder); `tabIds` stays accepted as the legacy folder-less shape.
export async function apiSaveDocumentMeta(
  ownerId: string,
  d: {
    id: string;
    name?: string;
    tabs?: { id: string; folder?: string }[];
    tabIds?: string[];
    // Slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised. Absent leaves the stored deck alone,
    // which is what every save that isn't about the deck sends; null clears
    // it. JSON.stringify drops an undefined field, so "absent" travels as
    // absent rather than as null.
    presentation?: string | null;
  },
  shareCode: string | null = null,
): Promise<void> {
  if (await isOfflineId(d.id)) {
    await offlineSaveDocumentMeta(
      d.id,
      { name: d.name, tabs: d.tabs, presentation: d.presentation },
      Date.now(),
    );
    return;
  }
  const res = await apiFetch(`${API_BASE}/documents/${d.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify({
      name: d.name,
      tabs: d.tabs,
      tabIds: d.tabIds,
      presentation: d.presentation,
    }),
  });
  await expectOkVoid(res, 'save document meta');
}

// Create a brand-new document with an optional initial set of tabs.
// Returns the meta + tab summaries the API stored. The live app uses
// this when the welcome flow commits a fresh id so the very first
// per-tab fetch lands on a populated row.
export async function apiCreateDocument(
  ownerId: string,
  // `teamId` / `folderId` are the placement, filed by the create itself and refused by name when
  // invalid (docs/specs/013-workspace/folders.md "Placement on create"). `createdAt` /
  // `presentation` are for an Offline Mode sync (docs/specs/006-document/offline-mode.md), which must
  // carry what the offline record held: the server copy is all that is left once the local one is
  // deleted. `createdAt` / `savedAt` also date an imported board as the board
  // (docs/specs/015-api/api.md "Document dates").
  d: {
    id: string;
    name: string;
    tabs?: Tab[];
    teamId?: string | null;
    // A folder; `null` = the root of the space, chosen on purpose; `undefined` = no choice.
    folderId?: string | null;
    // What the new document opens as (docs/specs/013-workspace/default-folders.md): with no place
    // chosen, the server files it in the person's default folder for it. Left out by a create that
    // keeps a place the document already has (duplicate, an Offline Mode sync, a Drive mirror copy).
    intent?: CreationIntent;
    createdAt?: number;
    savedAt?: number;
    presentation?: string | null;
    // Whether making it is a use, so it joins Explorer Home's Jump back in at once
    // (docs/specs/015-api/api.md "Marking a document used"). Only `false` travels: absent is the
    // server's own default, a making that counts.
    markUsed?: boolean;
    // Seed items (docs/specs/025-plan/items.md): a Plan template's, or an offline document's on sync.
    items?: ItemCreate[];
    // The type catalogue (docs/specs/025-plan/item-types.md): a copy's, a sync's or a Drive file's.
    itemTypes?: ItemTypeCatalogue | null;
  },
  // Set by the Offline Mode sync path (docs/specs/006-document/offline-mode.md). A sync is a plain POST, so
  // without this the worker records it as a brand-new document being created.
  opts: { conversion?: DocumentConversion } = {},
): Promise<LiveDoc> {
  const res = await apiFetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, {
      body: true,
      ...(opts.conversion ? { extra: { [DOCUMENT_CONVERSION_HEADER]: opts.conversion } } : {}),
    }),
    body: JSON.stringify({
      id: d.id,
      name: d.name,
      tabs: (d.tabs ?? []).map(tabForWire),
      ...(d.teamId ? { teamId: d.teamId } : {}),
      // `null` is the space's root chosen on purpose; absent is no choice, where a default folder
      // may answer (docs/specs/013-workspace/folders.md "Placement on create").
      ...(d.folderId !== undefined ? { folderId: d.folderId } : {}),
      ...(d.intent ? { intent: d.intent } : {}),
      ...(d.createdAt !== undefined ? { createdAt: d.createdAt } : {}),
      ...(d.savedAt !== undefined ? { savedAt: d.savedAt } : {}),
      ...(d.presentation ? { presentation: d.presentation } : {}),
      ...(d.markUsed === false ? { markUsed: false } : {}),
      ...(d.items && d.items.length ? { items: d.items } : {}),
    }),
  });
  const { document: liveDoc } = await expectOk<DocumentResponse>(res, 'create document');
  return liveDoc;
}

// Moves the document to the Trash (docs/specs/013-workspace/trash.md): the
// api's for a cloud document, this browser's for an Offline Mode one.
export async function apiDeleteDocument(ownerId: string, id: string): Promise<void> {
  if (await isOfflineId(id)) return offlineTrashDocument(id, Date.now());
  // Owner-gated server-side as of the security fix — without the
  // identity headers the worker would 400 / 403. apiHeaders prefers
  // the Clerk Bearer when a token provider is registered, falls
  // through to X-Owner-Id otherwise (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md).
  return apiDelete(`${API_BASE}/documents/${id}`, ownerId, {
    action: 'delete document',
    purge: { sourceType: 'document', sourceId: id },
  });
}

async function _apiListDocuments(ownerId: string): Promise<DocumentSummary[]> {
  // Offline documents (docs/specs/006-document/offline-mode.md) are browser-local; list them alongside the
  // cloud ones. If the cloud fetch fails but offline documents exist (e.g. no
  // network), still return those rather than failing the whole Explorer.
  // The local Trash keeps its 30 days by being swept whenever the app lists
  // documents (docs/specs/013-workspace/trash.md, "The local Trash").
  await offlinePurgeExpiredTrash(Date.now()).catch(() => 0);
  const offline = await offlineListDocuments().catch(() => [] as DocumentSummary[]);
  try {
    const res = await apiFetch(`${API_BASE}/documents`, { headers: await apiHeaders(ownerId) });
    const { documents: liveDocs } = await expectOk<DocumentListResponse>(res, 'list');
    // Dedupe by id: legacy data (pre ghost-row fix) can hold BOTH an offline
    // record and a same-id server row. The offline copy wins — it is what the
    // dispatch loads for that id — and dropping the twin keeps React keys
    // unique in every list.
    const offlineIds = new Set(offline.map((o) => o.id));
    const documents = [...offline, ...liveDocs.filter((d) => !offlineIds.has(d.id))];
    // The landing page's Welcome back reads this (docs/specs/019-marketing/returning-visitor.md).
    rememberRecentDiagrams(documents, (id, savedAt) =>
      apiFetchDocumentThumbnailSvg(ownerId, id, { version: savedAt }),
    );
    return documents;
  } catch (e) {
    if (offline.length > 0) return offline;
    throw e;
  }
}
export const apiListDocuments = dedupeInFlight(_apiListDocuments, (ownerId) => ownerId);

// Fetch a document's cached SVG snapshot (docs/specs/006-document/document-snapshots.md) and return a blob URL
// for an `<img src>` plus the document's background colour. Native `<img>`
// can't send auth headers, so — like apiFetchImageBlobUrl — the bytes
// come through the authenticated client (Authorization / X-Owner-Id, plus
// X-Share-Code for a shared row) and get wrapped in a blob URL the caller
// revokes on unmount. `version` (the document's savedAt) rides as `?v=`
// purely to bust the browser/edge cache when the document changes; the
// worker ignores it. Returns null on 404 / 403 / 503 (empty document, no
// access, no R2) so the Explorer row falls back to its generic icon.
export async function apiFetchDocumentThumbnailUrl(
  ownerId: string,
  documentId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<{ url: string; backgroundColor: string | null } | null> {
  const svg = await apiFetchDocumentThumbnailSvg(ownerId, documentId, opts);
  if (svg == null) return null;
  // The letterbox matches the document's own background (svgBackgroundColor, the snapshot's first
  // rect) instead of a generic slate.
  const backgroundColor = svgBackgroundColor(svg);
  const scalable = scalableSnapshotSvg(svg);
  const blobUrl = URL.createObjectURL(new Blob([scalable], { type: 'image/svg+xml' }));
  return { url: blobUrl, backgroundColor };
}

// The snapshot SVG's text, through the authenticated client; null on 404 / 403 / 503 (empty
// document, no access, no R2). Behind the Explorer's thumbnails and the landing page's Welcome back
// (docs/specs/019-marketing/returning-visitor.md).
export async function apiFetchDocumentThumbnailSvg(
  ownerId: string,
  documentId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<string | null> {
  const params = new URLSearchParams();
  if (opts.version != null) params.set('v', String(opts.version));
  const qs = params.toString();
  const url = `${API_BASE}/documents/${encodeURIComponent(documentId)}/thumbnail${qs ? `?${qs}` : ''}`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await apiFetch(url, { headers });
  if (!res.ok) return null;
  return res.text();
}

// ---------------------------------------------------------------------
// shared_with — "Shared with you" (migration 0010)
// ---------------------------------------------------------------------

// The "Shared with you" row shape now lives in @livediagram/api-schema
// (the api worker emits it via listSharedWith), imported above and
// re-exported here so the existing `@/lib/api-client` / `./api/documents`
// import paths keep resolving unchanged. See that package for the
// per-field rationale.
export type { SharedWithItem };

// List documents that have been shared with this owner (i.e. the
// owner previously opened a share link for them and was identified
// to the api at the time). Returns newest-interaction-first.
// Same dedupe rationale as apiListDocuments: editor + /new +
// /explorer all mount surfaces that fire this on first paint.
async function _apiListSharedWith(ownerId: string): Promise<SharedWithItem[]> {
  const res = await apiFetch(`${API_BASE}/shared`, { headers: await apiHeaders(ownerId) });
  const { shared } = await expectOk<{ shared: SharedWithItem[] }>(res, 'list shared');
  return shared;
}
export const apiListSharedWith = dedupeInFlight(_apiListSharedWith, (ownerId) => ownerId);

// Dismiss a single "shared with you" row.
export async function apiDismissSharedWith(ownerId: string, documentId: string): Promise<void> {
  return apiDelete(`${API_BASE}/shared/${documentId}`, ownerId, {
    action: 'dismiss shared',
    allow404: false,
  });
}

// Mint a one-time WebSocket room ticket (docs/specs/015-api/api.md). The WS upgrade
// can't carry the Bearer token, so an identified caller (a signed-in
// team member above all) proves access over normal authenticated REST
// and rides the returned ticket on the upgrade URL as `?t=`. Returns
// null on any failure — the connector falls back to the legacy
// owner-id / share-code query params, which still cover every
// non-team session.
export async function apiCreateRoomTicket(
  ownerId: string,
  documentId: string,
  shareCode: string | null = null,
): Promise<string | null> {
  // Retried with a short backoff: a team member whose mint fails has NO
  // fallback (the legacy query params are personal/share-code only and
  // the connector has no reconnect loop), so one transient blip would
  // otherwise cost the whole page session its realtime.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const res = await apiFetch(`${API_BASE}/documents/${documentId}/room-ticket`, {
        method: 'POST',
        headers: await apiHeaders(ownerId, { share: shareCode }),
      });
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return null;
      if (!res.ok) continue;
      const { ticket } = (await res.json()) as { ticket?: string };
      return typeof ticket === 'string' && ticket.length > 0 ? ticket : null;
    } catch {
      // Network error — retry.
    }
  }
  return null;
}

// Copy a document (typically one shared with the caller) into the
// caller's own files. Returns the new document. Optional shareCode
// covers the "visitor just arrived via share URL, no shared_with
// row yet" path — when present the api worker uses it as the
// authorisation proof instead of looking up shared_with.
export async function apiCopyDocument(
  ownerId: string,
  sourceId: string,
  opts: { name?: string; shareCode?: string | null } = {},
): Promise<LiveDoc> {
  const res = await apiFetch(`${API_BASE}/documents/${sourceId}/copy`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true, share: opts.shareCode ?? null }),
    body: JSON.stringify({ name: opts.name }),
  });
  const { document: liveDoc } = await expectOk<DocumentResponse>(res, 'copy document');
  return liveDoc;
}
