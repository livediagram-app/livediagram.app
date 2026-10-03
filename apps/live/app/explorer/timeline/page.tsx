import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDocumentTitle } from '../view-titles';

// /explorer/timeline — the default landing section: a day-grouped feed
// of everything that has happened across the user's documents, teams and
// account (docs/specs/013-workspace/timeline.md). The layout's ExplorerShell provides the chrome +
// state; this page only pins the route and the tab title.
export const metadata: Metadata = {
  title: viewDocumentTitle('timeline'),
};

export default function Page() {
  return <ExplorerPane />;
}
