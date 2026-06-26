import type { Metadata } from 'next';
import { SITE_NAME } from './site';

// Shared metadata factory for marketing subpages (FAQ, Terms,
// Privacy). All three pages had grown identical 17-line Metadata
// blocks repeating openGraph + twitter + alternates with the same
// locale, type, siteName, and card style. Pulling the boilerplate
// here means a future change (a new locale, a different OG `type`,
// adding a per-page image override) lands once and rides to every
// subpage.
//
// The landing page (`/`) keeps its own bespoke Metadata in
// app/layout.tsx because its shape differs (type: 'website', extra
// JSON-LD wrappers, root canonical), so this factory deliberately
// covers subpages only.

const SUBPAGE_LOCALE = 'en_GB';

// The shared OG / Twitter card. Next only auto-attaches the file-convention
// opengraph-image.tsx to a page when that page doesn't declare its own
// openGraph; because every subpage here sets an explicit openGraph object,
// the auto-image is suppressed and the card goes missing. So reference the
// same generated assets (served at `/opengraph-image` + `/twitter-image`)
// explicitly, resolved to absolute URLs via metadataBase, so subpage links
// shared on social / shown in SERPs carry the brand card like the homepage.
const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'livediagram: a real-time multiplayer canvas for diagrams and mindmaps',
};
const TWITTER_IMAGE = '/twitter-image';

export type SubpageMetadataInput = {
  title: string;
  description: string;
  // Path relative to the metadataBase (set in app/layout.tsx). The
  // canonical + openGraph url both resolve through that base so a
  // value of `/faq` becomes `https://livediagram.app/faq` in the
  // emitted head.
  path: `/${string}`;
  // Last-revised date for the page's content. Surfaces as the
  // `article:modified_time` OG meta tag (the standard companion
  // field to `og:type=article`, which this factory always emits).
  // Optional: pages whose content doesn't carry a tracked revision
  // date (FAQ today) omit it, and the meta tag simply isn't
  // emitted. The alternatives pages wire it to
  // `ALTERNATIVES_LAST_UPDATED` from lib/alternatives.ts so the
  // sitemap + this meta stay synchronised on one constant
  // (spec/21).
  modifiedTime?: Date;
};

export function subpageMetadata({
  title,
  description,
  path,
  modifiedTime,
}: SubpageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: path,
      siteName: SITE_NAME,
      title,
      description,
      locale: SUBPAGE_LOCALE,
      images: [OG_IMAGE],
      // Only set when supplied: Next will simply omit the
      // article:modified_time meta tag if `modifiedTime` is
      // undefined, which is what FAQ / Terms / Privacy expect.
      ...(modifiedTime ? { modifiedTime: modifiedTime.toISOString() } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [TWITTER_IMAGE],
    },
  };
}
