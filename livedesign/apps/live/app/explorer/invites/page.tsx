import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDesignTitle } from '../view-titles';

// /explorer/invites — the team invitations waiting for the person, answered on liveworkspace.app
// (docs/specs/013-workspace/teams.md "Invitations"). The layout's ExplorerShell provides the chrome and
// state; this page pins the route and the tab title.
export const metadata: Metadata = {
  title: viewDesignTitle('invites'),
};

export default function Page() {
  return <ExplorerPane />;
}
