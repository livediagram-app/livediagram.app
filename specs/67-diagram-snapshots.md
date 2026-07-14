# 67 — Diagram SVG snapshots

A single cached SVG snapshot per diagram, used two ways:

1. **Explorer thumbnails** — a small preview on each row of the Recent /
   folder lists so you can recognise a diagram without opening it.
2. **Live image share** — an `<img>`-able URL (spec/54) that embeds the
   diagram in a README / wiki / doc and stays up to date.

Both render the same artifact through the same DOM-free renderer; they
differ only in how they're authorised and cached.

## Why one artifact, not two

The diagram list endpoint (`GET /api/diagrams`) deliberately ships no
element data (spec/13) so listing 100 diagrams stays cheap. Rendering a
preview per row from element data would re-load exactly what the list
avoids. So previews come from a **pre-rendered SVG**, not from element
data at list time.

Because SVG is vector, the same full-fidelity snapshot renders crisply
as a 36px list thumbnail and as a full-size embed — there is no separate
"thumbnail size" to generate. One stored artifact serves both surfaces.

## Render-on-read, cached in R2

The snapshot bytes live in R2 (the existing `IMAGES` bucket, key
`thumb/<diagramId>`); a `diagrams.thumb_rendered_at` column records when
they were last rendered.

On a read of either delivery path:

- **Fresh** (`thumb_rendered_at >= saved_at`): stream the stored R2
  bytes. No render, no element load.
- **Stale** (or never rendered, or the object is missing): render the
  first tab with `renderElementsToSvg` (`@livediagram/diagram`, the same
  DOM-free renderer the MCP worker uses), write it to R2, stamp
  `thumb_rendered_at`, and return it. Icon elements render their real
  glyph (line art + Technology brand tiles) via the
  `@livediagram/icons/resolve` resolver the worker passes in — see
  spec/41 "Rendering".

This is **render-on-read**, not render-on-save, on purpose:

- **Covers every write path.** `saved_at` is bumped by every tab write
  (editor, collaborators, MCP server, API token), so the snapshot
  invalidates uniformly regardless of who edited — no client upload to
  keep in sync.
- **No wasted renders.** A diagram is only rendered when it has been
  edited _and_ subsequently viewed (in a list or an embed). A diagram
  nobody opens never costs a render.
- **Cheap steady state.** Once cached, reads are a straight R2 stream
  until the next save.

An empty / unparseable first tab yields no snapshot (the endpoints 404
and the row shows its generic icon). Deleting a diagram clears its R2
object. The freshness column needs no backfill: the first read of each
diagram renders lazily.

## Delivery path 1 — Explorer thumbnail (owner-authed)

`GET /api/diagrams/:id/thumbnail?v=<savedAt>`

- Read-gated exactly like `GET /api/diagrams/:id`: the owner, a joined
  team member, or a valid share-code visitor.
- A native `<img>` can't send auth headers, so the live app fetches this
  through the authenticated client and wraps the bytes in a blob URL
  (the same pattern image elements use, spec/19). `?v=<savedAt>` busts
  the browser cache when the diagram changes; the worker ignores it.
  `Cache-Control: private, max-age=86400`.
- The Explorer row fetches **lazily** (IntersectionObserver): only rows
  scrolled into view fetch, so a long list never fires dozens of
  requests / renders for rows the user never reaches.
- Degrades gracefully: no R2 binding, no access, or an empty diagram →
  404 → the row keeps its generic icon.

## Delivery path 2 — Live image share (public, share-code-scoped)

`GET /api/share/:code/image.svg` — this is spec/54's endpoint.

- Public: the share code in the URL is the only credential, matching a
  share link's "anyone with the URL" semantics (an `<img>` can't carry
  an auth header). Resolves through `getShareLink`, so revoking /
  expiring the link kills the image too.
- **Password-protected shares (spec/24) get no image**: an `<img>` can't
  supply the password, so serving one would bypass the gate. The route
  404s a gated diagram _before_ rendering, and the Share dialog hides the
  live-image option while a password is set.
- `Cache-Control: public, max-age=30, stale-while-revalidate=300` so an
  embed stays close to live without hammering the origin (the bytes come
  from R2; the worker only re-renders when the diagram was saved since).

### Share dialog

A per-active-link **Live image** control (non-password links only) opens
a menu to copy the URL, a Markdown `![](...)` snippet, or an HTML
`<img>` snippet. Sits beside the existing Copy / Embed actions.

The menu also carries a **tab picker** (a `<select>` header, shown only
when the diagram has more than one tab) so the copied URL / snippet can
target any tab, not just the first (spec/54's `?tab=<id>`). Picking the
first tab clears back to the default (no `?tab=`, so the cached
first-tab snapshot serves it); picking another appends `?tab=<id>` and
the endpoint renders that tab **on read, uncached** (see Scope). The
choice is diagram-wide, applying to every share link's image.

### Where thumbnails appear

The thumbnail shows on **every** Explorer surface that lists a diagram:
the full-page `/explorer` rows (Recent / My Work / folders / Unsorted /
Generated), the team library page, the "Shared with me" list, and the
floating in-editor Explorer panel. A single shared `DiagramThumbnail`
component (`components/panels/DiagramThumbnail.tsx`) backs them all, fed
the **viewer's** owner id (never the diagram's) plus, for a shared row,
its share code — so the authed fetch authorises the same way the diagram
itself does (owner / team membership / share code). A stranger with none
of those gets a 404 and the row falls back to its icon.

### List / card view

The browse views (Recent / My Work / folders / Unsorted / Generated)
have a **List ↔ Card** toggle at the far right of the header (device-
local preference, `livediagram:explorer-view`). Card view renders the
same folders + diagrams as a responsive grid of cards (1 / 2 / 3 columns
by width), each with a large snapshot and every column the list shows
(name, owner, visibility badge, updated time, actions menu). List and
card share one badge + actions-menu module (`diagram-row-shared.tsx`) so
they can't drift. A real switch (not a click on the already-active side)
emits `UI / Toggled / ExplorerViewList | ExplorerViewCard` (spec/22).

The snapshot preview paints its letterbox in the diagram's own
background colour (parsed client-side from the SVG's background rect)
instead of a generic slate, so a card reads as a continuation of the
diagram rather than a framed cut-out. The client also strips the
snapshot's fixed `width`/`height` (keeping the `viewBox`) before handing
it to the `<img>`, so the vector scales to the card's size crisply
rather than rasterising at its intrinsic size and upscaling.

The same toggle is on the **team library** (spec/35) — its shared
diagrams + folders reuse the same `CardView`, sharing the
`livediagram:explorer-view` preference so a card-view user gets cards
there too. Team cards hide the visibility badge (every card is a team
diagram, so a per-card badge is noise — the team list omits it as well).

## Scope (v1)

- **R2 cache is first-tab only.** The persisted snapshot
  (`thumb/<diagramId>`, one per diagram, shared by the Explorer
  thumbnail and the default live image) always renders the **first**
  tab. The live image's `?tab=<id>` selector (spec/54) now ships in the
  Share dialog, but a non-default tab is rendered **on read and not
  written to that cache** — the single per-diagram key + freshness stamp
  has no room for a second tab, and per-tab embeds are niche. The
  endpoint's `max-age=30, stale-while-revalidate=300` keeps repeat views
  cheap without a persistent cache. So "first tab only" still describes
  the cached artifact and the Explorer thumbnail, just no longer the
  live image.
- **No PNG.** SVG only — vector, tiny, headless-renderable. A rasterised
  variant is out of scope.
- The List/Card toggle covers the main browse views and the team
  library; the "Shared with me" page keeps its fixed layout (it already
  shows the thumbnail).

## Self-hosting

The whole feature is gated on the optional `IMAGES` R2 binding, exactly
like the image gallery (spec/19): with no bucket, both endpoints 404 and
the Explorer row shows its icon. No new binding, no required SaaS.
