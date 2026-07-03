# 54 — Live image share link

> **Status: implemented, as part of [spec/67](67-diagram-snapshots.md).** The
> endpoint and Share-dialog option below shipped, but two design points here are
> now superseded by spec/67 — read it for the authoritative behaviour:
>
> - **Not re-rendered per request.** The image serves a **cached SVG snapshot**
>   from R2, refreshed render-on-read when the diagram has been saved since
>   (`thumb_rendered_at`). Cheaper, and "live" within the cache window + last
>   save. The cache is shared with the Explorer thumbnail (spec/67) — one
>   artifact, two delivery paths.
> - **Renderer already shared.** The "main work" below (extracting the renderer
>   into a new package) is moot: `renderElementsToSvg` already lives DOM-free in
>   `@livediagram/diagram` (`packages/diagram/src/svg-render.ts`) and powers the
>   MCP worker (spec/62), so the worker imports it directly. No `@livediagram/render`
>   package was created.
>
> The rest of this spec (URL shape, password exclusion, share dialog) holds.

A share option that serves the diagram as a **live image**: an `<img>`-able URL
that serves the current diagram as SVG, so it can be embedded in a README / wiki
/ site and stay up to date — no editor chrome, just the content (like the SVG
export).

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
diamond, spec/09) and scales with the `arrowheadSize` preset, so UML notation
(hollow-triangle inheritance, hollow-diamond aggregation, e.g. the Class
diagram template) survives export instead of flattening into generic filled
triangles. Pinned by `svg-render.test.ts`.

This is a sizeable extraction (it touches the export / canvas / isometric code
paths), so it's tracked as its own change to keep it well-tested and the export
regression-free. New top-level package ⇒ update `README.md` +
`docs/architecture.md` + `docs/local-development.md` trees in the same change.

## Share dialog

A new **Live image** option in the Share dialog (owner, non-password, shared):
a menu off the `.../image.svg` URL to copy the raw URL, a Markdown
`![](...)` snippet, or an HTML `<img>` snippet (the same `ShareCopyMenu`
the Embed control uses). The menu also carries a **per-tab picker** (a
`<select>`, shown when the diagram has more than one tab) that threads
`?tab=<id>` into the copied URL / snippets; see
[spec/67](67-diagram-snapshots.md#share-dialog) for the caching detail
(a non-default tab renders on read, uncached). Out of scope for v1: a
PNG variant (Worker rasterization) and themed cache invalidation.
