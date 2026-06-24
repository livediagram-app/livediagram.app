import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/tokens — the per-owner API token library (spec/61). Signed-in
// only (the sidebar gates the section on clerkEnabled; the routes reject a
// guest). The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (spec/15, routes.ts).
export const metadata: Metadata = {
  title: 'API tokens | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
