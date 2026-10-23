# Document SVG snapshots

A single cached SVG snapshot per document, used two ways:

1. **Explorer thumbnails** — a small preview on each row of the Recent /
   folder lists so you can recognise a document without opening it.
2. **Live image share** — an `<img>`-able URL ([Live image share link](../013-workspace/live-image-share.md)) that embeds the
   document in a README / wiki / doc and stays up to date.

Both render the same artifact through the same DOM-free renderer; they
differ only in how they're authorised and cached.

## Why one artifact, not two

The document list endpoint (`GET /api/documents`) deliberately ships no
element data ([Per-tab storage](per-tab-storage.md)) so listing 100 documents stays cheap. Rendering a
preview per row from element data would re-load exactly what the list
avoids. So previews come from a **pre-rendered SVG**, not from element
data at list time.

Because SVG is vector, the same full-fidelity snapshot renders crisply
as a 36px list thumbnail and as a full-size embed — there is no separate
"thumbnail size" to generate. One stored artifact serves both surfaces.

## Render-on-read, cached in R2

The snapshot bytes live in R2 (the existing `IMAGES` bucket, key
`thumb/<documentId>`); a `documents.thumb_rendered_at` column records when
they were last rendered.

On a read of either delivery path:

- **Fresh** (`thumb_rendered_at >= saved_at`): stream the stored R2
  bytes. No render, no element load.
- **Stale** (or never rendered, or the object is missing): render the
  first tab with `renderElementsToSvg` (`@livedocuments/document`, the same
  DOM-free renderer the MCP worker uses), write it to R2, stamp
  `thumb_rendered_at`, and return it. Icon elements render their real
  glyph via the `@livedocuments/icons/resolve` resolver the worker passes in. Image elements render their real picture: the
  worker reads each upload from the media service and inlines it as a base64 data URL
  through `embedTabImages` (`@livedocuments/api-schema`, shared with the
  MCP preview, [MCP server](../015-api/mcp-server.md) §5), in document order under a 3 MB total budget
  so a tab of large photos can't produce a multi-megabyte snapshot. An
  image past the budget, unknown to the media service, or not a recognised raster
  format keeps its placeholder box.

This is **render-on-read**, not render-on-save, on purpose:

- **Covers every write path.** `saved_at` is bumped by every tab write
  (editor, collaborators, MCP server, API token), so the snapshot
  invalidates uniformly regardless of who edited — no client upload to
  keep in sync.
- **No wasted renders.** A document is only rendered when it has been
  edited _and_ subsequently viewed (in a list or an embed). A document
  nobody opens never costs a render.
- **Cheap steady state.** Once cached, reads are a straight R2 stream
  until the next save.

### Pages tabs

A first tab in Pages (pages: infographics, slides, articles)
snapshots as **its first page alone**, drawn as the page export draws it
(`renderPageToSvg`, [Pages](../007-editor/pages-mode.md) "Export"): the page's sheet and
background, an article page's estimated writing, and the elements reaching
onto it, cut at its edges, at the page's own size. Drawing the whole canvas
instead put every page side by side, which at thumbnail size shrank to a
row of slivers nobody could recognise; a deck is recognised by its cover.
The same rule holds wherever this renderer serves a preview: the Explorer
thumbnail, the default live image, a `?tab=` live image of a Pages
tab. Only the first page's images are read for
it (its elements' images and its picture background), so a long deck of
photos costs one page's R2 reads.

Measured on the renderer alone (Node, warm): a 12-slide deck of 10 shapes
a slide drew in 1.33 ms as a 42 KB whole canvas and draws in 0.14 ms as a
4 KB first page; a worst case of 60 slides of 25 shapes plus a 30-page,
600-paragraph article drew in 6.5 ms at 528 KB and draws in 5.6 ms at
9 KB (the article's writing estimate dominates either way).

An empty / unparseable first tab yields no snapshot (the endpoints 404
and the row shows its generic icon). Deleting a document clears its R2
object. Nothing renders ahead of time: the first read of each document
renders it lazily.

## Delivery path 1 — Explorer thumbnail (owner-authed)

`GET /api/documents/:id/thumbnail?v=<savedAt>`

- Read-gated exactly like `GET /api/documents/:id`: the owner, a joined
  team member, or a valid share-code visitor.
- A native `<img>` can't send auth headers, so the editor app fetches this
  through the authenticated client and wraps the bytes in a blob URL
  (the same pattern image elements use, [Image element + per-owner gallery](../009-elements/images.md)). `?v=<savedAt>` busts
  the browser cache when the document changes; the worker ignores it.
  `Cache-Control: private, max-age=86400`.
- One D1 read gates it: `getDocumentThumbMeta` returns the owner, team,
  name, `saved_at` and `thumb_rendered_at` in one query, so a fresh
  snapshot costs that query, the access gate and the R2 read. The full
  document (participant and tab summaries) is never loaded for a preview.
- A stale snapshot is returned as soon as it is rendered; the R2 write
  and the freshness stamp run in the request's `waitUntil`.
- The Explorer row fetches **lazily** (IntersectionObserver): only rows
  scrolled into view fetch, so a long list never fires dozens of
  requests / renders for rows the user never reaches.
- The editor app keeps settled thumbnails in a page-wide, least-recently-used
  cache of 200 entries keyed by viewer, document, version and share code
  (`lib/thumbnail-cache.ts`). A remount (a view switch, a folder, coming
  back to the Explorer) paints from it at once, and two thumbnails of one
  document share one request. The cache owns each blob URL and revokes it
  on eviction.
- While the snapshot is on its way the box shows the **loader**: the
  placeholder's three-node sketch drawing itself in the placeholder's own
  slate, so it never reads as a real preview. On a 5.4s loop the first
  node traces, then a small spinner appears and turns inside it, the
  connectors grow and their arrowheads land, the other two nodes trace, a
  dot runs down each connector, and the sketch fades to start over. Each
  card starts at a point in the loop derived from its document id, so a
  loading grid ripples rather than pulsing in step. Under reduced motion
  it is the finished sketch, still.
- Loader to snapshot is a **crossfade**, never a cut: the image stays
  hidden until the browser has decoded it, then fades and settles in
  (`duration-long`) while the loader fades out, and the box eases into the
  document's background colour. A snapshot already cached when the
  thumbnail mounts paints at once, with no loader. The box never changes
  size.
- **An empty document is never asked for.** Every document list carries
  `empty` per document (`DocumentSummary`, `SharedWithItem`): true when its
  first tab has nothing to draw (no element: `drawnCount` in
  `@livedocuments/document`), or it has no tab. Such a row shows the still,
  dashed sketch at once, captioned "Nothing drawn yet" where there is room,
  and makes no request, so an Explorer of new or blank documents fires no
  404s. The list knows without reading any tab body: each tab row keeps its
  drawn count (`tabs.element_count`: its elements), and a list reads the first tab's
  count (a tab-scoped share reads its own tab's). Every tab write binds the
  count in the same statement, from the tab the api already holds parsed;
  a copy carries its source's, so the column is `NOT NULL` and no count is
  ever unknown. The editor's own row follows its saves:
  after an autosave it says `empty` from the first tab when that tab is
  loaded, and keeps what the list said when it is not.
- **The count is written with the body, never by a trigger.** Nothing
  fills a count later: there is no tab from before the column to fill.
- **Why no trigger** (measured with SQLite, D1's engine, sync off to
  isolate the work itself):

  | Tab body | Save, no count | Save, bound count | Save, trigger re-parse |
  | -------- | -------------- | ----------------- | ---------------------- |
  | 10 KB    | 0.005 ms       | 0.005 ms          | 0.015 ms               |
  | 500 KB   | 0.09 ms        | 0.05-0.10 ms      | 0.9-3.1 ms             |
  | 2 MB     | 0.8-0.9 ms     | 0.6-0.7 ms        | 7.9-8.1 ms             |

  A trigger re-parses the body and rewrites the row a second time, about
  ten times the cost of a 2 MB autosave, on the hot path (one save about
  every 600 ms per active editor).

- Degrades gracefully otherwise: no R2 binding or no access → 404 → the row
  shows the still, dashed sketch, captioned "Nothing drawn yet" where there
  is room. The no-snapshot 404 (past the access gate)
  carries the same `private, max-age=86400` as the image, because it is
  version-keyed too; an access-denied 404 carries no cache header.

## Delivery path 2 — Live image share (public, share-code-scoped)

`GET /api/share/:code/image.svg` — this is [Live image share link](../013-workspace/live-image-share.md)'s endpoint.

- Public: the share code in the URL is the only credential, matching a
  share link's "anyone with the URL" semantics (an `<img>` can't carry
  an auth header). Resolves the code with the index, so revoking /
  expiring the link kills the image too.
- **Password-protected shares ([Share password](../013-workspace/share-password.md)) get no image**: an `<img>` can't
  supply the password, so serving one would bypass the gate. The route
  404s a gated document _before_ rendering.
- `Cache-Control: public, max-age=30, stale-while-revalidate=300` so an
  embed stays close to live without hammering the origin (the bytes come
  from R2; the worker only re-renders when the document was saved since).

## Delivery path 3: Share card (public, share-code-scoped)

`GET /api/share/:code/image.png`, the picture a pasted share link previews with
([Share-link previews](../013-workspace/share-link-previews.md)): the same drawing,
behind the same gate, fitted onto a 1200 x 630 PNG. The PNG is cached in R2 beside
the snapshots (`og/<documentId>`), stamped with its
own render time, and deleted with them.

### Share dialog

The shared Share dialog (`@liveworkspace/explorer`) gives each active pass, while no password is set, a
**Live image** menu to copy the URL, a Markdown `![](...)` snippet, or an HTML `<img>` snippet, beside its
Embed menu. livedocuments supplies the address (`liveImageUrl` in `apps/editor/lib/explorer-host.ts`).

The menu also carries a **tab picker** (a `<select>` header, shown only when the document has more than one tab
and the pass opens every tab) so the copied URL / snippet can target any tab, not just the first
([Live image share link](../013-workspace/live-image-share.md)'s `?tab=<id>`). Picking the first tab clears back
to the default (no `?tab=`, so the cached first-tab snapshot serves it); picking another appends `?tab=<id>` and
the endpoint renders that tab **on read, uncached** (see Scope). The choice applies to every pass while the dialog
is open.

### Where thumbnails appear

The shared Explorer draws a row's or card's preview through its host's `renderThumbnail`; livedocuments' draws
this snapshot, fetched with the viewer's own credentials (or, for a shared row, its share code), so it is
authorised exactly as the document itself is. A viewer without access gets a 404 and the row falls back to the
document icon.

## Scope (v1)

- **R2 cache is first-tab only.** The persisted snapshot
  (`thumb/<documentId>`, one per document, shared by the Explorer
  thumbnail and the default live image) always renders the **first**
  tab. The live image's `?tab=<id>` selector ([Live image share link](../013-workspace/live-image-share.md)) is honoured,
  but a non-default tab is rendered **on read and not
  written to that cache** — the single per-document key + freshness stamp
  has no room for a second tab, and per-tab embeds are niche. The
  endpoint's `max-age=30, stale-while-revalidate=300` keeps repeat views
  cheap without a persistent cache. So "first tab only" still describes
  the cached artifact and the Explorer thumbnail, just no longer the
  live image.
- **No PNG.** SVG only — vector, tiny, headless-renderable. A rasterised
  variant is out of scope.
- The List/Card toggle covers the main browse views and the team
  library; the "Shared With Me" page keeps its fixed layout (it already
  shows the thumbnail).

## Self-hosting

The whole feature is gated on the optional `IMAGES` R2 binding, which holds only snapshots and share
cards (uploaded images live in liveworkspace's media service, [Image element + per-owner gallery](../009-elements/images.md)):
with no bucket, both endpoints 404 and the Explorer row shows its icon. No new binding, no required SaaS.
