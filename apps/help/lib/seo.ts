import type { Metadata } from 'next';
import { SITE_URL } from './site';

const SITE_NAME = 'livediagram Help';
const LOCALE = 'en_GB';

interface SeoInput {
  title: string;
  description: string;
  /** Absolute path on the help centre, including the `/help/` prefix and
   *  trailing slash, and matching the page's real route: an article sits at
   *  `/help/<categorySlug>/<slug>/`, e.g. `/help/canvas/themes/`. A path that
   *  disagrees with the route points the canonical and the OG url at a
   *  different page, which nothing at runtime notices.
   *  (`seo-canonical.test.ts` checks every article page.) */
  path: string;
}

/** Build per-page metadata with a complete Open Graph block so each help
 *  page carries its own canonical + OG title/url rather than inheriting the
 *  layout's homepage block. */
export function helpMetadata({ title, description, path }: SeoInput): Metadata {
  const url = `${SITE_URL}${path}`;
  // Final document/OG title, consistent everywhere: "<Page Title> | livediagram".
  // `absolute` bypasses the layout title template (which only applies to child
  // segments, not the root index), so the home page gets the suffix too.
  const fullTitle = `${title} | livediagram`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      locale: LOCALE,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url,
    },
    twitter: {
      card: 'summary',
      title: fullTitle,
      description,
    },
  };
}
