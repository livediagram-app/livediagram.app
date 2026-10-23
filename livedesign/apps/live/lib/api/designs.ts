// Design-level calls: load / create / save-meta / delete / list, the
// copy-into-my-files flow, and the "Shared with you" list.
import {
  DESIGN_CONVERSION_HEADER,
  scalableSnapshotSvg,
  svgBackgroundColor,
  TEAM_RECENT_INCLUDE,
  type CreationIntent,
  type DesignConversion,
  type SharedTabsSummary,
} from '@livedesign/api-schema';
import type {
  LiveDoc,
  DesignListResponse,
  DesignResponse,
  DesignSummary,
  SharedWithItem,
  TeamRecentDesign,
} from '@livedesign/api-schema';
import type { Tab } from '@livedesign/design';
import { dedupeInFlight } from '../dedupe';
import {
  isOfflineId,
  offlineListDesigns,
  offlineLoadDesign,
  offlineSaveDesignMeta,
} from '../offline/offline-store';
import { offlinePurgeExpiredTrash, offlineTrashDesign } from '../offline/offline-trash';
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
  saveTimeoutSignal,
} from './core';
import type { RoomTicketResponse } from '@livedesign/api-schema';

// The design-list row every list surface renders: the Explorer
// panel, the /explorer page, /new, and the editor's design-list
// state. A Pick of the wire type so the UI rows can't drift from
// what apiListDesigns actually returns; surfaces needing more
// fields widen the Pick rather than re-declaring the shape.
export type DesignListItem = Pick<
  DesignSummary,
  'id' | 'name' | 'folderId' | 'savedAt' | 'shareCode' | 'ownerId'
> & {
  // Provenance (docs/specs/013-workspace/folders.md). Present on real list rows from the API; optional
  // so synthetic rows (shared / team placeholders) can omit it. Absent or
  // null means user-made (no Made by AI badge).
  source?: DesignSummary['source'];
  // Nothing drawn (docs/specs/006-design/design-snapshots.md): the row asks for no thumbnail. Absent on a
  // synthetic row, which asks as before.
  empty?: DesignSummary['empty'];
  // The creation intent recorded on the design (docs/specs/013-workspace/default-folders.md
  // "Recorded intent"), which the Explorer filters read. Absent on a row that cannot say (an
  // offline record, a synthetic shared row): it reads as unknown.
  opensIn?: DesignSummary['opensIn'];
  tabKind?: DesignSummary['tabKind'];
  // The Details view's Created column and counted stats (docs/specs/013-workspace/explorer-details-view.md).
  // Absent on a synthetic row (shared with you), which reads as not counted.
  createdAt?: DesignSummary['createdAt'];
  stats?: DesignSummary['stats'];
};

// Deduped on `${ownerId}|${id}`: the editor mounts and React Strict
// Mode in dev double-invokes its hydration effect, so this fires
// twice on first paint. With dedup, the second call receives the
// in-flight promise instead of opening a second request to the
// same design.
async function _apiLoadDesign(ownerId: string, id: string): Promise<LiveDoc | null> {
  // Offline Mode (docs/specs/006-design/offline-mode.md): a design registered offline loads from IndexedDB,
  // never the API. Same for the save / delete / list paths below.
  if (await isOfflineId(id)) return offlineLoadDesign(id);
  const res = await apiFetch(`${API_BASE}/designs/${id}`, {
    headers: await apiHeaders(ownerId),
  });
  const body = await expectOkOrNull<DesignResponse>(res, 'load');
  return body?.design ?? null;
}
export const apiLoadDesign = dedupeInFlight(
  _apiLoadDesign,
  (ownerId, id) => `${ownerId}|${id}`,
);

// How many of the design's tabs are also in other designs, and how many
// designs (docs/specs/006-design/tab-design-many-to-many.md, "Shared-tab
// notice"). Null for an offline design: its tabs live only in this browser.
export async function apiSharedTabs(
  ownerId: string,
  id: string,
  signal?: AbortSignal,
): Promise<SharedTabsSummary | null> {
  if (await isOfflineId(id)) return null;
  const res = await apiFetch(`${API_BASE}/designs/${id}/shared-tabs`, {
    headers: await apiHeaders(ownerId),
    ...(signal ? { signal } : {}),
  });
  const { sharedTabs } = await expectOk<{ sharedTabs: SharedTabsSummary }>(res, 'shared tabs');
  return sharedTabs;
}

// Persist design-level metadata: name (rename), tab order, and each
// tab's per-design folder (docs/specs/006-design/tab-folders.md). Used for tab reorders + rename
// + folder ops — anything that doesn't touch element content. Element
// changes go through apiSaveTab. Callers pass `tabs` (id + order +
// folder); `tabIds` stays accepted as the legacy folder-less shape.
export async function apiSaveDesignMeta(
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
    await offlineSaveDesignMeta(
      d.id,
      { name: d.name, tabs: d.tabs, presentation: d.presentation },
      Date.now(),
    );
    return;
  }
  const body = JSON.stringify({
    name: d.name,
    tabs: d.tabs,
    tabIds: d.tabIds,
    presentation: d.presentation,
  });
  const res = await apiFetch(`${API_BASE}/designs/${d.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body,
    signal: saveTimeoutSignal(body),
  });
  await expectOkVoid(res, 'save design meta');
}

// Create a brand-new design with an optional initial set of tabs.
// Returns the meta + tab summaries the API stored. The live app uses
// this when the welcome flow commits a fresh id so the very first
// per-tab fetch lands on a populated row.
export async function apiCreateDesign(
  ownerId: string,
  // `teamId` / `folderId` are the placement, filed by the create itself and refused by name when
  // invalid (docs/specs/013-workspace/folders.md "Placement on create"). `createdAt` /
  // `presentation` are for an Offline Mode sync (docs/specs/006-design/offline-mode.md), which must
  // carry what the offline record held: the server copy is all that is left once the local one is
  // deleted. `createdAt` / `savedAt` also date an imported board as the board
  // (docs/specs/015-api/api.md "Design dates").
  d: {
    id: string;
    name: string;
    tabs?: Tab[];
    teamId?: string | null;
    // A folder; `null` = the root of the space, chosen on purpose; `undefined` = no choice.
    folderId?: string | null;
    // What the new design opens as (docs/specs/013-workspace/default-folders.md): with no place
    // chosen, the server files it in the person's default folder for it. Left out by a create that
    // keeps a place the design already has (duplicate, an Offline Mode sync).
    intent?: CreationIntent;
    createdAt?: number;
    savedAt?: number;
    presentation?: string | null;
  },
  // Set by the Offline Mode sync path (docs/specs/006-design/offline-mode.md). A sync is a plain POST, so
  // without this the worker records it as a brand-new design being created.
  opts: { conversion?: DesignConversion } = {},
): Promise<LiveDoc> {
  const res = await apiFetch(`${API_BASE}/designs`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, {
      body: true,
      ...(opts.conversion ? { extra: { [DESIGN_CONVERSION_HEADER]: opts.conversion } } : {}),
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
    }),
  });
  const { design: liveDoc } = await expectOk<DesignResponse>(res, 'create design');
  return liveDoc;
}

// Moves the design to the Trash (docs/specs/013-workspace/trash.md): the
// api's for a cloud design, this browser's for an Offline Mode one.
export async function apiDeleteDesign(ownerId: string, id: string): Promise<void> {
  if (await isOfflineId(id)) return offlineTrashDesign(id, Date.now());
  // Owner-gated server-side as of the security fix — without the
  // identity headers the worker would 400 / 403. apiHeaders prefers
  // the account Bearer when a token provider is registered, falls
  // through to X-Owner-Id otherwise (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md).
  return apiDelete(`${API_BASE}/designs/${id}`, ownerId, {
    action: 'delete design',
    purge: { sourceType: 'design', sourceId: id },
  });
}

// The personal library and, beside it, the newest designs of the teams the caller has joined: the
// team ones feed only the recent lists (Welcome back, Jump Back In), never the personal library views.
export type DesignListing = {
  designs: DesignSummary[];
  teamRecent: TeamRecentDesign[];
};

async function _apiListDesignsWithTeamRecent(ownerId: string): Promise<DesignListing> {
  // Offline designs (docs/specs/006-design/offline-mode.md) are browser-local; list them alongside the
  // cloud ones. If the cloud fetch fails but offline designs exist (e.g. no
  // network), still return those rather than failing the whole Explorer.
  // The local Trash keeps its 30 days by being swept whenever the app lists
  // designs (docs/specs/013-workspace/trash.md, "The local Trash").
  await offlinePurgeExpiredTrash(Date.now()).catch(() => 0);
  const offline = await offlineListDesigns().catch(() => [] as DesignSummary[]);
  try {
    const res = await apiFetch(`${API_BASE}/designs?include=${TEAM_RECENT_INCLUDE}`, {
      headers: await apiHeaders(ownerId),
    });
    const { designs: liveDocs, teamRecent = [] } = await expectOk<DesignListResponse>(
      res,
      'list',
    );
    // Dedupe by id: legacy data (pre ghost-row fix) can hold BOTH an offline
    // record and a same-id server row. The offline copy wins — it is what the
    // dispatch loads for that id — and dropping the twin keeps React keys
    // unique in every list.
    const offlineIds = new Set(offline.map((o) => o.id));
    const designs = [...offline, ...liveDocs.filter((d) => !offlineIds.has(d.id))];
    // The landing page's returning-visitor fan reads this (docs/specs/019-marketing/returning-visitor.md).
    // A design in This Browser has no server snapshot, so it is drawn here from the offline store
    // (lib/local-snapshot.ts, loaded only when one is wanted) rather than asked of the server, where it
    // could only 404 (once per save, since the version is in the key). A guest's designs start local.
    rememberRecentDiagrams([...designs, ...teamRecent], (id, savedAt) =>
      offlineIds.has(id)
        ? import('@/lib/local-snapshot').then((m) => m.localSnapshotSvg(id))
        : apiFetchDesignThumbnailSvg(ownerId, id, { version: savedAt }),
    );
    return { designs, teamRecent };
  } catch (e) {
    if (offline.length > 0) return { designs: offline, teamRecent: [] };
    throw e;
  }
}
export const apiListDesignsWithTeamRecent = dedupeInFlight(
  _apiListDesignsWithTeamRecent,
  (ownerId) => ownerId,
);

// The personal library (and this browser's Offline Mode designs).
export async function apiListDesigns(ownerId: string): Promise<DesignSummary[]> {
  return (await apiListDesignsWithTeamRecent(ownerId)).designs;
}

// Fetch a design's cached SVG snapshot (docs/specs/006-design/design-snapshots.md) and return a blob URL
// for an `<img src>` plus the design's background colour. Native `<img>`
// can't send auth headers, so — like apiFetchImageBlobUrl — the bytes
// come through the authenticated client (Authorization / X-Owner-Id, plus
// X-Share-Code for a shared row) and get wrapped in a blob URL the caller
// revokes on unmount. `version` (the design's savedAt) rides as `?v=`
// purely to bust the browser/edge cache when the design changes; the
// worker ignores it. Returns null on 404 / 403 / 503 (empty design, no
// access, no R2) so the Explorer row falls back to its generic icon.
export async function apiFetchDesignThumbnailUrl(
  ownerId: string,
  designId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<{ url: string; backgroundColor: string | null } | null> {
  const svg = await apiFetchDesignThumbnailSvg(ownerId, designId, opts);
  if (svg == null) return null;
  // The letterbox matches the design's own background (svgBackgroundColor, the snapshot's first
  // rect) instead of a generic slate.
  const backgroundColor = svgBackgroundColor(svg);
  const scalable = scalableSnapshotSvg(svg);
  const blobUrl = URL.createObjectURL(new Blob([scalable], { type: 'image/svg+xml' }));
  return { url: blobUrl, backgroundColor };
}

// The snapshot SVG's text, through the authenticated client; null on 404 / 403 / 503 (empty
// design, no access, no R2). Behind the Explorer's thumbnails and the landing page's Welcome back
// (docs/specs/019-marketing/returning-visitor.md).
export async function apiFetchDesignThumbnailSvg(
  ownerId: string,
  designId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<string | null> {
  const params = new URLSearchParams();
  if (opts.version != null) params.set('v', String(opts.version));
  const qs = params.toString();
  const url = `${API_BASE}/designs/${encodeURIComponent(designId)}/thumbnail${qs ? `?${qs}` : ''}`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await apiFetch(url, { headers });
  if (!res.ok) return null;
  return res.text();
}

// ---------------------------------------------------------------------
// shared_with — "Shared with you" (migration 0010)
// ---------------------------------------------------------------------

// The "Shared with you" row shape now lives in @livedesign/api-schema
// (the api worker emits it via listSharedWith), imported above and
// re-exported here so the existing `@/lib/api-client` / `./api/designs`
// import paths keep resolving unchanged. See that package for the
// per-field rationale.
export type { SharedWithItem };

// List designs that have been shared with this owner (i.e. the
// owner previously opened a share link for them and was identified
// to the api at the time). Returns newest-interaction-first.
// Same dedupe rationale as apiListDesigns: editor + /new +
// /explorer all mount surfaces that fire this on first paint.
async function _apiListSharedWith(ownerId: string): Promise<SharedWithItem[]> {
  const res = await apiFetch(`${API_BASE}/shared`, { headers: await apiHeaders(ownerId) });
  const { shared } = await expectOk<{ shared: SharedWithItem[] }>(res, 'list shared');
  return shared;
}
export const apiListSharedWith = dedupeInFlight(_apiListSharedWith, (ownerId) => ownerId);

// Dismiss a single "shared with you" row.
export async function apiDismissSharedWith(ownerId: string, designId: string): Promise<void> {
  return apiDelete(`${API_BASE}/shared/${designId}`, ownerId, {
    action: 'dismiss shared',
    allow404: false,
  });
}

// Mint a one-time WebSocket room ticket (docs/specs/015-api/api.md "Realtime model"). The WS upgrade
// can't carry headers, so every session proves access here over normal REST (the Bearer token, the
// signed guest id, the share code and its password) and rides the returned ticket on the upgrade URL as
// `?t=`, the only thing that URL carries. Returns null on any failure: that upgrade is refused and the
// connector mints again on its next reconnect.
export async function apiCreateRoomTicket(
  ownerId: string,
  designId: string,
  shareCode: string | null = null,
): Promise<RoomTicketResponse | null> {
  // Retried with a short backoff: a session whose mint fails has no other way
  // into the room, and the connector mints a fresh one for every reconnect,
  // so one transient blip would otherwise cost the session its realtime.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const res = await apiFetch(`${API_BASE}/designs/${designId}/room-ticket`, {
        method: 'POST',
        headers: await apiHeaders(ownerId, { share: shareCode }),
      });
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return null;
      if (!res.ok) continue;
      const { ticket, adderKey } = (await res.json()) as Partial<RoomTicketResponse>;
      if (typeof ticket !== 'string' || ticket.length === 0) return null;
      // A Participant's own adder key (docs/specs/013-workspace/share-roles.md): which stickies are its own.
      return typeof adderKey === 'string' && adderKey.length > 0
        ? { ticket, adderKey }
        : { ticket };
    } catch {
      // Network error — retry.
    }
  }
  return null;
}

// Copy a design (typically one shared with the caller) into the
// caller's own files. Returns the new design. Optional shareCode
// covers the "visitor just arrived via share URL, no shared_with
// row yet" path — when present the api worker uses it as the
// authorisation proof instead of looking up shared_with.
export async function apiCopyDesign(
  ownerId: string,
  sourceId: string,
  opts: { name?: string; shareCode?: string | null } = {},
): Promise<LiveDoc> {
  const res = await apiFetch(`${API_BASE}/designs/${sourceId}/copy`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true, share: opts.shareCode ?? null }),
    body: JSON.stringify({ name: opts.name }),
  });
  const { design: liveDoc } = await expectOk<DesignResponse>(res, 'copy design');
  return liveDoc;
}
