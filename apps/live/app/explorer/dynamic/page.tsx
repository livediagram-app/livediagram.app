import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/dynamic — the parent view for the synthetic folders (Unsorted,
// Generated, Offline): live views over your diagrams, grouped under one
// "Dynamic" folder so My Work stays tidy. The layout's ExplorerShell
// provides the chrome + state; this page only pins the route and the tab
// title (spec/15, routes.ts).
export const metadata: Metadata = {
  title: 'Dynamic | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
