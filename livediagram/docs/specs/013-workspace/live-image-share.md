# Live image share link

> **Status: implemented.** The image is liveworkspace's now, built once for every app
> ([liveworkspace/docs/specs/006-media/previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md)): this app's router forwards
> `/api/share/<code>/image.svg` to liveworkspace's previews, which ask the index whether the link is open, keep the
> picture, and ask livediagram to draw it again after a save ([Document SVG snapshots](../006-document/document-snapshots.md),
> "the export door"). The renderer is `renderElementsToSvg` in `@livediagram/document`; no `@livediagram/render`
> package was created, so "Renderer sharing" below is history.
>
> The rest of this spec (URL shape, password exclusion, share dialog) holds.
>
> The same drawing, fitted onto a 1200 x 630 PNG, is what a pasted share link previews with in a chat app:
> [Share-link previews](share-link-previews.md).

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
    gate. The Share dialog hides the image option while a password is set.
  - Revoking / expiring the share link also kills the image URL (it resolves
    through the same `share_links` authority as the share view).
- **Format: SVG.** Scalable, tiny, crisp at any size, and renders from the same
  vector logic as the SVG export. Best for embedding and staying live.

## Endpoint

`GET /api/share/<code>/image.svg`, answered by liveworkspace's previews (forwarded by this app's router):

1. Resolve `<code>` through the index (`resolveShare`, the single authority — expiry +
   role). 404 if missing / revoked / expired.
2. If the document has a share password, 404 (no image for gated shares).
3. Load the rendered tab (default: the first tab; `?tab=<id>` selects another). A tab-scoped link ([Tab-scoped share links](tab-scoped-share-links.md)) always renders its own tab, and a `?tab=` naming any other is a 404.
4. Serve the stored drawing, asking livediagram to draw it again when the document has been saved since
   ([Document SVG snapshots](../006-document/document-snapshots.md)), as `Content-Type: image/svg+xml` with a short
   `Cache-Control` (`public, max-age=30, stale-while-revalidate=300`) so embeds update without a drawing on every
   view.

## Renderer sharing (the build's main work)

The SVG renderer currently lives in `apps/editor/lib/export-tab.ts` (client-only)
and the worker can't import from an app. So the tab→SVG renderer must move into
a **new shared, DOM-free package** (`@livediagram/render`), imported by **both**
the live editor's export and the api worker. What moves: `renderTabToSvg`,
`describeBoxedExport`, `contentBounds`, the `svg*` helpers, the label-wrap,
`arrowHeadRefs`, the iso matrix, `backgroundPatternTile`, and `framesFirst`. The
label-measure helper already degrades to a character-width estimate when there's
no `document`, so it runs in the Worker.

**Label fidelity rules** (the renderer mirrors the editor's DOM layout):
labels inset by the element's **padding preset** and wrap to the remaining
width; the wrapped block hangs off the element's **`textAlignY`** anchor (a
top-aligned frame label exports at the frame's top, a bottom icon caption
stacks upward INTO the box rather than spilling below it, which the PNG
rasteriser would clip); alignment **defaults follow the element type** (sticky
notes top-left); and **rich (per-run) labels wrap too**, each word measured
with its own run's size/weight (`wrapExportRuns`), so a mixed-format label
breaks lines where the canvas does instead of running out of the element on
one line. The PNG canvas drawer shares the same wrap + block-alignment math.

**Arrowhead fidelity**: `svgArrowhead` reproduces all seven head-shape presets
(triangle / hollow triangle / open-V line / dot / hollow dot / diamond / hollow
diamond, [Canvas and palette](../008-canvas/canvas-and-palette.md)) and scales with the `arrowheadSize` preset, so UML notation
(hollow-triangle inheritance, hollow-diamond aggregation, e.g. the Class
diagram template) survives export instead of flattening into generic filled
triangles. Pinned by `svg-render.test.ts`.

This is a sizeable extraction (it touches the export / canvas / isometric code
paths), so it's tracked as its own change to keep it well-tested and the export
regression-free. New top-level package ⇒ update `README.md` +
`docs/development/architecture.md` + `docs/development/local-development.md` trees in the same change.

## Share dialog

A **Live image** menu on each pass in the Share dialog (owner, non-password, shared):
a menu off the `.../image.svg` URL to copy the raw URL, a Markdown
`![](...)` snippet, or an HTML `<img>` snippet (the same `ShareCopyMenu`
the Embed control uses). The menu also carries a **per-tab picker** (a
`<select>`, shown when the document has more than one tab) that threads
`?tab=<id>` into the copied URL / snippets; see
[Document SVG snapshots](../006-document/document-snapshots.md#share-dialog). Out of scope for v1: a
PNG variant (Worker rasterization) and themed cache invalidation.
