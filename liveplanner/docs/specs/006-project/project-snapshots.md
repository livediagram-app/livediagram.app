# Project previews

A project's picture, used three ways: the **Explorer thumbnail** on each row, so a project is recognised without
opening it; the **live image** a share link embeds in a README or wiki
([Live image share link](../013-workspace/live-image-share.md)); and the **share card** a pasted link previews with
([Share-link previews](../013-workspace/share-link-previews.md)).

All three are liveworkspace's previews ([previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md)): one service, built once for every app, stores them,
decides when they are stale, checks who may see them against the index and serves them. liveplanner only **renders
for the platform**: it draws a project when the service asks, through its export door, and keeps nothing.

## What liveplanner draws

The export door (`GET /api/internal/items/:id/export?format=svg[&tab=<id>]`, [previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md) "The export door")
is answered by the plan's Durable Object, where the content is (`plan-room.ts` `exportImage`):

- The **first tab**, or the tab asked for, drawn with `renderElementsToSvg` (`@liveplanner/project`, the same DOM-free
  renderer the MCP worker uses). A Form tab draws its form as respondents see it on its tab's look (`formArt` from
  `@liveplanner/plan-art`, since a form is not an element). A Board draws its project's cards, a Sheet its window of
  cells, a Dashboard its page laid out with its metrics and charts counted from the cards. Icon elements render their
  real glyph via `@liveworkspace/icons/resolve` ([Technology icons](../010-palette/technology-icons.md) "Rendering").
  The canvas takes no image uploads (a card's Image field is the one picture liveplanner keeps), so an image placeholder left by a diagram template draws as its empty box.
- The **version** is the plan's `saved_at`, which every tab, card and Sheet write that lands moves, whoever made it
  (editor, collaborators, MCP server, API token). The service sends the version it holds as `If-None-Match`; an
  unchanged plan answers `304` without drawing.
- **Nothing to draw** (no tab, an empty or unparseable first tab) answers `204`, and the service remembers it, so the
  row shows its sketch. A tab the plan does not hold, or a plan never started, is `404`.
- It is drawn **on request, never on save**: a project nobody looks at never costs a drawing.

Who may see a picture (the owner, a team member, a link visitor, a tab-scoped link's own tab only, never through a
password-protected link) is the index's rule, checked by the service on every read. The door itself answers only the
index's key or the media service's (`MEDIA_KEY`). When the index purges a plan, the api asks the service to drop its
previews (`db/projects.ts` `purgePlanPreviews`).

## Why a stored picture, not element data

The project lists deliberately ship no element data ([Per-tab storage](per-tab-storage.md)) so listing 100 projects
stays cheap; drawing a preview per row from element data would re-load exactly what the list avoids. Because SVG is
vector, one drawing serves the 36px thumbnail and the full-size embed alike.

## The Explorer thumbnail

The editor asks `GET /api/previews/items/:id?v=<savedAt>` through the authenticated client (its router forwards it to
the service) and wraps the bytes in a blob URL; `v` is only the browser's cache key.

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
  builder edit), which stamps it afresh; nothing reads the bodies to fill it.
- **The count is filled lazily, never by a bulk backfill.** The schema
  only adds the column. A tab stored before it starts unknown and gets its
  count from its next write, or from a drawing: having parsed the
  body to draw it, the export door stamps a still-unknown count (in the
  object's `waitUntil`, best effort, never overwriting a known count). An
  old empty project is therefore asked for at most once.
- **Why no trigger and no backfill** (measured with SQLite,
  sync off to isolate the work itself):

  | Tab body | Save, no count | Save, bound count | Save, trigger re-parse |
  | -------- | -------------- | ----------------- | ---------------------- |
  | 10 KB    | 0.005 ms       | 0.005 ms          | 0.015 ms               |
  | 500 KB   | 0.09 ms        | 0.05-0.10 ms      | 0.9-3.1 ms             |
  | 2 MB     | 0.8-0.9 ms     | 0.6-0.7 ms        | 7.9-8.1 ms             |

  A trigger re-parses the body and rewrites the row a second time, about
  ten times the cost of a 2 MB autosave, on the hot path (one save about
  every 600 ms per active editor). A one-statement backfill parses at about
  480 MB/s locally (250 tabs of 2 MB in 1.0 s), so a backfill would wake every plan's object to parse its
  whole content for a count the next write fills anyway. Adding the column alone takes
  under 5 ms on the same 500 MB table.

- Degrades gracefully otherwise: nothing drawn, no access or the service
  down → the row shows the still, dashed sketch, captioned "Nothing drawn
  yet" where there is room.
