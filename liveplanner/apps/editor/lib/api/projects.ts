// Plan-level calls: load, create and save-meta, the shared-tabs summary, the snapshot, and the room ticket. Listing,
// copying, deleting and sharing plans are the index's (lib/index-client.ts, the shared Explorer).
import type { ItemCreate, ItemTypeCatalogue } from '@liveplanner/items';
import {
  INDEX_GRANT_HEADER,
  indexIntentOf,
  PROJECT_CONVERSION_HEADER,
  scalableSnapshotSvg,
  svgBackgroundColor,
  type CreationIntent,
  type ProjectConversion,
  type SharedTabsSummary,
  type SheetCreateRequest,
} from '@liveplanner/api-schema';
import type { Project, ProjectResponse, ProjectSummary } from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import { isOfflineId, offlineLoadProject, offlineSaveProjectMeta } from '../offline/offline-store';
import { IndexError } from '@liveworkspace/index-client';
import { indexClient } from '../index-client';
import { markReported, reportApiError } from './error-report';
import { seedPlanGrant } from './plan-grants';
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
import type { RoomTicketResponse } from '@liveplanner/api-schema';

// The project-list row every list surface renders: the Explorer
// panel, the /explorer page, /new, and the editor's project-list
// state. A Pick of the wire type so the UI rows can't drift from
// what apiListProjects actually returns; surfaces needing more
// fields widen the Pick rather than re-declaring the shape.
export type ProjectListItem = Pick<
  ProjectSummary,
  'id' | 'name' | 'folderId' | 'savedAt' | 'shareCode' | 'ownerId'
> & {
  // Provenance (docs/specs/013-workspace/folders.md). Present on real list rows from the API; optional
  // so synthetic rows (shared / team placeholders) can omit it. Absent or
  // null means user-made (no Made by AI badge).
  source?: ProjectSummary['source'];
  // Nothing drawn (docs/specs/006-project/project-snapshots.md): the row asks for no thumbnail. Absent on a
  // synthetic row, which asks as before.
  empty?: ProjectSummary['empty'];
  // The creation intent recorded on the project (docs/specs/013-workspace/default-folders.md
  // "Recorded intent"), which the Explorer filters read. Absent on a row that cannot say (an
  // offline record, a synthetic shared row): it reads as unknown.
  opensIn?: ProjectSummary['opensIn'];
  tabKind?: ProjectSummary['tabKind'];
  templateFamily?: ProjectSummary['templateFamily'];
  // The Details view's Created column and counted stats (docs/specs/013-workspace/explorer-details-view.md).
  // Absent on a synthetic row (shared with you), which reads as not counted.
  createdAt?: ProjectSummary['createdAt'];
  stats?: ProjectSummary['stats'];
};

// Deduped on `${ownerId}|${id}`: the editor mounts and React Strict
// Mode in dev double-invokes its hydration effect, so this fires
// twice on first paint. With dedup, the second call receives the
// in-flight promise instead of opening a second request to the
// same project.
async function _apiLoadProject(ownerId: string, id: string): Promise<Project | null> {
  // Offline Mode (docs/specs/006-project/offline-mode.md): a project registered offline loads from IndexedDB,
  // never the API. Same for the save / delete / list paths below.
  if (await isOfflineId(id)) return offlineLoadProject(id);
  const res = await apiFetch(`${API_BASE}/projects/${id}`, {
    headers: await apiHeaders(ownerId),
  });
  const body = await expectOkOrNull<ProjectResponse>(res, 'load');
  if (body?.project) indexTitles.set(id, body.project.name);
  return body?.project ?? null;
}

// The title the index holds for each plan this page has read or named, so a meta save tells the index only when
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
export const apiLoadProject = dedupeInFlight(_apiLoadProject, (ownerId, id) => `${ownerId}|${id}`);

// How many of the project's tabs are also in other projects, and how many
// projects (docs/specs/006-project/tab-project-many-to-many.md, "Shared-tab
// notice"). Null for an offline project: its tabs live only in this browser.
export async function apiSharedTabs(
  ownerId: string,
  id: string,
  signal?: AbortSignal,
): Promise<SharedTabsSummary | null> {
  if (await isOfflineId(id)) return null;
  const res = await apiFetch(`${API_BASE}/projects/${id}/shared-tabs`, {
    headers: await apiHeaders(ownerId),
    ...(signal ? { signal } : {}),
  });
  const { sharedTabs } = await expectOk<{ sharedTabs: SharedTabsSummary }>(res, 'shared tabs');
  return sharedTabs;
}

// Persist project-level metadata: name (rename), tab order, and each
// tab's per-project folder (docs/specs/006-project/tab-folders.md). Used for tab reorders + rename
// + folder ops — anything that doesn't touch element content. Element
// changes go through apiSaveTab. Callers pass `tabs` (id + order +
// folder); `tabIds` stays accepted as the legacy folder-less shape.
export async function apiSaveProjectMeta(
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
    await offlineSaveProjectMeta(d.id, { name: d.name, tabs: d.tabs }, Date.now());
    return;
  }
  const body = JSON.stringify({
    name: d.name,
    tabs: d.tabs,
    tabIds: d.tabIds,
  });
  const res = await apiFetch(`${API_BASE}/projects/${d.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body,
    signal: saveTimeoutSignal(body),
  });
  await expectOkVoid(res, 'save project meta');
  if (typeof d.name === 'string' && d.name) renameInIndex(d.id, d.name, shareCode);
}

// Create a brand-new project with an optional initial set of tabs.
// Returns the meta + tab summaries the API stored. The editor app uses
// this when the welcome flow commits a fresh id so the very first
// per-tab fetch lands on a populated row.
export async function apiCreateProject(
  ownerId: string,
  // `teamId` / `folderId` are the placement, filed by the create itself and refused by name when
  // invalid (docs/specs/013-workspace/folders.md "Placement on create"). `createdAt` is for an
  // Offline Mode sync (docs/specs/006-project/offline-mode.md), which must
  // carry what the offline record held: the server copy is all that is left once the local one is
  // deleted. `createdAt` / `savedAt` also date an imported board as the board
  // (docs/specs/015-api/api.md "Project dates").
  d: {
    id: string;
    name: string;
    tabs?: Tab[];
    teamId?: string | null;
    // A folder; `null` = the root of the space, chosen on purpose; `undefined` = no choice.
    folderId?: string | null;
    // What the new project opens as (docs/specs/013-workspace/default-folders.md): with no place
    // chosen, the server files it in the person's default folder for it. Left out by a create that
    // keeps a place the project already has (duplicate, an Offline Mode sync).
    intent?: CreationIntent;
    createdAt?: number;
    savedAt?: number;
    // Seed items (docs/specs/026-plan/items.md): an offline project's, on sync.
    items?: ItemCreate[];
    // Sheets (docs/specs/029-sheets/sheet-store.md "Offline projects", "Copies"), whole.
    sheets?: SheetCreateRequest[];
    // The type catalogue (docs/specs/026-plan/item-types.md): a copy's, a sync's or a Drive file's.
    itemTypes?: ItemTypeCatalogue | null;
  },
  // Set by the Offline Mode sync path (docs/specs/006-project/offline-mode.md). A sync is a plain POST, so
  // without this the worker records it as a brand-new project being created.
  opts: { conversion?: ProjectConversion } = {},
): Promise<Project> {
  // The index makes the plan first (liveworkspace/docs/one-explorer-contracts.md "Items"): its place, its title
  // and the grant on it come back together. The content is then started in the plan's room with that grant.
  let created: Awaited<ReturnType<typeof indexClient.createItem>>;
  try {
    created = await indexClient.createItem({
      id: d.id,
      // Synced to the cloud from this browser (Offline Mode): the Timeline says so, not "Created".
      ...(opts.conversion === 'sync' ? { synced: true } : {}),
      app: 'liveplanner',
      title: d.name,
      ...(d.teamId ? { teamId: d.teamId } : {}),
      ...(d.folderId !== undefined ? { folderId: d.folderId } : {}),
      // The index keeps the intent as a word for filters and defaults: "plan:board", "plan:sheet:okr".
      ...(d.intent ? { intent: indexIntentOf(d.intent) } : {}),
    });
  } catch (err) {
    if (err instanceof IndexError) {
      reportApiError(err.status, 'create plan in index', err.code);
      const apiErr = new ApiError('create project', err.status, err.code);
      markReported(apiErr);
      throw apiErr;
    }
    throw err;
  }
  seedPlanGrant(d.id, created.grant);
  indexTitles.set(d.id, created.item.title);
  const res = await apiFetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      ...(await apiHeaders(ownerId, {
        body: true,
        ...(opts.conversion ? { extra: { [PROJECT_CONVERSION_HEADER]: opts.conversion } } : {}),
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
      ...(d.items && d.items.length ? { items: d.items } : {}),
      // The sheet store (docs/specs/029-sheets/sheet-store.md "Offline projects", "Copies"), whole.
      ...(d.sheets && d.sheets.length ? { sheets: d.sheets } : {}),
      // The type catalogue rides the create (a copy's, a Plan template's card types); absent is the default types.
      ...(d.itemTypes ? { itemTypes: d.itemTypes } : {}),
    }),
  });
  const { project: liveDoc } = await expectOk<ProjectResponse>(res, 'create project');
  return liveDoc;
}

// Fetch a project's cached SVG snapshot (docs/specs/006-project/project-snapshots.md) and return a blob URL
// for an `<img src>` plus the project's background colour. Native `<img>`
// can't send auth headers, so — like apiFetchImageBlobUrl — the bytes
// come through the authenticated client (the Authorization Bearer, plus
// X-Share-Code for a shared row) and get wrapped in a blob URL the caller
// revokes on unmount. `version` (the project's savedAt) rides as `?v=`
// purely to bust the browser/edge cache when the project changes; the
// worker ignores it. Returns null on 404 / 403 / 503 (empty project, no
// access, no R2) so the Explorer row falls back to its generic icon.
export async function apiFetchProjectThumbnailUrl(
  ownerId: string,
  projectId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<{ url: string; backgroundColor: string | null } | null> {
  const svg = await apiFetchProjectThumbnailSvg(ownerId, projectId, opts);
  if (svg == null) return null;
  // The letterbox matches the project's own background (svgBackgroundColor, the snapshot's first
  // rect) instead of a generic slate.
  const backgroundColor = svgBackgroundColor(svg);
  const scalable = scalableSnapshotSvg(svg);
  const blobUrl = URL.createObjectURL(new Blob([scalable], { type: 'image/svg+xml' }));
  return { url: blobUrl, backgroundColor };
}

// The project's preview SVG, liveworkspace's (liveworkspace/docs/previews.md: the router sends /api/previews there),
// through the authenticated client; null on 404 / 503 (nothing drawn, no access, the service down). `version` is
// only the browser's cache key. Behind the Explorer's thumbnails and the landing page's Welcome back
// (docs/specs/019-marketing/returning-visitor.md).
export async function apiFetchProjectThumbnailSvg(
  ownerId: string,
  projectId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<string | null> {
  const params = new URLSearchParams();
  if (opts.version != null) params.set('v', String(opts.version));
  const qs = params.toString();
  const url = `${API_BASE}/previews/items/${encodeURIComponent(projectId)}${qs ? `?${qs}` : ''}`;
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
  projectId: string,
  shareCode: string | null = null,
): Promise<RoomTicketResponse | null> {
  // Retried with a short backoff: a session whose mint fails has no other way
  // into the room, and the connector mints a fresh one for every reconnect,
  // so one transient blip would otherwise cost the session its realtime.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const res = await apiFetch(`${API_BASE}/projects/${projectId}/room-ticket`, {
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
