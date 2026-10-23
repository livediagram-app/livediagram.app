// /api/oauth/exchange — the single api change for the MCP OAuth flow
// (docs/specs/015-api/mcp-server.md §3.4). The apps/live consent page (signed-in) calls this when a
// user approves an MCP client. It asks liveworkspace for an account token (liveworkspace/docs/
// accounts.md "API tokens"), named for the connecting client, vouching for the person with the
// access token they signed in with, and returns the secret ONCE. The MCP worker binds it to the
// PKCE flow in its own KV; the token works on every liveworkspace app and is listed and revoked on
// liveworkspace.app like any other.
//
// A guest (X-Owner-Id only) or a no-auth deployment has no verified account identity, so nothing
// can be minted.
import { bearerTokenOf } from '@livedesign/api-schema';
import { badRequest, conflict, forbidden, json, notFound } from '../responses';
import { readOptionalBody, type RouteContext } from './context';
import { mintApiToken } from '../db';
import { MAX_NAME_LEN } from '../limits';

export async function handleOauthExchange(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, accountUserId } = ctx;
  if (segments[1] !== 'oauth') return notFound();
  if (!accountUserId) return forbidden();
  if (segments[2] !== 'exchange' || segments.length !== 3 || request.method !== 'POST') {
    return notFound();
  }
  const body = (await readOptionalBody(request)) as {
    clientName?: string;
    readOnly?: boolean;
  };
  const raw = typeof body.clientName === 'string' ? body.clientName.trim() : '';
  if (raw.length > MAX_NAME_LEN) return badRequest('client name too long');
  // Default name keeps the token identifiable in the user's token list even if
  // the client registered without a readable name.
  const name = raw || 'MCP client';

  const readOnly = body.readOnly === true;
  // liveworkspace keeps the cap, the expiry and the hash-only storage, as for a token made on
  // liveworkspace.app. accountUserId is set only when the bearer verified as an access token, so the bearer is one.
  const accessToken = bearerTokenOf(request.headers.get('Authorization'));
  if (!accessToken) return forbidden();
  const minted = await mintApiToken(env, { accessToken, name, readOnly });
  if (!minted) return conflict('token_limit_reached');
  // The plaintext is returned ONCE; the MCP hands it to the client and never stores it.
  return json(
    { token: minted.secret, id: minted.id, name, expiresAt: minted.expiresAt, readOnly },
    { status: 201 },
  );
}
