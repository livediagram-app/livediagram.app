import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EDITOR_VIEWPORT } from '@/lib/page-viewport';
import { WorkbenchPage } from '../WorkbenchPage';
import { WorkbenchStatus } from '../WorkbenchStatus';

// The workspace frame (docs/specs/013-workspace/workbench-embeds.md "Two scopes", "What renders"): the Explorer and
// every project in it, inside a developer tool's frame, signed in by a workbench session. One static page backs
// every place in the frame: the editor worker serves it for /embed/workbench/explorer/** and
// /embed/workbench/project/** (lib/workbench/workbench-frame-path.ts), and the page reads the real address. Under
// /embed, so frameable; the page binds to the minting workbench before it shows anything.
export const metadata: Metadata = {
  title: 'Workbench | liveplanner',
  robots: { index: false },
};

// The canvas owns zoom when a project is open, so the page is pinned at 1 (lib/page-viewport.ts).
export const viewport = EDITOR_VIEWPORT;

// The frame reads its place from the address (useSearchParams), which a static export must hold in a Suspense
// boundary; its fallback is the opening line, so the first paint says what is happening.
export default function Page() {
  return (
    <Suspense fallback={<WorkbenchStatus phase={{ phase: 'reading' }} scope="workspace" />}>
      <WorkbenchPage />
    </Suspense>
  );
}
