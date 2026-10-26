import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './telemetry.css';

// The public transparency dashboard for every liveworkspace app (liveworkspace/docs/telemetry.md).
// Indexable: it's part of the open, "here's exactly what we measure" story, not a private app.
export const metadata: Metadata = {
  title: 'Telemetry · liveworkspace',
  description:
    'Anonymous, first-party product usage for every liveworkspace app, in the open. No third-party vendors; data is never sold or shared beyond this page.',
  alternates: { canonical: '/telemetry' },
  openGraph: {
    title: 'Telemetry · liveworkspace',
    description:
      'Anonymous, first-party product usage for every liveworkspace app, in the open. No third-party vendors; data is never sold or shared beyond this page.',
    url: '/telemetry',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Telemetry · liveworkspace',
    description:
      'Anonymous, first-party product usage for every liveworkspace app, in the open. No third-party vendors; data is never sold or shared beyond this page.',
  },
};

export default function TelemetryLayout({ children }: { children: ReactNode }) {
  return children;
}
