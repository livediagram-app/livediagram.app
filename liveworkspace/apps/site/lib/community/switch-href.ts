import type { Site } from '@liveworkspace/sites';

// On the Community page, each site's row in the logo's site switcher (liveworkspace/docs/specs/010-site/
// site-switcher.md "On a Community page"): that site's Community, which shows its own posts first, or liveworkspace.app's,
// which shows every app's. Every app's router serves the Community page.
export function communitySwitchHref(site: Site): string {
  return `${site.url}/community`;
}
