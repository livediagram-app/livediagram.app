import type { Metadata } from 'next';
import { InvitesRedirectGate } from './InvitesRedirectGate';

// /explorer/invites — pending team invites to accept or decline (spec/32).
// The layout's ExplorerShell provides the chrome + state; this page
// pins the route + tab title (spec/15, routes.ts) and gates the pane
// behind sign-in (invites are team-only, so a guest has nothing here).
export const metadata: Metadata = {
  title: 'Invites | livediagram',
};

export default function Page() {
  return <InvitesRedirectGate />;
}
