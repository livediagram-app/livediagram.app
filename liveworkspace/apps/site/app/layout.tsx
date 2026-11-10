import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DARK_READER_LOCK, PUBLIC_VIEWPORT } from '@livediagram/ui';
import { htmlProps, trustedConstant, trustedTypesBootScript } from '@liveworkspace/trusted-types';
import { SITE_ASSET_PREFIX } from '@liveworkspace/sites/workspace-proxy';
import { openExplorerBootScript } from '@liveworkspace/sites/open-explorer';
import { TURNSTILE_ORIGIN } from '@/lib/turnstile';
import { siteAppearanceBootScript } from '@/lib/appearance/appearance-keys';

// liveworkspace.app (liveworkspace/docs/specs/010-site/site.md). Trusted Types before anything else: the default
// policy and the violation log, and this site's own scripts, under its asset prefix (next.config.ts),
// on liveworkspace.app and on every app's address alike. The one script from another origin is
// Turnstile, on the sign-in pages.
const TRUSTED_TYPES_BOOT = trustedTypesBootScript(SITE_ASSET_PREFIX, [TURNSTILE_ORIGIN]);
// Automatically Open Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on the Explorer"): this is a
// static site with no router in front of its homepage, so the homepage's first script opens the Explorer instead,
// before anything paints, when the person's switch is on. Any other page returns at its first test.
const OPEN_EXPLORER_BOOT = trustedConstant(openExplorerBootScript());
// Appearance before first paint (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the setting of the app whose
// address the page is on, under that app's own key, or liveworkspace.app's own.
const APPEARANCE_BOOT = trustedConstant(siteAppearanceBootScript());

const TITLE = 'liveworkspace: Live apps for every kind of work';
const DESCRIPTION =
  'liveworkspace is a set of real-time apps, each built for one kind of work: livediagram for diagrams and whiteboards, liveplanner for boards, sheets and forms, livedocuments for articles, slides and infographics, livedesign for logos, wireframes and photos, and livehuddle for meetings in Spaces, with an avatar for everyone. Completely free, shared by link, no trackers.';

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
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>. Smooth scrolling is for the page's own
    // anchors (#apps); `data-scroll-behavior` lets Next turn it off for a route change, which lands at the top at once.
    <html
      lang="en-GB"
      suppressHydrationWarning
      className="scroll-smooth"
      data-scroll-behavior="smooth"
    >
      <head>
        <script {...htmlProps(TRUSTED_TYPES_BOOT)} />
        <script {...htmlProps(OPEN_EXPLORER_BOOT)} />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint. */}
        <script {...htmlProps(APPEARANCE_BOOT)} />
        {children}
      </body>
    </html>
  );
}
