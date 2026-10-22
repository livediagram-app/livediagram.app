import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewProjectTitle } from '../view-titles';

// /explorer/search: every project the reader can open, narrowed by the lens in `q`
// (docs/specs/013-workspace/explorer-filters.md#views). The layout's ExplorerShell provides the
// chrome and state; this page only pins the route and the tab title.
export const metadata: Metadata = {
  title: viewProjectTitle('search'),
};

export default function Page() {
  return <ExplorerPane />;
}
