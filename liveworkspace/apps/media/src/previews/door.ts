// The app's export door (liveworkspace/docs/specs/006-media/previews.md "The export door"): the only place an item is drawn. The
// service calls it with the app's media key, on a miss or a stale preview, and for a public link every time
// (conditionally, so an unchanged drawing is not drawn again).

import { etagVersion, exportEtag } from '@liveworkspace/index-app';
import type { App } from '@liveworkspace/index-client';
import type { PreviewAppearance } from '@liveworkspace/media';
import { appDoor, type Env } from '../env';

export type DoorQuery = {
  itemId: string;
  tabId: string | null;
  // The public link the reader came by, so the app draws what it may show.
  code: string | null;
  // The reader's appearance, for an app whose drawing depends on it.
  appearance: PreviewAppearance | null;
  // The app's version the caller holds (`If-None-Match`).
  ifVersion: number | null;
};

export type DoorAnswer =
  | { status: 'ok'; svg: string; version: number }
  | { status: 'empty'; version: number }
  | { status: 'unchanged'; version: number }
  | { status: 'not_found' }
  | { status: 'error'; reason: string };

// A render can take a while (a tab of photos inlined from the media service); past this the preview gives up and
// serves what it has.
export const DOOR_TIMEOUT_MS = 15_000;

export async function callDoor(env: Env, app: App, query: DoorQuery): Promise<DoorAnswer> {
  const door = appDoor(env, app);
  if (!door) return { status: 'error', reason: 'app_not_configured' };
  const params = new URLSearchParams({ format: 'svg' });
  if (query.tabId) params.set('tab', query.tabId);
  if (query.code) params.set('code', query.code);
  if (query.appearance) params.set('appearance', query.appearance);
  const headers = new Headers({ Authorization: `Bearer ${door.key}` });
  if (query.ifVersion !== null) headers.set('If-None-Match', exportEtag(query.ifVersion));
  let res: Response;
  try {
    res = await fetch(
      `${door.origin}/api/internal/items/${encodeURIComponent(query.itemId)}/export?${params}`,
      { headers, signal: AbortSignal.timeout(DOOR_TIMEOUT_MS) },
    );
  } catch (err) {
    return { status: 'error', reason: err instanceof Error ? err.name : 'fetch_failed' };
  }
  const version = etagVersion(res.headers.get('ETag'));
  if (res.status === 404) {
    await res.body?.cancel();
    return { status: 'not_found' };
  }
  if (version === null) {
    await res.body?.cancel();
    return { status: 'error', reason: `status_${res.status}_no_version` };
  }
  if (res.status === 304) return { status: 'unchanged', version };
  if (res.status === 204) return { status: 'empty', version };
  if (res.status !== 200) {
    await res.body?.cancel();
    return { status: 'error', reason: `status_${res.status}` };
  }
  return { status: 'ok', svg: await res.text(), version };
}
