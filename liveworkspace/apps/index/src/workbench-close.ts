// Accounts' workbench service ending a pairing's access (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"): it asks
// here, with its merge key, to tell an app to close the rooms that pairing's sessions joined, since this Worker
// already holds each app's key and origin. POST /internal/workbench-close {app, pairingId, itemIds} answers 200
// {closed, unreached} once every app call has settled. A revoked API token's rooms come the same way, naming
// `tokenId` instead of `pairingId`: the app closes the sockets that token's room tickets opened.

import { isApp } from '@liveworkspace/index-client';
import { callApp, eachLimited } from './app-calls';
import { isMergeCaller } from './auth';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, json, notFound, readObject, unauthorized } from './http';

// The rooms one call closes at most: accounts keeps a session's rooms below this.
export const WORKBENCH_CLOSE_MAX_ITEMS = 500;
// Room closes in flight at once, so one pairing's many rooms don't crowd an app.
export const WORKBENCH_CLOSE_CONCURRENCY = 10;

const PAIRING_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function handleWorkbenchClose(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  if (!(await isMergeCaller(request, env))) return unauthorized();
  const body = await readObject(request);
  const app = body?.app;
  const pairingId = body?.pairingId;
  const tokenId = body?.tokenId;
  const itemIds = body?.itemIds;
  // One of the two, never both.
  const who =
    typeof pairingId === 'string' && PAIRING_ID.test(pairingId) && tokenId === undefined
      ? { pairingId }
      : typeof tokenId === 'string' && PAIRING_ID.test(tokenId) && pairingId === undefined
        ? { tokenId }
        : null;
  if (
    !isApp(app) ||
    !who ||
    !Array.isArray(itemIds) ||
    itemIds.length > WORKBENCH_CLOSE_MAX_ITEMS ||
    !itemIds.every(isId)
  ) {
    return badRequest();
  }
  const unique = [...new Set(itemIds as string[])];
  const unreached: string[] = [];
  await eachLimited(unique, WORKBENCH_CLOSE_CONCURRENCY, async (itemId) => {
    const result = await callApp(
      env,
      app,
      'POST',
      `/items/${encodeURIComponent(itemId)}/workbench-close`,
      who,
    );
    if (!result.ok) unreached.push(itemId);
  });
  return json({ closed: unique.length - unreached.length, unreached });
}
