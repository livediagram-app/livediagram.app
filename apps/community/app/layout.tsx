import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { CommunityGate } from '@/components/CommunityGate';
import { Header } from '@/components/Header';
import './globals.css';
import {
  APPEARANCE_BOOT_SCRIPT,
  DARK_READER_LOCK,
  PageViewBoot,
  PUBLIC_VIEWPORT,
  SITE_URL,
  SiteFooter,
} from '@livediagram/ui';

// The livediagram Community (docs/specs/025-community/community.md): an indexable static site served
// under /community by the router. No third-party scripts and no sign-in; it stays self-host-clean
// (docs/specs/002-project-scope/open-source-and-business-model.md).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Community | livediagram',
    template: '%s | livediagram',
  },
  description:
    'Documents people are proud of. Browse diagrams, plans and drawings made with livediagram, then make your own copy.',
  alternates: { canonical: '/community/' },
  openGraph: {
    type: 'website',
    siteName: 'livediagram Community',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: { index: true, follow: true },
  other: DARK_READER_LOCK,
  // Favicon is served BY this app: `app/icon.svg` (Next injects it, basePath-aware at
  // /community/icon.svg), so standalone dev never relies on another worker for it.
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint (docs/specs/004-interface-design/appearance.md). */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
        <PageViewBoot />
        <Header />
        <main className="flex-1 pb-20">
          <CommunityGate>{children}</CommunityGate>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
