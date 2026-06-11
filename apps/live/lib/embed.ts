// Embed-URL + iframe-snippet builders for the read-only embed view
// (spec/33). Pure functions so the ShareDialog's "Embed" copy button
// and the tests share one source of truth for the snippet shape.

// The embed route reads the share code client-side from `?s=`, the
// same query form the share view uses (spec/33 "URL shape").
export function embedUrlFor(origin: string, code: string): string {
  return `${origin}/embed?s=${encodeURIComponent(code)}`;
}

// Default size picked for docs / wiki columns: wide enough that a
// flowchart reads, short enough not to dominate the page. The border
// matches the editor's hairline slate so the frame doesn't look like
// a hole in the host page. allowfullscreen because the embed's
// ZoomControls dock stays available and full-screening a diagram is
// the natural "let me read this properly" gesture.
export function buildEmbedSnippet(origin: string, code: string): string {
  return (
    `<iframe src="${embedUrlFor(origin, code)}" width="800" height="500" ` +
    `style="border:1px solid #e2e8f0;border-radius:8px" allowfullscreen></iframe>`
  );
}
