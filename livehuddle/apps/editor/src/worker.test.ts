import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP } from '@livehuddle/ui/trusted-types';
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

describe('editor worker editor route', () => {
  it('serves the editor page for /document/<id>', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://www.livehuddle.app/document/abc'), e);
    expect(seen).toEqual(['/document/placeholder']);
  });

  it('leaves other paths to the static assets', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://www.livehuddle.app/pricing'), e);
    expect(seen).toEqual(['/pricing']);
  });
});

describe('editor worker security headers', () => {
  // docs/specs/016-platform/trusted-types.md: every page enforces Trusted Types, the embed included.
  it('enforces Trusted Types on every page', async () => {
    const { env: e } = env();
    for (const path of ['/document/abc', '/embed', '/explorer']) {
      const res = await worker.fetch(new Request(`https://www.livehuddle.app${path}`), e);
      expect(res.headers.get('Content-Security-Policy'), path).toBe(TRUSTED_TYPES_CSP);
    }
  });

  // proximity-audio.md "Turning calls on": calls need the camera, the microphone and screen capture; the rest stays denied.
  it('lets this origin alone use the camera, the microphone and screen capture', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://www.livehuddle.app/document/abc'), e);
    const policy = res.headers.get('Permissions-Policy') ?? '';
    for (const allowed of ['camera=(self)', 'microphone=(self)', 'display-capture=(self)']) {
      expect(policy).toContain(allowed);
    }
    for (const denied of ['geolocation=()', 'payment=()', 'usb=()'])
      expect(policy).toContain(denied);
  });

  it('leaves the embed view frameable', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://www.livehuddle.app/embed'), e);
    expect(res.headers.get('X-Frame-Options')).toBeNull();
  });

  it('denies framing on the editor and every other page', async () => {
    const { env: e } = env();
    for (const path of ['/explorer', '/document/doc-1', '/embedded']) {
      const res = await worker.fetch(new Request(`https://www.livehuddle.app${path}`), e);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    }
  });

  // The headers above only ship if the worker actually runs for page paths.
  // Static Assets serves a matching file BEFORE the worker by default, which
  // once left every real page frameable in prod.
  it('runs ahead of the static assets for every page, prod and staging', () => {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    const lines = toml.match(/^run_worker_first = .*$/gm) ?? [];
    expect(lines).toEqual([
      'run_worker_first = ["/*", "!/_next/*"]',
      'run_worker_first = ["/*", "!/_next/*"]',
    ]);
  });
});
