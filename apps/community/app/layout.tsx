import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { CommunityGate } from '@/components/CommunityGate';
import { Header } from '@/components/Header';
import './globals.css';
import {
  APPEARANCE_BOOT_SCRIPT,
  DARK_READER_LOCK,
  PageViewBoot,
  pageMetadata,
  PUBLIC_VIEWPORT,
  RANDOM_UUID_BOOT_SCRIPT,
  SITE_URL,
  SiteFooter,
  WebVitalsBoot,
  trustedHtml,
  trustedScriptOrigins,
  trustedTypesBootScript,
} from '@liveplanner/ui';

// The liveplanner Community (docs/specs/025-community/community.md): an indexable static site served
// under /community by the router. No third-party scripts, and sign-in (Clerk) loads only for My Shares; it stays self-host-clean
// (docs/specs/002-project-scope/open-source-and-business-model.md).
const COMMUNITY_SITE_NAME = 'liveplanner Community';
const COMMUNITY_DESCRIPTION =
  'Documents people are proud of. Browse diagrams, plans and drawings made with liveplanner, then make your own copy.';

// Trusted Types before anything else (docs/specs/016-platform/trusted-types.md): the default policy and the
// violation log, this app's own scripts under its asset prefix, and the Clerk origin read from this build's key
// (Next inlines only the literal expression).
const TRUSTED_TYPES_BOOT = trustedTypesBootScript(
  '/community',
  trustedScriptOrigins({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }),
);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Canonical, Open Graph and Twitter card (with the brand card image) from the
  // shared factory; the title below replaces its plain one with the template.
  ...pageMetadata({
    title: 'Community | liveplanner',
    description: COMMUNITY_DESCRIPTION,
    path: '/community/',
    siteName: COMMUNITY_SITE_NAME,
    type: 'website',
  }),
  title: {
    default: 'Community | liveplanner',
    template: '%s | liveplanner',
  },
  robots: { index: true, follow: true },
  other: DARK_READER_LOCK,
  // Favicon is served BY this app: `app/icon.svg` with `app/icon.png` as its fallback (Next injects both, basePath-aware at
  // /community/icon.svg), so standalone dev never relies on another worker for it.
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Trusted Types first (docs/specs/016-platform/trusted-types.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(TRUSTED_TYPES_BOOT) }} />
        {/* The like key is a randomUUID, outside a secure context too (docs/specs/016-platform/secure-context.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(RANDOM_UUID_BOOT_SCRIPT) }} />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint (docs/specs/004-interface-design/appearance.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(APPEARANCE_BOOT_SCRIPT) }} />
        <PageViewBoot />
        <WebVitalsBoot />
        <Header />
        <main className="flex-1 pb-20">
          <CommunityGate>{children}</CommunityGate>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
