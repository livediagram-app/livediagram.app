import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/themes — the per-owner custom-theme library (spec/44).
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (spec/15, routes.ts).
export const metadata: Metadata = {
  title: 'Themes | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
