// The OAuth clients the authorization server knows (docs/specs/015-api/blueprints/cli.md "OAuth server").

import { CLI_CLIENT_ID, CLI_CLIENT_NAME, CLI_REDIRECT_URIS } from '@livediagram/api-schema';
import type { Env } from './env';

export type ClientReg = { redirectUris: readonly string[]; clientName: string };

// The clients livediagram ships (docs/specs/015-api/blueprints/cli.md "OAuth server", CLI35): looked up before any
// registration. Registration mints random hex ids, so it can never take one of these.
export const BUILT_IN_CLIENTS: Readonly<Record<string, ClientReg>> = {
  [CLI_CLIENT_ID]: { clientName: CLI_CLIENT_NAME, redirectUris: CLI_REDIRECT_URIS },
};

// A built-in client by its id: an own key only, so `constructor` or `toString` is no client.
export function builtInClient(clientId: string): ClientReg | null {
  return Object.hasOwn(BUILT_IN_CLIENTS, clientId) ? BUILT_IN_CLIENTS[clientId]! : null;
}

export async function lookupClient(env: Env, clientId: string): Promise<ClientReg | null> {
  return (
    builtInClient(clientId) ?? (await env.OAUTH_KV.get<ClientReg>(`client:${clientId}`, 'json'))
  );
}
