import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// SEO and social-card metadata. See spec/16-marketing-site.md
// for the policy. metadataBase lets the per-page canonical and
// openGraph fields use relative URLs and have Next resolve them
// against the production origin; without it Next logs a warning
// and falls back to localhost in dev (which would otherwise leak
// into preview builds).
const SITE_URL = 'https://livediagram.app';
const SITE_NAME = 'livediagram';
const TITLE = 'livediagram: Diagrams your team builds together';
const DESCRIPTION =
  'A real-time multiplayer canvas for diagrams and mindmaps. Built for teams who think visually.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Mobile chrome + colour-scheme signal. Brand-500 tints Android
// Chrome's URL bar, the iOS PWA status bar, and Windows' tile when
// the site is installed; declaring colorScheme: 'light' avoids a
// flash of dark-mode default styling on browsers that would
// otherwise auto-toggle. The viewport object is the Next 15
// metadata API's replacement for hand-rolled <meta> tags, see
// spec/16-marketing-site.md "SEO and metadata".
export const viewport: Viewport = {
  themeColor: '#0EA5E9',
  colorScheme: 'light',
};

// JSON-LD structured data, see spec/16-marketing-site.md "SEO and
// metadata". Two schemas under one @graph: WebSite for brand-name
// search results, SoftwareApplication for "diagramming tool"
// category browse. Both restate facts already on the page; the
// free-tier offer is truthful (the hosted product is currently
// free to use).
// Image URL the schemas reference: the OG card pre-rendered by
// `apps/marketing/app/opengraph-image.tsx` at build time. Google
// uses this for the brand card visual and Knowledge Graph
// preview when the WebSite / SoftwareApplication entities surface
// in search.
const OG_IMAGE = `${SITE_URL}/opengraph-image`;
const REPO_URL = 'https://github.com/livediagram-app/monorepo';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      inLanguage: 'en-GB',
      image: OG_IMAGE,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: 'en-GB',
      image: OG_IMAGE,
      // Links the brand entity to the open-source codebase Google
      // already indexes. Connecting the two helps the Knowledge
      // Graph recognise "livediagram" as a single thing across the
      // public marketing site, the GitHub repo, and the social
      // mentions that cite either.
      sameAs: [REPO_URL],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 antialiased">
        <script
          type="application/ld+json"
          // The JSON is serialised at build time (static export), so
          // dangerouslySetInnerHTML is safe here. JSON.stringify
          // escapes </ to prevent script-tag injection, the only
          // attack vector for embedded JSON-LD.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }}
        />
        {children}
      </body>
    </html>
  );
}
