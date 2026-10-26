# Community blueprint

Derived from [Community](../community.md). Implementation detail only; design decisions live in the spec.

## 0. The platform's part

The posts, their tags, likes, copies and reports, the counts, the gallery's reads (list, search, facets, featured,
sitemap), likes, reports and auto-hide are liveworkspace's Community service, one store for every app keyed by
`app` ([liveworkspace/docs/specs/007-community/community.md](../../../../../liveworkspace/docs/specs/007-community/community.md)). This file does not
re-document them; where it names the service's limits or rules, the service's doc is the authority. The pages read
the service straight (`communityServiceUrl('livediagram.app', path, ...)` against `NEXT_PUBLIC_COMMUNITY_API`); the
shared vocabulary is `@liveworkspace/community` (`packages/community/src/post.ts`, `query.ts`, `network.ts`),
re-exported by `@livediagram/api-schema`.

What is livediagram's: the canvas's `community_post` row (one per canvas: `share_code`, `author_id`, `post_id`,
`title`, `anonymous`, `hidden_at`, `sent_state`, `checked_at`), the owner routes `GET`/`PUT`/`DELETE
/api/documents/:id/community` (forwarding to the service's app routes with `COMMUNITY_KEY`), `GET
/api/community/mine`, the community link's doors, copy counting (`countCommunityCopy`), and the sync (the canvas's
alarm asks the index every `COMMUNITY_CHECK_MS` and sends the service what changed). Then the editor's Share dialog
section and publish dialog, the Public badge and Community bar, and the Community pages (`apps/community`). Vars:
`COMMUNITY_URL` (default `COMMUNITY_API_URL`, `https://liveworkspace.app/api/community`), secret `COMMUNITY_KEY`;
the pages' `NEXT_PUBLIC_COMMUNITY_API` and their Worker's `COMMUNITY_URL`. Without `COMMUNITY_KEY`
(`communityServiceConfigured`), the Community is off.

## 1. Domain and naming

| Spec term      | Identifier                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| post           | `CommunityPost` (DTO); a `posts` row at the service; the canvas's `community_post` row                                                            |
| author         | `CommunityAuthor` (`{ name, color, picture }`), column `author_id`                                                                                |
| category       | `CommunityCategory` (union of ids), `COMMUNITY_CATEGORIES` (ordered `{ id, label, blurb, type }[]`)                                               |
| tag            | `string` after `normaliseCommunityTag`                                                                                                            |
| like           | `likeCount` (the service counts them)                                                                                                             |
| copy count     | `copyCount` (the service counts them; `countCommunityCopy` reports one)                                                                           |
| report         | `CommunityReportReason`, `COMMUNITY_REPORT_REASONS` (`{ id, label, type }[]`)                                                                     |
| hidden         | `CommunityPostState = 'listed' \| 'hidden'`; the canvas's `community_post.hidden_at`                                                              |
| community link | an index share link (view, never expiring, public) whose code is `community_post.share_code`; `SharePurpose = 'share' \| 'community'` on the wire |
| community key  | header `X-Community-Key` (`COMMUNITY_KEY_HEADER`), localStorage `livediagram:v2:community-key` (`COMMUNITY_KEY_STORAGE`)                          |
| sort           | `CommunitySort = 'new' \| 'loved' \| 'copied'`, `COMMUNITY_SORTS` (`{ id, label, type }[]`)                                                       |
| Edit Listing   | the same `PUT /api/documents/:id/community` as publishing; the editor names the act, the api does not                                             |

Shared vocabulary lives in `@liveworkspace/community`, re-exported by `@livediagram/api-schema`, so the worker, the
editor, the Community app and the service cannot disagree: `../packages/community/src/post.ts` holds the post
(categories, reasons, limits, `normaliseCommunityTag`, `validateCommunityPostInput`, DTOs), `../packages/community/src/query.ts` the search
grammar and list query (sorts, the `#tag` / `category:` / `sort:` / `is:mine` words, `parseCommunityListQuery`,
`communityQueryParams`). Each category, report reason and sort carries `type`, its PascalCase telemetry value
(`Architecture`, `Personal`, `Loved`, ...), so no caller derives one. This app's paths are
`packages/api-schema/src/community-paths.ts` (`COMMUNITY_HOME_PATH`, `communityPostPath`, `communityImagePath`,
`COMMUNITY_KEY_STORAGE`).

## 2. Constants and configuration

All in `../packages/community/src/post.ts`; the service enforces the ones past publishing.

| Constant                           | Value         | Provenance            | Safe range |
| ---------------------------------- | ------------- | --------------------- | ---------- |
| `COMMUNITY_TITLE_MIN` / `_MAX`     | 3/80          | spec "Title"          | fixed      |
| `COMMUNITY_DESCRIPTION_MIN`/`_MAX` | 20/500        | spec "Description"    | fixed      |
| `COMMUNITY_TAGS_MAX`               | 5             | spec "Tags"           | 1..10      |
| `COMMUNITY_TAG_MIN` / `_MAX`       | 2/24          | spec "Tags"           | fixed      |
| `COMMUNITY_REPORT_NOTE_MAX`        | 300           | spec "Reports"        | fixed      |
| `COMMUNITY_POSTS_PER_AUTHOR`       | 50            | spec "Publishing"     | 10..500    |
| `COMMUNITY_PAGE_SIZE`              | 24            | spec "Gallery"        | 12..48     |
| `COMMUNITY_MAX_OFFSET`             | 2400          | C3 (100 pages)        | 480..10000 |
| `COMMUNITY_AUTO_HIDE_REPORTERS`    | 3             | spec "Reports"        | 2..10      |
| `COMMUNITY_POPULAR_TAGS`           | 24            | C4                    | 8..48      |
| `COMMUNITY_RELATED_POSTS`          | 6             | spec "More Like This" | 3..12      |
| `COMMUNITY_SEARCH_TERMS_MAX`       | 5             | C5                    | 1..10      |
| `COMMUNITY_SEARCH_TERM_MAX`        | 40            | C5                    | 10..80     |
| `COMMUNITY_SEARCH_MAX`             | 200           | C5 (whole query)      | 80..500    |
| `COMMUNITY_COUNTED_PER_NETWORK`    | 5             | spec "Likes"          | 1..20      |
| `COMMUNITY_FEATURED_COUNT`         | 6             | spec "Featured"       | fixed      |
| `COMMUNITY_FEATURED_WINDOW_MS`     | 90 days       | spec "Featured"       | 30..365 d  |
| `COMMUNITY_KEY_PATTERN`            | UUID v4 regex | C6                    | fixed      |

Rate limits on likes, reports and reads are the service's. The canvas's `COMMUNITY_CHECK_MS` is 10 minutes
(`apps/api/src/document-room/community-post.ts`).
Worker var `COMMUNITY_ENABLED` (optional; `false`, `0` or `off` switches the Community off, anything else or unset
leaves it on), read per request by `communityEnabled(env)` (`apps/api/src/community-enabled.ts`) and reported as
`communityEnabled` by `GET /api/capabilities`. Moderation needs no var: it is reports alone.

Switched off (or with no `COMMUNITY_KEY`): `handleCommunity` and the owner routes answer 404 before anything else, and
`openCommunityCode` answers null, so the canvas's room reports its post's link as not open, which closes the grant
(`gateGrant`) and the share resolve in one place. The apps ask through `useCommunityEnabled(apiBase)` / `fetchCommunityEnabled`
(`packages/ui/src/community/useCommunityEnabled.ts`; one request per api base per page, on unless an explicit
`false`; `useCommunityEnabled(apiBase, ask)` skips the request and answers on while `ask` is false). Each asks only
when its answer can matter, so a page view that never reaches them makes no request: `ProductNavLinks` (the Explorer footer row) filters its
Community link, asking as it mounts; `CommunityFooterLink` renders
nothing, asking once the footer comes near the viewport (`useNearViewport`); `ShareDialogWithCommunity` falls back to
the plain `ShareDialog`; `EditorView` drops the Public badge (it asks only while a post is listed and not in an embed);
`CommunityShowcase` never asks: it renders nothing when `featured` fails, and it fetches `featured` only once the section comes near the viewport; the Community app's
`CommunityGate` replaces the location with `/`.

## 3. Data and persistence

The posts, tags, likes, copies and reports are the service's
([liveworkspace/docs/specs/007-community/community.md](../../../../../liveworkspace/docs/specs/007-community/community.md)).

What the canvas keeps is its own post's link, in its Durable Object's SQLite (`community_post` in
`apps/api/src/document-room/document-schema.ts`; `apps/api/src/document-room/community-post.ts`): at most one row with
the share code of its link (an index share link, view, never expiring), the post's id at the service, its `title`,
`anonymous`, `hidden_at`, the listing state last sent and when it last checked. A grant through that link is a
content-only pass (`apps/api/src/routes/context.ts`).

- Where the canvas stands is the index's (its Trash, its team, its share password, its owner). While it has a post,
  the canvas asks the index from its own alarm, every `COMMUNITY_CHECK_MS`, and sends the service what changed
  (`communityStateOf`: `gone`, `away`, `closed` or `public`); the same check hears whether the service hid the post
  after reports.
- `openCommunityCode(env, post, meta)`: the code that opens the canvas as its post right now, or null (switched off,
  hidden, or the canvas no longer its author's own or in a team).
- Field classification: `author_id` is an owner credential (never on the wire); everything else on the row is public
  post content or sync state.
- A hidden post is final: nothing restores it, edits it or deletes it except deleting its canvas.
- Account deletion and guest to account: the service stops counting the deleted account's copies
  (`forgetCommunityCopier`), and a guest's copies become the account's (`mergeCommunityCopier`), both in
  `apps/api/src/community-service.ts`; a copier is sent as a one-way hash (`copierHash`).
- Pictures: the card image (`communityImagePath`, `/api/share/:code/image.svg`) is liveworkspace's previews, drawn
  through the export door from the redacted board ([liveworkspace/docs/specs/006-media/previews.md](../../../../../liveworkspace/docs/specs/006-media/previews.md)).
- Snapshot/restore and Google Drive sync carry no Community state; a copy is never published.

## 4. Interfaces and contracts

DTOs (api-schema):

```ts
type CommunityAuthor = { name: string; color: string; picture: string | null };
type CommunityPost = {
  id: string;
  title: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
  likeCount: number;
  copyCount: number;
  publishedAt: number;
  updatedAt: number;
  shareCode: string;
  author: CommunityAuthor; // "Anonymous" when anonymous
  anonymous: boolean;
  liked: boolean;
};
type CommunityOwnPost = CommunityPost & { state: CommunityPostState };
type CommunityMinePost = CommunityOwnPost & { documentId: string };
type CommunityMineTotals = { posts: number; likes: number; copies: number };
type CommunityMineResponse = {
  posts: CommunityMinePost[];
  nextOffset: number | null;
  totals: CommunityMineTotals;
};
type CommunityFeaturedResponse = { posts: CommunityPost[] };
type CommunityPostInput = {
  title: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
  anonymous: boolean; // a missing value publishes anonymously
};
type CommunityListQuery = {
  q: string;
  category: CommunityCategory | null;
  tag: string | null;
  sort: CommunitySort;
  offset: number;
};
```

Routes on this api (all JSON; errors `{ error: <code> }`):

| Method + path                         | Who                  | Success                                                                                      | Rejections                                                                                                                                                                                                                                                              |
| ------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/documents/:id/community`    | owner                | `{ post: CommunityOwnPost \| null }` (null for a previous owner's post)                      | 404 missing or not the owner's                                                                                                                                                                                                                                          |
| `PUT /api/documents/:id/community`    | owner, signed in     | 201 new / 200 update `{ post }`                                                              | 401 `sign_in_required`, 404, 409 `team_document`, 409 `share_password_set`, 409 `empty_document`, 409 `post_hidden`, 400 `invalid_<field>`, 503 `index_unavailable`; the service's refusals (`post_limit`, `already_published`, ...) pass through by code, a 5xx as 502 |
| `DELETE /api/documents/:id/community` | owner                | 204                                                                                          | 404 (also when not published, or a previous owner's post), 409 `post_hidden`                                                                                                                                                                                            |
| `GET /api/community/mine?q&offset`    | signed in            | 200 `CommunityMineResponse` (hidden included)                                                | 400 `invalid_query`, 401, 502 `community_unavailable`                                                                                                                                                                                                                   |
| `GET /api/share/:code`                | anyone with the code | `{ document, role: 'view', tabId: null, community: { postId, author } }` for the post's link | 404 while the post is not open                                                                                                                                                                                                                                          |

The gallery's reads (posts, featured, facets, a post with its related), likes and reports are the service's routes
(`liveworkspace.app/api/community/...?app=livediagram.app`), called by the pages; their shapes are the DTOs above.

- Every route above answers 404 while the Community is switched off.
- `mine` reads the same search words as the list and asks the service for the signed-in author
  (`owner=<accountUserId>`), passing the page's community key (`communityKeyHeaders`) so its hearts show as that
  browser left them; `Cache-Control: private, no-store`.
- Query parsing is `parseCommunityListQuery(URLSearchParams)`: unknown sort → `new`, unknown category or bad tag →
  `invalid_query`, offset clamped to `[0, COMMUNITY_MAX_OFFSET]`.
- Validation is `validateCommunityPostInput(input)` → `{ ok: true, value } | { ok: false, error }`, trimming title and
  description, collapsing description runs of 3+ newlines to 2, normalising and de-duplicating tags.
- A share password and a post exclude each other: the owner's `PUT` refuses one while a password is set
  (`client.listShareLinks(id).passwordSet`), and the community link is made `public`, so a password set later closes
  it (404) rather than asking visitors for one.

## 5. Behaviour and state

Post state machine (kept by the service): (none) → `listed` (publish) → `hidden` (auto: reports; final). `listed` →
(none) on unpublish; either state → (none) only when the document is deleted. Where the canvas stands (Trash, team,
share password, owner) is sent to the service as its `documentState` by the sync, and only a `public` canvas's post is
in any public read.

Guards (`apps/api/src/routes/community-owner-routes.ts` unless named):

- G1 publish: `ctx.accountUserId` non-null and equal to the canvas's owner (`ownsDocument`), and `teamId === null`.
- G2 publish: no share password (`client.listShareLinks(id).passwordSet` false).
- G3 publish (new post only): `firstTabElementCount > 0` (`apps/api/src/db/tabs.ts`: counted, not rendered); the
  per-author cap `COMMUNITY_POSTS_PER_AUTHOR` is the service's (it answers `post_limit`).
- G4 public reads: the service's (a `listed` post whose canvas is `public`); the canvas's own door is
  `openCommunityCode` (`apps/api/src/document-room/community-post.ts`).
- G5 like/report: the service's (a valid community key, a post passing G4).
- G6 hidden is final: owner `PUT` / `DELETE` on a hidden post answer 409 `post_hidden`.
- G7 previous owner: a post the service does not report as the caller's `own` (it came with the canvas from a team
  library) reads as none; `PUT` publishes afresh and the canvas's row is replaced, the previous link revoked;
  `DELETE` answers 404.
- Auto-hide after reports is the service's
  ([liveworkspace/docs/specs/007-community/community.md](../../../../../liveworkspace/docs/specs/007-community/community.md)); the canvas hears it on its next
  check and records `hidden_at`.

Community link behaviour (keyed off the canvas's `community_post.share_code`):

- `apps/api/src/routes/share.ts`: the resolve answers `role: 'view'`, `tabId: null` and the post's `community`
  listing; while the post is not open it answers 404 to everyone.
- `apps/api/src/routes/document-room-routes.ts`: ticket mint and WebSocket upgrade refuse with 403 `community_link`
  (`isCommunityCode`).
- `DocumentGrant` carries `community: boolean`. A community grant is refused by every door that has not opted in with
  `COMMUNITY_CONTENT` (`gateGrant`, `apps/api/src/routes/context.ts`), the comment listing included. The document GET
  and the tab GET opt in; the document is redacted with `redactDocumentForCommunity` and the tab with
  `redactTabForCommunity` (`apps/api/src/community-redact.ts`).
- Copy: the api's copy door (`apps/api/src/routes/document-index-routes.ts`) names a copy through the post's link
  after the post (`communityPostTitle`) and counts it (`countCommunityCopy`, with the copier's network) before the
  index copies; the index's copy (`copy` in `apps/api/src/routes/internal-items.ts`) takes the source through
  `exportCopy`, which drops comments and the people on actions for a community copy, and counts a copy the api door
  did not.

Shared UI (`packages/ui/src/community/`): `CommunityPostTile` (the card, used by the Community app and the landing
page's `CommunityShowcase`), `CommunityAuthorBadge`, `communitySharedAgo` (the shared-ago line), `useCommunityEnabled`
/ `fetchCommunityEnabled`, `CommunityFooterLink` (the shared footer's link, hidden while switched off),
`CommunityCounts` (`CommunityLikeCount`, `CommunityCopyCount`), and `surfaces.ts` (`COMMUNITY_DOT_GRID`,
`COMMUNITY_SKELETON_BAR`: the dot grid behind a post's image and the pulsing loading bar, used by the card, its
skeleton, `EmbedFrame` and `PostStates`), and `CommunityHelpLink` (`packages/ui/src/community/CommunityHelpLink.tsx`:
a help-glyph link keyed by `COMMUNITY_HELP` in `packages/help-registry/src/community.ts`, `sharing` or `finding`,
each an article href and its telemetry id, sent as `UI·Opened·<id>`).

Picture and redaction (api): the export door (`exportImage` in `apps/api/src/document-room/document-room.ts`,
`drawDocument` in `apps/api/src/thumbnail.ts`) draws from the redacted board when asked with the open post's code;
liveworkspace's previews keep that picture apart from the owner's (`liveworkspace/docs/specs/006-media/previews.md`);
`redactDocumentForCommunity` (`apps/api/src/redact-document.ts`) strips owner name, colour, folder and origin from the
document a community grant reads. `clientRateKey(request)` is the copier's network the api passes with a copy;
the service maps it (`communityNetwork`, `../packages/community/src/network.ts`).

Editor (`apps/editor`):

- `apps/editor/lib/api/community.ts`: `apiGetCommunityPost`, `apiPublishCommunityPost`, `apiRemoveCommunityPost`;
  error codes map to copy in `apps/editor/lib/community-errors.ts`.
- `apps/editor/hooks/persistence/useCommunityPost.ts`: loads the owner's post when the Share dialog opens; exposes
  `{ post, loading, error, publish(input), remove() }`.
- `apps/editor/components/dialogs/community/`: `ShareDialogWithCommunity.tsx` composes the Share dialog with
  `CommunitySection.tsx` (its state chosen by the pure `community-section-state.ts`); `CommunityPublishDialog.tsx`
  (title, description with counter, `CategoryPicker.tsx`, `TagInput.tsx` (the shared `apps/editor/components/primitives/ChipField.tsx` with Community's rules) over the pure `tag-draft.ts`,
  `CommunityCardPreview.tsx`, the consequences list) replaces the Share dialog while open, its draft and submit in
  `usePublishForm.ts`, per-field error copy in the pure `publish-field-errors.ts` drawn by `FieldError.tsx`; a first
  publish ends on `CommunityPublishedConfirmation.tsx`. `CommunityCardPreview` is the shared `CommunityPostTile` as a
  still preview (no `href`), its `image` slot holding the owner's own snapshot and `categoryLabel` asking for a
  category until one is chosen. The share password control is locked while the post is listed; with a share
  password set the section disables Share to Community and says "Remove the share password to share it to the
  Community." With the open tab being the first and empty (`firstTabEmpty`, computed in `EditorTabDialogs.tsx` as
  `tabs[0].id === activeTab.id && activeTab.elements.length === 0`, the same count the server's `empty_document`
  check reads) it disables the button beside `communityCodeMessage('empty_document')`. A hidden post's card says **Hidden after reports.** and offers no Edit Listing or
  Remove.
- Public badge: `apps/editor/lib/community-state-store.ts` (an external store, seeded from the document fetch and
  updated by the Community section on publish or remove) feeds `SharedBadge`'s `community` state, labelled **Public**,
  which wins over Private, Shared and Team (only This Browser beats it).
- `resolveDocumentSession` (`apps/editor/app/document/[id]/editor-page-helpers.ts`) takes `community`: a community
  link resolves to a non-owner view session for everyone, the author included, so neither the post page's embed nor
  Open Canvas can edit the document; `CommunitySession.ownDocumentId` gives the author Edit Your Canvas in the bar.
- Share-view mode: `useIdentityBootstrap` stores `sessionCommunity` (in `editor-realtime.ts`) from the share resolve;
  when set, `useRoomConnection` gets `enabled: false`, the identity prompt is not opened, the visit is not recorded,
  and `apps/editor/components/chrome/CommunityBar.tsx` renders under the header with the author
  (the shared `CommunityAuthorBadge`).
- `?copy=1` on `/document/shared` (`apps/editor/hooks/canvas/useAutoCopyParam.ts`): once the document hydrates with a
  session share code, `makeCopy` runs once and the param is stripped.
- There is no moderation page and no operator route.

Community app (`apps/community`):

- `apps/community/lib/community-key.ts`: reads or mints (`crypto.randomUUID`) the key; SSR-safe; storage failures fall
  back to an in-memory key for the page's life. Never reads the guest owner id.
- `apps/community/lib/query-state.ts`: the URL query to and from the gallery's filters (pure, tested), via
  `parseCommunityListQuery` / `communityQueryParams`.
- `apps/community/lib/api.ts`: `fetchPosts`, `fetchMine`, `fetchFacets`, `fetchPost`, `likePost`, `unlikePost`,
  `reportPost`: every read, like and report straight to the service (`communityServiceUrl` over `communityApi()`),
  My Shares to this api (`NEXT_PUBLIC_API_BASE ?? '/api'`); `apps/community/lib/useLike.ts` is the optimistic like with rollback.
- Gallery (`apps/community/components/gallery/`): `GalleryView` over `useGallery`; `CommunityHero`, `SearchBox`
  (debounced `SEARCH_DEBOUNCE_MS`, Enter commits; the input and the controls in one flex row, so typed text never
  runs under them) holding Clear Search, the My Shares toggle (`aria-pressed`, where sign-in exists), `CategoryMenu`,
  `TagFilter` and `SortMenu` in its right edge, each a `SearchControlMenu` (one trigger, keyboard menu and check-marked rows; a pick closes it or, for Tags, leaves it open) over the shared `SearchControlButton` (icon only below `lg`),
  the menus sharing `MENU_PANEL` and `menuRadioRowClass` (`../packages/ui/src/menu/menu-classes.ts`, also used by the editor mode menus); then `PostGrid` of `PostCard`,
  `LoadMore`, `GalleryStates`. Clear Search keeps the sort and `is:mine`. Category, tags and sort are words in `q`: `communitySearchCategory`, `communitySearchTags`,
  `communitySearchSort` and their setters (api-schema) read and write them; the service's list reads them through
  `parseCommunityListQuery` (a word wins over the old parameter); a legacy `?tag=`, `?category=` or `?sort=` folds into `q` in `readQueryState`. The search form sits on the
  toolbar layer (`--z-toolbar`): above the grid, below the sticky header and its menus.
- My Shares: `is:mine` (`COMMUNITY_MINE_TOKEN`) in `q` switches `useGallery` to `fetchMine`, with the signed-in session
  from `AccountSession` (mounted only when My Shares is on: `POST /api/auth/token` on the same origin, skipped without the
  signed-in hint);
  `apps/community/lib/session.ts` holds
  `SESSION_LOAD_TIMEOUT_MS` and `signInHref`. `MineSummary` shows the **Your Shares** totals above the grid. Waiting
  past `SESSION_LOAD_TIMEOUT_MS` for the session, `GalleryView` shows `LoadError` ("We couldn't load the
  Community.") with a reload.
- Post page (`apps/community/components/post/`): `PostView` over `usePost`, `EmbedFrame` (`/embed?s=<code>`, lazy,
  titled, falling back to the card image after 15 s), `PostMeta`, `PostActions`, `ReportDialog` (on the shared `Dialog` shell from `@livediagram/ui`, a phone sheet below `sm`), `RelatedPosts`.
  Links come from `apps/community/lib/links.ts`: Open Canvas `openDocumentHref` (`/document/shared?s=<code>`), Make
  a Copy `makeCopyHref` (`/document/shared?s=<code>&copy=1`). Once the post loads, `PostView` sets `document.title`
  and a `link rel="canonical"` to the post's own address (`apps/community/app/post/page.tsx` carries none).

## 6. Errors and edge cases

| Case                                    | Handling                                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish on a document with a password   | 409 `share_password_set`; the section disables Share to Community and says why                                                                                                          |
| Password set on a published document    | The Share dialog locks the password control ("Remove it from the Community to set a password."); a password set another way closes the community link (404) and the sync sends `closed` |
| Empty document                          | 409 `empty_document`; "Add something to your first tab before sharing: it is the picture on your Community card."                                                                       |
| 51st post                               | 409 `post_limit` (the service's)                                                                                                                                                        |
| Two first publishes at once             | The canvas's Durable Object runs one write at a time; the service answers 409 `already_published` to a second create                                                                    |
| A previous owner's post                 | Reads as none; `PUT` replaces it, `DELETE` 404 (G7)                                                                                                                                     |
| My Shares, sign-in never loads          | After `SESSION_LOAD_TIMEOUT_MS`: "We couldn't load the Community." Try Again reloads                                                                                                    |
| Owner revokes all share links           | The community link is the post's; removing it in the Share dialog closes the post until it is published again                                                                           |
| Document trashed                        | The sync sends `away`; hidden everywhere; post page 404; restore lists it again                                                                                                         |
| Post hidden while a visitor has it open | Likes/reports 404; the UI shows "This post is no longer available."                                                                                                                     |
| Like twice / unlike twice               | Idempotent (the service's)                                                                                                                                                              |
| Report twice from one browser           | 204, nothing changes (the service's)                                                                                                                                                    |
| Storage blocked in the Community app    | In-memory key; likes work for the page's life                                                                                                                                           |
| Embed frame fails                       | Falls back to the card image with Open Canvas                                                                                                                                           |
| Author has no participant row           | Author `{ name: 'Someone', color: '#64748b', picture: null }`                                                                                                                           |
| Search with only stop characters        | Treated as no search                                                                                                                                                                    |
| Offset past the end                     | Empty `posts`, `nextOffset: null`                                                                                                                                                       |
| Copy by the author of their own post    | Counted only if a share code was presented and the caller is not the author                                                                                                             |

## 7. Security and trust

- Content-only pass: `resolveDocumentGrant` marks a community grant; `gateGrant` (`apps/api/src/routes/context.ts`)
  refuses it unless the door passes `COMMUNITY_CONTENT`. Doors that pass it: the document GET (and its views), the tab
  GET (and its views), images, the copy and the room ticket (which then refuses with 403 `community_link`). Every other
  door (comments, comment pictures, changesets, timeline, Q&A board, and any new one) refuses by default.
- `redactElementsForCommunity` / `redactTabDataForCommunity` (`apps/api/src/community-redact.ts`): comment threads
  dropped; each action keeps its text and status, its assignee, team, assigner id and assigner name blanked. Applied
  to the tab GET for a community visit and to the copy's source (`exportCopy` in
  `apps/api/src/document-room/document-content.ts`), so the copy is built from the redacted data.
- The share resolve for a community link records nothing for the visitor's Shared and sends no join email.
- A hidden post's link: the grant and the share resolve answer nothing to anyone; the card image is closed by
  liveworkspace's previews.
- `?copy=1` (`useAutoCopyParam`) copies only when the session came in through a community link.

- Trust boundary: the Community app is a public, unauthenticated surface. It never sends an owner's credential; the community
  key grants nothing but a like and a report.
- Publishing requires a verified account identity (G1), so every public post is tied to an account.
- No owner id leaves the worker in any Community DTO; authors are participant display identities only; a copier
  reaches the service only as `copierHash`.
- The community link is read-only (view role), cannot open the room, and cannot read comments.
- Abuse: likes, reports and reads are rate limited by the service, per network; the owner routes stay on the api's
  per-owner limiter; every call to the service's app routes carries `COMMUNITY_KEY`. Auto-hide, the per-network count
  caps (`COMMUNITY_COUNTED_PER_NETWORK`) and report hashing are the service's
  ([liveworkspace/docs/specs/007-community/community.md](../../../../../liveworkspace/docs/specs/007-community/community.md)).

## 8. Performance and limits

- List, search, facets, featured and their indexes are the service's
  ([liveworkspace/docs/specs/007-community/community.md](../../../../../liveworkspace/docs/specs/007-community/community.md)).
- Card images are liveworkspace's previews of `/api/share/:code/image.svg`
  ([liveworkspace/docs/specs/006-media/previews.md](../../../../../liveworkspace/docs/specs/006-media/previews.md)); the canvas draws through the
  export door only when asked.
- Bodies are capped by the worker's existing `MAX_BODY_BYTES`; inputs by the constants above.
- Sync: a canvas with a post asks the index from its own alarm, every `COMMUNITY_CHECK_MS`, and sends the service
  what changed: one index request, at most one service request and one write to its `community_post` row; a canvas
  with no post does nothing.
- Hot paths outside the Community: the canvas's `community_post` holds one row at most, so reading it is constant
  time; the read gate adds the post check only for a Community link; a copy through a post adds one service call,
  off the response path for the index's copy.
- Bundles: kept small by keeping the Community vocabulary off other pages: the paths have their own module
  (`community-paths.ts`), and the editor loads its Community message table only for the rare `community_published`
  answer. The Community bar stays in the editor's main chunk on purpose: splitting it out made the bundler duplicate
  two Explorer modules.

## 9. Presentation and UX

Final copy:

- Gallery search box: placeholder "Search..."; its label (visually hidden) "Search the Community".
- Share dialog section heading: **Community**. Unpublished: "The Community is public: anyone, with or without an
  account, can find this document there, view it and make their own copy." Button: **Share to Community**. With a
  share password set, the button is disabled beside "Remove the share password to share it to the Community." With
  the open first tab empty, it is disabled beside "Add something to your first tab before sharing: it is the picture
  on your Community card." Guest: "Sign in to share your document with the
  Community." Button: **Sign In to Share**. Team document: "Team library canvases can't be shared to the Community."
- Published: post title, category, "♥ n · Copied n times", **View Post**, **Edit Listing**, **Remove From Community**;
  hidden: "**Hidden after reports.** Several people reported it, so it was taken out of the Community for good. Only you
  can see it, and it can no longer be changed or removed." Remove asks in place: "Remove it from the Community? Its
  likes and copy count go too; copies people made stay theirs." **Keep It** / **Remove**.
- Publish dialog title: **Share to Community** / **Edit Listing**. Consequences: "Anyone can view this document and make
  their own copy." "Your later edits show in the Community too." "Comments stay private." "You can remove it at any
  time." Primary button: **Share to Community** / **Save Changes**.
- Gallery heading: **Community**; lead: "Canvases people are proud of. Find inspiration, then make it your own."
- Empty (no posts): "Nothing here yet. Be the first to share a canvas." Empty (filters): "No documents match these
  filters." Button **Clear Filters**. Error: "We couldn't load the Community." Button **Try Again**.
- My Shares: signed out "Sign in to see your shares." with **Sign In**; nothing shared "You haven't shared anything
  yet." with **Share Your Own**; totals headed **Your Shares**.
- Post not found: "This canvas isn't in the Community any more." Link **Back to Community**.
- Community bar: "Shared to the Community by <name>" · **Back to Community** · **Make a Copy**.
- Report dialog: title **Report This Canvas**, reasons as radio rows, note optional, button **Send Report**,
  confirmation "Thanks for letting us know. When enough people report a document, it is taken out of the
  Community." (no promise of a human review)
- Help links (`CommunityHelpLink`): `CommunityHero` **How the Community Works** (`finding`, `variant="inline"`, ending the
  lead) and **How Sharing Works** (`sharing`, `variant="button"`, a secondary button left of Share Your Own; the
  pair wraps with Share Your Own first, `flex-wrap-reverse`); `MineSummary` **Managing Your Shares** (`sharing`);
  `ReportDialog` **How Reports Work** (`finding`); the landing page's `CommunityShowcase` **How the Community Works**
  (`finding`). In the editor, `HelpArticleLink` with the `HELP_ARTICLES` key `community` sits on
  `CommunitySection`'s label and in `CommunityPublishDialog`'s header.

Layout: gallery grid 1 / 2 / 3 / 4 columns at <640 / 640 / 1024 / 1280 px; cards with a 4:3 image area on a subtle
dot-grid background (`COMMUNITY_DOT_GRID`); skeleton cards of the same size while loading. The search box's controls
show icons only below `lg`. The page-edge rail carries Appearance only (sharing off) and, the Community being a wide
surface (`SiteHeader wide`, `ShareRail wide`), shows from `2xl`.

## 10. Accessibility

Category and Sort are `menuitemradio` menus and Tags a `menuitemcheckbox` menu, on the shared menu keyboard
(`useMenuButton` / `useMenu`); My Shares is a toggle with `aria-pressed`; the publish dialog's category picker is a
`radiogroup`. Focus follows controls that leave: the Community section moves it by `data-focus` (into the remove
question, back to Remove From Community, or to Share to Community), `TagInput` refocuses the input or the last chip,
and the shared `useFocusTrap` restores focus after an unmounting modal and leaves an `autoFocus` control focused.
The first-publish confirmation is `role="status"` with focus on Done. Counts carry sr-only words
(`CommunityCounts`). The like button has `aria-pressed` and an `aria-label` with the count; card images carry `alt`
= title; the embed frame has a `title`; the report dialog traps focus and returns it; search has a visible label
(sr-only) and `role="search"`. Colours from the
shared Tailwind theme meet AA in light and dark. Reduced motion disables card lift and heart animation.

## 11. Web Experience

The gallery shell, hero and filters render statically (no layout shift: the grid reserves skeleton cards); posts load
client-side. Card images are `loading="lazy"` with fixed aspect boxes (CLS 0). LCP is the hero heading. The landing
page's section is below the fold and makes its one request only once it comes near, so it never competes with the
page's first paint, and a visit that does not scroll there costs nothing. Interactions
(search controls, likes) update optimistically (INP). Each post page names its own canonical address once it loads.

## 12. Observability

The telemetry dashboard reads these through a Community tab (liveworkspace/apps/site/app/telemetry/livediagram/CommunityView.tsx) and the
Community cards (liveworkspace/apps/site/app/telemetry/livediagram/catalogue/community.ts); its emitter scan recognises `siteTrack`, so the
Community app's events are covered by the completeness tests.

Worker logs with fingerprints: `[community] published`, `[community] updated`, `[community] removed`,
`[community] rejected <code>` (including `post_hidden` and the service's refusals), `[community] link not removed`
and `[community] copy count failed`. The service's own logs (auto-hide and the rest) are liveworkspace's.

Browser warnings: `[community] capabilities unavailable; assuming on` (`useCommunityEnabled`), `[community] featured
load failed` (`CommunityShowcase`), `[community] switched off; leaving for the home page` (`CommunityGate`),
`[community] sign-in did not load; My Shares gives up`, `[community] gallery load failed`, `[community] facets load
failed`, `[community] load more failed`, `[community] post load failed`, `[community] report failed`; the Community
app's api errors read `[community] api <status> <code>`. Telemetry per the spec.

## 13. Testing

| Spec rule                                  | Test                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag normalisation, input validation, query | packages/community/src/post.test.ts                                                                                                            |
| Publish guards, update, unpublish          | `apps/api/src/routes/community-routes.test.ts` (in-memory SQLite)                                                                              |
| List filters, sorts, search, paging, trash | liveworkspace/apps/community/src/posts.test.ts (sqlite D1)                                                                                     |
| Likes, reports, auto-hide, hidden is final | liveworkspace/apps/community/src/posts.test.ts, liveworkspace/apps/community/src/index.test.ts, `apps/api/src/routes/community-routes.test.ts` |
| Community link: unlisted, no join, no pw   | `apps/api/src/routes/community-routes.test.ts`                                                                                                 |
| Community link: no room                    | `apps/api/src/routes/document-room-routes.test.ts`                                                                                             |
| Community grant                            | `apps/api/src/routes/context.test.ts`                                                                                                          |
| Switched off: routes, links, capabilities  | `apps/api/src/community-enabled.test.ts`, `apps/api/src/routes/community-routes.test.ts`                                                       |
| Switched off: footer links, fetch          | `packages/ui/src/community/useCommunityEnabled.test.tsx`                                                                                       |
| Hidden is final (Share dialog)             | `apps/editor/components/dialogs/community/CommunitySection.test.tsx`                                                                           |
| Copy counting                              | liveworkspace/apps/community/src/posts.test.ts, `apps/api/src/routes/community-routes.test.ts`                                                 |
| Query state round trip                     | `apps/community/lib/query-state.test.ts`                                                                                                       |
| Community key fallback                     | `apps/community/lib/community-key.test.ts`                                                                                                     |
| Router forwards `/community`               | `apps/router/src/index.test.ts`                                                                                                                |
| Optimistic like and rollback               | `apps/community/components/shared/LikeButton.test.tsx`                                                                                         |
| Copy once from `?copy=1`                   | `apps/editor/hooks/canvas/useAutoCopyParam.test.tsx`                                                                                           |
| Community section state, tag input         | `apps/editor/components/dialogs/community/*.test.ts(x)`                                                                                        |
| Editor api client and error copy           | `apps/editor/lib/api/community.test.ts`                                                                                                        |
| Network ranges (IPv4 /24, IPv6 /56)        | packages/community/src/network.test.ts                                                                                                         |
| Redaction for strangers                    | `apps/api/src/community-redact.test.ts`                                                                                                        |
| Community drawing redacted                 | `apps/api/src/thumbnail.test.ts`                                                                                                               |
| Post row mapping (Anonymous, state)        | liveworkspace/apps/community/src/posts.test.ts                                                                                                 |
| Community links, sync state                | `apps/api/src/routes/community-routes.test.ts`                                                                                                 |
| Service routes, keys, CORS                 | liveworkspace/apps/community/src/index.test.ts                                                                                                 |
| Public badge                               | `apps/editor/components/chrome/SharedBadge.test.tsx`                                                                                           |
| Community bar                              | `apps/editor/components/chrome/CommunityBar.test.tsx`                                                                                          |
| Share dialog with Community, switched off  | `apps/editor/components/dialogs/community/ShareDialogWithCommunity.test.tsx`                                                                   |
| Community section, focus follows           | `apps/editor/components/dialogs/community/CommunitySection.test.tsx`                                                                           |
| Publish dialog pieces                      | `apps/editor/components/dialogs/community/publish-pieces.test.tsx`                                                                             |
| Owner post hook                            | `apps/editor/hooks/persistence/useCommunityPost.test.tsx`                                                                                      |
| Gallery states, My Shares, sign-in wait    | `apps/community/components/gallery/GalleryView.test.tsx`                                                                                       |
| Post page, canonical                       | `apps/community/components/post/PostView.test.tsx`                                                                                             |
| Sign-in session and switched-off gate      | `apps/community/components/auth-and-gate.test.tsx`                                                                                             |
| Home page showcase                         | `apps/marketing/components/CommunityShowcase.test.tsx`                                                                                         |
| Shared card, counts, author                | `packages/ui/src/community/community-pieces.test.tsx`                                                                                          |
| Focus restore after an unmounting modal    | `../packages/ui/src/useFocusTrap.test.tsx`                                                                                                     |

## 14. Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows C1 to C17.

## 15. Assets and external resources

- App icon: `apps/community/app/icon.svg`, hand-authored in this repo (MIT).
- Glyphs: `apps/community/components/shared/icons.tsx` draws Lucide-derived primitives (`lucide*`) from the shared
  `@liveworkspace/icons` catalogue, under Lucide's ISC licence, credited on the generated `/licences` page.
