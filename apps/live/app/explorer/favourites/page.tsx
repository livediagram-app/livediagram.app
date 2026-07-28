import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/favourites — the diagrams this user starred, personal and team
// alike (spec/95). The layout's ExplorerShell provides the chrome + state;
// this page only pins the route and the tab title (spec/15, routes.ts).
export const metadata: Metadata = {
  title: 'Favourites | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
