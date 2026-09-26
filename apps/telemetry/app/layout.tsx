import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { BRAND_ICONS, PageViewBoot, PUBLIC_VIEWPORT, SITE_URL } from '@livediagram/ui';

// The public transparency dashboard (docs/specs/017-telemetry/telemetry.md). Indexable: it's part of
// the open, "here's exactly what we measure" story, not a private app.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Telemetry · livediagram',
  description:
    'Anonymous, first-party product usage for livediagram, in the open. No third-party vendors; data is never sold or shared beyond this page.',
  alternates: { canonical: '/telemetry' },
  robots: { index: true, follow: true },
  // The origin-root brand favicons (literal hrefs, so Next leaves them
  // un-prefixed by the `/telemetry` basePath and the router resolves them to
  // the workers that serve them). See BRAND_ICONS and docs/specs/019-marketing/marketing-site.md.
  icons: BRAND_ICONS,
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="bg-slate-50 text-slate-800 antialiased">
        <PageViewBoot />
        {children}
      </body>
    </html>
  );
}
