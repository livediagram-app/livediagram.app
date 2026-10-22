import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewProjectTitle } from '../view-titles';

// /explorer/home: the Explorer's landing view (docs/specs/013-workspace/explorer-home.md). The
// layout's ExplorerShell provides the chrome and state; this page only pins the route and the tab
// title.
export const metadata: Metadata = {
  title: viewProjectTitle('home'),
};

export default function Page() {
  return <ExplorerPane />;
}
