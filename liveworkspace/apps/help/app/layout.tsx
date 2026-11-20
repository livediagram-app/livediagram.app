import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BackToTop } from '@liveworkspace/help-site/components/BackToTop';
import { AppSwitch } from '@liveworkspace/help-site/components/AppSwitch';
import { trustedTypesBootScript, htmlProps } from '@liveworkspace/trusted-types';
import { JsonLd } from '@liveworkspace/ui';
import { EDITION } from '@/editions';
import {
  APPEARANCE_BOOT_SCRIPT,
  PageViewBoot,
  PUBLIC_VIEWPORT,
  WebVitalsBoot,
} from '@/lib/bindings.generated';
import { HelpProvider } from '@/lib/help-client';
import { site } from '@/lib/help-site';
import { SCOPE } from '@/lib/scope.generated';
import './globals.css';

// The one help centre (liveworkspace/docs/specs/017-help/help-centre.md), one build per scope: the scope's header and
// footer (its edition), its theme (app/scope.generated.css), its appearance key, telemetry and boots
// (lib/bindings.generated.ts). `data-help-scope` on <html> names the build for styles and tests. No third-party
// scripts.
//
// Trusted Types before anything else: the default policy and the violation log, and this app's own scripts under its
// asset prefix.
const TRUSTED_TYPES_BOOT = trustedTypesBootScript('/help');

// Dark Reader stands down on sight of this meta: every app paints its own dark appearance.
export const metadata: Metadata = site.rootMetadata({ other: { 'darkreader-lock': 'true' } });

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  const { header: Header, footer: Footer } = EDITION;
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" data-help-scope={SCOPE} suppressHydrationWarning>
      <head>
        <script {...htmlProps(TRUSTED_TYPES_BOOT)} />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint. */}
        <script {...htmlProps(APPEARANCE_BOOT_SCRIPT)} />
        <JsonLd data={site.webSiteJsonLd()} />
        <HelpProvider facts={site.facts}>
          <PageViewBoot />
          <WebVitalsBoot />
          <Header />
          {/* The app switch on a phone and a small tablet, where the header's search (and the switch in it) does
              not show: one row under the header (help-centre.md "Choosing an app"). */}
          <div className="border-b border-slate-200/70 bg-slate-50/80 px-4 py-2 lg:hidden dark:border-slate-800/70 dark:bg-slate-950/80">
            <AppSwitch size="chip" />
          </div>
          <main className="flex-1 pb-16">{children}</main>
          <Footer />
          <BackToTop />
        </HelpProvider>
      </body>
    </html>
  );
}
