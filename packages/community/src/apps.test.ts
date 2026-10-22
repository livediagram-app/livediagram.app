import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { COMMUNITY_APPS, communityAppOfOrigin } from './apps';

describe('the apps a browser may write from', () => {
  it("are each app's own site as SITES links to it, with and without www, and its staging", () => {
    for (const app of COMMUNITY_APPS) {
      const site = APP_SITES.find((s) => s.id === app)!;
      expect(communityAppOfOrigin(new URL(site.url).origin)).toBe(app);
      expect(communityAppOfOrigin(`https://www.${app}`)).toBe(app);
      expect(communityAppOfOrigin(`https://${app}`)).toBe(app);
      expect(communityAppOfOrigin(`https://staging.${app}`)).toBe(app);
    }
  });

  it('are no one else', () => {
    for (const origin of [
      'https://evil.example',
      'https://livediagram.app.evil.example',
      'http://livediagram.app',
      'https://liveworkspace.app',
    ]) {
      expect(communityAppOfOrigin(origin), origin).toBeNull();
    }
  });
});
