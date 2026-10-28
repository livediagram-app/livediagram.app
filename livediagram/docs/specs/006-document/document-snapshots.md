# Document SVG snapshots

A document's picture, used three ways:

1. **Explorer thumbnails**: a small preview on each row of the Recent /
   folder lists so you can recognise a document without opening it.
2. **Live image share**: an `<img>`-able URL ([Live image share link](../013-workspace/live-image-share.md)) that embeds the
   diagram in a README / wiki / doc and stays up to date.
3. **Share card**: the picture a pasted share link previews with ([Share-link previews](../013-workspace/share-link-previews.md)).

**livediagram renders; liveworkspace stores and serves.** Previews are a liveworkspace platform feature, built
once for every app ([liveworkspace/docs/specs/006-media/previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md)): its media service
keeps every app's pictures in one bucket, decides when one is stale from the index's `updatedAt`, asks the index
who may see it, and serves the Explorer's preview, the live image and the share card. The only part that is
livediagram's is drawing a canvas, which happens where the canvas is.

## Why a pre-rendered picture

The document list endpoint (`GET /api/documents`) deliberately ships no
element data ([Per-tab storage](per-tab-storage.md)) so listing 100 documents stays cheap. Rendering a
preview per row from element data would re-load exactly what the list
avoids. So previews come from a **pre-rendered SVG**, not from element
data at list time.

Because SVG is vector, the same full-fidelity drawing renders crisply
as a 36px list thumbnail and as a full-size embed: there is no separate
"thumbnail size" to generate.

## Renders for the platform: the export door

`GET /api/internal/items/:id/export?format=svg[&tab=<tabId>][&code=<shareCode>][&appearance=light|dark]`, on the
index's key or the
media service's (`MEDIA_KEY`), answered by `@liveworkspace/index-app`'s internal door and the document's Durable
Object (`exportImage`):

- **200** the drawing (`image/svg+xml`), with an `ETag` naming the document's `saved_at`.
- **304** when `If-None-Match` names the current `saved_at`: nothing drawn.
- **204** nothing to draw (no tab, or an empty or unparseable one).
- **404** no such document, a tab it does not hold, or a Community post's code while the post is not open.

The drawing is the first tab, or `tab`, through `renderElementsToSvg` (`@livediagram/document`, the same DOM-free
renderer the MCP worker uses). Icon elements render their real glyph (line art + Technology brand tiles) via the
`@liveworkspace/icons/resolve` resolver; see [Technology icons](../010-palette/technology-icons.md) "Rendering". Image
elements render their real picture: the object reads each upload from the media service and inlines it as a base64
data URL through `embedTabImages` (`@livediagram/api-schema`, shared with the MCP preview,
[MCP server](../015-api/mcp-server.md) §5), in document order under a 3 MB total budget so a tab of large photos
can't produce a multi-megabyte picture. An image past the budget, unknown to the media service, not one the
document may serve, or not a recognised raster format keeps its placeholder box.

### In the viewer's half

A preview is the tab as the person looking at it would see it on opening it
([Light and dark halves](../011-theme/light-and-dark.md)): a Default tab is on the dark canvas in dark chrome and on
the light one in light chrome, whichever half the last save stored. Drawing what is stored made a new, imported or
untouched document preview in its author's half (or the light one), and only come right once someone in the
viewer's appearance opened and saved it.

- The Explorer asks with `&appearance=`, the viewer's resolved appearance, part of its page cache's key, so
  switching appearance asks for the other half and never shows the old one meanwhile. liveworkspace.app's Explorer
  asks the same way.
- The platform passes it to the door, stores each half on its own and refuses any other value
  ([Previews](../../../../liveworkspace/docs/specs/006-media/previews.md)).
- The door draws the tab through `tabAsSeen` (`@livediagram/document`, the one the editor's exports use): the
  backdrop in that half of its theme (a colour someone picked stays), every theme colour mapped to the same slot in
  that half, stock colours for that canvas, and labels re-inked where the half sank them.
- With no `appearance` (the live image, the share card) it draws what is stored, as before.

When `code` is the document's open Community post's code, the drawing is made from the redacted tab
([Community](../025-community/community.md) "Viewing a post's document"), so comment threads and the people on them
never reach a public picture.

The object stores nothing and stamps nothing about pictures: whether a drawing is current, and who may see it, are
the platform's. It is **render-on-read**, never render-on-save:

- **Covers every write path.** Every tab write (editor, collaborators, MCP server, API token) moves the index's
  `updatedAt` through the document's outbox, so the platform's copy goes stale uniformly.
- **No wasted renders.** A document is drawn only when it has been edited _and_ then looked at. A save costs no
  render at all.
- **Cheap steady state.** Until the next save the platform serves its stored copy; asked again, the door answers
  304 without drawing.

Purging a document (routes/internal-items.ts) asks the media service to drop its previews
(`DELETE /api/media/app/previews/:itemId`), best effort.

## Where a picture is asked for

- **Explorer thumbnail**: `GET /api/previews/items/:id?v=<version>&appearance=<viewer's>` on this app's own address, which the router
  forwards to liveworkspace's previews (the editor's Explorer and Google Drive sync alike).
  The editor fetches it through the authenticated client (a native `<img>` can't send auth headers) and wraps the
  bytes in a blob URL; `?v=` only keys the browser's cache. Who may see it is the index's rule for the document
  itself: the owner, a team member, or a share-code visitor (a tab-scoped one gets their tab).
- **Live image**: `GET /api/share/:code/image.svg`, forwarded by the router the same way.
- **Share card**: `GET /api/share/:code/image.png`, likewise.

## The Explorer's thumbnail

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
  `empty` per document (`DocumentSummary`, and the index's Shared With You rows): true when its
  first tab has nothing to draw (no element and no form: `drawnCount` in
  `@livediagram/document`), or it has no tab. Such a row shows the still,
  dashed sketch at once, captioned "Nothing drawn yet" where there is room,
  and makes no request, so an Explorer of new or blank documents fires no
  404s. The list knows without reading any tab body: each tab row keeps its
  drawn count (`tabs.element_count`: its elements, plus one for a form), and a list reads the first tab's
  count (a tab-scoped share reads its own tab's). Every tab write binds the
  count in the same statement, from the tab the api already holds parsed;
  a copy carries its source's. A count not known (`null`) reads as not
  empty, so the row asks as before. The editor's own row follows its saves:
  after an autosave it says `empty` from the first tab when that tab is
  loaded, and keeps what the list said when it is not.
- **The count is filled lazily, never by a bulk backfill.** The column
  starts unknown. A tab stored before it starts unknown and gets its
  count from its next write, or from the export door: having parsed the
  body to draw it, the object stamps a still-unknown count (in the
  request's `waitUntil`, best effort, never overwriting a known count). An
  old empty document is therefore asked for at most once.
- **Why no trigger and no backfill** (measured with SQLite, the engine a Durable Object runs,
  sync off to isolate the work itself):

  | Tab body | Save, no count | Save, bound count | Save, trigger re-parse |
  | -------- | -------------- | ----------------- | ---------------------- |
  | 10 KB    | 0.005 ms       | 0.005 ms          | 0.015 ms               |
  | 500 KB   | 0.09 ms        | 0.05-0.10 ms      | 0.9-3.1 ms             |
  | 2 MB     | 0.8-0.9 ms     | 0.6-0.7 ms        | 7.9-8.1 ms             |

  A trigger re-parses the body and rewrites the row a second time, about
  ten times the cost of a 2 MB autosave, on the hot path (one save about
  every 600 ms per active editor). A one-statement backfill parses at about
  480 MB/s locally (250 tabs of 2 MB in 1.0 s), so it was ruled out
  when every tab shared one 10 GB D1 database (over 20 s against D1's 30 s
  query limit); each document now keeps its own tabs, so there is still
  nothing to backfill in bulk. Adding the column alone takes
  under 5 ms on the same 500 MB table.

- Degrades gracefully otherwise: nothing drawn, no access or the service
  down → the row shows the still, dashed sketch, captioned "Nothing drawn
  yet" where there is room.

### Share dialog

A per-active-link **Live image** control (non-password links only) opens
a menu to copy the URL, a Markdown `![](...)` snippet, or an HTML
`<img>` snippet. Sits beside the existing Copy / Embed actions.

The menu also carries a **tab picker** (a `<select>` header, shown only
when the document has more than one tab) so the copied URL / snippet can
target any tab, not just the first ([Live image share link](../013-workspace/live-image-share.md)'s `?tab=<id>`). Picking the
first tab clears back to the default (no `?tab=`); picking another appends `?tab=<id>`, which the
platform stores as its own picture. The
choice is document-wide, applying to every share link's image.

### Where thumbnails appear

Every Explorer surface the editor draws (its in-editor panel and the workspace frame) is the shared Explorer,
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md) (liveworkspace/docs/specs/004-index/one-explorer.md); its list,
card and details views, its phone layout, its view toggle and its actions menu are the platform's. livediagram
supplies the picture: `renderDocumentThumbnail` (`apps/editor/lib/explorer-thumbnail.tsx`) draws each box with the
shared `DocumentThumbnail` component (`components/panels/DocumentThumbnail.tsx`), which also backs the tab-organise
dialogs and the Community card preview. Every app's items have their previews at the same address
(`/api/previews/items/<id>`, liveworkspace's previews service through this site's router), so under All another app's
item shows its own picture too. The fetch carries the page's Bearer plus, for a shared item, its share code, so it is
authorised the same way the document itself is; a stranger gets a 404 and the box falls back to its icon.

The snapshot paints its letterbox in the document's own background colour (parsed client-side from the SVG's
background rect) instead of a generic slate, so a card reads as a continuation of the document rather than a framed
cut-out. The client also strips the snapshot's fixed `width`/`height` (keeping the `viewBox`) before handing it to the
`<img>`, so the vector scales to the box crisply rather than rasterising at its intrinsic size and upscaling.

## Scope

- **SVG from the app, PNG from the platform.** livediagram draws SVG only; the share card's PNG is liveworkspace's
  ([liveworkspace/docs/specs/006-media/previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md)).
- The List/Card toggle covers the main browse views and the team
  library; the "Shared With Me" page keeps its fixed layout (it already
  shows the thumbnail).

## Without optional services

Pictures come from liveworkspace's media service. A deploy without `MEDIA_KEY` has no image service and no export
door key from it: the Explorer row shows its sketch and a link previews with the brand card. livediagram has no
bucket of its own: the image bytes uploaded before images moved to the media service are still in the previous
Cloudflare account's `livediagram-images` bucket, until they are migrated.
