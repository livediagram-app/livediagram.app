import type { Metadata } from 'next';
import { WorkbenchPage } from './WorkbenchPage';
import { EDITOR_VIEWPORT } from '@liveworkspace/workbench/lib/page-viewport';

// The workbench embed (docs/specs/013-workspace/workbench-embeds.md): the editor inside a developer
// tool's frame, signed in by a workbench session. Static like /embed; the editor worker leaves every
// /embed path frameable, and the page itself binds to the minting workbench before it shows anything.
export const metadata: Metadata = {
  title: 'Workbench | livedocuments',
  robots: { index: false },
};

// The canvas owns zoom here, so the page is pinned at 1 (@liveworkspace/workbench/lib/page-viewport.ts).
export const viewport = EDITOR_VIEWPORT;

export default function Page() {
  return <WorkbenchPage />;
}
