import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
import EditorPage from '../document/[id]/editor-page';
import { EDITOR_VIEWPORT } from '@liveworkspace/workbench/lib/page-viewport';

// Read-only embed view (docs/specs/013-workspace/embeds.md): the same editor page in embed mode,
// served from a plain static route. The share code arrives client-side
// as `?s=<code>` (the same query form the share view uses), so unlike
// `/document/<id>` no worker rewrite is needed; the static export ships
// this page directly. The editor worker omits X-Frame-Options for
// `/embed` so host pages can iframe it.
export const metadata: Metadata = {
  title: 'Embedded canvas | livediagram',
  robots: { index: false },
};

// The editor renders in the browser only (docs/specs/003-system-architecture/react-state-and-effects.md "Rendering in
// the browser only"): the prerender holds the opening screen it always showed first.

// The canvas owns zoom here, so the page is pinned at 1 (@liveworkspace/workbench/lib/page-viewport.ts).
export const viewport = EDITOR_VIEWPORT;

export default function Page() {
  return (
    <Suspense fallback={<OpeningScreen />}>
      <EditorPage surface="embed" />
    </Suspense>
  );
}
