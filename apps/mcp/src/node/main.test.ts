// The MCP process itself (docs/specs/016-platform/self-hosted-runtime.md, "MCP process"):
// the same Hono app the Worker serves, on a Node HTTP server, with the two
// bindings it needs built from the process. A real port and real requests — the
// Worker's own behaviour is covered by the package's other tests.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The resvg wasm is a bundler asset (esbuild inlines it, wrangler compiles it),
// not something vitest can import; nothing here renders a picture. Rendering is
// covered by packages/render-png and the MCP's own image-result tests, and the
// process's end-to-end render was measured against a real client.
vi.mock('../render', () => ({ svgToPngBase64: async () => '' }));

import { startMcpServer, type StartedMcpServer } from './main';

describe('the MCP process', () => {
  const started: StartedMcpServer[] = [];
  const dirs: string[] = [];

  async function start(apiOrigin = 'http://127.0.0.1:1'): Promise<StartedMcpServer> {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-process-'));
    dirs.push(dir);
    const server = await startMcpServer({
      port: 0,
      host: '127.0.0.1',
      databasePath: join(dir, 'mcp.sqlite'),
      apiOrigin,
      vars: {},
    });
    started.push(server);
    return server;
  }

  afterEach(async () => {
    for (const server of started.splice(0)) await server.close();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('answers /health and creates its own database file', async () => {
    const server = await start();
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('serves the OAuth discovery documents on its own origin', async () => {
    const server = await start();
    const res = await fetch(`${server.url}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ resource: `${server.url}/mcp` });
  });

  it('refuses /mcp without a bearer token, and points at its metadata', async () => {
    const server = await start();
    const res = await fetch(`${server.url}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource');
  });
});
