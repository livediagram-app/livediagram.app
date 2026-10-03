import type { Metadata } from 'next';
import { ExplorerPane } from '../ExplorerPane';
import { viewDocumentTitle } from '../view-titles';

// /explorer/shape-libraries: the owner's shape libraries (docs/specs/013-workspace/shape-libraries.md).
// The layout's ExplorerShell provides the chrome and state; this page only pins the route and the
// tab title (docs/specs/013-workspace/folders.md, routes.ts).
export const metadata: Metadata = {
  title: viewDocumentTitle('shape-libraries'),
};

export default function Page() {
  return <ExplorerPane />;
}
