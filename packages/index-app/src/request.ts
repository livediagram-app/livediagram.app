// The index's grant on the item a request is about (liveworkspace/docs/one-explorer-contracts.md "Grants"), as an
// app's worker settles it before the request goes to the item's Durable Object.
//
//   - The editor sends the grant it fetched itself (`POST /api/index/items/:id/grant`) as X-Index-Grant
//     (ITEM_GRANT_HEADER): checked offline against the index's keys, no call.
//   - Anything else (an API token, a workbench session, a browser that sent none) gets one fetched here
//     (`service.requestGrant`, cached until a minute before it lapses): as that account with the app's key, or
//     with the browser's own bearer and share headers.
//
// A refusal the caller can act on (the item's password) comes back as the index's answer, a Response; any other
// miss leaves the request without a grant (null), and the item's gates answer it as they answer no access.

import type { ShareAccess } from '@liveworkspace/index-client';
import {
  itemGrantOf,
  type GrantCaller,
  type IndexEnv,
  type IndexService,
  type ItemGrant,
} from './service';

export const ITEM_GRANT_HEADER = 'X-Index-Grant';
// A link visitor's share code and its password, as every app's editor sends them.
export const SHARE_CODE_HEADER = 'X-Share-Code';
export const SHARE_PASSWORD_HEADER = 'X-Share-Password';

const PASSWORD_REFUSALS = new Set(['password_required', 'password_invalid']);

// The share code a link visitor's request carries. Its PRESENCE is the only honest signal that a caller arrived
// through a share link: a joined team member reads every team item without one.
export function shareCodeOf(request: Request): string | null {
  return request.headers.get(SHARE_CODE_HEADER);
}

export function shareAccessOf(request: Request): ShareAccess | null {
  const code = shareCodeOf(request);
  if (!code) return null;
  const password = request.headers.get(SHARE_PASSWORD_HEADER);
  return password === null ? { code } : { code, password };
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function resolveItemGrant(
  service: IndexService,
  env: IndexEnv,
  request: Request,
  caller: GrantCaller,
  itemId: string,
  // How the app answers a refusal (its CORS headers, say). Defaults to plain JSON.
  respond: (body: { error: string }, status: number) => Response = jsonResponse,
): Promise<ItemGrant | null | Response> {
  const sent = request.headers.get(ITEM_GRANT_HEADER);
  if (sent) {
    const claims = await service.verifyGrant(env, sent, itemId);
    if (claims) return itemGrantOf(claims, shareCodeOf(request), sent);
  }
  const share = shareAccessOf(request);
  // Nobody to ask for: no identity and no link.
  if (caller.kind === 'bearer' && !caller.token && !share) return null;
  if (caller.kind === 'delegate' && !caller.personId) return null;
  const outcome = await service.requestGrant(env, caller, itemId, share);
  if (!outcome.ok) {
    if (PASSWORD_REFUSALS.has(outcome.error))
      return respond({ error: outcome.error }, outcome.status);
    return null;
  }
  const claims = await service.verifyGrant(env, outcome.grant.grant, itemId);
  return claims ? itemGrantOf(claims, share?.code ?? null, outcome.grant.grant) : null;
}
