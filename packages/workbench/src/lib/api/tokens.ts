// API token calls (docs/specs/015-api/public-api-and-tokens.md). Tokens belong to the liveworkspace
// account and are made, listed and revoked on liveworkspace.app; this app only ends a token it just
// minted for an AI tool that did not take it (lib/oauth-handover.ts), by presenting the token itself.
import { workbench } from '../../bindings';
import { API_BASE } from './base';

export async function apiRevokeTokenAsItself(token: string): Promise<void> {
  const { api } = workbench;
  const res = await api.fetch(`${API_BASE}/tokens/current`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await api.expectOkVoid(res, 'revoke token');
}
