import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDesignTitle } from '../view-titles';

// /explorer/search: every design the reader can open, narrowed by the lens in `q`
// (docs/specs/013-workspace/explorer-filters.md#views). The layout's ExplorerShell provides the
// chrome and state; this page only pins the route and the tab title.
export const metadata: Metadata = {
  title: viewDesignTitle('search'),
};

export default function Page() {
  return <ExplorerPane />;
}
