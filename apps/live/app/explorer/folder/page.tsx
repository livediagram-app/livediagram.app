import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';

// /explorer/folder?id=<id> — one folder's subfolders + diagrams. The id rides the query string (see routes.ts for why not a path segment).
// The layout's ExplorerShell provides the chrome + state; this page
// only pins the route and the tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: 'Folder | livediagram',
};

export default function Page() {
  return <ExplorerPane />;
}
