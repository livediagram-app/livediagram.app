// /api/tokens — external API credentials, signed-in (Clerk) users only
// (spec/61). Gated exactly like the team routes: a guest (X-Owner-Id-only)
// caller is refused outright. A token always acts as the Clerk account that
// created it; there are no guest-owned tokens.
//
//   GET    /api/tokens        — list the caller's live tokens (metadata only)
//   POST   /api/tokens        — mint one; returns the secret ONCE
//   DELETE /api/tokens/<id>   — revoke one of the caller's tokens

import { badRequest, forbidden, json, noContent, notFound } from '../responses';
import { type RouteContext } from './context';
import {
  countLiveApiTokens,
  createApiToken,
  listApiTokensByOwner,
  revokeApiToken,
  MAX_API_TOKENS_PER_OWNER,
} from '../db';
import { apiTokenExpiry, generateApiToken, hashApiToken } from '../auth/api-token';
import { MAX_NAME_LEN } from '../limits';

export async function handleTokens(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId } = ctx;
  if (segments[1] !== 'tokens') return notFound();
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
      // Per-account cap (spec/61).
      if ((await countLiveApiTokens(env, owner)) >= MAX_API_TOKENS_PER_OWNER) {
        return json({ error: 'token_limit_reached' }, { status: 409 });
      }
      const secret = generateApiToken();
      const now = Date.now();
      const id = crypto.randomUUID();
      const expiresAt = apiTokenExpiry(now);
      await createApiToken(env, {
        id,
        ownerId: owner,
        name: name || null,
        tokenHash: await hashApiToken(secret),
        createdAt: now,
        expiresAt,
      });
      // The plaintext is returned ONCE, here. It is never stored and never
      // retrievable again; the client shows it for copy then drops it.
      return json({ token: secret, id, name: name || null, expiresAt }, { status: 201 });
    }
  }

  if (segments.length === 3 && request.method === 'DELETE') {
    const revoked = await revokeApiToken(env, owner, segments[2]!);
    return revoked ? noContent() : notFound();
  }

  return notFound();
}
