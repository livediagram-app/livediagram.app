import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'livediagram',
  description: 'Build diagrams and mindmaps. Multiplayer canvas.',
};

// Pre-hydration URL swap for /live/diagram/<id> routes.
//
// `output: 'export'` forces dynamicParams=false; the client router
// triggers its not-found path whenever a dynamic-segment URL doesn't
// match the build-time placeholder. Every real diagram URL gets the
// editor swapped for the framework's default 404 on hydration — the
// editor briefly paints (loading spinner) then vanishes.
//
// The two-step fix this script bootstraps:
//
//  1. Synchronously in <head> — before React or Next.js's bundle has
//     loaded — rewrite the URL to /live/diagram/placeholder so the
//     client router sees a path that matches the static manifest,
//     and stash the real id on `window.__LD_DIAGRAM_PATH_ID__`.
//  2. ALSO stash the native, unpatched `history.replaceState` on
//     `window.__LD_NATIVE_REPLACE_STATE__`. After its bundle loads,
//     Next.js's app router patches `history.replaceState` and
//     `history.pushState` so any call notifies its routing layer —
//     which, on a non-matching dynamic-segment URL, fires `notFound`.
//     The editor's bootstrap useLayoutEffect uses the captured
//     native reference to restore the real URL, updating the address
//     bar WITHOUT notifying Next.js's router → no re-evaluation →
//     notFound stays dormant → editor stays on screen.
//
// Try/catch wraps both steps so a failure degrades to the old broken
// state rather than blocking the whole page.
const PRE_HYDRATION_URL_SWAP = `
(function () {
  try {
    window.__LD_NATIVE_REPLACE_STATE__ = window.history.replaceState.bind(window.history);
    var m = window.location.pathname.match(/^\\/live\\/diagram\\/([^\\/?#]+)$/);
    if (!m || m[1] === 'placeholder') return;
    window.__LD_DIAGRAM_PATH_ID__ = m[1];
    window.__LD_NATIVE_REPLACE_STATE__(
      null,
      '',
      '/live/diagram/placeholder' + window.location.search + window.location.hash
    );
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_URL_SWAP }} />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
