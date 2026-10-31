import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StatusBoard } from '@/components/status/StatusBoard';
import './status-motion.css';

// Status (liveworkspace/docs/specs/010-site/site.md "Status"): one page for liveworkspace's shared services and every app's own,
// checked live from the visitor's browser. Each app's old /status redirects here, to its own group.

const TITLE = 'Status · liveworkspace';
const DESCRIPTION =
  'Live status of liveworkspace and every app in it: accounts, the Explorer, Community, telemetry and media, and each app’s API, realtime rooms, editor, help centre and MCP server.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/status' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/status',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export default function StatusPage() {
  return (
    <>
      <Header />
      <main>
        <StatusBoard />
      </main>
      <Footer />
    </>
  );
}
