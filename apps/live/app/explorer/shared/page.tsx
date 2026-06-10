import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/shared — diagrams opened via someone else's share link.
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (spec/15, routes.ts).
export const metadata: Metadata = {
  title: 'Shared with you | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
