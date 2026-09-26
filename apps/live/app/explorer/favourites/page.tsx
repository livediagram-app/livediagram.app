import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/favourites — the diagrams this user starred, personal and team
// alike (docs/specs/013-workspace/favourites.md). The layout's ExplorerShell provides the chrome + state;
// this page only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: 'Favourites | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
