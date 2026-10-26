// The owner's own access to an item or a folder, for a ticket's mint and redemption (liveworkspace/docs/specs/011-workbench/workbench.md
// "The handoff"): never a share code, whatever the request carries. Asked of the index as the person, with accounts'
// key and the app named (the index's delegated caller): only that app's items answer. Through the INDEX service
// binding, so it never leaves Cloudflare.

import {
  createIndexDelegateClient,
  IndexError,
  type App,
  type IndexClient,
} from '@liveworkspace/index-client';
import type { Env } from '../env.ts';
import type { WorkbenchLevel } from './store.ts';

export type ItemAccess =
  { ok: true; level: WorkbenchLevel } | { ok: false; status: 404 | 410 | 503; error: string };

function clientFor(
  env: Env,
  app: App,
  personId: string,
  teams: readonly string[],
): IndexClient | null {
  const key = env.INDEX_MERGE_KEY?.trim();
  if (!env.INDEX_URL || !key) return null;
  const service = env.INDEX;
  return createIndexDelegateClient({
    app,
    key,
    personId,
    teams: [...teams],
    baseUrl: env.INDEX_URL,
    ...(service
      ? { fetch: ((input, init) => service.fetch(input as RequestInfo, init)) as typeof fetch }
      : {}),
  });
}

// The owner's level on the item now. In the Trash: 410 `<noun>_trashed`. Out of reach (or another app's): 404. An
// index that can't answer: 503, never a guess.
export async function ownerItemAccess(
  env: Env,
  input: { app: App; noun: string; personId: string; teams: readonly string[]; itemId: string },
): Promise<ItemAccess> {
  const client = clientFor(env, input.app, input.personId, input.teams);
  if (!client) return { ok: false, status: 503, error: 'index_unavailable' };
  try {
    const grant = await client.grant(input.itemId);
    if (grant.trashed) return { ok: false, status: 410, error: `${input.noun}_trashed` };
    return { ok: true, level: grant.level };
  } catch (err) {
    if (err instanceof IndexError && err.status < 500)
      return { ok: false, status: 404, error: 'not_found' };
    console.warn('[workbench] index access failed', { error: String(err) });
    return { ok: false, status: 503, error: 'index_unavailable' };
  }
}

// A folder a workspace ticket may start on: one of the owner's, or a team's they have joined. One request: the
// index's folder previews leave out a folder the person cannot reach.
export async function ownerReachesFolder(
  env: Env,
  input: { app: App; personId: string; teams: readonly string[]; folderId: string },
): Promise<boolean | 'unavailable'> {
  const client = clientFor(env, input.app, input.personId, input.teams);
  if (!client) return 'unavailable';
  try {
    const { previews } = await client.folderPreviews([input.folderId], { app: input.app });
    return previews.some((p) => p.folderId === input.folderId);
  } catch (err) {
    if (err instanceof IndexError && err.status < 500) return false;
    console.warn('[workbench] folder lookup failed', { error: String(err) });
    return 'unavailable';
  }
}

// Closes the rooms a pairing's sessions had open, through the index, which holds each app's key
// (POST /internal/workbench-close). Best effort: a session whose rows are gone already fails every check.
export async function closeRooms(
  env: Env,
  rooms: readonly { app: string; pairingId: string; itemIds: string[] }[],
): Promise<{ closed: number; unreached: number }> {
  const key = env.INDEX_MERGE_KEY?.trim();
  let closed = 0;
  let unreached = 0;
  for (const room of rooms) {
    if (!env.INDEX_URL || !key) {
      unreached += room.itemIds.length;
      continue;
    }
    const send = env.INDEX ? env.INDEX.fetch.bind(env.INDEX) : fetch;
    try {
      const response = await send(`${env.INDEX_URL}/internal/workbench-close`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(room),
      });
      const answer = (await response.json().catch(() => ({}))) as {
        closed?: number;
        unreached?: unknown[];
      };
      if (!response.ok) throw new Error(`status_${response.status}`);
      closed += answer.closed ?? 0;
      unreached += answer.unreached?.length ?? 0;
    } catch (err) {
      unreached += room.itemIds.length;
      console.warn('[workbench] room close failed', {
        app: room.app,
        pairingId: room.pairingId,
        error: String(err),
      });
    }
  }
  if (rooms.length > 0) console.log('[workbench] rooms closed', { closed, unreached });
  return { closed, unreached };
}
