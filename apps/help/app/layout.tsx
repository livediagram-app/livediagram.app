import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BackToTop } from '@/components/BackToTop';
import './globals.css';

// The livediagram help centre (spec/55). Indexable static site served
// under /help by the router. No third-party scripts, it stays
// self-host-clean (spec/03).
export const metadata: Metadata = {
  metadataBase: new URL('https://livediagram.app'),
  // Consistent page titles across the help centre: every page reads
  // "<Page Title> | livediagram"; the bare help home is "Help | livediagram".
  title: {
    default: 'Help | livediagram',
    template: '%s | livediagram',
  },
  description:
    'Guides, tutorials, and answers for livediagram. Browse feature documentation, getting-started guides, and troubleshooting.',
  alternates: { canonical: '/help' },
  openGraph: {
    type: 'website',
    siteName: 'livediagram Help Centre',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary',
  },
  robots: { index: true, follow: true },
  // Favicon is served BY this app: `app/icon.svg` (Next auto-injects it,
  // basePath-aware at /help/icon.svg) so the help centre owns its icon
  // instead of relying on the router forwarding a bare /icon.svg to another
  // worker (which 404s in standalone dev).
};

export const viewport: Viewport = {
  themeColor: '#0EA5E9',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}
