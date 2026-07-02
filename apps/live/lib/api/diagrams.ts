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
> & {
  // Provenance (spec/15). Present on real list rows from the API; optional
  // so synthetic rows (shared / team placeholders) can omit it. Absent or
  // null means user-made (not in the Generated folder).
  source?: DiagramSummary['source'];
};

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

// Pull the snapshot's solid background colour out of the SVG text: it's
// the first `<rect>`'s fill, since renderElementsToSvg (spec/67) draws a
// full-viewBox background rect before any element, and the snapshot has no
// backdrop pattern, so the fill is always a plain colour string. Lets a
// card paint its letterbox to match the diagram instead of a generic
// slate. Null when absent (an unexpected SVG shape) — the caller falls
// back to its default box colour.
function svgBackgroundColor(svg: string): string | null {
  return /<rect[^>]*\bfill="([^"]+)"/.exec(svg)?.[1] ?? null;
}

// Fetch a diagram's cached SVG snapshot (spec/67) and return a blob URL
// for an `<img src>` plus the diagram's background colour. Native `<img>`
// can't send auth headers, so — like apiFetchImageBlobUrl — the bytes
// come through the authenticated client (Authorization / X-Owner-Id, plus
// X-Share-Code for a shared row) and get wrapped in a blob URL the caller
// revokes on unmount. `version` (the diagram's savedAt) rides as `?v=`
// purely to bust the browser/edge cache when the diagram changes; the
// worker ignores it. Returns null on 404 / 403 / 503 (empty diagram, no
// access, no R2) so the Explorer row falls back to its generic icon.
export async function apiFetchDiagramThumbnailUrl(
  ownerId: string,
  diagramId: string,
  opts: { version?: number; shareCode?: string | null } = {},
): Promise<{ url: string; backgroundColor: string | null } | null> {
  const params = new URLSearchParams();
  if (opts.version != null) params.set('v', String(opts.version));
  const qs = params.toString();
  const url = `${API_BASE}/diagrams/${encodeURIComponent(diagramId)}/thumbnail${qs ? `?${qs}` : ''}`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const svg = await res.text();
  const backgroundColor = svgBackgroundColor(svg);
  // Drop the snapshot's fixed width/height so the <img> renders the vector at
  // the card's display size (crisp) instead of rasterising at the snapshot's
  // intrinsic pixel size and upscaling it, which softens it in a large card.
  // The viewBox stays, so aspect ratio + object-contain are unchanged, and the
  // <img> sandbox (no script/font loading) is kept vs inlining the markup.
  const scalable = svg.replace(/(<svg\b[^>]*?)\s+width="[^"]*"\s+height="[^"]*"/, '$1');
  const blobUrl = URL.createObjectURL(new Blob([scalable], { type: 'image/svg+xml' }));
  return { url: blobUrl, backgroundColor };
}

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

// Mint a one-time WebSocket room ticket (spec/11). The WS upgrade
// can't carry the Bearer token, so an identified caller (a signed-in
// team member above all) proves access over normal authenticated REST
// and rides the returned ticket on the upgrade URL as `?t=`. Returns
// null on any failure — the connector falls back to the legacy
// owner-id / share-code query params, which still cover every
// non-team session.
export async function apiCreateRoomTicket(
  ownerId: string,
  diagramId: string,
  shareCode: string | null = null,
): Promise<string | null> {
  // Retried with a short backoff: a team member whose mint fails has NO
  // fallback (the legacy query params are personal/share-code only and
  // the connector has no reconnect loop), so one transient blip would
  // otherwise cost the whole page session its realtime.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const res = await fetch(`${API_BASE}/diagrams/${diagramId}/room-ticket`, {
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
