// /api/tokens — API tokens are the liveworkspace account's (liveworkspace/docs/accounts.md "API
// tokens"): made, listed and revoked on liveworkspace.app, so the management routes answer 410 with
// where to go. What stays is the token a request presented:
//
//   GET    /api/tokens/current — the token this request presented (the CLI's auth status)
//   DELETE /api/tokens/current — that token revoking itself (the CLI's auth logout)

import { bearerTokenOf, type CurrentTokenResponse } from '@livedocuments/api-schema';
import { forbidden, json, methodNotAllowed, noContent, notFound } from '../responses';
import type { RouteContext } from './context';
import { listApiTokensByOwner, revokePresentedToken } from '../db';
import { getParticipant } from '../person/profiles';
import { endWorkbenchAccess } from '../workbench-end';

export async function handleTokens(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'tokens') return notFound();
  if (segments[2] === 'current' && segments.length === 3) return handleCurrentToken(ctx);
  const managed =
    (segments.length === 2 && (request.method === 'GET' || request.method === 'POST')) ||
    (segments.length === 3 && request.method === 'DELETE');
  if (!managed) return notFound();
  return json(
    {
      error: 'tokens_moved',
      manageAt: `${(env.ACCOUNTS_URL ?? 'https://liveworkspace.app').replace(/\/+$/, '')}/account/tokens`,
    },
    { status: 410 },
  );
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
  // DELETE: the token revokes itself, at liveworkspace too, so it stops in every app.
  const secret = bearerTokenOf(request.headers.get('Authorization'));
  if (secret) await revokePresentedToken(env, { id: token.id, secret });
  await endWorkbenchAccess(env, { tokenId: token.id }, 'revoked');
  console.info('[tokens] current revoked', { tokenId: token.id });
  return noContent();
}
