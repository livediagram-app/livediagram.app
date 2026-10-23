import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP } from '@livedesign/ui/trusted-types';
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
  it('serves the editor page for /design/<id>', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://livedesign.app/design/abc'), e);
    expect(seen).toEqual(['/design/placeholder']);
  });

  it('leaves other paths to the static assets', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://livedesign.app/pricing'), e);
    expect(seen).toEqual(['/pricing']);
  });

  it('serves /explorer here while livedesign hosts the Explorer (lib/explorer-redirect.ts)', async () => {
    const { env: e, seen } = env();
    const res = await worker.fetch(new Request('https://livedesign.app/explorer/folder?id=f1'), e);
    expect(res.status).toBe(200);
    expect(seen).toEqual(['/explorer/folder']);
  });
});

describe('live worker security headers', () => {
  // docs/specs/016-platform/trusted-types.md: every page enforces Trusted Types, the embed included.
  it('enforces Trusted Types on every page', async () => {
    const { env: e } = env();
    for (const path of ['/design/abc', '/embed', '/oauth/consent']) {
      const res = await worker.fetch(new Request(`https://livedesign.app${path}`), e);
      expect(res.headers.get('Content-Security-Policy'), path).toBe(TRUSTED_TYPES_CSP);
    }
  });

  it('denies framing on the MCP OAuth consent screen', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://livedesign.app/oauth/consent'), e);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('leaves the embed view frameable', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://livedesign.app/embed'), e);
    expect(res.headers.get('X-Frame-Options')).toBeNull();
  });

  // Workbench embeds (docs/specs/013-workspace/blueprints/workbench-embeds.md): the workbench page is
  // framed by its workbench; the pairing page never is (E34), nor is any other route.
  it('leaves the workbench page frameable, with or without a trailing slash', async () => {
    const { env: e } = env();
    for (const path of ['/embed/workbench', '/embed/workbench/?d=doc-1']) {
      const res = await worker.fetch(new Request(`https://livedesign.app${path}`), e);
      expect(res.headers.get('X-Frame-Options')).toBeNull();
    }
  });

  it('serves the workspace frame page for every place inside it, frameable', async () => {
    const { env: e, seen } = env();
    for (const path of [
      '/embed/workbench/explorer',
      '/embed/workbench/explorer/folder/f1',
      '/embed/workbench/explorer/recent?q=x',
      '/embed/workbench/design/doc-1?s=CODE2345',
    ]) {
      const res = await worker.fetch(new Request(`https://livedesign.app${path}`), e);
      expect(res.headers.get('X-Frame-Options')).toBeNull();
    }
    expect(seen).toEqual([
      '/embed/workbench/explorer',
      '/embed/workbench/explorer',
      '/embed/workbench/explorer',
      '/embed/workbench/explorer',
    ]);
  });

  it('denies framing on the pairing page and the editor', async () => {
    const { env: e } = env();
    for (const path of [
      '/workbench/pair?code=x',
      '/design/doc-1',
      '/embedded',
    ]) {
      const res = await worker.fetch(new Request(`https://livedesign.app${path}`), e);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    }
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
