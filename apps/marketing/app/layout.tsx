import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { JsonLd } from '@/components/JsonLd';
import { SITE_NAME, SITE_URL } from '@/lib/site';

// SEO and social-card metadata. See spec/16-marketing-site.md
// for the policy. metadataBase lets the per-page canonical and
// openGraph fields use relative URLs and have Next resolve them
// against the production origin; without it Next logs a warning
// and falls back to localhost in dev (which would otherwise leak
// into preview builds).
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
  // Favicon set: the SVG mark (app/icon.svg) plus a raster PNG fallback
  // for browsers that ignore SVG favicons (older Safari would otherwise
  // show a blank tab), and the opaque iOS tile from app/apple-icon.tsx.
  // The PNGs already ship in public/. NB: declaring `icons` explicitly
  // overrides Next's file-based auto-discovery, so the apple tile must
  // be listed here too or its <link> stops being emitted.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/livediagram-icon-256.png', type: 'image/png', sizes: '256x256' },
    ],
    apple: '/apple-icon',
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
// The brand mark, served from public/ at the origin root. Used as the
// Organization logo so a brand SERP / Knowledge Graph can show it.
const LOGO_URL = `${SITE_URL}/livediagram-icon-512.png`;

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    // Organization anchors the brand entity: name + logo + the same
    // GitHub sameAs the app node carries, so Google can resolve
    // "livediagram" to one thing across the site, the repo, and social
    // mentions. publisher/url on the other nodes point back at this @id.
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: LOGO_URL,
      sameAs: [REPO_URL],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      inLanguage: 'en-GB',
      image: OG_IMAGE,
      publisher: { '@id': `${SITE_URL}/#org` },
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
      publisher: { '@id': `${SITE_URL}/#org` },
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
    <html lang="en-GB">
      <body className="bg-slate-50 text-slate-800 antialiased">
        <JsonLd data={JSON_LD} />
        {children}
      </body>
    </html>
  );
}
