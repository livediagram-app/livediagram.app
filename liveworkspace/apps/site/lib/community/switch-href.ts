import { isAppName, type Site } from '@liveworkspace/sites';
import { hasCommunityPage } from '@liveworkspace/sites/workspace-proxy';

// On the Community page, each site's row in the logo's site switcher (liveworkspace/docs/specs/010-site/
// site-switcher.md "On a Community page"): that site's Community, which shows its own posts first, or liveworkspace.app's,
// which shows every app's. An app whose router serves no Community page yet links its home.
export function communitySwitchHref(site: Site): string {
  const app = site.id.replace(/\.app$/, '');
  if (isAppName(app) && !hasCommunityPage(app)) return site.url;
  return `${site.url}/community`;
}
