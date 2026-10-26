import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_NAMES } from './index';
import { PRODUCTION_WORKSPACE_ORIGIN, statusPageUrl, statusRedirect } from './workspace-proxy';

// liveworkspace.app keeps the one status page (liveworkspace/docs/site.md "Status"); an app's old /status goes there,
// to the app's own group.
describe('statusRedirect', () => {
  it('sends /status and everything under it to the app’s group on liveworkspace’s page, permanently', () => {
    for (const path of ['/status', '/status/', '/status/anything?x=1']) {
      const res = statusRedirect(
        new URL(`https://livediagram-router.liveworkspace-easing509.workers.dev${path}`),
        'livediagram',
      );
      expect(res?.status).toBe(301);
      expect(res?.headers.get('Location')).toBe(
        `${PRODUCTION_WORKSPACE_ORIGIN}/status#livediagram`,
      );
    }
  });

  it('follows the router’s workspace origin: staging’s, or the local site', () => {
    expect(
      statusPageUrl(
        'liveplanner',
        'https://staging.liveworkspace.app',
      ),
    ).toBe(
      'https://staging.liveworkspace.app/status#liveplanner',
    );
    expect(statusPageUrl('livedesign', 'http://localhost:3000')).toBe(
      'http://localhost:3000/status#livedesign',
    );
  });

  it('leaves every other path alone', () => {
    for (const path of ['/', '/statuses', '/help/status', '/api/status']) {
      expect(
        statusRedirect(
          new URL(`https://livediagram-router.liveworkspace-easing509.workers.dev${path}`),
          'livediagram',
        ),
      ).toBeNull();
    }
  });

  it('is what every app’s router answers its old status page with', () => {
    for (const app of APP_NAMES) {
      const router = readFileSync(
        new URL(`../../../${app}/apps/router/src/index.ts`, import.meta.url),
        'utf8',
      );
      expect(router, app).toContain(`statusRedirect(url, '${app}', env.WORKSPACE_ORIGIN)`);
    }
  });
});
