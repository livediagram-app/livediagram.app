// Project-level calls: load / create / save-meta / delete / list, the
// copy-into-my-files flow, and the "Shared with you" list.
import type { ItemCreate, ItemTypeCatalogue } from '@liveplanner/items';
import {
  PROJECT_CONVERSION_HEADER,
  scalableSnapshotSvg,
  svgBackgroundColor,
  TEAM_RECENT_INCLUDE,
  type CreationIntent,
  type ProjectConversion,
  type SharedTabsSummary,
  type SheetCreateRequest,
} from '@liveplanner/api-schema';
import type {
  Project,
  ProjectListResponse,
  ProjectResponse,
  ProjectSummary,
  SharedWithItem,
  TeamRecentProject,
} from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import { dedupeInFlight } from '../dedupe';
import {
  isOfflineId,
  offlineListProjects,
  offlineLoadProject,
  offlineSaveProjectMeta,
} from '../offline/offline-store';
import { offlinePurgeExpiredTrash, offlineTrashProject } from '../offline/offline-trash';
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
  return body?.project ?? null;
}
export const apiLoadProject = dedupeInFlight(
  _apiLoadProject,
  (ownerId, id) => `${ownerId}|${id}`,
);

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
}

// Create a brand-new project with an optional initial set of tabs.
// Returns the meta + tab summaries the API stored. The live app uses
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
  const res = await apiFetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, {
      body: true,
      ...(opts.conversion ? { extra: { [PROJECT_CONVERSION_HEADER]: opts.conversion } } : {}),
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
      ...(d.items && d.items.length ? { items: d.items } : {}),
      // The sheet store (docs/specs/029-sheets/sheet-store.md "Offline projects", "Copies"): typed since Sheets
      // shipped but never sent, so a sync came up short of its sheets and kept the local copy, and a duplicate or
      // a Drive import landed without them.
      ...(d.sheets && d.sheets.length ? { sheets: d.sheets } : {}),
      // The type catalogue rides the create (a copy's, a Plan template's card types); absent is the default types.
      ...(d.itemTypes ? { itemTypes: d.itemTypes } : {}),
    }),
  });
  const { project: liveDoc } = await expectOk<ProjectResponse>(res, 'create project');
  return liveDoc;
}

// Moves the project to the Trash (docs/specs/013-workspace/trash.md): the
// api's for a cloud project, this browser's for an Offline Mode one.
export async function apiDeleteProject(ownerId: string, id: string): Promise<void> {
  if (await isOfflineId(id)) return offlineTrashProject(id, Date.now());
  // Owner-gated server-side as of the security fix — without the
  // identity headers the worker would 400 / 403. apiHeaders prefers
  // the Clerk Bearer when a token provider is registered, falls
  // through to X-Owner-Id otherwise (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md).
  return apiDelete(`${API_BASE}/projects/${id}`, ownerId, {
    action: 'delete project',
    purge: { sourceType: 'project', sourceId: id },
  });
}

// The personal library and, beside it, the newest projects of the teams the caller has joined: the
// team ones feed only the recent lists (Welcome back, Jump Back In), never the personal library views.
export type ProjectListing = {
  projects: ProjectSummary[];
  teamRecent: TeamRecentProject[];
};

async function _apiListProjectsWithTeamRecent(ownerId: string): Promise<ProjectListing> {
  // Offline projects (docs/specs/006-project/offline-mode.md) are browser-local; list them alongside the
  // cloud ones. If the cloud fetch fails but offline projects exist (e.g. no
  // network), still return those rather than failing the whole Explorer.
  // The local Trash keeps its 30 days by being swept whenever the app lists
  // projects (docs/specs/013-workspace/trash.md, "The local Trash").
  await offlinePurgeExpiredTrash(Date.now()).catch(() => 0);
  const offline = await offlineListProjects().catch(() => [] as ProjectSummary[]);
  try {
    const res = await apiFetch(`${API_BASE}/projects?include=${TEAM_RECENT_INCLUDE}`, {
      headers: await apiHeaders(ownerId),
    });
    const { projects: liveDocs, teamRecent = [] } = await expectOk<ProjectListResponse>(
      res,
      'list',
    );
    // Dedupe by id: legacy data (pre ghost-row fix) can hold BOTH an offline
    // record and a same-id server row. The offline copy wins — it is what the
    // dispatch loads for that id — and dropping the twin keeps React keys
    // unique in every list.
    const offlineIds = new Set(offline.map((o) => o.id));
    const projects = [...offline, ...liveDocs.filter((d) => !offlineIds.has(d.id))];
    // The landing page's returning-visitor fan reads this (docs/specs/019-marketing/returning-visitor.md).
    // A project in This Browser has no server snapshot, so it is drawn here from the offline store
    // (lib/local-snapshot.ts, loaded only when one is wanted) rather than asked of the server, where it
    // could only 404 (once per save, since the version is in the key). A guest's projects start local.
    rememberRecentDiagrams([...projects, ...teamRecent], (id, savedAt) =>
      offlineIds.has(id)
        ? import('@/lib/local-snapshot').then((m) => m.localSnapshotSvg(id))
        : apiFetchProjectThumbnailSvg(ownerId, id, { version: savedAt }),
    );
    return { projects, teamRecent };
  } catch (e) {
    if (offline.length > 0) return { projects: offline, teamRecent: [] };
    throw e;
  }
}
export const apiListProjectsWithTeamRecent = dedupeInFlight(
  _apiListProjectsWithTeamRecent,
  (ownerId) => ownerId,
);

// The personal library (and this browser's Offline Mode projects).
export async function apiListProjects(ownerId: string): Promise<ProjectSummary[]> {
  return (await apiListProjectsWithTeamRecent(ownerId)).projects;
}

// Fetch a project's cached SVG snapshot (docs/specs/006-project/project-snapshots.md) and return a blob URL
// for an `<img src>` plus the project's background colour. Native `<img>`
// can't send auth headers, so — like apiFetchImageBlobUrl — the bytes
// come through the authenticated client (Authorization / X-Owner-Id, plus
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

// The snapshot SVG's text, through the authenticated client; null on 404 / 403 / 503 (empty
// project, no access, no R2). Behind the Explorer's thumbnails and the landing page's Welcome back
// (docs/specs/019-marketing/returning-visitor.md).
export async function apiFetchProjectThumbnailSvg(
  ownerId: string,
  projectId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<string | null> {
  const params = new URLSearchParams();
  if (opts.version != null) params.set('v', String(opts.version));
  const qs = params.toString();
  const url = `${API_BASE}/projects/${encodeURIComponent(projectId)}/thumbnail${qs ? `?${qs}` : ''}`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await apiFetch(url, { headers });
  if (!res.ok) return null;
  return res.text();
}

// ---------------------------------------------------------------------
// shared_with — "Shared with you"
// ---------------------------------------------------------------------

// The "Shared with you" row shape now lives in @liveplanner/api-schema
// (the api worker emits it via listSharedWith), imported above and
// re-exported here so the existing `@/lib/api-client` / `./api/projects`
// import paths keep resolving unchanged. See that package for the
// per-field rationale.
export type { SharedWithItem };

// List projects that have been shared with this owner (i.e. the
// owner previously opened a share link for them and was identified
// to the api at the time). Returns newest-interaction-first.
// Same dedupe rationale as apiListProjects: editor + /new +
// /explorer all mount surfaces that fire this on first paint.
async function _apiListSharedWith(ownerId: string): Promise<SharedWithItem[]> {
  const res = await apiFetch(`${API_BASE}/shared`, { headers: await apiHeaders(ownerId) });
  const { shared } = await expectOk<{ shared: SharedWithItem[] }>(res, 'list shared');
  return shared;
}
export const apiListSharedWith = dedupeInFlight(_apiListSharedWith, (ownerId) => ownerId);

// Dismiss a single "shared with you" row.
export async function apiDismissSharedWith(ownerId: string, projectId: string): Promise<void> {
  return apiDelete(`${API_BASE}/shared/${projectId}`, ownerId, {
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

// Copy a project (typically one shared with the caller) into the
// caller's own files. Returns the new project. Optional shareCode
// covers the "visitor just arrived via share URL, no shared_with
// row yet" path — when present the api worker uses it as the
// authorisation proof instead of looking up shared_with.
export async function apiCopyProject(
  ownerId: string,
  sourceId: string,
  opts: { name?: string; shareCode?: string | null } = {},
): Promise<Project> {
  const res = await apiFetch(`${API_BASE}/projects/${sourceId}/copy`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true, share: opts.shareCode ?? null }),
    body: JSON.stringify({ name: opts.name }),
  });
  const { project: liveDoc } = await expectOk<ProjectResponse>(res, 'copy project');
  return liveDoc;
}
