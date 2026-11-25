import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP } from '@liveplanner/ui/trusted-types';
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
  it('serves the editor page for /project/<id>', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://liveplanner.app/project/abc'), e);
    expect(seen).toEqual(['/project/placeholder']);
  });

  // Share Form's Embed (docs/specs/030-forms/forms.md "Publishing and the form link"): the form page alone of the
  // editor's pages may be framed; it keeps every other security header.
  it('serves the form page for /form/<code>, frameable for an embed (docs/specs/030-forms/forms.md)', async () => {
    const { env: e, seen } = env();
    const res = await worker.fetch(
      new Request('https://liveplanner.app/form/AbCdEfGhIjKlMnOpQrStU1?q.q-1=Ada'),
      e,
    );
    const placeholder = await worker.fetch(
      new Request('https://liveplanner.app/form/placeholder'),
      e,
    );
    expect(seen).toEqual(['/form/placeholder', '/form/placeholder']);
    for (const r of [res, placeholder]) {
      expect(r.headers.get('X-Frame-Options')).toBeNull();
      expect(r.headers.get('Content-Security-Policy')).toBe(TRUSTED_TYPES_CSP);
      expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
  });

  // A public roadmap's page (docs/specs/026-plan/public-roadmap.md): one placeholder backs every roadmap; never framed.
  it('serves the roadmap page for /roadmap/<plan>/<code>, refusing framing', async () => {
    const { env: e, seen } = env();
    const res = await worker.fetch(
      new Request('https://liveplanner.app/roadmap/plan-1/lpr_AbCdEfGhIjKlMnOpQrStUv'),
      e,
    );
    const placeholder = await worker.fetch(
      new Request('https://liveplanner.app/roadmap/placeholder'),
      e,
    );
    expect(seen).toEqual(['/roadmap/placeholder', '/roadmap/placeholder']);
    for (const r of [res, placeholder]) {
      expect(r.headers.get('X-Frame-Options')).toBe('DENY');
      expect(r.headers.get('Content-Security-Policy')).toBe(TRUSTED_TYPES_CSP);
    }
  });

  it('keeps refusing framing on paths that only look like the form page', async () => {
    const { env: e } = env();
    for (const path of ['/forms', '/formx/abc', '/project/form']) {
      const res = await worker.fetch(new Request(`https://liveplanner.app${path}`), e);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    }
  });

  it('leaves other paths to the static assets', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://liveplanner.app/pricing'), e);
    expect(seen).toEqual(['/pricing']);
  });
});

describe('editor worker security headers', () => {
  // docs/specs/016-platform/trusted-types.md: every page enforces Trusted Types, the embed included.
  it('enforces Trusted Types on every page', async () => {
    const { env: e } = env();
    for (const path of ['/project/abc', '/embed', '/sign-in']) {
      const res = await worker.fetch(new Request(`https://liveplanner.app${path}`), e);
      expect(res.headers.get('Content-Security-Policy'), path).toBe(TRUSTED_TYPES_CSP);
    }
  });

  it('denies framing on the sign-in page', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://liveplanner.app/sign-in'), e);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  // walkthroughs.md: recording a walkthrough needs the microphone and camera; the rest stays denied.
  it('lets this origin alone use the camera and the microphone', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://www.liveplanner.app/project/abc'), e);
    const policy = res.headers.get('Permissions-Policy') ?? '';
    for (const allowed of ['camera=(self)', 'microphone=(self)']) expect(policy).toContain(allowed);
    for (const denied of ['geolocation=()', 'payment=()', 'usb=()'])
      expect(policy).toContain(denied);
  });

  it('leaves the embed view frameable', async () => {
    const { env: e } = env();
    const res = await worker.fetch(new Request('https://liveplanner.app/embed'), e);
    expect(res.headers.get('X-Frame-Options')).toBeNull();
  });

  // Workbench embeds (docs/specs/013-workspace/blueprints/workbench-embeds.md): the workbench page is
  // framed by its workbench; no other route is (E34).
  it('leaves the workbench page frameable, with or without a trailing slash', async () => {
    const { env: e } = env();
    for (const path of ['/embed/workbench', '/embed/workbench/?d=doc-1']) {
      const res = await worker.fetch(new Request(`https://liveplanner.app${path}`), e);
      expect(res.headers.get('X-Frame-Options')).toBeNull();
    }
  });

  it('serves the workspace frame page for every place inside it, frameable', async () => {
    const { env: e, seen } = env();
    for (const path of [
      '/embed/workbench/explorer',
      '/embed/workbench/explorer/folder/f1',
      '/embed/workbench/explorer/recent?q=x',
      '/embed/workbench/project/doc-1?s=CODE2345',
    ]) {
      const res = await worker.fetch(new Request(`https://liveplanner.app${path}`), e);
      expect(res.headers.get('X-Frame-Options')).toBeNull();
    }
    expect(seen).toEqual([
      '/embed/workbench/explorer',
      '/embed/workbench/explorer',
      '/embed/workbench/explorer',
      '/embed/workbench/explorer',
    ]);
  });

  it('denies framing on the editor', async () => {
    const { env: e } = env();
    for (const path of ['/project/doc-1', '/embedded']) {
      const res = await worker.fetch(new Request(`https://liveplanner.app${path}`), e);
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

// A live embed's frame (liveworkspace/docs/specs/004-index/live-embeds.md "Framed by our apps alone", Work Tracker
// 1427): framed by our apps' pages alone, every other page's framing unchanged.
describe('a live embed frame', () => {
  const csp = async (href: string) =>
    (await worker.fetch(new Request(href), env().env)).headers.get('Content-Security-Policy')!;

  it("names our apps' origins as its only frame-ancestors, keeping Trusted Types", async () => {
    const policy = await csp('https://www.liveplanner.app/embed/workbench?d=doc-1&live=1');
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toMatch(/frame-ancestors 'self' .*https:\/\/www\.livehuddle\.app/);
    expect(policy).not.toContain('frame-ancestors *');
  });

  it('leaves the workbench frame and the share embed as they were', async () => {
    for (const path of ['/embed/workbench?d=doc-1', '/embed?s=code'])
      expect(await csp(`https://www.liveplanner.app${path}`)).not.toContain('frame-ancestors');
  });
});
