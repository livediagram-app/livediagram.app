import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDesignTitle } from '../view-titles';

// /explorer/all: the My Work root, its root folders then its root designs.
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: viewDesignTitle('all'),
};

export default function Page() {
  return <ExplorerPane />;
}
