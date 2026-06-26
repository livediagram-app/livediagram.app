// MCP OAuth consent (spec/62 §3): the consent page calls this to mint the
// lvd_ token that gets handed to the connecting MCP client. Signed-in only —
// apiHeaders attaches the Clerk Bearer, and the api's /api/oauth/exchange
// rejects a guest.
import { API_BASE, apiHeaders, expectOk } from './core';

export type OauthExchangeResult = {
  token: string;
  id: string;
  name: string | null;
  expiresAt: number;
};

export async function apiExchangeOauthToken(
  ownerId: string,
  clientName: string,
): Promise<OauthExchangeResult> {
  const res = await fetch(`${API_BASE}/oauth/exchange`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ clientName }),
  });
  return expectOk<OauthExchangeResult>(res, 'oauth exchange');
}
