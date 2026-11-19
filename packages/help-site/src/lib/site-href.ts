import { SITES, siteHrefFrom } from '@liveworkspace/sites';

// A link from the help centre to another site's address (the app switch, Read It In, Pick an App, a "From Other
// Apps" result, Search All Apps; liveworkspace/docs/specs/016-help/help-centre.md "Choosing an app"), as the page's
// own deployment gives it, the way the Explorer and the routers pick origins (@liveworkspace/sites app-origins): the
// help is a static export built with the live origins (a dev server's, the local port blocks, via siteUrl), so on a
// staging host each live origin moves to that site's `staging.` origin. Anything else is unchanged.

/** `href` as a page on `host` links it: on a staging host, any site's live origin moved to its staging one. */
export function siteHref(href: string, host: string): string {
  for (const site of SITES) {
    const moved = siteHrefFrom(site, href, host);
    if (moved !== href) return moved;
  }
  return href;
}
