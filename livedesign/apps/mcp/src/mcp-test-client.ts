// A real MCP client connected to this MCP's real tools over an in-memory transport (the name cap,
// docs/specs/006-design/name-length.md): @liveworkspace/mcp-kit's test client, handed this server's tools. A caller must still
// stub `./image-result` (vi.mock is per file): the resvg WASM renderer cannot load in plain node.
import { connectTestClient as connect } from '@liveworkspace/mcp-kit/testing/test-client';
import { registerTools } from './tools';

export const connectTestClient = (fetch: (request: Request) => Promise<Response>) =>
  connect(registerTools, fetch);
