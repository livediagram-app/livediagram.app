import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/offline — diagrams saved only in this browser (docs/specs/006-diagram/offline-mode.md): a
// synthetic folder, no folder row behind it. The layout's ExplorerShell
// provides the chrome + state; this page only pins the route and the tab
// title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: 'Offline | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
