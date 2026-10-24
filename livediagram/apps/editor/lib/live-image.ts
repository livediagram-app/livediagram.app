// The live-image URL for the share dialog (docs/specs/013-workspace/live-image-share.md +
// docs/specs/006-document/document-snapshots.md). The endpoint serves a document's cached SVG snapshot scoped
// to a share code, so a bare <img> in a README / wiki / Notion can embed
// it and it stays close to live (the worker re-renders when the document
// is saved). The shared Share dialog wraps it in its Markdown and HTML snippets.
//
// The api is same-origin in production (the router worker stitches `/api`
// onto the app's hostname), so the public URL is `<origin>/api/share/...`
// — matching how embedUrlFor builds its `<origin>/embed?s=` URL.

// `tabId` (docs/specs/013-workspace/live-image-share.md) selects which tab the image renders; omit it for the
// default (first tab), which the server serves from its cached snapshot.
// A supplied id is appended as `?tab=<id>` so the endpoint renders that
// specific tab.
export function liveImageUrlFor(origin: string, code: string, tabId?: string): string {
  const base = `${origin}/api/share/${encodeURIComponent(code)}/image.svg`;
  return tabId ? `${base}?tab=${encodeURIComponent(tabId)}` : base;
}
