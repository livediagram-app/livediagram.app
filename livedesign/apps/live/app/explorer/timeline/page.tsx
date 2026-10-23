import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDesignTitle } from '../view-titles';

// /explorer/timeline: the Timeline, the day-grouped feed of everything that has happened across
// the user's designs, teams and account (docs/specs/013-workspace/timeline.md), reached from its
// sidebar row and Home's See Timeline. The layout's ExplorerShell provides the chrome +
// state; this page only pins the route and the tab title.
export const metadata: Metadata = {
  title: viewDesignTitle('timeline'),
};

export default function Page() {
  return <ExplorerPane />;
}
