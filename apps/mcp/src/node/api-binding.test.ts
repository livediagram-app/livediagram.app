// The api binding over HTTP (docs/specs/016-platform/self-hosted-runtime.md, "MCP process").
// A real server on a real port: what matters is that the request the application
// code builds — path, method, headers, body — arrives at the app process unchanged.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { apiOverHttp } from './api-binding';

type Seen = { method: string; url: string; headers: Record<string, string>; body: string };

describe('the API binding over HTTP', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
    );
  });

  /** A real HTTP server that records what it was asked and answers JSON. */
  async function withServer(): Promise<{ origin: string; seen: Seen[] }> {
    const seen: Seen[] = [];
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += String(chunk)));
      req.on('end', () => {
        seen.push({
          method: req.method ?? '',
          url: req.url ?? '',
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join(',') : (v ?? ''),
            ]),
          ),
          body,
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    return { origin: `http://127.0.0.1:${port}`, seen };
  }

  it('forwards a GET with its path, query and bearer token', async () => {
    const { origin, seen } = await withServer();
    const api = apiOverHttp(origin);
    const answer = await api.fetch(
      new Request('https://livediagram-api/api/documents?limit=5', {
        headers: { authorization: 'Bearer lvd_test' },
      }),
    );

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ ok: true });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe('GET');
    expect(seen[0]?.url).toBe('/api/documents?limit=5');
    expect(seen[0]?.headers['authorization']).toBe('Bearer lvd_test');
  });

  it('forwards a POST body, and never the binding host', async () => {
    const { origin, seen } = await withServer();
    const api = apiOverHttp(origin);
    await api.fetch(
      new Request('https://livediagram-api/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Board' }),
      }),
    );

    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.body).toBe('{"name":"Board"}');
    expect(seen[0]?.headers['host']).not.toBe('livediagram-api');
  });

  it('tolerates a trailing slash on the configured origin', async () => {
    const { origin, seen } = await withServer();
    const api = apiOverHttp(`${origin}/`);
    await api.fetch(new Request('https://livediagram-api/api/capabilities'));
    expect(seen[0]?.url).toBe('/api/capabilities');
  });
});
