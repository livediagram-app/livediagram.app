// Live-image URL + snippet builders for the share dialog (docs/specs/013-workspace/live-image-share.md +
// docs/specs/006-diagram/diagram-snapshots.md). The endpoint serves a diagram's cached SVG snapshot scoped
// to a share code, so a bare <img> in a README / wiki / Notion can embed
// it and it stays close to live (the worker re-renders when the diagram
// is saved). Pure functions so the dialog's copy buttons and the tests
// share one source of truth for the URL shape.
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

// GitHub / docs Markdown image syntax.
export function liveImageMarkdown(origin: string, code: string, tabId?: string): string {
  return `![diagram](${liveImageUrlFor(origin, code, tabId)})`;
}

// Plain HTML <img> for wikis / sites that take raw HTML.
export function liveImageHtml(origin: string, code: string, tabId?: string): string {
  return `<img src="${liveImageUrlFor(origin, code, tabId)}" alt="diagram" />`;
}
