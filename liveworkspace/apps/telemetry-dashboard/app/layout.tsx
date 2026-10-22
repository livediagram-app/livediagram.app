import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import {
  APPEARANCE_BOOT_SCRIPT,
  DARK_READER_LOCK,
  PUBLIC_VIEWPORT,
  trustedHtml,
  trustedTypesBootScript,
} from '@livediagram/ui';

// The public transparency dashboard for every liveworkspace app (liveworkspace/docs/telemetry.md).
// Indexable: it's part of the open, "here's exactly what we measure" story, not a private app.
// Trusted Types before anything else: the default policy and the violation log, and this app's own
// scripts under its asset prefix. It loads nothing from another origin.
const TRUSTED_TYPES_BOOT = trustedTypesBootScript('/telemetry', []);

export const metadata: Metadata = {
  metadataBase: new URL('https://liveworkspace.app'),
  title: 'Telemetry · liveworkspace',
  description:
    'Anonymous, first-party product usage for every liveworkspace app, in the open. No third-party vendors; data is never sold or shared beyond this page.',
  alternates: { canonical: '/telemetry' },
  robots: { index: true, follow: true },
  other: DARK_READER_LOCK,
};

export const viewport: Viewport = PUBLIC_VIEWPORT;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script may add `dark` to <html>.
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(TRUSTED_TYPES_BOOT) }} />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        {/* Appearance before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: trustedHtml(APPEARANCE_BOOT_SCRIPT) }} />
        {children}
      </body>
    </html>
  );
}
