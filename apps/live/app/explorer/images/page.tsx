import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/images — the per-owner image gallery (spec/19).
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (spec/15, routes.ts).
export const metadata: Metadata = {
  title: 'Image Gallery | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
