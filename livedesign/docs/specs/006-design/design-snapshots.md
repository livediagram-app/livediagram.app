# Design SVG snapshots

A design's preview is **liveworkspace's**, built once for every app
([Previews](../../../../liveworkspace/docs/previews.md)): the media service stores it, decides when it is stale,
checks who may see it against the index, and serves it. livedesign only **renders for the platform**: its export
door draws a design when the service asks. The same picture serves:

1. **Explorer thumbnails**: a small preview on each row and card, so you can recognise a design without opening it.
2. **Live image share**: an `<img>`-able URL ([Live image share link](../013-workspace/live-image-share.md)) that
   embeds the design in a README, wiki or doc and stays up to date.
3. **Share cards**: the PNG a pasted share link previews with
   ([Share-link previews](../013-workspace/share-link-previews.md)), drawn by the service from the same SVG.

## Why a pre-rendered picture

The design list ships no element data ([Per-tab storage](per-tab-storage.md)) so listing 100 designs stays cheap.
Rendering a preview per row from element data would re-load exactly what the list avoids, so previews come from a
**pre-rendered SVG**. Because SVG is vector, the same picture renders crisply as a list thumbnail and as a
full-size embed: there is no separate thumbnail size.

## What livedesign draws: the export door

`GET /api/internal/items/:id/export?format=svg[&tab=<id>][&code=<code>]`, served by
`@liveworkspace/index-app`'s internal doors (`routes/internal-items.ts`) with the media service's key (`MEDIA_KEY`,
the same secret the image gallery uses) or the index's. The design's Durable Object answers it
(`design-room.ts` `exportImage`), where the content is:

- **Not found** (404) for a design this object never held, or a `tab` it does not hold.
- **Unchanged** (304) when the caller's `If-None-Match` names the design's last save (`saved_at`): a revalidation
  costs one row read and no render.
- **Empty** (204) when the tab has nothing to draw (no tab, an empty or unparseable one).
- Otherwise the SVG (200), its `ETag` the last save. Nothing is stored: a design nobody looks at never costs a
  render, and a save costs no render either.

Who may see the picture (the owner, a team member, a share link, a tab-scoped link's own tab, a share password) is
the index's to say, asked by the service before it ever calls the door; the door trusts its caller's key.

The drawing is the first tab, or the one asked for, with `renderElementsToSvg` (`@livedesign/design`, the same
DOM-free renderer the MCP worker uses). Icon elements render their real glyph via `@liveworkspace/icons/resolve`.
Image elements render their real picture: the design reads each upload from the media service and inlines it as a
base64 data URL through `embedTabImages` (`@livedesign/api-schema`, shared with the MCP preview,
[MCP server](../015-api/mcp-server.md) §5), in design order under a 3 MB total budget so a tab of large photos can't
produce a multi-megabyte picture. An image past the budget, missing, not servable by the design (Placement grants,
[Image element + per-owner gallery](../009-elements/images.md)) or not a recognised raster keeps its placeholder box.

### Pages tabs

A tab in Pages (pages: logos, wireframes, photos) draws as **its first page alone**, drawn as the page export draws
it (`renderPageToSvg`, [Pages](../007-editor/pages-mode.md) "Export"): the page's sheet and background, and the
elements reaching onto it, cut at its edges, at the page's own size. Drawing the whole canvas instead put every page
side by side, which at thumbnail size shrank to a row of slivers nobody could recognise; a design is recognised by
its first page. The same rule holds for every tab asked for. Only the first page's images are read for it (its
elements' images and its picture background), and a photo page draws its stored preview
([Photo store](../031-photo/photo-store.md) "Previews"), so a long run of photo pages costs one page's reads.

Measured on the renderer alone (Node, warm): a 12-page tab of 10 shapes a page drew in 1.33 ms as a 42 KB whole
canvas and draws in 0.14 ms as a 4 KB first page.

When the index purges a design, the api asks the media service to drop its previews (`deletePreviews`, best effort:
a preview the purge misses is unreachable, since every read asks the index).

## The Explorer thumbnail

The live app reads `GET /api/previews/items/:id?v=<savedAt>` on its own origin, which the router forwards to the
media service; `?v=` only keys the browser's cache.

- A native `<img>` can't send auth headers, so the live app fetches it through the authenticated client and wraps
  the bytes in a blob URL (the same pattern image elements use). A miss is a 404 the row turns into its sketch.
- The Explorer row fetches **lazily** (IntersectionObserver): only rows scrolled into view fetch, so a long list
  never fires dozens of requests for rows the user never reaches.
- The live app keeps settled thumbnails in a page-wide, least-recently-used cache of 200 entries keyed by viewer,
  design, version and share code (`lib/thumbnail-cache.ts`). A remount (a view switch, a folder, coming back to the
  Explorer) paints from it at once, and two thumbnails of one design share one request. The cache owns each blob
  URL and revokes it on eviction.
- While the picture is on its way the box shows the **loader**: the placeholder's three-node sketch drawing itself
  in the placeholder's own slate, so it never reads as a real preview. On a 5.4s loop the first node traces, then a
  small spinner appears and turns inside it, the connectors grow and their arrowheads land, the other two nodes
  trace, a dot runs down each connector, and the sketch fades to start over. Each card starts at a point in the
  loop derived from its design id, so a loading grid ripples rather than pulsing in step. Under reduced motion it
  is the finished sketch, still.
- Loader to picture is a **crossfade**, never a cut: the image stays hidden until the browser has decoded it, then
  fades and settles in (`duration-long`) while the loader fades out, and the box eases into the design's background
  colour. A picture already cached when the thumbnail mounts paints at once, with no loader. The box never changes
  size.
- **An empty design is never asked for.** Every design list carries `empty` per design: true when its first tab
  has nothing to draw (no element: `drawnCount` in `@livedesign/design`), or it has no tab. Such a row shows the
  still, dashed sketch at once, captioned "Nothing drawn yet" where there is room, and makes no request. The list
  knows without reading any tab body: each tab row keeps its drawn count (`tabs.element_count`), and the design's
  summary to the index carries it. Every tab write binds the count in the same statement, from the tab the api
  already holds parsed; a copy carries its source's. A count not known (`null`) reads as not empty, so the row asks.
- **The count is filled lazily, never by a bulk backfill.** A tab stored before the count existed gets it from its
  next write, or from the export door: having parsed the body to draw it, the door stamps a still-unknown count (in
  the request's `waitUntil`, best effort, never overwriting a known count). An old empty design is therefore asked
  for at most once.
- **Why no trigger and no backfill** (measured with SQLite, sync off to isolate the work itself):

  | Tab body | Save, no count | Save, bound count | Save, trigger re-parse |
  | -------- | -------------- | ----------------- | ---------------------- |
  | 10 KB    | 0.005 ms       | 0.005 ms          | 0.015 ms               |
  | 500 KB   | 0.09 ms        | 0.05-0.10 ms      | 0.9-3.1 ms             |
  | 2 MB     | 0.8-0.9 ms     | 0.6-0.7 ms        | 7.9-8.1 ms             |

  A trigger re-parses the body and rewrites the row a second time, about ten times the cost of a 2 MB autosave, on
  the hot path (one save about every 600 ms per active editor). A one-statement backfill parses at about 480 MB/s
  locally (250 tabs of 2 MB in 1.0 s), far past a request's limits on a large store.

- Degrades gracefully otherwise: no access, nothing drawn or the service down → 404 or 503 → the row shows the
  still, dashed sketch, captioned "Nothing drawn yet" where there is room.

## The live image and the share card

`GET /api/share/:code/image.svg` ([Live image share link](../013-workspace/live-image-share.md)) and
`GET /api/share/:code/image.png` ([Share-link previews](../013-workspace/share-link-previews.md)) are the media
service's too, forwarded by the router. The share code is the only credential; a revoked, expired or
password-protected link has no image. Their caching is the service's
([Previews](../../../../liveworkspace/docs/previews.md)).

### Share dialog

A per-active-link **Live image** control (non-password links only) opens
a menu to copy the URL, a Markdown `![](...)` snippet, or an HTML
`<img>` snippet. Sits beside the existing Copy / Embed actions.

The menu also carries a **tab picker** (a `<select>` header, shown only
when the design has more than one tab) so the copied URL / snippet can
target any tab, not just the first ([Live image share link](../013-workspace/live-image-share.md)'s `?tab=<id>`). Picking the
first tab clears back to the default (no `?tab=`); picking another appends `?tab=<id>`. The
choice is design-wide, applying to every share link's image.

### Where thumbnails appear

The thumbnail shows on **every** Explorer surface that lists a design:
the full-page `/explorer` rows (Recent / My Work / folders / Search results /
This Browser), the team library page, the "Shared With Me" list, and the
in-editor Explorer. A single shared `DesignThumbnail`
component (`components/panels/DesignThumbnail.tsx`) backs them all, fed
the **viewer's** owner id (never the design's) plus, for a shared row,
its share code — so the authed fetch authorises the same way the design
itself does (owner / team membership / share code). A stranger with none
of those gets a 404 and the row falls back to its icon.

### List / card view

The browse views (Recent / My Work / folders / Search results / This Browser)
have a **List / Card / Details** toggle in the header's actions, left of Help and
Create, which always sit further right (device-local preference,
`livedesign:explorer-view`). **Card is the default**:
a design is pictures, and a wall of names in one typeface makes you read
every line to find the one you would have recognised on sight. Somebody who
prefers the density of rows knows where the toggle is; somebody opening the
Explorer for the first time does not know there is anything to look for, so
the unchosen view is the one that shows them their work. Card view renders the
same folders + designs as a responsive grid of cards (1 / 2 / 3 columns
by width), each with a large snapshot and every column the list shows
(name, owner, visibility badge, updated time, actions menu). List and
card share one badge module (`design-badges.tsx`) and one actions-menu
module (`design-row-shared.tsx`) so they can't drift. A real switch (not a click on the already-active side)
emits `UI / Toggled / ExplorerViewList | ExplorerViewCard | ExplorerViewDetails` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). The Details view, a sortable table with a snapshot preview on a resting hover, is [Explorer Details view](../013-workspace/explorer-details-view.md).

**On a phone** (the `phone:` breakpoint: narrower than `sm`, or a touch screen under 500px tall)
List and Details are not offered: they are for larger screens. The browse views and the team
library always show cards, and the toggle is hidden so it takes no room in the header. The saved
choice is left alone, so the same device shows it again once the window is wide enough.

**The actions menu** (the ⋯ on a row or card, and on a Timeline design
card, [Timeline](../013-workspace/timeline.md) §2.8) has one shape wherever it opens: a **header row**
naming the design with its visibility badge, because a menu opens away
from its trigger and on a grid of near-identical cards the menu itself
has to say which one it belongs to; then **Open on its own, under a
separator**, unless the row is the design already open in this editor
(the verb people reach for first sits first, and the current design's
row doesn't offer a no-op); then **one full-width row per verb, icon on
the left** (Rename, Duplicate, Change Folder, Favourite,
History, Hide from Recent, Open Team, Take Offline / Sync); then
**Delete last, under a separator** (styled as every other row: a delete is never red). It was an icon-over-
label tile grid, two columns and then three: eight verbs in a grid read
in two directions with labels wrapping under their icons, and a list of
verbs scans down in one. The rows are `MenuActionRow` in its `plain`
(sentence-case, 13px) form rather than the uppercase category-header
form the note menu uses, because here the rows are the whole menu. A
shared-with-you design's menu (Open, Dismiss) is the same shape.
**The editor's Explorer rows use this same menu** (both the
personal rows and a team library's rows). The panel used to carry its
own toolbar-and-accordion menu with a Share section; sharing is the
editor header's job, and a menu that looked like no other in the app was
one people had to learn twice. A row that can't offer a verb (the panel
has no star or history) simply doesn't pass its handler, and the menu
leaves that tile out.

The snapshot preview paints its letterbox in the design's own
background colour (parsed client-side from the SVG's background rect)
instead of a generic slate, so a card reads as a continuation of the
design rather than a framed cut-out. The client also strips the
snapshot's fixed `width`/`height` (keeping the `viewBox`) before handing
it to the `<img>`, so the vector scales to the card's size crisply
rather than rasterising at its intrinsic size and upscaling.

The same toggle is on the **team library** ([Team shared designs](../013-workspace/team-shared-designs.md)) — its shared
designs + folders reuse the same `CardView`, sharing the
`livedesign:explorer-view` preference so a card-view user gets cards
there too. Team cards hide the visibility badge (every card is a team
design, so a per-card badge is noise — the team list omits it as well).

## Scope (v1)

- The Explorer thumbnail and the default live image are the **first** tab; the live image's `?tab=<id>`
  selector ([Live image share link](../013-workspace/live-image-share.md)) draws any tab.
- The List/Card toggle covers the main browse views and the team library; the "Shared With Me" page keeps its
  fixed layout (it already shows the thumbnail).

## Without image storage

Previews need liveworkspace's media service (`MEDIA_KEY`), exactly like the image gallery
([Image element + per-owner gallery](../009-elements/images.md)): without it the export door is closed, every
preview 404s, and the Explorer row shows its sketch. livedesign keeps no bucket for previews.
