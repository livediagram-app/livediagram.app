# 54 — Live image share link

A share option that serves the diagram as a **live image**: an `<img>`-able URL
that re-renders the current diagram on each request, so it can be embedded in a
README / wiki / site and stay up to date — no editor chrome, just the content
(like the SVG export).

## Confirmed decisions

- **Scope: tied to a share link.** The image URL embeds a diagram's share code,
  so only diagrams the owner has explicitly shared expose an image. The URL is
  effectively public to anyone who has it (an `<img>` can't send a password or
  auth header), which matches a share link's existing semantics.
  - **Password-protected shares** (spec/24) get **no** image URL — an `<img>`
    can't supply the password, so exposing an unguarded image would bypass the
    gate. The Share dialog hides the image option while a password is set.
  - Revoking / expiring the share link also kills the image URL (it resolves
    through the same `share_links` authority as the share view).
- **Format: SVG.** Scalable, tiny, crisp at any size, and renders from the same
  vector logic as the SVG export. Best for embedding and staying live.

## Endpoint

`GET /api/share/<code>/image.svg` on the api worker:

1. Resolve `<code>` through `getShareLink` (the single authority — expiry +
   role). 404 if missing / revoked / expired.
2. If the diagram has a share password, 404 (no image for gated shares).
3. Load the rendered tab (default: the first tab; `?tab=<id>` selects another).
4. Render it to SVG and return `Content-Type: image/svg+xml` with a short
   `Cache-Control` (e.g. `max-age=30, stale-while-revalidate=300`) so embeds
   update without hammering D1.

The router already forwards `/api/*` to the api worker, so no router change.

## Renderer sharing (the build's main work)

The SVG renderer currently lives in `apps/live/lib/export-tab.ts` (client-only)
and the worker can't import from an app. So the tab→SVG renderer
(`renderTabToSvg` + `describeBoxedExport` + `contentBounds` + the `svg*` helpers
+ label-wrap + `arrowHeadRefs` + the iso matrix + `backgroundPatternTile` +
`framesFirst`) must move into a **new shared, DOM-free package**
(`@livediagram/render`), imported by **both** the live editor's export and the
api worker. The label-measure helper already degrades to a character-width
estimate when there's no `document`, so it runs in the Worker.

This is a sizeable extraction (it touches the export / canvas / isometric code
paths), so it's tracked as its own change to keep it well-tested and the export
regression-free. New top-level package ⇒ update `README.md` +
`docs/architecture.md` + `docs/local-development.md` trees in the same change.

## Share dialog

A new **Live image** option in the Share dialog (owner, non-password, shared):
the `.../image.svg` URL with copy buttons for the raw URL, a Markdown
`![](...)` snippet, and an HTML `<img>` snippet. Out of scope for v1: a PNG
variant (Worker rasterization), per-tab pickers in the UI (the `?tab=` param
exists for power users), and themed cache invalidation.
