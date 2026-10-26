// The index's grant on the item a request is about (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as an
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

import {
  IndexError,
  ITEM_GRANT_HEADER,
  SHARE_CODE_HEADER,
  SHARE_PASSWORD_HEADER,
  type CreateItemInput,
  type Item,
  type ItemSource,
  type ShareAccess,
} from '@liveworkspace/index-client';
import {
  itemGrantOf,
  type GrantCaller,
  type IndexEnv,
  type IndexService,
  type ItemGrant,
} from './service';

// The headers every app's editor sends (@liveworkspace/index-client), for the apps' servers.
export { ITEM_GRANT_HEADER, SHARE_CODE_HEADER, SHARE_PASSWORD_HEADER };

const PASSWORD_REFUSALS = new Set(['password_required', 'password_invalid']);

// The share code a link visitor's request carries. The grant's `link` claim is the signal an app relies on (a person
// who opened the link before may send no header); the header only adds to it, for a grant signed without the claim.
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

// What an API client's create (an MCP server's, the CLI's, a script's) names besides its id: its title, where it
// goes and what made it. A `folderId` key left out lets the index file it by the person's default folder for the
// intent; `folderId: null` is the top of the space, chosen on purpose.
export type ItemCreateRequest = Omit<CreateItemInput, 'id' | 'app'>;

// The provenance an app's create body names ('mcp', 'cli') as the index records it; anything else is a person's.
export function itemSourceOf(source: unknown): ItemSource | null {
  if (source === 'mcp') return 'ai';
  if (source === 'cli') return 'import';
  return null;
}

// An API client's create (a create that carries no grant): the app's worker makes the index's item for the caller,
// under the id the client minted, and the item's Durable Object then opens with the grant that comes back; `item`
// is where the index filed it (the person's default folder, say), for the create's answer. The id already taken is
// the same client re-committing its own item: the grant it holds decides (resolveItemGrant), with no `item`. Any
// other refusal is the index's, answered as `respond` answers.
export type CreatedItemGrant = { grant: ItemGrant; item: Item | null };

export async function createItemGrant(
  service: IndexService,
  env: IndexEnv,
  request: Request,
  caller: GrantCaller,
  itemId: string,
  create: ItemCreateRequest,
  respond: (body: { error: string }, status: number) => Response = jsonResponse,
): Promise<CreatedItemGrant | null | Response> {
  const client = service.clientFor(env, caller);
  if (!client) return respond({ error: 'index_unavailable' }, 503);
  try {
    const { item, grant } = await client.createItem({ ...create, id: itemId, app: service.app });
    const claims = await service.verifyGrant(env, grant.grant, itemId);
    return claims ? { grant: itemGrantOf(claims, null, grant.grant), item } : null;
  } catch (err) {
    if (err instanceof IndexError && err.code === 'item_exists') {
      const held = await resolveItemGrant(service, env, request, caller, itemId, respond);
      return held && !(held instanceof Response) ? { grant: held, item: null } : held;
    }
    if (err instanceof IndexError) return respond({ error: err.code }, err.status);
    console.error('[index] create failed', { itemId, error: String(err) });
    return respond({ error: 'index_unavailable' }, 503);
  }
}
