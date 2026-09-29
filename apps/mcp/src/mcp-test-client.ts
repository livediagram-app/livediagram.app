// A real MCP client connected to the real tools over an in-memory transport, for
// tests that need the SDK's own behaviour: input schemas parsed (the name cap,
// docs/specs/006-document/name-length.md) and results validated against each tool's outputSchema
// (docs/specs/015-api/mcp-server.md §4.17). The api worker is the caller's `fetch` stub.
//
// A caller must still stub `./image-result` (vi.mock is per file): the resvg
// WASM renderer cannot load in plain node.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Env } from './env';
import { registerTools } from './tools';

export async function connectTestClient(
  fetch: (request: Request) => Promise<Response>,
): Promise<Client> {
  const env = { API: { fetch } } as unknown as Env;
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTools(server, env);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  // Every client message carries a bearer token, the shape the worker's auth
  // layer hands the SDK, so requireToken passes.
  const send = clientSide.send.bind(clientSide);
  clientSide.send = (message, options) =>
    send(message, {
      ...options,
      authInfo: { token: 'lvd_test', clientId: 'test-client', scopes: [] },
    });
  await server.connect(serverSide);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
}
