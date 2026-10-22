import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDocumentTitle } from '../view-titles';

// /explorer/tags — the reader's documents grouped by tag, or one tag's (`?id=`) (docs/specs/013-workspace/tags.md
// "The Tags page"). The layout's ExplorerShell provides the chrome + state; this page only pins the route and the tab
// title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: viewDocumentTitle('tags'),
};

export default function Page() {
  return <ExplorerPane />;
}
