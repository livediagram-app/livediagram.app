// /api/tokens — external API credentials, signed-in (Clerk) users only
// (docs/specs/015-api/public-api-and-tokens.md). Gated exactly like the team routes: a guest (X-Owner-Id-only)
// caller is refused outright. A token always acts as the Clerk account that
// created it; there are no guest-owned tokens.
//
//   GET    /api/tokens        — list the caller's live tokens (metadata only)
//   POST   /api/tokens        — mint one; returns the secret ONCE
//   DELETE /api/tokens/<id>   — revoke one of the caller's tokens
//   GET    /api/tokens/current — the token this request presented (the CLI's auth status)
//   DELETE /api/tokens/current — that token revoking itself (the CLI's auth logout)

import type { CurrentTokenResponse } from '@livediagram/api-schema';
import {
  badRequest,
  conflict,
  forbidden,
  json,
  methodNotAllowed,
  noContent,
  notFound,
} from '../responses';
import { type RouteContext } from './context';
import {
  getParticipant,
  listApiTokensByOwner,
  mintApiToken,
  retractTimelineWarning,
  revokeApiToken,
} from '../db';
import { MAX_NAME_LEN } from '../limits';
import { recordTokenCreated, recordTokenRevoked } from '../timeline';
import { endWorkbenchAccess } from '../workbench-end';

export async function handleTokens(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId } = ctx;
  if (segments[1] !== 'tokens') return notFound();
  if (segments[2] === 'current' && segments.length === 3) return handleCurrentToken(ctx);
  // Signed-in only: reject when there's no verified Clerk identity (a guest
  // with only X-Owner-Id, or auth not configured), mirroring routes/teams.ts.
  if (!clerkUserId) return forbidden();
  const owner = clerkUserId;

  if (segments.length === 2) {
    if (request.method === 'GET') {
      return json({ tokens: await listApiTokensByOwner(env, owner) });
    }
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name.length > MAX_NAME_LEN) return badRequest('name too long');
      const minted = await mintApiToken(env, { ownerId: owner, name: name || null });
      // Null means the per-account cap (docs/specs/015-api/public-api-and-tokens.md) is already reached.
      if (!minted) return conflict('token_limit_reached');
      ctx.waitUntil?.(recordTokenCreated(env, { id: minted.id, name: name || 'API token' }, owner));
      // The plaintext is returned ONCE, here. It is never stored and never
      // retrievable again; the client shows it for copy then drops it.
      return json(
        { token: minted.secret, id: minted.id, name: name || null, expiresAt: minted.expiresAt },
        { status: 201 },
      );
    }
  }

  if (segments.length === 3 && request.method === 'DELETE') {
    const tokenId = segments[2]!;
    // Named before the revoke, so the feed can say WHICH token stopped
    // working rather than just that one did.
    const doomed = (await listApiTokensByOwner(env, owner)).find((t) => t.id === tokenId);
    const revoked = await revokeApiToken(env, owner, tokenId);
    if (revoked) {
      // docs/specs/013-workspace/workbench-embeds.md: its pairings and sessions end with it.
      await endWorkbenchAccess(env, { tokenId }, 'revoked');
      ctx.waitUntil?.(
        // Withdraw the pending "expires soon" warning first: the token is gone,
        // so its deadline can't arrive, and leaving the future-dated row would
        // have the feed still counting down to a token the same feed says the
        // owner already revoked. token_revoked carries a DIFFERENT source id
        // ('<id>:revoked'), so emitting it never displaced the warning.
        retractTimelineWarning(env, 'account', tokenId, 'token_expiring').then(() =>
          recordTokenRevoked(env, { id: tokenId, name: doomed?.name || 'API token' }, owner),
        ),
      );
    }
    return revoked ? noContent() : notFound();
  }

  return notFound();
}

// The token the request presented (docs/specs/015-api/blueprints/cli.md "Token self-service"). Only a token
// has one: a signed-in session or a guest is refused `403 not_a_token`; a token since revoked is 404.
async function handleCurrentToken(ctx: RouteContext): Promise<Response> {
  const { request, env, token } = ctx;
  if (request.method !== 'GET' && request.method !== 'DELETE') return methodNotAllowed();
  const owner = ctx.resolveOwner();
  if (!token || !owner) return forbidden('not_a_token');
  const current = (await listApiTokensByOwner(env, owner)).find((t) => t.id === token.id);
  if (!current) return notFound();
  if (request.method === 'GET') {
    console.info('[tokens] current read', { tokenId: token.id });
    const participant = await getParticipant(env, owner);
    const body: CurrentTokenResponse = {
      accountId: owner,
      accountName: participant?.name ?? null,
      tokenId: current.id,
      tokenName: current.name,
      role: token.readOnly ? 'read-only' : 'full',
      expiresAt: current.expiresAt,
    };
    return json(body);
  }
  // DELETE: the token revokes itself.
  await revokeApiToken(env, owner, token.id);
  await endWorkbenchAccess(env, { tokenId: token.id }, 'revoked');
  console.info('[tokens] current revoked', { tokenId: token.id });
  ctx.waitUntil?.(
    retractTimelineWarning(env, 'account', token.id, 'token_expiring').then(() =>
      recordTokenRevoked(env, { id: token.id, name: current.name || 'API token' }, owner),
    ),
  );
  return noContent();
}
