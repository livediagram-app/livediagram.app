import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewProjectTitle } from '../view-titles';

// /explorer/tags — the reader's projects grouped by tag, or one tag's (`?id=`) (docs/specs/013-workspace/tags.md
// "The Tags page"). The layout's ExplorerShell provides the chrome + state; this page only pins the route and the tab
// title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: viewProjectTitle('tags'),
};

export default function Page() {
  return <ExplorerPane />;
}
