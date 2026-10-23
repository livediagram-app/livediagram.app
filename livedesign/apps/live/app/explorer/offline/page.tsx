import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDesignTitle } from '../view-titles';

// /explorer/offline — designs saved only in this browser (docs/specs/006-design/offline-mode.md): a
// view the app gathers, no folder row behind it. The layout's ExplorerShell
// provides the chrome + state; this page only pins the route and the tab
// title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: viewDesignTitle('offline'),
};

export default function Page() {
  return <ExplorerPane />;
}
