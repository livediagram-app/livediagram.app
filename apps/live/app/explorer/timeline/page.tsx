import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/timeline — the default landing section: a day-grouped feed
// of everything that has happened across the user's diagrams, teams and
// account (spec/138). The layout's ExplorerShell provides the chrome +
// state; this page only pins the route and the tab title.
export const metadata: Metadata = {
  title: 'Timeline | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
