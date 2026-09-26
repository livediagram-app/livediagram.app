import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/unsorted — diagrams with no folder (folder_id IS NULL).
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: 'Unsorted | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
