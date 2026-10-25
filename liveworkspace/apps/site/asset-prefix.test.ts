import { readFileSync } from 'node:fs';
import { SITE_ASSET_PREFIX } from '@liveworkspace/sites/workspace-proxy';
import { describe, expect, it } from 'vitest';

// The site's assetPrefix is the path every app's router forwards here (@liveworkspace/sites/workspace-proxy), so the
// sign-in pages and the Explorer load their assets under an app's address too.
describe('the asset prefix', () => {
  it('is the one the routers forward', () => {
    const config = readFileSync(new URL('./next.config.ts', import.meta.url), 'utf8');
    expect(config).toContain(`const ASSET_PREFIX = '${SITE_ASSET_PREFIX}';`);
    const script = readFileSync(new URL('./scripts/asset-prefix.mjs', import.meta.url), 'utf8');
    expect(script).toContain(`${SITE_ASSET_PREFIX.slice(1)}/_next`);
  });
});
