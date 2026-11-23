# Blueprint: Publish to the Web

Derived from [Publish to the Web](../publishing.md). The spec decides; this file adds the engineering precision.
Rules are numbered P1 to P30 and each maps to a test (Testing).

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
| Public Knowledgebases, the tier's count    | `apps/api/src/publishing/published-gauge.ts`                                                  |
| The public site, in the worker             | `apps/api/src/publishing/public-site.ts`                                                      |
| The router's `/kb` line                    | `apps/router/src/index.ts`                                                                    |
| The dialog                                 | `apps/editor/components/publishing/`                                                          |
| The limit's words and its refusal          | `apps/editor/lib/publishing/publish-limit.ts`                                                 |
| The client                                 | `apps/editor/lib/api/publishing.ts`                                                           |

## Behaviour and state

- **P1 One capability check.** `publishingOffered({ ownerId, teamId })` answers `true`. The api's routes refuse
  `403 publishing_unavailable` when it is false, the state read says `offered`, and the editor's menu row reads
  `offered`. How many an owner publishes is the tier's count (P28 to P32), never this check.
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
  (a picture, chart or drawing) and a page break draw nothing. Heading anchors are made from their text, unique in
  the page.
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

- **P28 The count** (`published-gauge.ts`, spec "Tiers"): with Pro on, the subscription service's
  `publicKnowledgebases` gauge holds one key per published knowledgebase, its document id. The routes read the
  knowledgebase's tier as `WorkerTier` (`knowledge/tier-limits.ts`, which gains `claim` and `release` with
  ItemTier's shape); the room's own paths (upkeep, purge, a move) use the room's `ItemTier`. A guest's knowledgebase
  is counted in itself against Free's 1 (`held` 0: it holds one site at most), and never sent to the service.
- **P29 The mark.** `published_site.counted` is 1 (holds a place), 0 (refused or given back) or NULL (never counted:
  published before Pro, or while the service was out of reach). `siteServes(on, counted)` is true with Pro off and
  for any mark but 0; `readPublished` answers `none` for a site that does not serve, and the state read reads it as
  not published (`published: false`, `site: null`; `defaultAddress` keeps its address).
- **P30 Publish counts first.** A PUT on a knowledgebase with no site, or one that does not serve, claims its place
  before anything is written. Refused at the limit: `409 publish_limit_reached` with `limit:
'publicKnowledgebases'`, `used`, `max` (and `guest` for a guest's), nothing written. The service refusing the
  request itself (`refusedByService`) throws: a server error, never a limit. Unmetered (out of reach) publishes with
  the mark NULL. A write that fails after the claim releases it. A PUT on a site that serves never claims.
- **P31 Counting again.** The dialog's first read (a GET with no `root`), and the room's daily upkeep, claim again
  for a site that exists (the add is idempotent at the service): a site from before takes its place, one refused
  takes it when the owner has room, and the answer's `used` is the owner's count. A GET carries `usage: { used?,
limit }` and `owner` (or `guest: true`), absent with Pro off; `used` only when a claim answered.
- **P32 Giving back.** Unpublish releases (whether or not a site was there). The room's purge releases before its
  storage goes. A move (the room's head write naming a new owner or team) releases from the old owner, reads the
  new owner's tier and claims, unless the mark is 0; each is logged and never throws.

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
address_taken`, `409 publish_limit_reached` (Pro on, P30: `{ error, message, limit, used, max, guest? }`); `429
rate_limited` (the write limiter).
- `PublishingState` with Pro on also carries `usage?: { used?: number; limit: number | null }`, `owner?` (the
  payer's scope) and `guest?: true` (P31).
- Public routes (`apps/api/src/publishing/public-site.ts`, GET and HEAD only, `405` otherwise; no Authorization or
  cookie is read):
  - `/kb/<site>` and `/kb/<site>/<page>` → `text/html`; a moved site or page → `301`; none → `404` page.
  - `/kb/<site>/search?q=` → `text/html`, results or none.
  - `/kb/<site>/sitemap.xml` → `application/xml`.
- The room's RPC `publishedRead(documentId, read)`, `read` one of `{ kind: 'page', address: string | null }`,
  `{ kind: 'search', query }`, `{ kind: 'sitemap' }`, answers `PublishedAnswer`:
  `{ status: 'none' }`, `{ status: 'moved', address }` or `{ status: 'ok', site, page?, results?, pages? }` with
  only published fields. `site` is `{ address, name, style, noindex, showWriters, tree: { address, title, icon,
parent }[] }`.

## Data and persistence

Schema step after the existing ones (`document-schema.ts`), additive, `IF NOT EXISTS`:

| Table                      | Columns                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `published_site`           | `id` (1), `address`, `root`, `noindex`, `show_writers`, `published_by`, `published_at`, `stale`, `counted` (P29; step 41)            |
| `published_pages`          | `tab` PK, `address` UNIQUE, `parent`, `position`, `title`, `icon`, `description`, `html`, `text`, `writers` (JSON names), `saved_at` |
| `published_addresses`      | `address` PK, `tab`: every address a page of the site has had                                                                        |
| `published_site_addresses` | `address` PK, `held_at`: every site address this knowledgebase holds at the registry                                                 |
| `published_dirty`          | `tab` PK                                                                                                                             |
| `published_fts`            | FTS5 (`tab` UNINDEXED, `title`, `text`), the search tokenizer the knowledge index uses                                               |

- `counted` is added by its own step (`document-schema.ts` V41, `publishedCountedStep`), asking `PRAGMA
table_info` before its `ALTER`, as V15 does. Every site there before reads NULL: never counted.
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
  60 second lifetime bounds the rest.

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

## Performance and limits

- A cached public read costs one Cache API lookup. A miss costs two Durable Object calls (the registry's one
  storage read, then the knowledgebase's) and, when a page changed, one body read and render for that page.
- A Publish renders every page in scope: at most 500 bodies, read 50 at a time. The render is linear in the
  writing's blocks and runs (P27 holds a 5,000 block page under a CPU budget).
- No image is drawn: `og:image` is liveknowledge's own social image (`<origin>/opengraph-image`). A card per page
  (resvg in the api) is a follow-up, held back for its bundle cost (about 2.5 MB of wasm and fonts).

## Presentation and UX

- **The limit** (`PublishLimit`, Pro on): the shared `LimitNotice` (`limitKey="publicKnowledgebases"`), its
  sentence from `publishLimitSentence` and its own offer dropped (`offer=""`). Shown above What to Publish while the
  knowledgebase is not published and the state's `usage` (or a refused Publish's numbers, `publishLimitOf`) is at
  its limit. The owner's view comes from `useOwnerView(state.owner)`.
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
  title's text and CLS is nil (no images in the column, the sidebar's width fixed).

## Observability

- `[publishing] published { documentId, pages, leftOut }`, `[publishing] unpublished { documentId }`,
  `[publishing] refresh { documentId, rendered, removed }`, `[publishing] refresh_failed`, `[publishing] purge_failed`.
  `[publishing] refused { reason: 'tier_limit' }` (P30), `[publishing] gauge.sync.failed`, `gauge.leave.failed`,
  `gauge.move.failed` (P31, P32). Never an address, title or name.

## Testing

| Rule                      | Test                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1                        | `publish-capability.test.ts`; `publishing-routes.test.ts` "is refused when not offered"                                                                                                                                      |
| P2                        | `publishing-routes.test.ts` "role gating" (Editor, Participant, Viewer, link, page link, agent, stranger)                                                                                                                    |
| P3, P8, P9                | `publishing-routes.test.ts` "publish, update, unpublish"                                                                                                                                                                     |
| P4, P18                   | `publish-scope.test.ts`                                                                                                                                                                                                      |
| P5, P6                    | `publish-address.test.ts`                                                                                                                                                                                                    |
| P7                        | `site-addresses.test.ts`                                                                                                                                                                                                     |
| P10, P17, P19             | `published-snapshot.test.ts`                                                                                                                                                                                                 |
| P11, P12, P13, P22        | `publish-writing.test.ts`                                                                                                                                                                                                    |
| P14                       | `published-snapshot.test.ts` "writers"                                                                                                                                                                                       |
| P15, P16, P20, P21, P23   | `public-site.test.ts`                                                                                                                                                                                                        |
| P26 nothing private leaks | `published-leaks.test.ts`: a knowledgebase with a draft, margin notes, threads, a pending and a rejected page, an owner, verification, an approval and named editors; every public answer is searched for each private value |
| P27                       | `publish-writing.test.ts` CPU budget                                                                                                                                                                                         |
| P28 to P32                | `publishing-tier.test.ts`; the editor's `publish-limit.test.ts` and `PublishLimit.test.tsx`                                                                                                                                  |

## Constants and configuration

| Constant                    | Value | Why                                                    |
| --------------------------- | ----- | ------------------------------------------------------ |
| `SITE_ADDRESS_MIN`, `_MAX`  | 3, 48 | Short enough to type, long enough for a product name   |
| `PAGE_ADDRESS_MAX`          | 80    | A readable address; titles past it are cut at a hyphen |
| `PUBLISHED_EDGE_SECONDS`    | 60    | The spec's "within a minute"                           |
| `PUBLISHED_DESCRIPTION_MAX` | 160   | What search engines show                               |
| `PREVIEW_PAGES_SHOWN`       | 8     | The dialog's list before "and N more"                  |
| `PUBLISH_RENDER_BATCH`      | 50    | Bodies read at once during a Publish                   |

## Defaults ledger

See DEFAULTS.md D13 to D17.
