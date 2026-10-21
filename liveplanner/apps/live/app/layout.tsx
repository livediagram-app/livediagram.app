import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@/components/providers/ClerkProvider';
import { ErrorTelemetryBoot } from '@/components/providers/ErrorTelemetryBoot';
import { PageViewBoot } from '@/components/providers/PageViewBoot';
import { TimingTelemetryBoot } from '@/components/providers/TimingTelemetryBoot';
import { StaleBuildBoot } from '@/components/providers/StaleBuildBoot';
import { KeyboardAvoidanceBoot } from '@/components/providers/KeyboardAvoidanceBoot';
import { ConfirmProvider } from '@/hooks/ui/useConfirm';
import { ToastProvider } from '@/hooks/ui/useToast';
import { googleFontsHref } from '@liveplanner/document';
import { BRAND_OG_IMAGE, BRAND_TWITTER_IMAGE } from '@liveplanner/ui/seo';
import { SITE_NAME } from '@liveplanner/ui/site';
import {
  APPEARANCE_BOOT_SCRIPT,
  BRAND_ICONS,
  DARK_READER_LOCK,
  RANDOM_UUID_BOOT_SCRIPT,
  trustedHtml,
  trustedScriptOrigins,
  trustedTypesBootScript,
} from '@liveplanner/ui';
import {
  REDUCE_MOTION_BOOT_SCRIPT,
  WEBFONTS_STYLESHEET_ID,
  WEBFONTS_SWAP_SCRIPT,
} from './pre-hydration-scripts';
import { EDITOR_BUILD_ID } from '@/lib/server-release';
import { STALE_HTML_GUARD_ATTRIBUTES, STALE_HTML_GUARD_SCRIPT } from '@/lib/stale-html-guard';
import './globals.css';

// The live app is the product, not a content surface. Every route
// under /live/* is either a signed-in workspace carrying private
// user data, an auth flow that's worthless to crawlers, or the
// welcome flow that needs runtime identity to mean anything.
// `noindex, nofollow` at the root layout cascades through every
// nested page in the static export. See docs/specs/007-editor/live-app.md "SEO and indexing".
// Trusted Types before anything else (docs/specs/016-platform/trusted-types.md): the default policy and the
// violation log, this app's own scripts under its asset prefix, and the Clerk origin read from this build's key
// (Next inlines only the literal expression).
const TRUSTED_TYPES_BOOT = trustedTypesBootScript(
  '/live',
  trustedScriptOrigins({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }),
);

const TITLE = 'liveplanner';
const DESCRIPTION = 'Diagrams, whiteboards, illustrations and documents. Multiplayer canvas.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Link previews (docs/specs/013-workspace/share-link-previews.md): every editor address previews with the brand
  // card rather than an empty box, and the live worker (src/share-page.ts) rewrites these same tags to name the
  // document on a share link's page, so they must stay declared here.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [BRAND_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [BRAND_TWITTER_IMAGE],
  },
  // PWA install affordances. The editor is what users add to their home
  // screen, but only its app/icon.svg favicon was linked, so an installed
  // editor PWA showed no icon. liveplanner.app is one origin (the router
  // stitches the apps by path), and the marketing worker already serves the
  // origin's web manifest at /manifest.webmanifest and the opaque iOS tile at
  // /apple-icon (both carrying the brand icon, see docs/specs/019-marketing/marketing-site.md). Reference those
  // absolute paths so installing from the editor picks up the same icon + name
  // on Android (manifest) and iOS (apple-touch-icon). They are literal hrefs,
  // so Next leaves them un-prefixed by the `/live` assetPrefix and the router
  // resolves them to the marketing worker.
  manifest: '/manifest.webmanifest',
  // Favicon set: the SVG mark (app/icon.svg, served by the live worker
  // via the router's LIVE_ROOT_ASSETS) plus the PNG fallback + apple tile
  // the marketing worker serves, all literal origin-root hrefs (same
  // pattern as the manifest above). Shared as BRAND_ICONS.
  icons: BRAND_ICONS,
  robots: {
    index: false,
    follow: false,
  },
  other: DARK_READER_LOCK,
};

// Every page can zoom, so a phone can pinch to read it (WCAG 1.4.4). The routes that draw the canvas pin it at 1
// instead with EDITOR_VIEWPORT (lib/page-viewport.ts), since the canvas owns zoom there. See
// docs/specs/007-editor/live-app.md "Mobile / responsive".
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// ClerkProvider wraps everything so `useAuth` / `useSignIn` / `useSignUp`
// work in every page — including the editor. Per docs/specs/014-identity/auth-and-guest-access.md this is NOT a
// route gate: the editor stays open to guests forever. Auth is purely
// additive (signed-in users get per-account persistence; guests keep
// the localStorage participant id).
//
// The existing app/not-found.tsx → EditorPage mechanism (docs/specs/007-editor/new-document-route.md, fixes
// the static-export dynamic-segment 404) is unaffected by the provider
// — ClerkProvider doesn't touch the route tree.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint inline scripts below add the
    // `dark` / `reduce-motion` classes to <html> from localStorage before
    // React hydrates, so the client's <html> className intentionally
    // differs from the static-export HTML. Scoped to this one element (it
    // doesn't cascade to children), so real mismatches elsewhere still warn.
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Trusted Types before anything else (docs/specs/016-platform/trusted-types.md). */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(TRUSTED_TYPES_BOOT) }} />
        {/* Ids work outside a secure context too (docs/specs/016-platform/secure-context.md), before any app code. */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(RANDOM_UUID_BOOT_SCRIPT) }} />
        {/* Then the stale HTML guard (docs/specs/016-platform/stale-builds.md "The pre-boot
            guard"), listening before any build asset can fail to load. Its source is static; its
            settings ride as data attributes on this element. */}
        <script
          {...STALE_HTML_GUARD_ATTRIBUTES}
          dangerouslySetInnerHTML={{ __html: trustedHtml(STALE_HTML_GUARD_SCRIPT) }}
        />
        {/* The build this export was made from (docs/specs/016-platform/stale-builds.md), for
            developers, support and the e2e suite; the app itself compares EDITOR_BUILD_ID. */}
        {EDITOR_BUILD_ID ? <meta name="liveplanner-build" content={EDITOR_BUILD_ID} /> : null}
        {/* Text fonts (docs/specs/004-interface-design/fonts.md). One stylesheet defines every option's
            @font-face; browsers only fetch the families actually applied,
            and `display=swap` keeps text visible in the fallback stack
            while a face loads — so the editor still works if these are
            blocked (self-host / offline). preconnect trims the round-trip.
            Linked as print media and switched to all once loaded, so a
            cross-origin stylesheet never holds up first paint on any route;
            suppressHydrationWarning because that switch happens before
            hydration. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          id={WEBFONTS_STYLESHEET_ID}
          rel="stylesheet"
          href={googleFontsHref()}
          media="print"
          suppressHydrationWarning
        />
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(WEBFONTS_SWAP_SCRIPT) }} />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-100">
        {/* Apply the persisted appearance before first paint, so EVERY route
            honours it — including /live/new and the welcome / template-picker
            flow, which never mount the TabBar that's the only caller of
            useAppearance. Without this they'd render light over the dark body.
            The appearance snippet is shared by every app (@liveplanner/ui);
            both are executed by tests against stub globals. */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(APPEARANCE_BOOT_SCRIPT) }} />
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(REDUCE_MOTION_BOOT_SCRIPT) }} />
        <ErrorTelemetryBoot />
        <StaleBuildBoot />
        <PageViewBoot />
        <TimingTelemetryBoot />
        <KeyboardAvoidanceBoot />
        <ClerkProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
