// API token calls (docs/specs/015-api/public-api-and-tokens.md). Tokens belong to the liveworkspace
// account and are made, listed and revoked on liveworkspace.app; this app only ends a token it just
// minted for an AI tool that did not take it (lib/oauth-handover.ts), by presenting the token itself.
import { API_BASE, apiFetch, expectOkVoid } from './core';

export async function apiRevokeTokenAsItself(token: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/tokens/current`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await expectOkVoid(res, 'revoke token');
}
