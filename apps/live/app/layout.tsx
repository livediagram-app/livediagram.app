import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@/components/providers/ClerkProvider';
import { ErrorTelemetryBoot } from '@/components/providers/ErrorTelemetryBoot';
import { ConfirmProvider } from '@/hooks/ui/useConfirm';
import { ToastProvider } from '@/hooks/ui/useToast';
import { googleFontsHref } from '@/lib/fonts';
import { STORAGE_KEY as UI_MODE_STORAGE_KEY } from '@/hooks/ui/useUiMode';
import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';
import './globals.css';

// The live app is the product, not a content surface. Every route
// under /live/* is either a signed-in workspace carrying private
// user data, an auth flow that's worthless to crawlers, or the
// welcome flow that needs runtime identity to mean anything.
// `noindex, nofollow` at the root layout cascades through every
// nested page in the static export. See spec/07 "SEO and indexing".
export const metadata: Metadata = {
  title: 'livediagram',
  description: 'Build diagrams and mindmaps. Multiplayer canvas.',
  // PWA install affordances. The editor is what users add to their home
  // screen, but only its app/icon.svg favicon was linked, so an installed
  // editor PWA showed no icon. livediagram.app is one origin (the router
  // stitches the apps by path), and the marketing worker already serves the
  // origin's web manifest at /manifest.webmanifest and the opaque iOS tile at
  // /apple-icon (both carrying the brand icon, see spec/16). Reference those
  // absolute paths so installing from the editor picks up the same icon + name
  // on Android (manifest) and iOS (apple-touch-icon). They are literal hrefs,
  // so Next leaves them un-prefixed by the `/live` assetPrefix and the router
  // resolves them to the marketing worker.
  manifest: '/manifest.webmanifest',
  // Favicon set: the SVG mark (app/icon.svg, served by the live worker
  // via the router's LIVE_ROOT_ASSETS) plus a raster PNG fallback for
  // browsers that ignore SVG favicons (older Safari would otherwise
  // show a blank tab). The PNG + apple tile are literal origin-root
  // hrefs the marketing worker serves, so Next leaves them un-prefixed
  // by the `/live` assetPrefix and the router resolves them to
  // marketing (same pattern as the manifest above).
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/livediagram-icon-256.png', type: 'image/png', sizes: '256x256' },
    ],
    apple: '/apple-icon',
  },
  robots: {
    index: false,
    follow: false,
  },
};

// Pin the viewport so mobile browsers don't auto-zoom the page. The
// editor has its own canvas zoom (pinch on the canvas surface, or
// the zoom buttons in the bottom-right) and that's the only zoom we
// want users to drive: browser-level page zoom on top of the
// canvas-transform zoom misaligns selection rings, anchor dots,
// and the cursor-to-canvas-coords math. The two trigger paths we
// need to block are (1) pinch-zoom on the whole page and (2) iOS
// Safari's automatic focus-zoom when an input's effective font-size
// is under 16px (every TabBar / Explorer / Palette field is well
// under). maximumScale=1 + userScalable=false covers both without
// touching per-input font sizes, which keeps the desktop chrome
// dense as designed. Accessibility tradeoff: users who relied on
// browser zoom to read small UI can no longer use it on the editor;
// the canvas zoom + the editor's dark-mode toggle are the available
// readability levers. See spec/07 "Mobile / responsive".
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// ClerkProvider wraps everything so `useAuth` / `useSignIn` / `useSignUp`
// work in every page — including the editor. Per spec/04 this is NOT a
// route gate: the editor stays open to guests forever. Auth is purely
// additive (signed-in users get per-account persistence; guests keep
// the localStorage participant id).
//
// The existing app/not-found.tsx → EditorPage mechanism (spec/14, fixes
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
        {/* Text fonts (spec/28). One stylesheet defines every option's
            @font-face; browsers only fetch the families actually applied,
            and `display=swap` keeps text visible in the fallback stack
            while a face loads — so the editor still works if these are
            blocked (self-host / offline). preconnect trims the round-trip. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={googleFontsHref()} />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-100">
        {/* Apply the persisted UI light/dark choice before first paint, so
            EVERY route honours it — including /live/new and the welcome /
            template-picker flow, which never mount the TabBar that's the
            only caller of useUiMode. Without this they'd render light over
            the dark body. Reads useUiMode's exported STORAGE_KEY so the two
            can't drift; opt-in only, never auto-detects the OS (spec/07). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('${UI_MODE_STORAGE_KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        {/* Apply the persisted "Reduce motion" preference (spec/20) before
            first paint, for the same reason as the dark-mode script above:
            the class must be on <html> by the time elements mount, or their
            one-shot pop-in / fly-up-in animations have already fired before
            a React effect could add it. The OS prefers-reduced-motion query
            in globals.css needs no JS; this only covers the user override. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=JSON.parse(localStorage.getItem('${USER_PREFERENCES_STORAGE_KEY}')||'{}');if(p&&p.reduceMotion===true)document.documentElement.classList.add('reduce-motion')}catch(e){}`,
          }}
        />
        <ErrorTelemetryBoot />
        <ClerkProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
