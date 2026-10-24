# Document previews

A document's picture (its Explorer thumbnail, the live image a share link embeds, the card a pasted link previews
with) is a liveworkspace platform capability ([Previews](../../../liveworkspace/docs/previews.md)): liveworkspace's
media service decides who may see it (the index's access rule), when it is stale (the index's `updatedAt`), stores it
and serves it, and draws the share card from it. livedocuments only **renders for the platform**: it draws a document
as SVG when the platform asks, and keeps no picture, bucket or route of its own.

## Why a picture, not element data

The document list (`GET /api/documents`, the index's list) ships no element data ([Per-tab storage](per-tab-storage.md))
so listing 100 documents stays cheap. A preview per row from element data would re-load exactly what the list avoids,
so previews are pre-rendered SVG. Because SVG is vector, the one drawing renders crisply as a 36px list thumbnail and
as a full-size embed.

## The export door

`GET /api/internal/items/:id/export?format=svg[&tab=<id>]`, served by `@liveworkspace/index-app`'s
`handleInternalItems` (routes/internal-items.ts) with liveworkspace's media key (`MEDIA_KEY`) or the index's
(`INDEX_KEY`); every other internal door takes the index's key only. The document's Durable Object answers it
(`exportImage`, document-room.ts), where the content is:

- `200 image/svg+xml` with `ETag: "<saved_at>"`: the first tab (or `tab`) drawn by `renderElementsToSvg`
  (`@livedocuments/document`, the DOM-free renderer the MCP worker uses). Icon elements draw their real glyph
  (`@livedocuments/icons/resolve`). Image elements draw their real picture: each upload the document
  [may serve](../009-elements/images.md#placement-grants) is read from the media service and inlined as a base64
  data URL through `embedTabImages` (`@livedocuments/api-schema`, shared with the MCP preview), in document order
  under a 3 MB total budget, so a tab of large photos can't produce a multi-megabyte drawing. An image past the
  budget, unknown to the media service, or not a recognised raster format keeps its placeholder box.
- `304` when `If-None-Match` names the current `saved_at`: the platform's copy is still the document's, at the cost
  of one row read and no drawing.
- `204` with the ETag: nothing to draw (an empty or unparseable tab, no tab).
- `404`: no such document, or no such tab in it.

Whether the asker may see the document, and which tab a link confines it to, is decided by the index before the
platform calls; the door draws what it is asked for. Nothing is written: no cache, no stamp. `saved_at` follows every
content write (editor, collaborators, MCP, API token), so the version covers every write path.

### Pages tabs

A first tab in Pages (pages: infographics, slides, articles)
draws as **its first page alone**, drawn as the page export draws it
(`renderPageToSvg`, [Pages](../007-editor/pages-mode.md) "Export"): the page's sheet and
background, an article page's estimated writing, and the elements reaching
onto it, cut at its edges, at the page's own size. Drawing the whole canvas
instead put every page side by side, which at preview size shrank to a
row of slivers nobody could recognise; a deck is recognised by its cover.
The same rule holds wherever this renderer serves a preview: the Explorer
thumbnail, the default live image, a `?tab=` live image of a Pages
tab. Only the first page's images are read for
it (its elements' images and its picture background), so a long deck of
photos costs one page's image reads.

Measured on the renderer alone (Node, warm): a 12-slide deck of 10 shapes
a slide drew in 1.33 ms as a 42 KB whole canvas and draws in 0.14 ms as a
4 KB first page; a worst case of 60 slides of 25 shapes plus a 30-page,
600-paragraph article drew in 6.5 ms at 528 KB and draws in 5.6 ms at
9 KB (the article's writing estimate dominates either way).

A document purged by the index has its previews dropped from the platform with it (`purgeDocumentPreviews`,
db/documents.ts, best effort: a preview the purge misses is unreachable, since every read asks the index).

## In the Explorer

The editor asks `/api/previews/items/<id>?v=<savedAt>` on its own origin (the router forwards it to liveworkspace),
through the authenticated client, with the viewer's token (or, for a shared row, its share code), and wraps the bytes
in a blob URL (a native `<img>` can't send auth headers). A 404 (nothing drawn, no access) shows the still, dashed
sketch, captioned "Nothing drawn yet" where there is room.

- The Explorer row fetches **lazily** (IntersectionObserver): only rows
  scrolled into view fetch, so a long list never fires dozens of
  requests / renders for rows the user never reaches.
- The editor app keeps settled thumbnails in a page-wide, least-recently-used
  cache of 200 entries keyed by viewer, document, version and share code
  (`lib/thumbnail-cache.ts`). A remount (a view switch, a folder, coming
  back to the Explorer) paints from it at once, and two thumbnails of one
  document share one request. The cache owns each blob URL and revokes it
  on eviction.
- While the preview is on its way the box shows the **loader**: the
  placeholder's three-node sketch drawing itself in the placeholder's own
  slate, so it never reads as a real preview. On a 5.4s loop the first
  node traces, then a small spinner appears and turns inside it, the
  connectors grow and their arrowheads land, the other two nodes trace, a
  dot runs down each connector, and the sketch fades to start over. Each
  card starts at a point in the loop derived from its document id, so a
  loading grid ripples rather than pulsing in step. Under reduced motion
  it is the finished sketch, still.
- Loader to preview is a **crossfade**, never a cut: the image stays
  hidden until the browser has decoded it, then fades and settles in
  (`duration-long`) while the loader fades out, and the box eases into the
  document's background colour. A preview already cached when the
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
- **Why no trigger** (measured with SQLite, the engine of the document's store, sync off to
  isolate the work itself):

  | Tab body | Save, no count | Save, bound count | Save, trigger re-parse |
  | -------- | -------------- | ----------------- | ---------------------- |
  | 10 KB    | 0.005 ms       | 0.005 ms          | 0.015 ms               |
  | 500 KB   | 0.09 ms        | 0.05-0.10 ms      | 0.9-3.1 ms             |
  | 2 MB     | 0.8-0.9 ms     | 0.6-0.7 ms        | 7.9-8.1 ms             |

  A trigger re-parses the body and rewrites the row a second time, about
  ten times the cost of a 2 MB autosave, on the hot path (one save about
  every 600 ms per active editor).

## Live image and share card

The live image (`/api/share/<code>/image.svg[?tab=<id>]`, [Live image share link](../013-workspace/live-image-share.md))
and the share card (`/api/share/<code>/image.png`, [Share-link previews](../013-workspace/share-link-previews.md)) are
the platform's, on this app's address through its router. They draw from the same door.

### Share dialog

The shared Share dialog (`@liveworkspace/explorer`) gives each active pass, while no password is set, a
**Live image** menu to copy the URL, a Markdown `![](...)` snippet, or an HTML `<img>` snippet, beside its
Embed menu. livedocuments supplies the address (`liveImageUrl` in `apps/editor/lib/explorer-host.ts`).

The menu also carries a **tab picker** (a `<select>` header, shown only when the document has more than one tab
and the pass opens every tab) so the copied URL / snippet can target any tab, not just the first
([Live image share link](../013-workspace/live-image-share.md)'s `?tab=<id>`). Picking the first tab clears back
to the default (no `?tab=`); picking another appends `?tab=<id>`. The choice applies to every pass while the dialog
is open.

## Self-hosting

livedocuments binds no bucket for previews. A deployment without liveworkspace's media service has none: the Explorer
row shows its sketch and a link previews as the brand card.
