'use client';

// People's names and Google pictures for the editors (liveworkspace/docs/specs/003-accounts/accounts.md "Profile
// pictures"): liveworkspace's account API through this app's router (`/api/workspace/account`), by the person's access
// token, as Teams goes (explorer-teams-host.ts). History in Tools names who did what with it, and shows their faces,
// the reader's own included (owner, 2026-11-17: it drew a blank person).

import { createExplorerAccounts } from '@liveworkspace/explorer';
import { workbench } from '../bindings';

/** The bearer fetch: the product's access token, read when each request goes out. */
export async function bearerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await workbench.api.currentBearer();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export const explorerAccounts = createExplorerAccounts({
  baseUrl: '/api/workspace/account',
  fetch: bearerFetch,
});
