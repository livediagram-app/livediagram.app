// /api/tokens — API tokens are the liveworkspace account's (liveworkspace/docs/accounts.md "API
// tokens"): made, listed and revoked on liveworkspace.app. This app serves only the token a request presented:
//
//   GET    /api/tokens/current — the token this request presented (the CLI's auth status)
//   DELETE /api/tokens/current — that token revoking itself (the CLI's auth logout)

import { bearerTokenOf, type CurrentTokenResponse } from '@liveplanner/api-schema';
import { forbidden, json, methodNotAllowed, noContent, notFound } from '../responses';
import type { RouteContext } from './context';
import { revokePresentedToken } from '../db';
import { getParticipant } from '../person/profiles';
import { workbenchStore } from '../workbench-store';

export async function handleTokens(ctx: RouteContext): Promise<Response> {
  const { segments } = ctx;
  if (segments[1] === 'tokens' && segments[2] === 'current' && segments.length === 3)
    return handleCurrentToken(ctx);
  return notFound();
}

// The token the request presented (docs/specs/015-api/blueprints/cli.md "Token self-service"), as liveworkspace
// described it when it checked it. Only a token has one: a signed-in session or a guest is refused
// `403 not_a_token`; a token since revoked never got this far (401).
async function handleCurrentToken(ctx: RouteContext): Promise<Response> {
  const { request, env, token } = ctx;
  if (request.method !== 'GET' && request.method !== 'DELETE') return methodNotAllowed();
  const owner = ctx.resolveOwner();
  if (!token || !owner) return forbidden('not_a_token');
  if (token.expiresAt === undefined) return notFound();
  const current = { id: token.id, name: token.name ?? null, expiresAt: token.expiresAt };
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
  // DELETE: the token revokes itself, at liveworkspace too, so it stops in every app.
  const secret = bearerTokenOf(request.headers.get('Authorization'));
  if (secret) await revokePresentedToken(env, secret);
  await workbenchStore(env, owner).endAccess({ tokenId: token.id }, 'revoked');
  console.info('[tokens] current revoked', { tokenId: token.id });
  return noContent();
}
