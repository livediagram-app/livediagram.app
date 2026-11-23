# Blueprint: Publish to the Web

Derived from [Publish to the Web](../publishing.md). The spec decides; this file adds the engineering precision.
Rules are numbered P1 to P36 and each maps to a test (Testing).

## Domain and naming

| Spec term          | Identifier                                                                        |
| ------------------ | --------------------------------------------------------------------------------- |
| public site        | `PublishedSite` (the `published_site` row)                                        |
| site address       | `address` on the site; `SiteAddressRecord` at the registry                        |
| page address       | `address` on a `published_pages` row; `published_addresses` history               |
| section            | `root`: the tab id of the section's first page; `null` is the whole knowledgebase |
| published snapshot | the `published_*` tables of the knowledgebase's Durable Object                    |
| Show Who Wrote     | `showWriters`                                                                     |
| Hide From Search   | `noindex`                                                                         |

The wire, the code and the routes say `publishing` for the feature and `site` for what it makes. "Public" is never
an identifier of this feature.

## Where the code is

| Piece                                      | File                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| The capability check (P1)                  | `packages/knowledge/src/publish/publish-capability.ts`                                        |
| Addresses: shape, reserved, from titles    | `packages/knowledge/src/publish/publish-address.ts`                                           |
| Which pages go public                      | `packages/knowledge/src/publish/publish-scope.ts`                                             |
| Writing to safe HTML                       | `packages/knowledge/src/publish/publish-writing.ts`                                           |
| The site's pages (HTML, CSS, sitemap)      | `packages/knowledge/src/publish/publish-site.ts`, `publish-site-css.ts`, `publish-sitemap.ts` |
| The theme's accent (moved from the editor) | `packages/document/src/knowledge-accent.ts`                                                   |
| Wire types                                 | `packages/api-schema/src/publishing.ts`                                                       |
| The snapshot's tables                      | `apps/api/src/publishing/published-schema.ts`                                                 |
| Writing and refreshing the snapshot        | `apps/api/src/publishing/published-snapshot.ts`                                               |
| The public reads, in the room              | `apps/api/src/publishing/published-reads.ts`                                                  |
| The site address registry                  | `apps/api/src/publishing/site-addresses.ts`                                                   |
| The Editor's routes                        | `apps/api/src/publishing/publishing-routes.ts`                                                |
| The public site, in the worker             | `apps/api/src/publishing/public-site.ts`                                                      |
| A page's figures, cover and pictures       | `apps/api/src/publishing/published-media.ts`                                                  |
| The public picture route                   | `apps/api/src/publishing/public-media.ts`                                                     |
| The cover's colours (shared with editor)   | `packages/document/src/page-cover.ts` `coverThemeFrom`                                        |
| The router's `/kb` line                    | `apps/router/src/index.ts`                                                                    |
| The dialog                                 | `apps/editor/components/publishing/`                                                          |
| The client                                 | `apps/editor/lib/api/publishing.ts`                                                           |

## Behaviour and state

- **P1 One capability check.** `publishingOffered({ ownerId, teamId })` answers `true`. The api's routes refuse
  `403 publishing_unavailable` when it is false, the state read says `offered`, and the editor's menu row reads
  `offered`. A tier gate is a change to this function's body alone.
- **P2 Who.** The Editor's routes need `grant.role === 'edit'` on the whole knowledgebase (`tabScope === null`), an
  account (`accountUserId`), and no API token (`403 needs_a_person`). Everyone else: `403 forbidden`. A Community
  visit's grant is `view`, so it is refused too.
- **P3 States.** Not published (no `published_site` row) and Published (one row, id 1). Publish moves either to
  Published; Unpublish moves Published to Not published. There is no draft of a site.
- **P4 What goes public** (`publishableScope(tabs, root)`): the pages under `root` (the root included; all pages for
  `null`) in the tab list's order, depth first by parent. A page whose `knowledge.approval.state` is `pending` or
  `rejected` is left out with that reason; its subpages stay, under its nearest included ancestor (or the top). A
  page with no saved text is left out as `empty` (decided once its writing is read). A `root` the knowledgebase lacks
  is `400 unknown_root`; a scope with no page left is `400 nothing_to_publish`.
- **P5 Page addresses** (`addressFrom(title)`): NFKD, marks dropped, lowercased, every run of other characters one
  hyphen, trimmed of hyphens, at most `PAGE_ADDRESS_MAX` (80) characters, `page` when nothing is left. Unique in the
  site by `-2`, `-3` (`uniqueAddress`) against every address any other page of the site has held. A page keeps its
  address while its title makes the same one; a new title gives it a new address, and its old one stays in
  `published_addresses` and redirects (`301`).
- **P6 The site address** (`siteAddressRefusal`): 3 to 48 characters of `a-z`, `0-9` and single hyphens, a letter or
  digit at each end (`invalid_address`), not one of `RESERVED_SITE_ADDRESSES` (`address_reserved`). Its default is
  `addressFrom(knowledgebase name)` cut to 48, padded with `-kb` when shorter than 3.
- **P7 The registry.** A site address is held by the DOCUMENT_ROOM instance named `~kb-site:<address>` (no document id
  starts with `~`, as `setup-draft-count.ts`), whose one storage key `site` holds
  `SiteAddressRecord { documentId, movedTo? }`. Its RPC `siteAddress(op)`: `read`; `claim(documentId)` answers
  `held` when free or already this knowledgebase's, else `taken`; `move(documentId, to)` sets `movedTo` when held by
  that knowledgebase; `release(documentId)` deletes it when held by that knowledgebase. A Durable Object runs one
  request's storage calls alone, so two claims of one address cannot both win.
- **P8 Publish** (`PUT /api/documents/<id>/publishing { address, root, noindex, showWriters }`): validate (P6, P4);
  claim the address (P7, `409 address_taken`); when the site had another current address, `move` it to the new one;
  record every address held in `published_site_addresses`; upsert the site row; rebuild every page (P10); answer
  `PublishingState`. The answer's `X-Publish-Purge` header lists the paths whose edge copies the worker drops (P21);
  the worker strips it.
- **P9 Unpublish** (`DELETE /api/documents/<id>/publishing`): `release` every address in `published_site_addresses`,
  then delete every `published_*` row in one batch; answer `PublishingState` (not published), with the purge header.
  Unpublishing what is not published answers the same state.
- **P10 Refresh.** Triggers keep `published_dirty` (a tab inserted, its data or name updated, or deleted) and
  `published_site.stale` (the document's name or style changed, a tab linked, unlinked or reordered) while a site
  exists. Before every public read the room refreshes: when nothing is dirty or stale it reads nothing more;
  otherwise it reads the outline once (no bodies), recomputes the scope (P4), renders each dirty or missing page from
  its saved writing, deletes the rows of pages no longer in scope, rewrites every row's place, then clears the marks,
  in one batch. A Publish marks every page dirty first.
- **P11 Rendering a page** (`publishedWriting`): the saved writing only (`savedArticlesOf`, `pageFlowOf`); the first
  Title block is the page's title and not repeated; a Subtitle is the lead paragraph. Each run's text is escaped;
  bold, italic, underline, strike, code, superscript and subscript are their elements; a colour and a highlight are
  kept only as a valid hex; a web link only when `isSafeArticleHref`, with `rel="noopener"`; a margin note's mark and
  its id are dropped and its text kept; a footnote is a numbered reference to a list at the foot. Lists nest by
  level (numbered, bulleted, to-do with a disabled checkbox), code is `<pre><code>`, a divider `<hr>`, a table a
  `<table>` (its header row `<thead>`), a contents block the page's headings (to its depth) linked by anchor. A zone
  is the figure P31 draws for it (nothing when it has none); a page break draws nothing. Heading anchors are made
  from their text, unique in the page.
- **P12 Page links** to a page in the snapshot link to `/kb/<site>/<address>` (the front page to `/kb/<site>`); any
  other is its text.
- **P13 The description**: the writing's text after the title, whitespace collapsed, cut at a word to 160 characters
  with an ellipsis; the knowledgebase's name when empty. The text (also what search indexes and snips) is one line
  per block, a line with no closing punctuation (a heading, a list item) kept apart from the next by " ·": "Before a
  Release · Releasing", never "Before a Release Releasing".
- **P14 Writers** (only with `showWriters`): the people in `page_editors` of kind `human`, first first, their names
  read once a refresh through `getParticipants`; an agent, an id or an email is never written. A name that cannot be
  read is left out.
- **P15 The front page.** `/kb/<site>` serves the first page in the snapshot's order; its own address redirects there
  (`301`). The canonical of the front page is `/kb/<site>`.
- **P16 Previous and Next** follow the snapshot's order (depth first), across levels.
- **P31 A zone's figure** (`zoneFigure`, Work Tracker 1346): the zone's rect where it last stood
  (`zoneCanvasRect` over the tab's laid out pages) and its elements (`zoneMemberIds`), drawn by the shared renderer
  (`renderElementsToSvg`) in the knowledgebase's style (`tabInKnowledgeStyle`), framed to the rect with no
  background, inked for a light page; a zone never laid out, or holding nothing, draws nothing. The SVG sits in
  `<figure class="zone zone-<object|drawing> align-<left|center|right>[ wrap-<left|right>]">`, its `width` and
  `height` the zone's, scaled down to the column by CSS, `role="img"` with the elements' alt text
  (`imageAltTextOf`) as its `aria-label`, else `aria-hidden="true"`. A drawing zone sits on a white card in the dark
  appearance, as its ink is a light page's. Icons and stickers are drawn as the preview draws them.
- **P32 A page's pictures** (`published_media`): the gallery ids (`imageRefIds`) of the elements in the page's zones
  and of its cover picture, kept to those the knowledgebase may serve (`servableImageIds`, one query per drawn
  batch). The renderer's image href for each is `/kb/<site>/media/<encodeURIComponent(id)>`; any other id keeps its
  placeholder. Each drawn page's rows are replaced in the refresh's batch; a page leaving the site deletes its rows;
  Unpublish deletes them all.
- **P33 A page's cover** (`published_pages.cover`, HTML): a picture is `<div class="cover"><img src="/kb/<site>/
media/<id>" alt="" ...></div>` placed by its focus (`object-position: 50% <focus>%`), its credit in a
  `<span class="credit">`, only when P32 kept it; a gradient or an animated cover is the band painted
  `linear-gradient(<angle>deg, <from>, <to>)` from `coverFill(cover, coverThemeFrom(theme, accent))`, only hex
  colours and a finite angle written (an animated cover is its gradient, still). No cover is `''`.
- **P34 Restyle.** A change to the knowledgebase's style marks every published page dirty (trigger
  `published_pages_restyled`), as P31 and P33 draw in it.

## Interfaces and contracts

- `GET /api/documents/<id>/publishing[?root=<tab>|all]` → `PublishingState`:
  `{ offered, published, site: { address, url, root, noindex, showWriters, publishedAt } | null, defaultAddress,
preview: { root, pages: { id, title }[], leftOut: { id, title, reason }[] } }`. The preview is for `root` when
  given, else the site's own (or the whole knowledgebase when not published). `empty` pages are found from the
  page_trust / passages index without reading bodies: a page whose index holds no passage is `empty`.
- `PUT` body: `{ address: string, root: string | null, noindex: boolean, showWriters: boolean }`, every field
  required; a missing or wrong one is `400 invalid_body` naming it.
- Refusals: `400 invalid_body`, `invalid_address`, `address_reserved`, `unknown_root`, `nothing_to_publish`;
  `403 forbidden`, `needs_a_person`, `publishing_unavailable`; `404` for an unknown knowledgebase; `409
address_taken`; `429 rate_limited` (the write limiter).
- Public routes (`apps/api/src/publishing/public-site.ts`, GET and HEAD only, `405` otherwise; no Authorization or
  cookie is read):
  - `/kb/<site>` and `/kb/<site>/<page>` → `text/html`; a moved site or page → `301`; none → `404` page.
  - `/kb/<site>/search?q=` → `text/html`, results or none.
  - `/kb/<site>/sitemap.xml` → `application/xml`.
  - `/kb/<site>/media/<id>` (P35) → the picture's bytes, its stored type; `304` to a browser's `If-None-Match`
    holding its `ETag`; `404` (an empty body) for anything P35 refuses; `429` over the limit (P36).
- The room's RPC `publishedRead(documentId, read)`, `read` one of `{ kind: 'page', address: string | null }`,
  `{ kind: 'search', query }`, `{ kind: 'sitemap' }`, `{ kind: 'media', imageId }`, answers `PublishedAnswer`:
  `{ status: 'none' }`, `{ status: 'moved', address }`, `{ status: 'media' }` (the picture may be served) or
  `{ status: 'ok', site, page?, results?, pages? }` with only published fields; a page carries its `cover` HTML. `site` is `{ address, name, style, noindex, showWriters, tree: { address, title, icon,
parent }[] }`.

## Data and persistence

Schema step after the existing ones (`document-schema.ts`), additive, `IF NOT EXISTS`:

| Table                      | Columns                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `published_site`           | `id` (1), `address`, `root`, `noindex`, `show_writers`, `published_by`, `published_at`, `stale`                                      |
| `published_pages`          | `tab` PK, `address` UNIQUE, `parent`, `position`, `title`, `icon`, `description`, `html`, `text`, `writers` (JSON names), `saved_at` |
| `published_addresses`      | `address` PK, `tab`: every address a page of the site has had                                                                        |
| `published_site_addresses` | `address` PK, `held_at`: every site address this knowledgebase holds at the registry                                                 |
| `published_dirty`          | `tab` PK                                                                                                                             |
| `published_fts`            | FTS5 (`tab` UNINDEXED, `title`, `text`), the search tokenizer the knowledge index uses                                               |
| `published_media`          | `image`, `tab`, PK (`image`, `tab`): the pictures each published page places (P32)                                                   |

A second schema step (Work Tracker 1346) adds `published_media`, the column `published_pages.cover` (TEXT, default
`''`) and the trigger P34, and marks every page already published dirty, so a site published before it shows its
pictures at its next read.

- Every column is classified **public** (it is what the site shows) except `published_by` and `held_at`, which no
  public read selects. A test (P26) holds the public reads to these columns.
- A snapshot travels with nothing: a copy, an export, a version, a Drive file and an Offline copy never carry it
  (they read the document's own tables). Deleting the knowledgebase purges the Durable Object and the snapshot with
  it; the registry's record then points at a knowledgebase whose snapshot is empty, which reads as not found (P20).

## Errors and edge cases

- **P17** A page in the snapshot whose tab is deleted leaves the site at the next refresh; its addresses stay
  reserved to the site until Unpublish.
- **P18** A section whose root page becomes Pending Approval keeps publishing its subpages (P4); a section whose
  root is deleted publishes nothing, and every read answers `404` until an Editor publishes again.
- **P19** A refresh that throws answers the snapshot as it stands (logged `[publishing] refresh_failed`); the next
  read tries again.
- **P20** A registry record whose knowledgebase holds no site (unpublished from elsewhere, deleted) reads `404`.
- **P21** The purge after Publish, an update and Unpublish is best effort: a failed `cache.delete` is logged and the
  60 second lifetime bounds the rest. It names every page's pictures too (`/kb/<site>/media/<id>`).

## Security and trust

- The public reads select only the public columns (P26); nothing else of the knowledgebase is read on a public
  request, so a draft, comment, Page Health field, approval, owner or id cannot be written into an answer.
- **P22** Every text is HTML-escaped (`& < > " '`); attribute values too; hrefs are only `/kb/...` paths the
  renderer built or `isSafeArticleHref` addresses. No script is ever sent: the answer's CSP is
  `default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;
img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`, with `X-Content-Type-Options:
nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- **P23** Search is limited per visitor's network on `SEARCH_RATE_LIMITER` (`kb:<network>`); over it
  `429` with `Retry-After: 60`. A query is cut to `SEARCH_MAX_QUERY_CHARS` and made safe by `searchTerms` and
  `ftsExpression`, so nothing typed is read as an FTS operator.
- The router forwards `/kb/*` to the api as it is; no cookie or Authorization header is read by the public site.
- **P35 A picture's fetch** (`/kb/<site>/media/<id>`): the site is resolved by the registry (P7; a moved site
  redirects to the same picture at its new address); its knowledgebase refreshes (P10) and answers `media` only when
  `published_media` holds the id for a page still in `published_pages` and `servableImageIds` still keeps it, else
  `none`. Only then are the bytes read (`media.bytes`). An id is 1 to `IMAGE_REF_ID_MAX_LENGTH` characters after
  percent-decoding, never `data:`; any other is `404` before any lookup. The answer carries
  `Cache-Control: public, max-age=60`, an `ETag` made from the id, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` and
  `Cross-Origin-Resource-Policy: same-origin`, so a picture opened alone runs nothing and another site cannot embed
  it. Nothing of the picture but its bytes and type is sent.
- **P36** A picture's fetch the edge has not kept is limited per visitor's network on `SEARCH_RATE_LIMITER` under its
  own key (`kb-media:<network>`, so its budget is apart from search's); over it `429` with `Retry-After: 60`.

## Performance and limits

- A cached public read costs one Cache API lookup. A miss costs two Durable Object calls (the registry's one
  storage read, then the knowledgebase's) and, when a page changed, one body read and render for that page.
- A Publish renders every page in scope: at most 500 bodies, read 50 at a time. The render is linear in the
  writing's blocks and runs (P27 holds a 5,000 block page under a CPU budget).
- No raster image is drawn: `og:image` is liveknowledge's own social image (`<origin>/opengraph-image`). A card per
  page (resvg in the api) is a follow-up, held back for its bundle cost (about 2.5 MB of wasm and fonts).
- A zone's figure (P31) is drawn once per page draw, not per read; it is an SVG of its elements alone. The media
  rows add one `servableImageIds` query per batch of 50 pages and one row per picture. A picture fetch the edge has
  not kept costs one registry read, one knowledgebase call (two indexed lookups) and one media read; a browser's
  revalidation (`If-None-Match`) skips the media read. The renderer and the icon art were already in the api's
  bundle (`thumbnail.ts`), so nothing is added to it.

## Presentation and UX

- The dialog (`PublishDialog`): `Dialog size="md" phoneSheet`, the platform's DialogHeader, a steady height. Copy as
  the spec words it. The section picker is the shared `Select`, options in tree order indented by two spaces a
  level. The address is a text field with the fixed prefix beside it and its refusal under it. The options are the
  shared `Switch`. What Goes Public lists at most 8 pages and "and N more". Unpublish asks through `ConfirmDialog`.
- The public page: a 64 px head (the knowledgebase's name, the search form), a 260 px sidebar from 960 px wide, the
  column 720 px at most, a 16 px gutter on a phone where the tree is a `<details>` "Pages" disclosure. Light and dark
  follow `prefers-color-scheme`.

## Accessibility

- The public page: one `h1` (the title), landmarks (`header`, `nav aria-label="Pages"`, `main`, `footer`), a skip
  link, the current page `aria-current="page"`, visible focus rings in the accent, AA contrast in both appearances,
  search labelled. No motion.
- The dialog: every control labelled, the refusal tied by `aria-describedby`, the state announced (`role="status"`).

## Web Experience

- No script; the CSS is inline (one small block); fonts load with `display=swap` and a system fallback, so LCP is the
  title's text and CLS is nil (every figure's SVG has its size before its pictures load, the cover's band a fixed
  height, the sidebar's width fixed).

## Observability

- `[publishing] published { documentId, pages, leftOut }`, `[publishing] unpublished { documentId }`,
  `[publishing] refresh { documentId, rendered, removed }`, `[publishing] refresh_failed`, `[publishing] purge_failed`.
  Never an address, title or name.

## Testing

| Rule                      | Test                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1                        | `publish-capability.test.ts`; `publishing-routes.test.ts` "is refused when not offered"                                                                                                                                                                                                                                         |
| P2                        | `publishing-routes.test.ts` "role gating" (Editor, Participant, Viewer, link, page link, agent, stranger)                                                                                                                                                                                                                       |
| P3, P8, P9                | `publishing-routes.test.ts` "publish, update, unpublish"                                                                                                                                                                                                                                                                        |
| P4, P18                   | `publish-scope.test.ts`                                                                                                                                                                                                                                                                                                         |
| P5, P6                    | `publish-address.test.ts`                                                                                                                                                                                                                                                                                                       |
| P7                        | `site-addresses.test.ts`                                                                                                                                                                                                                                                                                                        |
| P10, P17, P19             | `published-snapshot.test.ts`                                                                                                                                                                                                                                                                                                    |
| P11, P12, P13, P22        | `publish-writing.test.ts`                                                                                                                                                                                                                                                                                                       |
| P14                       | `published-snapshot.test.ts` "writers"                                                                                                                                                                                                                                                                                          |
| P15, P16, P20, P21, P23   | `public-site.test.ts`                                                                                                                                                                                                                                                                                                           |
| P26 nothing private leaks | `published-leaks.test.ts`: a knowledgebase with a draft, margin notes, threads, a pending and a rejected page, an owner, verification, an approval and named editors; every public answer is searched for each private value                                                                                                    |
| P27                       | `publish-writing.test.ts` CPU budget                                                                                                                                                                                                                                                                                            |
| P31 to P36                | `published-media.test.ts`: a published page's picture, drawing and cover show signed out; an unplaced, a left-out and another knowledgebase's picture 404; removing a picture, leaving a page out and Unpublish take it down; a restyle redraws; cache headers, ETag and 304; the rate limit. `publish-writing.test.ts` "zones" |

## Constants and configuration

| Constant                    | Value | Why                                                    |
| --------------------------- | ----- | ------------------------------------------------------ |
| `SITE_ADDRESS_MIN`, `_MAX`  | 3, 48 | Short enough to type, long enough for a product name   |
| `PAGE_ADDRESS_MAX`          | 80    | A readable address; titles past it are cut at a hyphen |
| `PUBLISHED_EDGE_SECONDS`    | 60    | The spec's "within a minute"                           |
| `PUBLISHED_DESCRIPTION_MAX` | 160   | What search engines show                               |
| `PREVIEW_PAGES_SHOWN`       | 8     | The dialog's list before "and N more"                  |
| `PUBLISH_RENDER_BATCH`      | 50    | Bodies read at once during a Publish                   |
| `COVER_BAND_PX`             | 220   | The cover's height, as the editor's (140 on a phone)   |

## Defaults ledger

See DEFAULTS.md D13 to D17.
