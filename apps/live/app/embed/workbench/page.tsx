import type { Metadata } from 'next';
import { WorkbenchPage } from './WorkbenchPage';

// The workbench embed (docs/specs/013-workspace/workbench-embeds.md): the editor inside a developer
// tool's frame, signed in by a workbench session. Static like /embed; the live worker leaves every
// /embed path frameable, and the page itself binds to the minting workbench before it shows anything.
export const metadata: Metadata = {
  title: 'Workbench | livediagram',
  robots: { index: false },
};

export default function Page() {
  return <WorkbenchPage />;
}
