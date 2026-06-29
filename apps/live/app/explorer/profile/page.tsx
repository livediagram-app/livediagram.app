import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/profile — the signed-in user's account home (spec/65): identity,
// email-notification settings, and account deletion. Signed-in only (a guest
// deep-linking it gets a sign-in prompt). The layout's ExplorerShell provides
// the chrome + state; this page only pins the route and the tab title.
export const metadata: Metadata = {
  title: 'Profile | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
