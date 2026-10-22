import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewProjectTitle } from '../view-titles';

// /explorer/all: the My Projects root, its root folders then its root projects.
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: viewProjectTitle('all'),
};

export default function Page() {
  return <ExplorerPane />;
}
