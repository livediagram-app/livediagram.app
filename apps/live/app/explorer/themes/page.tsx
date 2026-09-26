import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/themes — the per-owner custom-theme library (docs/specs/011-theme/custom-themes.md).
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: 'Themes | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
