import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDocumentTitle } from '../view-titles';

// /explorer/activity — what is outstanding for the reader across every
// document they can open: open actions assigned to them or by them, and
// unresolved comment threads they are in (docs/specs/013-workspace/activity-page.md). The layout's
// ExplorerShell provides the chrome + state; this page only pins the
// route and the tab title.
export const metadata: Metadata = {
  title: viewDocumentTitle('activity'),
};

export default function Page() {
  return <ExplorerPane />;
}
