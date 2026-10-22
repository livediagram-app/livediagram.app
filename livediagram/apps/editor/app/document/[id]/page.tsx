import { Suspense } from 'react';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
import EditorPage from './editor-page';
import { EDITOR_VIEWPORT } from '@/lib/page-viewport';

// Static export + dynamic route: `output: 'export'` requires every
// dynamic segment to be resolvable at build time. User-minted document
// ids can't be enumerated, so we ship a single placeholder route
// (`/document/placeholder/`) and have the editor worker rewrite any
// `/document/<anything>` request to that file. The client then reads
// the real id from `window.location.pathname`. See docs/specs/007-editor/new-document-route.md.
export const generateStaticParams = async () => [{ id: 'placeholder' }];

// The editor renders in the browser only (docs/specs/003-system-architecture/react-state-and-effects.md "Rendering in
// the browser only"): the prerender holds the opening screen it always showed first, so the swap moves nothing.

// The canvas owns zoom here, so the page is pinned at 1 (lib/page-viewport.ts).
export const viewport = EDITOR_VIEWPORT;

export default function Page() {
  return (
    <Suspense fallback={<OpeningScreen />}>
      <EditorPage />
    </Suspense>
  );
}
