// The embed URL for the embed view (docs/specs/013-workspace/embeds.md), which the shared Share dialog wraps in its
// iframe snippet. Embeds honour the share link's role: a view link embeds read-only, an edit link embeds an
// editable canvas.

// The embed route reads the share code client-side from `?s=`, the
// same query form the share view uses (docs/specs/013-workspace/embeds.md "URL shape").
export function embedUrlFor(origin: string, code: string): string {
  return `${origin}/embed?s=${encodeURIComponent(code)}`;
}
