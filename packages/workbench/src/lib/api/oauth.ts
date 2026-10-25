// MCP OAuth consent (docs/specs/015-api/mcp-server.md §3): the consent page calls this to mint the
// lwt_ token that gets handed to the connecting MCP client. Signed-in only —
// the api headers (the product's, through the `api` binding) attach the account Bearer, and the api's /api/oauth/exchange
// rejects a guest.
import { workbench } from '../../bindings';
import { API_BASE } from './base';

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
  const { api } = workbench;
  const res = await api.fetch(`${API_BASE}/oauth/exchange`, {
    method: 'POST',
    headers: await api.headers(ownerId, { body: true }),
    body: JSON.stringify({ clientName, readOnly }),
  });
  return api.expectOk<OauthExchangeResult>(res, 'oauth exchange');
}
