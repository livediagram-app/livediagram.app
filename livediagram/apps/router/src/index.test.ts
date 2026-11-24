import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { categories } from '@livediagram/help-registry';
import { describeAppRouter } from '@liveworkspace/sites/app-router-testing';
import router from './index';

// The dispatch tests every app's router runs (@liveworkspace/sites/app-router-testing; docs/specs/016-platform/
// router-app.md), against this router, and what is livediagram's own: its spec's route row and
// its old form links.
describeAppRouter({
  router,
  app: 'livediagram',
  editorBinding: 'EDITOR',
  apiItems: 'documents',
  pageSegment: 'document',
  signedInCookie: 'ld_signed_in',
  // `.href` rather than the URL object: this worker's tsconfig loads BOTH @cloudflare/workers-types and node, and
  // each declares a global `URL`. A string is the one argument both agree on.
  liveAppDir: fileURLToPath(new URL('../../editor/app', import.meta.url).href),
  helpCategorySlugs: categories.map((category) => category.slug),
  stagingTelemetryEnv: { DEPLOY_ENV: 'staging' },
  oneHopPaths: ['/diagram/abc?tab=2', '/help/tabs/add-to-diagram', '/form/AbC123?embed=1'],
});

describe('live route drift guard', () => {
  it("lists exactly the editor's route segments in the spec's live page routes row", async () => {
    // The spec's table is prose, so it kept `/drive/*` for weeks after the old Drive mirror's pages left the
    // editor. Pin its row to the set the router actually routes by. `explorer` has its own row (liveworkspace's), and
    // so does `form` (old form links, sent on to liveplanner before the editor sees them).
    const { LIVE_ROUTE_SEGMENTS } = await import('@livediagram/api-schema');
    const spec = readFileSync(
      fileURLToPath(
        new URL('../../../docs/specs/016-platform/router-app.md', import.meta.url).href,
      ),
      'utf8',
    );
    const row = spec.split('\n').find((line) => line.startsWith('| live page routes:'));
    expect(row).toBeDefined();
    const listed = [...row!.matchAll(/`\/([a-z-]+)(?:\/\*)?`/g)].map((m) => m[1]!);
    const routed = [...LIVE_ROUTE_SEGMENTS].filter(
      (segment) => segment !== 'explorer' && segment !== 'form',
    );
    expect(listed.filter((s) => s !== 'icon.svg').toSorted()).toEqual(routed.toSorted());
  });
});

describe('the bare domain', () => {
  it('sends an old form link straight to liveplanner, not through www. first', async () => {
    const res = await router.fetch(new Request('https://livediagram.app/form/AbC123?embed=1'), {});
    expect(res.headers.get('Location')).toBe('https://www.liveplanner.app/form/AbC123?embed=1');
  });
});
