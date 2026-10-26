# Live image share link

> The live image is a platform service
> ([Previews](../../../../liveworkspace/docs/specs/006-media/previews.md)): liveworkspace's previews serve it, on this app's address
> through its router, and livedocuments only draws the document when asked ([Document previews](../006-document/document-snapshots.md)
> "The export door"). Not re-rendered per request: the platform keeps the drawing until the document is saved again.
> The renderer is `renderElementsToSvg`, DOM-free in `@livedocuments/document`, which also powers the MCP worker
> ([MCP server](../015-api/mcp-server.md)).
>
> The same drawing, fitted onto a 1200 x 630 PNG, is
> what a pasted share link previews with in a chat app: [Share-link previews](share-link-previews.md).

A share option that serves the document as a **live image**: an `<img>`-able URL
that serves the current document as SVG, so it can be embedded in a README / wiki
/ site and stay up to date — no editor chrome, just the content (like the SVG
export).

## Confirmed decisions

- **Scope: tied to a share link.** The image URL embeds a document's share code,
  so only documents the owner has explicitly shared expose an image. The URL is
  effectively public to anyone who has it (an `<img>` can't send a password or
  auth header), which matches a share link's existing semantics.
  - **Password-protected shares** ([Share password](share-password.md)) get **no** image URL — an `<img>`
    can't supply the password, so exposing an unguarded image would bypass the
    gate.
  - Revoking / expiring the share link also kills the image URL (it resolves
    through the index, the same authority as the share view).
- **Format: SVG.** Scalable, tiny, crisp at any size, and renders from the same
  vector logic as the SVG export. Best for embedding and staying live.

## Endpoint

`GET /api/share/<code>/image.svg[?tab=<id>]`, forwarded by the router to liveworkspace's previews
(`/api/previews/share/<code>/image.svg`):

1. The code resolves with the index, as an anonymous visitor's would (the single authority for expiry, level and
   tab). 404 if missing, revoked, expired, trashed, or behind a share password.
2. The drawn tab is the first (`?tab=<id>` selects another). A tab-scoped link ([Tab-scoped share links](tab-scoped-share-links.md))
   always draws its own tab, and a `?tab=` naming any other is a 404.
3. livedocuments draws it through the export door (a Pages tab as its first page alone,
   [Document previews](../006-document/document-snapshots.md) "Pages tabs"); the platform serves it as
   `image/svg+xml` with `Cache-Control: public, max-age=30, stale-while-revalidate=300`.

## Renderer sharing (the build's main work)

The SVG renderer currently lives in `apps/editor/lib/export-tab.ts` (client-only)
and the worker can't import from an app. So the tab→SVG renderer must move into
a **new shared, DOM-free package** (`@livedocuments/render`), imported by **both**
the live editor's export and the api worker. What moves: `renderTabToSvg`,
`describeBoxedExport`, `contentBounds`, the `svg*` helpers, the label-wrap,
`arrowHeadRefs`, the iso matrix, `backgroundPatternTile`, and `containersFirst`. The
label-measure helper already degrades to a character-width estimate when there's
no `document`, so it runs in the Worker.

**Label fidelity rules** (the renderer mirrors the editor's DOM layout):
labels inset by the element's **padding preset** and wrap to the remaining
width; the wrapped block hangs off the element's **`textAlignY`** anchor (a
top-aligned label exports at the element's top, a bottom icon caption
stacks upward INTO the box rather than spilling below it, which the PNG
rasteriser would clip); alignment **defaults follow the element type** (sticky
notes top-left); and **rich (per-run) labels wrap too**, each word measured
with its own run's size/weight (`wrapExportRuns`), so a mixed-format label
breaks lines where the canvas does instead of running out of the element on
one line. The PNG canvas drawer shares the same wrap + block-alignment math.

**Arrowhead fidelity**: `svgArrowhead` reproduces all seven head-shape presets
(triangle / hollow triangle / open-V line / dot / hollow dot / diamond / hollow
diamond, [Canvas and palette](../008-canvas/canvas-and-palette.md)) and scales with the `arrowheadSize` preset, so a hollow or diamond head survives export instead of flattening into a generic filled
triangle. Pinned by `svg-render.test.ts`.

This is a sizeable extraction (it touches the export / canvas code
paths), so it's tracked as its own change to keep it well-tested and the export
regression-free. New top-level package ⇒ update `README.md` +
`docs/development/architecture.md` + `docs/development/local-development.md` trees in the same change.

## Share dialog

The shared Share dialog (`@liveworkspace/explorer`) has no **Live image** menu, so the address is
built by hand from a link's code: `/api/share/<code>/image.svg`, with `?tab=<id>` to pick a tab. The PNG variant
is the share card ([Share-link previews](share-link-previews.md)); themed drawings are out of scope.
