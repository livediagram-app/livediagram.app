'use client';

// Render the editor inside the not-found slot.
//
// `output: 'export'` forces dynamicParams=false, so the client
// router fires `notFound()` for any /document/<id> where `<id>` isn't
// the `placeholder` enumerated by generateStaticParams — i.e. every
// real document URL. Rather than fight that (multiple prior attempts:
// route-level override, pre-hydration URL swap, captured-native
// replaceState — see docs/specs/007-editor/new-document-route.md), embrace it: the not-found slot
// renders the editor, so a URL mismatch produces the editor instead
// of a 404 page. The editor reads the real id from
// `window.location.pathname` on mount and loads the document via the
// API; if the API actually 404s (genuinely deleted / never existed),
// the in-app NotFound card surfaces — branded, with a CTA. Any
// non-document path that lands here (e.g. /live/typo) hits that same
// API-404 surface, which is good enough until we have a proper
// routing story for unknown paths.
//
// Loaded lazily, the way /new loads it: Next ships the root not-found
// slot's code with EVERY route, so a static import here put the whole
// editor in the first load of sign-in, the Explorer, /new, join and the
// rest. A document URL still has it in time, since /document/placeholder
// imports the editor itself; the opening screen covers the one tick the
// import takes to resolve.

import dynamic from 'next/dynamic';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';

const EditorPage = dynamic(() => import('./document/[id]/editor-page'), {
  ssr: false,
  loading: () => <OpeningScreen />,
});

export default function NotFound() {
  return <EditorPage />;
}
