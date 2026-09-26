import type { Metadata } from 'next';
import { pageMetadata } from '@livediagram/ui';

// The help centre's name in link previews (the OG siteName); everything else
// about a page's metadata follows the shared pageMetadata rule (docs/specs/018-help/help-app.md "SEO"):
// the title passes through as given, the canonical and OG url are the page's
// path, and the card is the large brand card.
const HELP_SITE_NAME = 'livediagram Help';

interface SeoInput {
  title: string;
  description: string;
  /** Absolute path on the help centre, including the `/help/` prefix and
   *  trailing slash, and matching the page's real route: an article sits at
   *  `/help/<categorySlug>/<slug>/`, e.g. `/help/canvas/themes/`. A path that
   *  disagrees with the route points the canonical and the OG url at a
   *  different page, which nothing at runtime notices.
   *  (`seo-canonical.test.ts` checks every article page.) */
  path: `/${string}`;
}

/** Per-page metadata with a complete Open Graph block, so each help page
 *  carries its own canonical + OG title/url rather than inheriting the
 *  layout's. The document <title> still reads "<Title> | livediagram": the
 *  root layout's title template adds the suffix, so link previews get the
 *  bare title and the siteName beside it. */
export function helpMetadata({ title, description, path }: SeoInput): Metadata {
  return pageMetadata({ title, description, path, siteName: HELP_SITE_NAME });
}
