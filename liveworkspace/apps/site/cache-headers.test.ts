import { readFileSync } from 'node:fs';
import { SITE_ASSET_PREFIX } from '@liveworkspace/sites/workspace-proxy';
import { describe, expect, it } from 'vitest';

// The build's assets live under the asset prefix (scripts/asset-prefix.mjs) and are named by their content's hash,
// so public/_headers caches them for a year, as each app's router does its own (livediagram/apps/router
// cache-policy.ts IMMUTABLE_CACHE_CONTROL). Without the rule Cloudflare sends `max-age=0, must-revalidate`, and every
// load asks again for every chunk.
describe('the build assets’ caching', () => {
  const headers = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8');

  it('caches everything under the prefix’s _next/static for a year, immutable', () => {
    expect(headers).toContain(
      `\n${SITE_ASSET_PREFIX}/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
    );
  });

  it('sets Cache-Control in that rule only, so no other rule joins its value', () => {
    expect(headers.match(/^\s+Cache-Control:/gm)).toHaveLength(1);
  });
});
