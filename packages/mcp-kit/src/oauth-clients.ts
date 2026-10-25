// The OAuth clients a product's authorization server knows (each product's docs/specs/015-api/blueprints/cli.md
// "OAuth server", CLI35): the ones it ships, looked up before any registration, then the registered ones in
// OAUTH_KV. Registration mints random hex ids, so it can never take a shipped client's id.

import { CLI_REDIRECT_URIS } from '@liveworkspace/api-kit/oauth';

export type ClientReg = { redirectUris: readonly string[]; clientName: string };
export type BuiltInClients = Readonly<Record<string, ClientReg>>;

// The KV namespace the authorization server keeps its short-lived state in.
export type OauthEnv = { OAUTH_KV: KVNamespace };

// A product's built-in CLI client, by its id and name (its api-schema's CLI_CLIENT_ID and CLI_CLIENT_NAME), on
// the loopback callbacks every CLI listens on.
export function cliClients(id: string, name: string): BuiltInClients {
  return { [id]: { clientName: name, redirectUris: CLI_REDIRECT_URIS } };
}

// A built-in client by its id: an own key only, so `constructor` or `toString` is no client.
export function builtInClient(clients: BuiltInClients, clientId: string): ClientReg | null {
  return Object.hasOwn(clients, clientId) ? clients[clientId]! : null;
}

export async function lookupClient(
  env: OauthEnv,
  clients: BuiltInClients,
  clientId: string,
): Promise<ClientReg | null> {
  return (
    builtInClient(clients, clientId) ??
    (await env.OAUTH_KV.get<ClientReg>(`client:${clientId}`, 'json'))
  );
}
