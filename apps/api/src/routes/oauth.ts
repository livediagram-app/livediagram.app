// /api/oauth/exchange — the single api change for the MCP OAuth flow
// (spec/62 §3.4). The apps/live consent page (Clerk-authed) calls this when a
// user approves an MCP client. It mints an ordinary lvd_ API token (spec/61)
// owned by that Clerk user, named for the connecting client, and returns the
// secret ONCE. The MCP worker binds it to the PKCE flow in its own KV; the
// token then shows up in the Explorer "API tokens" page and is revocable like
// any other — no parallel credential model.
//
// Gated exactly like /api/tokens: a guest (X-Owner-Id only) or a no-auth
// self-host has no verified Clerk identity, so nothing can be minted.
import { badRequest, forbidden, json, notFound } from '../responses';
import { type RouteContext } from './context';
import { mintApiToken } from '../db';
import { MAX_NAME_LEN } from '../limits';

export async function handleOauthExchange(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId } = ctx;
  if (segments[1] !== 'oauth') return notFound();
  if (!clerkUserId) return forbidden();
  if (segments[2] !== 'exchange' || request.method !== 'POST') return notFound();
  const owner = clerkUserId;

  const body = (await request.json().catch(() => ({}))) as {
    clientName?: string;
    readOnly?: boolean;
  };
  const raw = typeof body.clientName === 'string' ? body.clientName.trim() : '';
  if (raw.length > MAX_NAME_LEN) return badRequest('client name too long');
  // Default name keeps the token identifiable in the user's token list even if
  // the client registered without a readable name.
  const name = raw || 'MCP client';

  const readOnly = body.readOnly === true;
  // Same mint as the user-facing route, so the cap (spec/61 §3.6), the expiry
  // and the hash-only storage cannot differ between the two ways in.
  const minted = await mintApiToken(env, { ownerId: owner, name, readOnly });
  if (!minted) return json({ error: 'token_limit_reached' }, { status: 409 });
  // The plaintext is returned ONCE; the MCP hands it to the client and never
  // stores it server-side (only the hash is persisted).
  return json(
    { token: minted.secret, id: minted.id, name, expiresAt: minted.expiresAt, readOnly },
    { status: 201 },
  );
}
