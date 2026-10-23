# Project SVG snapshots

A single cached SVG snapshot per project, used two ways:

1. **Explorer thumbnails** — a small preview on each row of the Recent /
   folder lists so you can recognise a project without opening it.
2. **Live image share** — an `<img>`-able URL ([Live image share link](../013-workspace/live-image-share.md)) that embeds the
   diagram in a README / wiki / doc and stays up to date.

Both render the same artifact through the same DOM-free renderer; they
differ only in how they're authorised and cached.

## Why one artifact, not two

The project list endpoint (`GET /api/projects`) deliberately ships no
element data ([Per-tab storage](per-tab-storage.md)) so listing 100 projects stays cheap. Rendering a
preview per row from element data would re-load exactly what the list
avoids. So previews come from a **pre-rendered SVG**, not from element
data at list time.

Because SVG is vector, the same full-fidelity snapshot renders crisply
as a 36px list thumbnail and as a full-size embed — there is no separate
"thumbnail size" to generate. One stored artifact serves both surfaces.

## Render-on-read, cached in R2

The snapshot bytes live in R2 (the `SNAPSHOTS` bucket, `liveplanner-snapshots`, key
`thumb/<projectId>`); a `projects.thumb_rendered_at` column records when
they were last rendered.

On a read of either delivery path:

- **Fresh** (`thumb_rendered_at >= saved_at`): stream the stored R2
  bytes. No render, no element load.
- **Stale** (or never rendered, or the object is missing): render the
  first tab (a Form tab as its form, the picture respondents see on its
  tab's look: `formArt` from `@liveplanner/plan-art`, as the MCP preview
  draws it, since a form is not an element) with `renderElementsToSvg` (`@liveplanner/project`, the same
  DOM-free renderer the MCP worker uses), write it to R2, stamp
  `thumb_rendered_at`, and return it. Icon elements render their real
  glyph (line art + Technology brand tiles) via the
  `@liveplanner/icons/resolve` resolver the worker passes in — see
  [Technology icons](../010-palette/technology-icons.md) "Rendering". liveplanner takes no image uploads, so an image
  placeholder left by a diagram template draws as its empty placeholder box
  and a snapshot reads nothing but the project's own rows.

This is **render-on-read**, not render-on-save, on purpose:

- **Covers every write path.** `saved_at` is bumped by every tab write
  (editor, collaborators, MCP server, API token), and by every card write
  and Sheet write that lands (a board draws its cards and a Sheet its
  cells, which live in their own tables: in the statement each already
  runs on the project row, never moving the time back), so the snapshot
  invalidates uniformly regardless of who edited — no client upload to
  keep in sync.
- **No wasted renders.** A project is only rendered when it has been
  edited _and_ subsequently viewed (in a list or an embed). A project
  nobody opens never costs a render.
- **Cheap steady state.** Once cached, reads are a straight R2 stream
  until the next save.

An empty / unparseable first tab yields no snapshot (the endpoints 404
and the row shows its generic icon). Deleting a project clears its R2
object. The freshness column needs no backfill: the first read of each
project renders lazily.

## Delivery path 1 — Explorer thumbnail (owner-authed)

`GET /api/projects/:id/thumbnail?v=<savedAt>`

- Read-gated exactly like `GET /api/projects/:id`: the owner, a joined
  team member, or a valid share-code visitor.
- A native `<img>` can't send auth headers, so the editor app fetches this
  through the authenticated client and wraps the bytes in a blob URL. `?v=<savedAt>` busts
  the browser cache when the project changes; the worker ignores it.
  `Cache-Control: private, max-age=86400`.
- One D1 read gates it: `getProjectThumbMeta` returns the owner, team,
  name, `saved_at` and `thumb_rendered_at` in one query, so a fresh
  snapshot costs that query, the access gate and the R2 read. The full
  project (participant and tab summaries) is never loaded for a preview.
- A stale snapshot is returned as soon as it is rendered; the R2 write
  and the freshness stamp run in the request's `waitUntil`.
- The Explorer row fetches **lazily** (IntersectionObserver): only rows
  scrolled into view fetch, so a long list never fires dozens of
  requests / renders for rows the user never reaches.
- The editor app keeps settled thumbnails in a page-wide, least-recently-used
  cache of 200 entries keyed by viewer, project, version and share code
  (`lib/thumbnail-cache.ts`). A remount (a view switch, a folder, coming
  back to the Explorer) paints from it at once, and two thumbnails of one
  project share one request. The cache owns each blob URL and revokes it
  on eviction.
- While the snapshot is on its way the box shows the **loader**: the
  placeholder's three-node sketch drawing itself in the placeholder's own
  slate, so it never reads as a real preview. On a 5.4s loop the first
  node traces, then a small spinner appears and turns inside it, the
  connectors grow and their arrowheads land, the other two nodes trace, a
  dot runs down each connector, and the sketch fades to start over. Each
  card starts at a point in the loop derived from its project id, so a
  loading grid ripples rather than pulsing in step. Under reduced motion
  it is the finished sketch, still.
- Loader to snapshot is a **crossfade**, never a cut: the image stays
  hidden until the browser has decoded it, then fades and settles in
  (`duration-long`) while the loader fades out, and the box eases into the
  project's background colour. A snapshot already cached when the
  thumbnail mounts paints at once, with no loader. The box never changes
  size.
- **An empty project is never asked for.** Every project list carries
  `empty` per project (`ProjectSummary`, `SharedWithItem`): true when its
  first tab has nothing to draw (no element and no form: `drawnCount` in
  `@liveplanner/project`), or it has no tab. Such a row shows the still,
  dashed sketch at once, captioned "Nothing drawn yet" where there is room,
  and makes no request, so an Explorer of new or blank projects fires no
  404s. The list knows without reading any tab body: each tab row keeps its
  drawn count (`tabs.element_count`: its elements, plus one for a form), and a list reads the first tab's
  count (a tab-scoped share reads its own tab's). Every tab write binds the
  count in the same statement, from the tab the api already holds parsed;
  a copy carries its source's. A count not known (`null`) reads as not
  empty, so the row asks as before. The editor's own row follows its saves:
  after an autosave it says `empty` from the first tab when that tab is
  loaded, and keeps what the list said when it is not. A Form tab stored
  before its form counted keeps a count of 0 until its next write (any
  builder edit), which stamps it afresh; no migration reads the bodies.
- **The count is filled lazily, never by a bulk backfill.** The migration
  only adds the column. A tab stored before it starts unknown and gets its
  count from its next write, or from the thumbnail route: having parsed the
  body to render it, the route stamps a still-unknown count (in the
  request's `waitUntil`, best effort, never overwriting a known count). An
  old empty project is therefore asked for at most once. A deploy without
  the R2 binding renders no snapshot, so there its counts fill from writes only.
- **Why no trigger and no backfill** (measured with SQLite, D1's engine,
  sync off to isolate the work itself):

  | Tab body | Save, no count | Save, bound count | Save, trigger re-parse |
  | -------- | -------------- | ----------------- | ---------------------- |
  | 10 KB    | 0.005 ms       | 0.005 ms          | 0.015 ms               |
  | 500 KB   | 0.09 ms        | 0.05-0.10 ms      | 0.9-3.1 ms             |
  | 2 MB     | 0.8-0.9 ms     | 0.6-0.7 ms        | 7.9-8.1 ms             |

  A trigger re-parses the body and rewrites the row a second time, about
  ten times the cost of a 2 MB autosave, on the hot path (one save about
  every 600 ms per active editor). A one-statement backfill parses at about
  480 MB/s locally (250 tabs of 2 MB in 1.0 s), so a full 10 GB D1
  database needs over 20 s even before D1's replicated writes, against
  D1's 30 s query limit and its guidance that a statement touching
  hundreds of MB exceeds execution limits. Adding the column alone takes
  under 5 ms on the same 500 MB table.- Degrades gracefully otherwise: no R2 binding or no access → 404 → the row
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
  404s a gated project _before_ rendering.
- `Cache-Control: public, max-age=30, stale-while-revalidate=300` so an
  embed stays close to live without hammering the origin (the bytes come
  from R2; the worker only re-renders when the project was saved since).

## Delivery path 3: Share card (public, share-code-scoped)

`GET /api/share/:code/image.png`, the picture a pasted share link previews with
([Share-link previews](../013-workspace/share-link-previews.md)): the same drawing,
behind the same gate, fitted onto a 1200 x 630 PNG. The PNG is cached in R2 beside
the snapshots (`og/<projectId>`), stamped with its
own render time, and deleted with them.

### Share dialog

The shared Share dialog from `@liveworkspace/explorer` offers no live-image control: it makes, lists
and turns off links only. The address is built by hand from a link's code,
`/api/share/<code>/image.svg`, with `?tab=<id>` to pick a tab other than the first. Picking the
first tab, or leaving `?tab=` off, serves the cached snapshot.

## Scope (v1)

- **R2 cache is first-tab only.** The persisted snapshot
  (`thumb/<projectId>`, one per project, shared by the Explorer
  thumbnail and the default live image) always renders the **first**
  tab. The live image's `?tab=<id>` selector ([Live image share link](../013-workspace/live-image-share.md)) is honoured,
  but a non-default tab is rendered **on read and not
  written to that cache** — the single per-project key + freshness stamp
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

## Without image storage

The whole feature is gated on the optional `SNAPSHOTS` R2 binding (it caches
nothing but snapshots and share cards): with no bucket, both endpoints 404 and
the Explorer row shows its icon. No new binding, no required SaaS.
