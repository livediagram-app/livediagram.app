// Render the editor inside the not-found slot.
//
// `output: 'export'` forces dynamicParams=false, so the client
// router fires `notFound()` for any /diagram/<id> where `<id>` isn't
// the `placeholder` enumerated by generateStaticParams — i.e. every
// real diagram URL. Rather than fight that (multiple prior attempts:
// route-level override, pre-hydration URL swap, captured-native
// replaceState — see docs/specs/007-editor/new-diagram-route.md), embrace it: the not-found slot
// renders the editor, so a URL mismatch produces the editor instead
// of a 404 page. The editor reads the real id from
// `window.location.pathname` on mount and loads the diagram via the
// API; if the API actually 404s (genuinely deleted / never existed),
// the in-app NotFound card surfaces — branded, with a CTA. Any
// non-diagram path that lands here (e.g. /live/typo) hits that same
// API-404 surface, which is good enough until we have a proper
// routing story for unknown paths.

import EditorPage from './diagram/[id]/editor-page';

export default function NotFound() {
  return <EditorPage />;
}
