import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/images — the per-owner image gallery (docs/specs/009-elements/images.md).
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: 'Image Gallery | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
