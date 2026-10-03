import type { Metadata } from 'next';
import { InvitesRedirectGate } from './InvitesRedirectGate';
import { viewDocumentTitle } from '../view-titles';

// /explorer/invites — pending team invites to accept or decline (docs/specs/013-workspace/teams.md).
// The layout's ExplorerShell provides the chrome + state; this page
// pins the route + tab title (docs/specs/013-workspace/folders.md, routes.ts) and gates the pane
// behind sign-in (invites are team-only, so a guest has nothing here).
export const metadata: Metadata = {
  title: viewDocumentTitle('invites'),
};

export default function Page() {
  return <InvitesRedirectGate />;
}
