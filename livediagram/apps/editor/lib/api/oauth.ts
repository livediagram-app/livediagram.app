// MCP OAuth consent (docs/specs/015-api/mcp-server.md §3): the consent page calls this to mint the
// lvd_ token that gets handed to the connecting MCP client. Signed-in only —
// apiHeaders attaches the Clerk Bearer, and the api's /api/oauth/exchange
// rejects a guest.
import { API_BASE, apiHeaders, expectOk, apiFetch } from './core';

type OauthExchangeResult = {
  token: string;
  id: string;
  name: string | null;
  expiresAt: number;
};

export async function apiExchangeOauthToken(
  ownerId: string,
  clientName: string,
  readOnly = false,
): Promise<OauthExchangeResult> {
  const res = await apiFetch(`${API_BASE}/oauth/exchange`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ clientName, readOnly }),
  });
  return expectOk<OauthExchangeResult>(res, 'oauth exchange');
}
