import type { Metadata } from 'next';

const SITE_URL = 'https://livediagram.app';
const SITE_NAME = 'livediagram Help Centre';
const LOCALE = 'en_GB';

interface SeoInput {
  title: string;
  description: string;
  /** Absolute path on the help centre, including the `/help/` prefix and
   *  trailing slash. e.g. `/help/features/canvas/` */
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
