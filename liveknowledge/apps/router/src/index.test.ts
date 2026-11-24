import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { categories } from '@liveknowledge/help-registry';
import { describeAppRouter } from '@liveworkspace/sites/app-router-testing';
import router from './index';

// The dispatch tests every app's router runs (@liveworkspace/sites/app-router-testing; docs/specs/016-platform/
// router-app.md), against this router, and what is liveknowledge's own: a knowledgebase's public
// site.
describeAppRouter({
  router,
  app: 'liveknowledge',
  editorBinding: 'EDITOR',
  apiItems: 'documents',
  pageSegment: 'document',
  signedInCookie: 'lkb_signed_in',
  // `.href` rather than the URL object: this worker's tsconfig loads BOTH @cloudflare/workers-types and node, and
  // each declares a global `URL`. A string is the one argument both agree on.
  liveAppDir: fileURLToPath(new URL('../../editor/app', import.meta.url).href),
  helpCategorySlugs: categories.map((category) => category.slug),
  stagingTelemetryEnv: { TELEMETRY_DASHBOARD_URL: 'https://staging.liveworkspace.app/telemetry' },
});

describe('production dispatch (service bindings)', () => {
  it("forwards a knowledgebase's public site to the api as it is, keeping the api's caching", async () => {
    const urls: string[] = [];
    const API = {
      fetch: (req: Request) => {
        urls.push(req.url);
        return Promise.resolve(new Response('ok'));
      },
    } as unknown as Fetcher;
    const dispatch = (path: string) =>
      router.fetch(new Request(`https://www.liveknowledge.app${path}`), { API });
    const res = await dispatch('/kb/acme-help/release-process?x=1');
    await dispatch('/kb');
    expect(urls).toEqual([
      'https://www.liveknowledge.app/kb/acme-help/release-process?x=1',
      'https://www.liveknowledge.app/kb',
    ]);
    // The page policy (no-cache) is the router's for its own sites; the api set the site's.
    expect(res.headers.get('Cache-Control')).toBeNull();
  });
});
