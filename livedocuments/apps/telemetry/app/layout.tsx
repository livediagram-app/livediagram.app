import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import {
  APPEARANCE_BOOT_SCRIPT,
  BRAND_ICONS,
  DARK_READER_LOCK,
  PageViewBoot,
  pageMetadata,
  PUBLIC_VIEWPORT,
  SITE_URL,
  WebVitalsBoot,
  trustedHtml,
  trustedScriptOrigins,
  trustedTypesBootScript,
} from '@livedocuments/ui';

// The public transparency dashboard (docs/specs/017-telemetry/telemetry.md). Indexable: it's part of
// the open, "here's exactly what we measure" story, not a private app.
// Trusted Types before anything else (docs/specs/016-platform/trusted-types.md): the default policy and the
// violation log, this app's own scripts under its asset prefix, and the Clerk origin read from this build's key
// (Next inlines only the literal expression).
const TRUSTED_TYPES_BOOT = trustedTypesBootScript(
  '/telemetry',
  trustedScriptOrigins({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }),
);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Canonical, Open Graph and Twitter card from the shared factory, so a link
  // to the dashboard previews with the brand card like every other public page.
  ...pageMetadata({
    title: 'Telemetry · livedocuments',
    description:
      'Anonymous, first-party product usage for livedocuments, in the open. No third-party vendors; data is never sold or shared beyond this page.',
    path: '/telemetry',
    type: 'website',
  }),
  robots: { index: true, follow: true },
  // The origin-root brand favicons (literal hrefs, so Next leaves them
  // un-prefixed by the `/telemetry` basePath and the router resolves them to
  // the workers that serve them). See BRAND_ICONS and docs/specs/019-marketing/marketing-site.md.
  icons: BRAND_ICONS,
  other: DARK_READER_LOCK,
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Trusted Types first (docs/specs/016-platform/trusted-types.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(TRUSTED_TYPES_BOOT) }} />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint (docs/specs/004-interface-design/appearance.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(APPEARANCE_BOOT_SCRIPT) }} />
        <PageViewBoot />
        <WebVitalsBoot />
        {children}
      </body>
    </html>
  );
}
