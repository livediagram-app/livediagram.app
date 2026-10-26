import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { APPEARANCE_BOOT_SCRIPT, DARK_READER_LOCK, PUBLIC_VIEWPORT } from '@livediagram/ui';
import { trustedHtml, trustedTypesBootScript } from '@liveworkspace/trusted-types';
import { SITE_ASSET_PREFIX } from '@liveworkspace/sites/workspace-proxy';
import { TURNSTILE_ORIGIN } from '@/lib/turnstile';

// liveworkspace.app (liveworkspace/docs/specs/010-site/site.md). Trusted Types before anything else: the default
// policy and the violation log, and this site's own scripts, under its asset prefix (next.config.ts),
// on liveworkspace.app and on every app's address alike. The one script from another origin is
// Turnstile, on the sign-in pages.
const TRUSTED_TYPES_BOOT = trustedTypesBootScript(SITE_ASSET_PREFIX, [TURNSTILE_ORIGIN]);

const TITLE = 'liveworkspace: Live apps for every kind of work';
const DESCRIPTION =
  'liveworkspace is a set of real-time apps, each built for one kind of work: livediagram for diagrams and whiteboards, liveplanner for boards, sheets and forms, livedocuments for articles, slides and infographics, and livedesign for logos, wireframes and photos. Completely free, shared by link, no trackers.';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.liveworkspace.app'),
  title: TITLE,
  description: DESCRIPTION,
  // No canonical here: each page names its own, so a page without one never claims to be the home page.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
  other: DARK_READER_LOCK,
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" suppressHydrationWarning className="scroll-smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(TRUSTED_TYPES_BOOT) }} />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(APPEARANCE_BOOT_SCRIPT) }} />
        {children}
      </body>
    </html>
  );
}
