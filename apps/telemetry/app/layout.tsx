import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import {
  APPEARANCE_BOOT_SCRIPT,
  BRAND_ICONS,
  DARK_READER_LOCK,
  PageViewBoot,
  PUBLIC_VIEWPORT,
  SITE_URL,
  WebVitalsBoot,
} from '@livediagram/ui';

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
  other: DARK_READER_LOCK,
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint (docs/specs/004-interface-design/appearance.md). */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
        <PageViewBoot />
        <WebVitalsBoot />
        {children}
      </body>
    </html>
  );
}
