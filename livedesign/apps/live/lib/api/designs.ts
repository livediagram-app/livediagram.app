// Design-level calls: load, create and save-meta, the shared-tabs summary, the snapshot, and the room ticket. Listing,
// copying, deleting and sharing designs are the index's (@liveworkspace/workbench/lib/index-client.ts, the shared Explorer).
import {
  INDEX_GRANT_HEADER,
  DESIGN_CONVERSION_HEADER,
  scalableSnapshotSvg,
  svgBackgroundColor,
  type CreationIntent,
  type DesignConversion,
  type SharedTabsSummary,
} from '@livedesign/api-schema';
import type { LiveDoc, DesignResponse, DesignSummary } from '@livedesign/api-schema';
import type { Tab } from '@livedesign/design';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import { isOfflineId, offlineLoadDesign, offlineSaveDesignMeta } from '../offline/offline-store';
import { IndexError } from '@liveworkspace/index-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { markReported, reportApiError } from './error-report';
import { seedDesignGrant } from './design-grants';
import {
  API_BASE,
  ApiError,
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
  if (body?.design) indexTitles.set(id, body.design.name);
  return body?.design ?? null;
}

// The title the index holds for each design this page has read or named, so a meta save tells the index only when
// the name changed: never on a save that merely carries it (liveworkspace/docs/one-explorer-contracts.md "Items").
const indexTitles = new Map<string, string>();

function renameInIndex(id: string, name: string, shareCode: string | null): void {
  if (indexTitles.get(id) === name) return;
  indexTitles.set(id, name);
  void indexClient.updateItem(id, { title: name }).catch((err: unknown) => {
    indexTitles.delete(id);
    console.warn('[index] rename not recorded', { shareCode: !!shareCode, err });
  });
}
export const apiLoadDesign = dedupeInFlight(_apiLoadDesign, (ownerId, id) => `${ownerId}|${id}`);

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
  },
  shareCode: string | null = null,
): Promise<void> {
  if (await isOfflineId(d.id)) {
    await offlineSaveDesignMeta(d.id, { name: d.name, tabs: d.tabs }, Date.now());
    return;
  }
  const body = JSON.stringify({
    name: d.name,
    tabs: d.tabs,
    tabIds: d.tabIds,
  });
  const res = await apiFetch(`${API_BASE}/designs/${d.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body,
    signal: saveTimeoutSignal(body),
  });
  await expectOkVoid(res, 'save design meta');
  if (typeof d.name === 'string' && d.name) renameInIndex(d.id, d.name, shareCode);
}

// Create a brand-new design with an optional initial set of tabs.
// Returns the meta + tab summaries the API stored. The live app uses
// this when the welcome flow commits a fresh id so the very first
// per-tab fetch lands on a populated row.
export async function apiCreateDesign(
  ownerId: string,
  // `teamId` / `folderId` are the placement, filed by the create itself and refused by name when
  // invalid (docs/specs/013-workspace/folders.md "Placement on create"). `createdAt` is
  // for an Offline Mode sync (docs/specs/006-design/offline-mode.md), which must
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
  },
  // Set by the Offline Mode sync path (docs/specs/006-design/offline-mode.md). A sync is a plain POST, so
  // without this the worker records it as a brand-new design being created.
  opts: { conversion?: DesignConversion } = {},
): Promise<LiveDoc> {
  // The index makes the design first (liveworkspace/docs/one-explorer-contracts.md "Items"): its place, its title
  // and the grant on it come back together. The content is then started in the design's room with that grant.
  let created: Awaited<ReturnType<typeof indexClient.createItem>>;
  try {
    created = await indexClient.createItem({
      id: d.id,
      // Synced to the cloud from this browser (Offline Mode): the Timeline says so, not "Created".
      ...(opts.conversion === 'sync' ? { synced: true } : {}),
      app: 'livedesign',
      title: d.name,
      ...(d.teamId ? { teamId: d.teamId } : {}),
      ...(d.folderId !== undefined ? { folderId: d.folderId } : {}),
      // The index keeps the intent as a word for filters and defaults: "logo:diagram", "photo:diagram".
      ...(d.intent ? { intent: intentWord(d.intent) } : {}),
    });
  } catch (err) {
    if (err instanceof IndexError) {
      reportApiError(err.status, 'create design in index', err.code);
      const apiErr = new ApiError('create design', err.status, err.code);
      markReported(apiErr);
      throw apiErr;
    }
    throw err;
  }
  seedDesignGrant(d.id, created.grant);
  indexTitles.set(d.id, created.item.title);
  const res = await apiFetch(`${API_BASE}/designs`, {
    method: 'POST',
    headers: {
      ...(await apiHeaders(ownerId, {
        body: true,
        ...(opts.conversion ? { extra: { [DESIGN_CONVERSION_HEADER]: opts.conversion } } : {}),
      })),
      [INDEX_GRANT_HEADER]: created.grant.grant,
    },
    body: JSON.stringify({
      id: d.id,
      name: d.name,
      tabs: (d.tabs ?? []).map(tabForWire),
      ...(d.intent ? { intent: d.intent } : {}),
      ...(d.createdAt !== undefined ? { createdAt: d.createdAt } : {}),
      ...(d.savedAt !== undefined ? { savedAt: d.savedAt } : {}),
    }),
  });
  const { design: liveDoc } = await expectOk<DesignResponse>(res, 'create design');
  return liveDoc;
}

/** The intent as the index keeps it, one word for filters and defaults: "pages:logo". */
export function intentWord(intent: CreationIntent): string {
  return [intent.mode, intent.tabKind].filter(Boolean).join(':');
}

// Fetch a design's cached SVG snapshot (docs/specs/006-design/design-snapshots.md) and return a blob URL
// for an `<img src>` plus the design's background colour. Native `<img>`
// can't send auth headers, so — like apiFetchImageBlobUrl — the bytes
// come through the authenticated client (the Authorization Bearer, plus
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

// The design's preview SVG, liveworkspace's (liveworkspace/docs/previews.md: the router sends /api/previews there),
// through the authenticated client; null on 404 / 503 (nothing drawn, no access, the service down). `version` is
// only the browser's cache key. Behind the Explorer's thumbnails and the landing page's Welcome back
// (docs/specs/019-marketing/returning-visitor.md).
export async function apiFetchDesignThumbnailSvg(
  ownerId: string,
  designId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<string | null> {
  const params = new URLSearchParams();
  if (opts.version != null) params.set('v', String(opts.version));
  const qs = params.toString();
  const url = `${API_BASE}/previews/items/${encodeURIComponent(designId)}${qs ? `?${qs}` : ''}`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await apiFetch(url, { headers });
  if (!res.ok) return null;
  return res.text();
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
