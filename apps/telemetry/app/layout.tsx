import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// The public transparency dashboard (spec/22). Indexable: it's part of
// the open, "here's exactly what we measure" story, not a private app.
export const metadata: Metadata = {
  metadataBase: new URL('https://livediagram.app'),
  title: 'Telemetry · livediagram',
  description:
    'Anonymous, first-party product usage for livediagram, in the open. No third-party vendors; data is never sold or shared beyond this page.',
  alternates: { canonical: '/telemetry' },
  robots: { index: true, follow: true },
  // Favicon set. livediagram.app is one origin (the router stitches the
  // apps by path), so we reference the same origin-root brand assets the
  // other apps do: the SVG mark, a raster PNG fallback for browsers that
  // ignore SVG favicons (older Safari would otherwise show a blank tab),
  // and the opaque iOS tile. These are literal hrefs, so Next leaves them
  // un-prefixed by the `/telemetry` basePath and the router resolves them
  // to the workers that already serve them (live serves /icon.svg,
  // marketing serves the PNG + /apple-icon). See spec/16.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/livediagram-icon-256.png', type: 'image/png', sizes: '256x256' },
    ],
    apple: '/apple-icon',
  },
};

export const viewport: Viewport = {
  themeColor: '#0EA5E9',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="bg-slate-50 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
