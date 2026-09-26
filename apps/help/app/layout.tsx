import { ErrorTelemetryBoot } from '@/components/ErrorTelemetryBoot';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BackToTop } from '@/components/BackToTop';
import { webSiteJsonLd } from '@/lib/structured-data';
import './globals.css';
import { JsonLd, PageViewBoot, PUBLIC_VIEWPORT, SITE_URL } from '@livediagram/ui';

// The livediagram help centre (docs/specs/018-help/help-app.md). Indexable static site served
// under /help by the router. No third-party scripts, it stays
// self-host-clean (docs/specs/002-project-scope/open-source-and-business-model.md).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Consistent document titles across the help centre: every page reads
  // "<Page Title> | livediagram" (the template reaches every child segment;
  // the root index spells the suffix out itself). Link previews carry the
  // bare title, per the shared pageMetadata rule (docs/specs/018-help/help-app.md "SEO").
  title: {
    default: 'Help | livediagram',
    template: '%s | livediagram',
  },
  description:
    'Guides, tutorials, and answers for livediagram. Browse feature documentation, getting-started guides, and troubleshooting.',
  alternates: { canonical: '/help' },
  openGraph: {
    type: 'website',
    siteName: 'livediagram Help',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: { index: true, follow: true },
  // Favicon is served BY this app: `app/icon.svg` (Next auto-injects it,
  // basePath-aware at /help/icon.svg) so the help centre owns its icon
  // instead of relying on the router forwarding a bare /icon.svg to another
  // worker (which 404s in standalone dev).
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased">
        <JsonLd data={webSiteJsonLd()} />
        <ErrorTelemetryBoot />
        <PageViewBoot />
        <Header />
        <main className="flex-1 pb-16">{children}</main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}
