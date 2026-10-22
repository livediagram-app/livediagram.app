'use client';

// Render the editor inside the not-found slot.
//
// `output: 'export'` forces dynamicParams=false, so the client
// router fires `notFound()` for any /project/<id> where `<id>` isn't
// the `placeholder` enumerated by generateStaticParams — i.e. every
// real project URL. Rather than fight that (multiple prior attempts:
// route-level override, pre-hydration URL swap, captured-native
// replaceState — see docs/specs/007-editor/new-project-route.md), embrace it: the not-found slot
// renders the editor, so a URL mismatch produces the editor instead
// of a 404 page. The editor reads the real id from
// `window.location.pathname` on mount and loads the project via the
// API; if the API actually 404s (genuinely deleted / never existed),
// the in-app NotFound card surfaces — branded, with a CTA. Any
// non-project path that lands here (e.g. /typo) shows that card as
// "Page not found" without asking the API (new-project-route.md
// "Unknown addresses").
//
// Loaded lazily, the way /new loads it: Next ships the root not-found
// slot's code with EVERY route, so a static import here put the whole
// editor in the first load of sign-in, the Explorer, /new, join and the
// rest. A project URL still has it in time, since /project/placeholder
// imports the editor itself; the opening screen covers the one tick the
// import takes to resolve.

import dynamic from 'next/dynamic';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';

const EditorPage = dynamic(() => import('./project/[id]/editor-page'), {
  ssr: false,
  loading: () => <OpeningScreen />,
});

export default function NotFound() {
  return <EditorPage />;
}
