import type { Metadata } from 'next';
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
