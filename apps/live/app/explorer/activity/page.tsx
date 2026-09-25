import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/activity — what is outstanding for the reader across every
// diagram they can open: open actions assigned to them or by them, and
// unresolved comment threads they are in (spec/142). The layout's
// ExplorerShell provides the chrome + state; this page only pins the
// route and the tab title.
export const metadata: Metadata = {
  title: 'Activity | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
