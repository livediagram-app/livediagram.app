import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import worker from './worker';

function env() {
  const seen: string[] = [];
  const ASSETS = {
    fetch: async (req: Request) => {
      seen.push(new URL(req.url).pathname);
      return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    },
  };
  return { env: { ASSETS } as never, seen };
}

describe('live worker editor route', () => {
  it('serves the editor page for /document/<id>', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://livediagram.app/document/abc'), e);
    expect(seen).toEqual(['/document/placeholder']);
  });

  it('leaves other paths to the static assets', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://livediagram.app/explorer/recent'), e);
    expect(seen).toEqual(['/explorer/recent']);
  });
});

describe('live worker security headers', () => {
  it('denies framing on the MCP OAuth consent screen', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://livediagram.app/oauth/consent'), e);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('leaves the embed view frameable', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://livediagram.app/embed'), e);
    expect(res.headers.get('X-Frame-Options')).toBeNull();
  });

  // The headers above only ship if the worker actually runs for page paths.
  // Static Assets serves a matching file BEFORE the worker by default, which
  // once left every real page (consent screen included) frameable in prod.
  it('runs ahead of the static assets for every page, prod and staging', () => {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    const lines = toml.match(/^run_worker_first = .*$/gm) ?? [];
    expect(lines).toEqual([
      'run_worker_first = ["/*", "!/_next/*"]',
      'run_worker_first = ["/*", "!/_next/*"]',
    ]);
  });
});
