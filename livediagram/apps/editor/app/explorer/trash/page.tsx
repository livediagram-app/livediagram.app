import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDocumentTitle } from '../view-titles';

// /explorer/trash — the Trash (docs/specs/013-workspace/trash.md): deleted
// documents waiting out their 30 days. No sidebar row; Settings links here.
// The layout's ExplorerShell provides the chrome + state; this page only pins
// the route and the tab title.
export const metadata: Metadata = {
  title: viewDocumentTitle('trash'),
};

export default function Page() {
  return <ExplorerPane />;
}
