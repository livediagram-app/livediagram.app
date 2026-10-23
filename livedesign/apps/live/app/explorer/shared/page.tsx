import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDesignTitle } from '../view-titles';

// /explorer/shared — designs opened via someone else's share link.
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: viewDesignTitle('shared'),
};

export default function Page() {
  return <ExplorerPane />;
}
