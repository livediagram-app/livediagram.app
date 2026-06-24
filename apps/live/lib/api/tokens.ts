// API token calls (spec/61). Signed-in (Clerk) only: the routes reject a
// guest, and apiHeaders attaches the Clerk Bearer when signed in. Used by the
// Explorer "API tokens" library section.
import type { ApiToken } from '@livediagram/api-schema';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  type CreateTokenResponse,
  type TokensResponse,
} from './core';

export async function apiListTokens(ownerId: string): Promise<ApiToken[]> {
  const res = await fetch(`${API_BASE}/tokens`, { headers: await apiHeaders(ownerId) });
  const { tokens } = await expectOk<TokensResponse>(res, 'list tokens');
  return tokens;
}

// Mint a token. The returned `token` is the one-time plaintext secret — show
// it to the user to copy, then drop it (it's never retrievable again).
export async function apiCreateToken(ownerId: string, name: string): Promise<CreateTokenResponse> {
  const res = await fetch(`${API_BASE}/tokens`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ name }),
  });
  return expectOk<CreateTokenResponse>(res, 'create token');
}

export async function apiRevokeToken(ownerId: string, id: string): Promise<void> {
  await apiDelete(`${API_BASE}/tokens/${id}`, ownerId, { action: 'revoke token' });
}
