import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/all — the folder-tree root: root folders + the Unsorted bucket.
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (spec/15, routes.ts).
export const metadata: Metadata = {
  title: 'Personal Space | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
