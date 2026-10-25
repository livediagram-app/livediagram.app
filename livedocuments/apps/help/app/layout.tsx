import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BackToTop } from '@liveworkspace/help-site/components/BackToTop';
import {
  APPEARANCE_BOOT_SCRIPT,
  DARK_READER_LOCK,
  JsonLd,
  PageViewBoot,
  PUBLIC_VIEWPORT,
  WebVitalsBoot,
  trustedHtml,
  trustedTypesBootScript,
} from '@livedocuments/ui';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HelpProvider } from '@/lib/help-client';
import { site } from '@/lib/help-site';
import './globals.css';

// The livedocuments help centre (docs/specs/018-help/help-app.md). Indexable static site served
// under /help by the router. No third-party scripts
// (docs/specs/002-project-scope/open-source-and-business-model.md).
//
// Trusted Types before anything else (docs/specs/016-platform/trusted-types.md): the default policy and the
// violation log, and this app's own scripts under its asset prefix.
const TRUSTED_TYPES_BOOT = trustedTypesBootScript('/help');

// The title template, description, canonical and Open Graph defaults are the help centre's own
// (@liveworkspace/help-site's rootMetadata, docs/specs/018-help/help-app.md "SEO").
export const metadata: Metadata = site.rootMetadata({
  other: DARK_READER_LOCK,
  // Favicon is served BY this app: `app/icon.svg` with `app/icon.png` as its fallback (Next auto-injects both,
  // basePath-aware at /help/icon.svg) so the help centre owns its icon
  // instead of relying on the router forwarding a bare /icon.svg to another
  // worker (which 404s in standalone dev).
});

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Trusted Types first (docs/specs/016-platform/trusted-types.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(TRUSTED_TYPES_BOOT) }} />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint (docs/specs/004-interface-design/appearance.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(APPEARANCE_BOOT_SCRIPT) }} />
        <JsonLd data={site.webSiteJsonLd()} />
        {/* The product's telemetry, search and facts for the help centre's client components; it also installs
            client error tracking (lib/help-client.tsx). */}
        <HelpProvider facts={site.facts}>
          <PageViewBoot />
          <WebVitalsBoot />
          <Header />
          <main className="flex-1 pb-16">{children}</main>
          <Footer />
          <BackToTop />
        </HelpProvider>
      </body>
    </html>
  );
}
