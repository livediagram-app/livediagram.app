# Community blueprint

Derived from [Community](../community.md). Implementation detail only; design decisions live in the spec.

## 1. Domain and naming

| Spec term      | Identifier                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| post           | `CommunityPost` (DTO), table `community_posts`, id column `id`                                        |
| author         | `CommunityAuthor` (`{ name, color, picture }`), column `author_id`                                    |
| category       | `CommunityCategory` (union of ids), `COMMUNITY_CATEGORIES` (ordered `{ id, label, blurb, type }[]`)   |
| tag            | `string` after `normaliseCommunityTag`; table `community_post_tags`                                   |
| like           | table `community_likes`, column `like_count`                                                          |
| copy count     | table `community_copies`, column `copy_count`                                                         |
| report         | `CommunityReportReason`, `COMMUNITY_REPORT_REASONS` (`{ id, label, type }[]`), `community_reports`    |
| hidden         | `CommunityPostState = 'listed' \| 'hidden'`, column `hidden_by = 'reports'`                           |
| community link | `share_links.purpose = 'community'` (`SharePurpose = 'share' \| 'community'`)                         |
| community key  | header `X-Community-Key`, localStorage `livediagram:v2:community-key`                                 |
| sort           | `CommunitySort = 'new' \| 'loved' \| 'copied'`, `COMMUNITY_SORTS` (`{ id, label, type }[]`)           |
| Edit Listing   | the same `PUT /api/documents/:id/community` as publishing; the editor names the act, the api does not |

Shared vocabulary lives in `packages/api-schema`, exported from the package index, so the worker, the editor and the
Community app cannot disagree: `packages/api-schema/src/community.ts` holds the post (categories, reasons, limits, `normaliseCommunityTag`,
`validateCommunityPostInput`, DTOs, `communityPostPath`, `communityImagePath`), and `packages/api-schema/src/community-query.ts` the search
grammar and list query (sorts, the `#tag` / `category:` / `sort:` / `is:mine` words, `parseCommunityListQuery`,
`communityQueryParams`). Each category, report reason and sort carries `type`, its PascalCase telemetry value
(`Architecture`, `PersonalInfo`, `Loved`, ...), so no caller derives one.

## 2. Constants and configuration

All in `packages/api-schema/src/community.ts`.

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

Worker binding `COMMUNITY_RATE_LIMITER` (ratelimit, 30 per 60 s, keyed `community:<network>` from `communityNetwork`),
production and staging.
Worker var `COMMUNITY_ENABLED` (optional; `false`, `0` or `off` switches the Community off, anything else or unset
leaves it on), read per request by `communityEnabled(env)` (`apps/api/src/community-enabled.ts`) and reported as
`communityEnabled` by `GET /api/capabilities`. Moderation needs no var: it is reports alone.

Switched off: `handleCommunity` and the owner routes answer 404 before anything else, and `communityLinkAccess`
answers `'closed'`, which closes the grant, the share resolve and the card image in one place; the share-password
guard skips the post check. The apps ask through `useCommunityEnabled(apiBase)` / `fetchCommunityEnabled`
(`packages/ui/src/community/useCommunityEnabled.ts`; one request per api base per page, on unless an explicit
`false`; `useCommunityEnabled(apiBase, ask)` skips the request and answers on while `ask` is false): `ProductNav`
filters its Community item, `CommunityFooterLink` renders nothing, `ShareDialogWithCommunity` falls back to the plain
`ShareDialog`, `EditorView` drops the Public badge (it asks only while a post is listed and not in an embed),
`CommunityShowcase` renders nothing (also on a 404 from `featured`), and the Community app's `CommunityGate`
replaces the location with `/`.

## 3. Data and persistence

Migration `apps/api/migrations/0068_community.sql`:

```sql
ALTER TABLE share_links ADD COLUMN purpose TEXT NOT NULL DEFAULT 'share'
  CHECK (purpose IN ('share', 'community'));

CREATE TABLE community_posts (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  share_code   TEXT NOT NULL UNIQUE REFERENCES share_links(code) ON DELETE CASCADE,
  author_id    TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,
  tags         TEXT NOT NULL DEFAULT '[]',
  search_text  TEXT NOT NULL,
  like_count   INTEGER NOT NULL DEFAULT 0,
  copy_count   INTEGER NOT NULL DEFAULT 0,
  state        TEXT NOT NULL DEFAULT 'listed' CHECK (state IN ('listed', 'hidden')),
  hidden_by    TEXT NULL CHECK (hidden_by IN ('reports', 'operator')), -- 'operator' is retired; nothing writes it
  published_at INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
-- indexes: (state, published_at), (state, like_count, published_at), (state, copy_count, published_at),
--          (category, state, published_at), (author_id)
CREATE TABLE community_post_tags (post_id → posts CASCADE, tag TEXT, PRIMARY KEY (post_id, tag)); index (tag)
CREATE TABLE community_likes   (post_id → posts CASCADE, liker_key TEXT, created_at INTEGER, PK (post_id, liker_key))
CREATE TABLE community_copies  (post_id → posts CASCADE, copier_id TEXT, created_at INTEGER, PK (post_id, copier_id))
CREATE TABLE community_reports (post_id → posts CASCADE, reporter_key TEXT, network_hash TEXT, reason TEXT CHECK
                                (reason IN (...)), note TEXT NULL, created_at INTEGER, PK (post_id, reporter_key))
```

Migration `apps/api/migrations/0069_community_anonymous.sql`: `community_posts.anonymous INTEGER NOT NULL DEFAULT 0`
(posts published before it stay named, C10).

Migration `apps/api/migrations/0070_community_networks.sql`: `network_hash TEXT` (nullable) on `community_likes` and
`community_copies` (rows from before it count on their own); indexes `idx_community_likes_created` on
`community_likes (created_at)` (the featured window) and `idx_community_copies_copier` on
`community_copies (copier_id)` (a guest's copies migrating to an account, and account deletion).

Field classification: `author_id`, `copier_id` are owner credentials for guests (never on the wire); `liker_key`,
`reporter_key` are worthless random keys (never on the wire); `network_hash` is a one-way per-post hash (never on the
wire); everything else is public post content.

- `tags` holds the display array (JSON); `community_post_tags` holds the same set for filtering. Both are rewritten in
  one batch on publish/update.
- `search_text` = lowercased `title + '\n' + description + '\n' + tags.join(' ')`.
- `like_count` / `copy_count` are recomputed with `LIKE_COUNT_SQL` / `COPY_COUNT_SQL`
  (`apps/api/src/db/community-engagement.ts`: `SUM(MIN(n, COMMUNITY_COUNTED_PER_NETWORK))` over the rows grouped by
  `COALESCE(network_hash, liker_key | copier_id)`) in the same batch as the insert/delete that changes them, so they
  cannot drift.
- Post ids: `generateShareCode(10)` (same alphabet), re-minted once on a primary-key collision.
- Trash: posts are excluded wherever `documents.trashed_at IS NOT NULL` (join), never modified. Restore needs nothing.
- Permanent delete: `documents` row deletion cascades to `share_links` and `community_posts` (and its children).
- Unpublish: `DELETE FROM share_links WHERE code = ? AND purpose = 'community'` cascades the post and its children.
- A hidden post is final: nothing restores it, edits it or deletes it except deleting its document.
- Account deletion (`deleteAccount`, `apps/api/src/db/account.ts`): the author's posts are deleted through their
  community `share_links` (the cascade takes tags, likes, copies and reports); its `community_copies` rows are deleted
  and those posts' `copy_count` recounted with `COPY_COUNT_SQL`, in one batch.
- Guest to account (`migrateOwnerId`, same file): the guest's `community_copies` rows (with their `network_hash`) move
  to the account, and the posts they touch are recounted with `COPY_COUNT_SQL`.
- Snapshots: `snapshotKeys(documentId)` (`apps/api/src/db/documents.ts`) is `thumb/<id>` and `thumb-community/<id>`;
  both are deleted on document delete, Trash purge and account deletion.
- Snapshot/restore and the Drive mirror carry no Community state; a copy is never published (copyDocument skips
  share links already).

`db/share.ts`: `SHARE_LINK_COLS` gains `purpose`; `ShareLinkDTO` gains `purpose: SharePurpose`;
`listShareLinks` and the revoke-all statement filter `purpose = 'share'`; `createShareLink` takes an optional
`purpose` (default `'share'`). The document's primary `shareCode` derivation ignores community links.

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

Routes (all JSON; errors `{ error: <code> }`):

| Method + path                                         | Who              | Success                                                                 | Rejections                                                                                                                                                                                                  |
| ----------------------------------------------------- | ---------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/documents/:id/community`                    | owner            | `{ post: CommunityOwnPost \| null }` (null for a previous owner's post) | 400 no identity, 404 missing, 403 not owner                                                                                                                                                                 |
| `PUT /api/documents/:id/community`                    | owner, signed in | 201 new / 200 update `{ post }`                                         | 400 no identity, 401 `sign_in_required`, 403, 404, 409 `team_document`, 409 `share_password_set`, 409 `empty_document`, 409 `post_limit`, 409 `already_published`, 409 `post_hidden`, 400 `invalid_<field>` |
| `DELETE /api/documents/:id/community`                 | owner            | 204                                                                     | 400 no identity, 404 (also when not published, or a previous owner's post), 403, 409 `post_hidden`                                                                                                          |
| `GET /api/community/posts?q&category&tag&sort&offset` | anyone           | `{ posts, nextOffset: number \| null }`                                 | 400 `invalid_query`                                                                                                                                                                                         |
| `GET /api/community/mine?q&offset`                    | signed in        | 200 `CommunityMineResponse` (hidden included)                           | 400 `invalid_query`, 401                                                                                                                                                                                    |
| `GET /api/community/featured`                         | anyone           | 200 `CommunityFeaturedResponse` (up to six)                             | none                                                                                                                                                                                                        |
| `GET /api/community/facets`                           | anyone           | `{ categories: Record<id, n>, tags: {tag, count}[], total }`            | none                                                                                                                                                                                                        |
| `GET /api/community/posts/:id`                        | anyone           | `{ post, related: CommunityPost[] }`                                    | 404 missing or not public (hidden, trashed, team, owner changed, password set)                                                                                                                              |
| `PUT /api/community/posts/:id/like`                   | community key    | `{ likeCount, liked: true }`                                            | 400 `community_key_required`, 404, 429                                                                                                                                                                      |
| `DELETE /api/community/posts/:id/like`                | community key    | `{ likeCount, liked: false }`                                           | as above                                                                                                                                                                                                    |
| `POST /api/community/posts/:id/report`                | community key    | 204 (also for a repeat)                                                 | 400 `community_key_required` / `invalid_reason` / `invalid_note`, 404, 429                                                                                                                                  |

- Every `/api/community/*` route, and the owner routes above, answer 404 while the Community is switched off.
- `liked` is filled from `X-Community-Key` when present and valid, else false.
- `mine` reads the same search words as the list (the public list ignores `is:mine`) and sends
  `Cache-Control: private, no-store`; `featured` sends `public, max-age=60`. Both answer 404 while the Community is off.
- List responses without a community key send `Cache-Control: public, max-age=30`; with one, `private, no-store`.
- Query parsing is `parseCommunityListQuery(URLSearchParams)` (api-schema): unknown sort → `new`, unknown category or
  bad tag → `invalid_query`, offset clamped to `[0, COMMUNITY_MAX_OFFSET]` and to multiples of nothing (any int).
- Validation is `validateCommunityPostInput(input)` → `{ ok: true, value } | { ok: false, error }`, trimming title and
  description, collapsing description runs of 3+ newlines to 2, normalising and de-duplicating tags.
- Share resolve (`GET /api/share/:code`) for a community link answers
  `{ document, role: 'view', tabId: null, community: { postId, author: CommunityAuthor } }`; a hidden post's community
  link answers 404. `ShareResolveResponse.community` is optional on the DTO.
- Owner-side share routes: `PUT /api/documents/:id/share-password` with a non-empty password on a document whose post
  is listed answers 409 `community_published`; a hidden post does not block it.
- `PUT` and `DELETE /api/documents/:id/community` on a hidden post answer 409 `post_hidden`.

Live share links: the live `ShareLink` type gains `purpose` but the owner list never contains community links.

## 5. Behaviour and state

Post state machine: (none) → `listed` (publish) → `hidden` (auto: reports; final). `listed` → (none) on unpublish;
either state → (none) only when the document is deleted. Trash is orthogonal: a trashed document's
post is invisible in every public read whatever its state.

Guards:

- G1 publish: `ctx.clerkUserId` non-null and `ownsDocument` and `teamId === null`.
- G2 publish: `getDocumentSharePassword` empty.
- G3 publish (new post only): `firstTabElementCount > 0` (`apps/api/src/db/tabs.ts`: counted, not rendered); author
  has fewer than `COMMUNITY_POSTS_PER_AUTHOR`.
- G4 public reads: `state = 'listed' AND trashed_at IS NULL AND team_id IS NULL AND d.owner_id = cp.author_id AND
d.share_password IS NULL` (`PUBLIC_POST`, `apps/api/src/db/community.ts`).
- G5 like/report: valid community key, post passes G4.
- G6 hidden is final: owner `PUT` / `DELETE` on a hidden post answer 409 `post_hidden`.
- G7 previous owner (`apps/api/src/routes/community-owner-routes.ts`): a post whose `author_id` is not the document's
  owner (it came with the document from a team library) reads as none; `PUT` deletes it, logging
  `[community] replaced a previous owner post`, and publishes afresh; `DELETE` answers 404.
- Auto-hide (after each new report row): if `state = 'listed'` and `COUNT(DISTINCT reporter_key) >= 3` and
  `COUNT(DISTINCT network_hash) >= 3` then `state = 'hidden', hidden_by = 'reports'`.

Community link behaviour (keyed off `link.purpose === 'community'`):

- `apps/api/src/routes/share.ts`: skip `recordSharedAccess`, `Document·Joined` and `notifyDocumentJoin`; add
  `community`. A hidden post's link answers 404 to everyone.
- `routes/document-room-routes.ts`: ticket mint and WebSocket upgrade refuse with 403 `community_link`.
- `DocumentGrant` gains `community: boolean` (the room's ticket mint reads it). A community grant is refused by every
  door that has not opted in with `COMMUNITY_CONTENT` (`apps/api/src/routes/context.ts`), the comment listing
  included. The tab GET opts in through `gateGrant` and reads the grant's `community` flag on a non-owner read, with
  no second share-link lookup, to redact the tab (`redactTabForCommunity`, `apps/api/src/community-redact.ts`).
- `routes/documents.ts` copy: when `scope.community` (grant from a community code), after the copy succeeds
  `INSERT OR IGNORE community_copies` for the caller and recompute `copy_count` (waitUntil).
- Visitor-opened and visitor-copied timeline events are not recorded for a community visit or copy (strangers' names
  do not belong in the author's feed).

Shared UI (`packages/ui/src/community/`): `CommunityPostTile` (the card, used by the Community app and the landing
page's `CommunityShowcase`), `CommunityAuthorBadge`, `communitySharedAgo` (the shared-ago line), `useCommunityEnabled`
/ `fetchCommunityEnabled`, `CommunityFooterLink` (the shared footer's link, hidden while switched off),
`CommunityCounts` (`CommunityLikeCount`, `CommunityCopyCount`), and `surfaces.ts` (`COMMUNITY_DOT_GRID`,
`COMMUNITY_SKELETON_BAR`: the dot grid behind a post's image and the pulsing loading bar, used by the card, its
skeleton, `EmbedFrame` and `PostStates`), and `CommunityHelpLink` (`packages/ui/src/community/CommunityHelpLink.tsx`:
a help-glyph link keyed by `COMMUNITY_HELP` in `packages/help-registry/src/community.ts`, `sharing` or `finding`,
each an article href and its telemetry id, sent as `UI·Opened·<id>`).

Snapshot and redaction (api): `getCommunityThumbnailSvg` (`apps/api/src/thumbnail.ts`) renders the first tab from the
redacted board and caches it under `thumb-community/<documentId>`, apart from the owner's `thumb/<id>`, fresh while
its R2 `customMetadata.renderedAt >= savedAt`;
`redactDocumentForCommunity` (`apps/api/src/redact-document.ts`) strips owner name, colour, folder and origin from the
document a community grant reads. `communityNetwork` (`apps/api/src/community-network.ts`) maps an address to its
IPv4 /24 or IPv6 /56 for the limiter, report and count hashes.

Editor (`apps/live`):

- `apps/live/lib/api/community.ts`: `apiGetCommunityPost`, `apiPublishCommunityPost`, `apiRemoveCommunityPost`;
  error codes map to copy in `apps/live/lib/community-errors.ts`.
- `apps/live/hooks/persistence/useCommunityPost.ts`: loads the owner's post when the Share dialog opens; exposes
  `{ post, loading, error, publish(input), remove() }`.
- `apps/live/components/dialogs/community/`: `ShareDialogWithCommunity.tsx` composes the Share dialog with
  `CommunitySection.tsx` (its state chosen by the pure `community-section-state.ts`); `CommunityPublishDialog.tsx`
  (title, description with counter, `CategoryPicker.tsx`, `TagInput.tsx` over the pure `tag-draft.ts`,
  `CommunityCardPreview.tsx`, the consequences list) replaces the Share dialog while open, its draft and submit in
  `usePublishForm.ts`, per-field error copy in the pure `publish-field-errors.ts` drawn by `FieldError.tsx`; a first
  publish ends on `CommunityPublishedConfirmation.tsx`. `CommunityCardPreview` is the shared `CommunityPostTile` as a
  still preview (no `href`), its `image` slot holding the owner's own snapshot and `categoryLabel` asking for a
  category until one is chosen. The share password control is locked while the post is listed; with a share
  password set the section disables Share to Community and says "Remove the share password to share it to the
  Community." A hidden post's card says **Hidden after reports.** and offers no Edit Listing or
  Remove.
- Public badge: `apps/live/lib/community-state-store.ts` (an external store, seeded from the document fetch and
  updated by the Community section on publish or remove) feeds `SharedBadge`'s `community` state, labelled **Public**,
  which wins over Private, Shared and Team (only Local only beats it).
- `resolveDocumentSession` (`apps/live/app/document/[id]/editor-page-helpers.ts`) takes `community`: a community
  link resolves to a non-owner view session for everyone, the author included, so neither the post page's embed nor
  Open Document can edit the document; `CommunitySession.ownDocumentId` gives the author Edit Your Document in the bar.
- Share-view mode: `useIdentityBootstrap` stores `sessionCommunity` (in `editor-realtime.ts`) from the share resolve;
  when set, `useRoomConnection` gets `enabled: false`, the identity prompt is not opened, the visit is not recorded,
  and `apps/live/components/chrome/CommunityBar.tsx` renders under the header with the author
  (the shared `CommunityAuthorBadge`).
- `?copy=1` on `/document/shared` (`apps/live/hooks/canvas/useAutoCopyParam.ts`): once the document hydrates with a
  session share code, `makeCopy` runs once and the param is stripped.
- There is no moderation page and no operator route.

Community app (`apps/community`):

- `apps/community/lib/community-key.ts`: reads or mints (`crypto.randomUUID`) the key; SSR-safe; storage failures fall
  back to an in-memory key for the page's life. Never reads the guest owner id.
- `apps/community/lib/query-state.ts`: the URL query to and from the gallery's filters (pure, tested), via
  `parseCommunityListQuery` / `communityQueryParams`.
- `apps/community/lib/api.ts`: `fetchPosts`, `fetchMine`, `fetchFacets`, `fetchPost`, `likePost`, `unlikePost`,
  `reportPost`, with `NEXT_PUBLIC_API_BASE ?? '/api'`; `apps/community/lib/useLike.ts` is the optimistic like with rollback.
- Gallery (`apps/community/components/gallery/`): `GalleryView` over `useGallery`; `CommunityHero`, `SearchBox`
  (debounced `SEARCH_DEBOUNCE_MS`, Enter commits; the input and the controls in one flex row, so typed text never
  runs under them) holding Clear Search, the My Shares toggle (`aria-pressed`, where sign-in exists), `CategoryMenu`,
  `TagFilter` and `SortMenu` in its right edge, each over the shared `SearchControlButton` (icon only below `lg`),
  the menus sharing `MENU_PANEL` and `menuRadioRowClass` (`packages/ui/src/menu/menu-classes.ts`, also used by the editor mode menus); then `PostGrid` of `PostCard`,
  `LoadMore`, `GalleryStates`. Clear Search keeps the sort and `is:mine`. Category, tags and sort are words in `q`: `communitySearchCategory`, `communitySearchTags`,
  `communitySearchSort` and their setters (api-schema) read and write them; the worker's list reads them through
  `parseCommunityListQuery` (a word wins over the old parameter) and `listCommunityPosts` (each `#tag` an `EXISTS`);
  a legacy `?tag=`, `?category=` or `?sort=` folds into `q` in `readQueryState`. The search form sits on the
  toolbar layer (`--z-toolbar`): above the grid, below the sticky header and its menus.
- My Shares: `is:mine` (`COMMUNITY_MINE_TOKEN`) in `q` switches `useGallery` to `fetchMine`, with the Clerk session
  from `LazyClerkSession` (a `next/dynamic` import of `ClerkSession`, so Clerk loads only when My Shares is on);
  `apps/community/lib/session.ts` holds the publishable key (`signInAvailable` false without one hides the toggle),
  `SESSION_LOAD_TIMEOUT_MS` and `signInHref`. `MineSummary` shows the **Your Shares** totals above the grid. Waiting
  past `SESSION_LOAD_TIMEOUT_MS` for the session, `GalleryView` shows `GalleryError` with a reload.
- Post page (`apps/community/components/post/`): `PostView` over `usePost`, `EmbedFrame` (`/embed?s=<code>`, lazy,
  titled, falling back to the card image after 15 s), `PostMeta`, `PostActions`, `ReportDialog` (on the shared `Dialog` shell from `@livediagram/ui`, a phone sheet below `sm`), `RelatedPosts`.
  Links come from `apps/community/lib/links.ts`: Open Document `openDocumentHref` (`/document/shared?s=<code>`), Make
  a Copy `makeCopyHref` (`/document/shared?s=<code>&copy=1`). Once the post loads, `PostView` sets `document.title`
  and a `link rel="canonical"` to the post's own address (`apps/community/app/post/page.tsx` carries none).

## 6. Errors and edge cases

| Case                                    | Handling                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Publish on a document with a password   | 409 `share_password_set`; the section disables Share to Community and says why       |
| Password set on a published document    | 409 `community_published`; Share dialog explains                                     |
| Empty document                          | 409 `empty_document`; "Add something to your document before sharing it."            |
| 51st post                               | 409 `post_limit`                                                                     |
| Two first publishes at once             | 409 `already_published` (the one-post-per-document `UNIQUE`)                         |
| A previous owner's post                 | Reads as none; `PUT` replaces it, `DELETE` 404 (G7)                                  |
| My Shares, sign-in never loads          | After `SESSION_LOAD_TIMEOUT_MS`: "We couldn't load the Community." Try Again reloads |
| My Shares on a build without sign-in    | "My Shares needs an account."                                                        |
| Owner revokes all share links           | Community link untouched (filtered)                                                  |
| Document trashed                        | Hidden everywhere; post page 404; restore lists it again                             |
| Post hidden while a visitor has it open | Likes/reports 404; the UI shows "This post is no longer available."                  |
| Like twice / unlike twice               | Idempotent; counts recomputed                                                        |
| Report twice from one browser           | 204, row unchanged                                                                   |
| Storage blocked in the Community app    | In-memory key; likes work for the page's life                                        |
| Embed frame fails                       | Falls back to the card image with Open Document                                      |
| Author has no participant row           | Author `{ name: 'Someone', color: '#64748b', picture: null }`                        |
| Search with only stop characters        | Treated as no search                                                                 |
| Offset past the end                     | Empty `posts`, `nextOffset: null`                                                    |
| Copy by the author of their own post    | Counted only if a share code was presented and the caller is not the author          |

## 7. Security and trust

- Content-only pass: `resolveDocumentGrant` marks a community grant; `canReadDocument` and `gateGrant`
  (`apps/api/src/routes/context.ts`) refuse it unless the door passes `COMMUNITY_CONTENT`. Doors that pass it: the
  document GET (and its views), the tab GET (and its views), the thumbnail, images, copy and the room ticket (which
  then refuses with 403 `community_link`). Every other door (comments, comment pictures, changesets, timeline, Q&A
  board, and any new one) refuses by default.
- `redactElementsForCommunity` / `redactTabDataForCommunity` (`apps/api/src/community-redact.ts`): comment threads
  dropped; each action keeps its text and status, its assignee, team, assigner id and assigner name blanked. Applied
  to the tab GET for a community visit and to `copyDocument(..., redactForCommunity)`, which rebuilds the copy's
  activity index from the redacted data instead of copying the source's rows.
- No `recordVisitorOpened` / `recordVisitorCopied` for a community visit or copy.
- A hidden post's link: `resolveDocumentGrant` and the live image route answer nothing to anyone.
- `?copy=1` (`useAutoCopyParam`) copies only when the session came in through a community link.

- Trust boundary: the Community app is a public, unauthenticated surface. It never sends `X-Owner-Id`; the community
  key grants nothing but a like and a report.
- Publishing requires a verified Clerk identity (G1), so every public post is tied to an account.
- No owner id leaves the worker in any Community DTO; authors are participant display identities only.
- The community link is read-only (view role), cannot open the room, and cannot read comments.
- Abuse: `COMMUNITY_RATE_LIMITER` per network (`communityNetwork`) for all `/api/community/*` writes (the
  owner-keyed write limiter is skipped for these paths, because anonymous callers would all share its `anonymous` key;
  publishing, under `/api/documents/:id/community`, stays on the per-owner limiter); auto-hide needs three distinct
  networks; like and copy counts take at most `COMMUNITY_COUNTED_PER_NETWORK` rows per `network_hash`; reports are
  never cleared and a hidden post cannot be removed to clear them.
- `network_hash` = first 32 hex of SHA-256(`<postId>:<network>`): not comparable across posts.
- LIKE patterns escape `%`, `_` and `\` with `ESCAPE '\'`.

## 8. Performance and limits

- List: one indexed query, `LIMIT 25 OFFSET ?` (one extra row decides `nextOffset`), joined to `documents` (PK) and
  `participants` (PK). Search adds up to five `LIKE` predicates on `search_text`, acceptable at expected sizes (well
  under 100k posts); revisit with FTS5 beyond that.
- Facets: two aggregate queries over listed, untrashed posts.
- Card images reuse `/api/share/:code/image.svg` (R2-cached under `thumb-community/<id>`); a community link's image
  sends `public, max-age=30` with no stale window (`COMMUNITY_IMAGE_CACHE`, `apps/api/src/routes/share.ts`), so a
  hidden post's image goes within 30 seconds.
- Bodies are capped by the worker's existing `MAX_BODY_BYTES`; inputs by the constants above.

## 9. Presentation and UX

Final copy:

- Gallery search box: placeholder "Search..."; its label (visually hidden) "Search the Community".
- Share dialog section heading: **Community**. Unpublished: "The Community is public: anyone, with or without an
  account, can find this document there, view it and make their own copy." Button: **Share to Community**. With a
  share password set, the button is disabled beside "Remove the share password to share it to the Community." Guest: "Sign in to share your document with the
  Community." Button: **Sign In to Share**. Team document: "Team library documents can't be shared to the Community."
- Published: post title, category, "♥ n · Copied n times", **View Post**, **Edit Listing**, **Remove From Community**;
  hidden: "**Hidden after reports.** Several people reported it, so it was taken out of the Community for good. Only you
  can see it, and it can no longer be changed or removed." Remove asks in place: "Remove it from the Community? Its
  likes and copy count go too; copies people made stay theirs." **Keep It** / **Remove**.
- Publish dialog title: **Share to Community** / **Edit Listing**. Consequences: "Anyone can view this document and make
  their own copy." "Your later edits show in the Community too." "Comments stay private." "You can remove it at any
  time." Primary button: **Share to Community** / **Save Changes**.
- Gallery heading: **Community**; lead: "Documents people are proud of. Find inspiration, then make it your own."
- Empty (no posts): "Nothing here yet. Be the first to share a document." Empty (filters): "No documents match these
  filters." Button **Clear Filters**. Error: "We couldn't load the Community." Button **Try Again**.
- My Shares: signed out "Sign in to see your shares." with **Sign In**; nothing shared "You haven't shared anything
  yet." with **Share Your Own**; a build without sign-in "My Shares needs an account."; totals headed **Your Shares**.
- Post not found: "This document isn't in the Community any more." Link **Back to Community**.
- Community bar: "Shared to the Community by <name>" · **Back to Community** · **Make a Copy**.
- Report dialog: title **Report This Document**, reasons as radio rows, note optional, button **Send Report**,
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
client-side. Card images are `loading="lazy"` with fixed aspect boxes (CLS 0). LCP is the hero heading. Interactions
(search controls, likes) update optimistically (INP). Each post page names its own canonical address once it loads.

## 12. Observability

The telemetry dashboard reads these through a Community tab (`apps/telemetry/app/CommunityView.tsx`) and the
Community cards (`apps/telemetry/app/catalogue/community.ts`); its emitter scan recognises `siteTrack`, so the
Community app's events are covered by the completeness tests.

Worker logs with fingerprints: `[community] published`, `[community] updated`, `[community] removed`,
`[community] replaced a previous owner post`, `[community] auto-hidden`, `[community] rejected <code>` (including
`post_hidden`), `[community] publish retried after an id collision`, `[community] copy count failed`, and
`[tabs] refused a save onto another document's tab` (the tab id guard).

Browser warnings: `[community] capabilities unavailable; assuming on` (`useCommunityEnabled`), `[community] featured
load failed` (`CommunityShowcase`), `[community] switched off; leaving for the home page` (`CommunityGate`),
`[community] sign-in did not load; My Shares gives up`, `[community] gallery load failed`, `[community] facets load
failed`, `[community] load more failed`, `[community] post load failed`, `[community] report failed`; the Community
app's api errors read `[community] api <status> <code>`. Telemetry per the spec.

## 13. Testing

| Spec rule                                  | Test                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Tag normalisation, input validation, query | `packages/api-schema/src/community.test.ts`                                              |
| Publish guards, update, unpublish          | `apps/api/src/routes/community-routes.test.ts` (sqlite D1)                               |
| List filters, sorts, search, paging, trash | `apps/api/src/db/community.test.ts` (sqlite D1)                                          |
| Likes, reports, auto-hide, hidden is final | `apps/api/src/db/community.test.ts`, `apps/api/src/routes/community-routes.test.ts`      |
| Community link: unlisted, no join, no pw   | `apps/api/src/routes/community-routes.test.ts`                                           |
| Community link: no room                    | `apps/api/src/routes/document-room-routes.test.ts`                                       |
| Community grant                            | `apps/api/src/auth/document-access.test.ts`                                              |
| Switched off: routes, links, capabilities  | `apps/api/src/community-enabled.test.ts`, `apps/api/src/routes/community-routes.test.ts` |
| Switched off: apps menu, footer, fetch     | `packages/ui/src/community/useCommunityEnabled.test.tsx`                                 |
| Hidden is final (Share dialog)             | `apps/live/components/dialogs/community/CommunitySection.test.tsx`                       |
| Copy counting                              | `apps/api/src/db/community.test.ts`                                                      |
| Query state round trip                     | `apps/community/lib/query-state.test.ts`                                                 |
| Community key fallback                     | `apps/community/lib/community-key.test.ts`                                               |
| Router forwards `/community`               | `apps/router/src/index.test.ts`                                                          |
| Optimistic like and rollback               | `apps/community/components/shared/LikeButton.test.tsx`                                   |
| Copy once from `?copy=1`                   | `apps/live/hooks/canvas/useAutoCopyParam.test.tsx`                                       |
| Community section state, tag input         | `apps/live/components/dialogs/community/*.test.ts(x)`                                    |
| Editor api client and error copy           | `apps/live/lib/api/community.test.ts`                                                    |
| Network ranges (IPv4 /24, IPv6 /56)        | `apps/api/src/community-network.test.ts`                                                 |
| Redaction for strangers                    | `apps/api/src/community-redact.test.ts`                                                  |
| Community snapshot cache                   | `apps/api/src/thumbnail.test.ts`                                                         |
| Post row mapping (Anonymous, state)        | `apps/api/src/community-row.test.ts`                                                     |
| Tab id guard (`tab_id_taken`)              | `apps/api/src/routes/tab-put-route.test.ts`                                              |
| Public badge                               | `apps/live/components/chrome/SharedBadge.test.tsx`                                       |
| Community bar                              | `apps/live/components/chrome/CommunityBar.test.tsx`                                      |
| Share dialog with Community, switched off  | `apps/live/components/dialogs/community/ShareDialogWithCommunity.test.tsx`               |
| Community section, focus follows           | `apps/live/components/dialogs/community/CommunitySection.test.tsx`                       |
| Publish dialog pieces                      | `apps/live/components/dialogs/community/publish-pieces.test.tsx`                         |
| Owner post hook                            | `apps/live/hooks/persistence/useCommunityPost.test.tsx`                                  |
| Gallery states, My Shares, sign-in wait    | `apps/community/components/gallery/GalleryView.test.tsx`                                 |
| Post page, canonical                       | `apps/community/components/post/PostView.test.tsx`                                       |
| Sign-in session and switched-off gate      | `apps/community/components/auth-and-gate.test.tsx`                                       |
| Home page showcase                         | `apps/marketing/components/CommunityShowcase.test.tsx`                                   |
| Shared card, counts, author                | `packages/ui/src/community/community-pieces.test.tsx`                                    |
| Focus restore after an unmounting modal    | `packages/ui/src/useFocusTrap.test.tsx`                                                  |

## 14. Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows C1 to C17.

## 15. Assets and external resources

- App icon: `apps/community/app/icon.svg`, hand-authored in this repo (MIT).
- Glyphs: `apps/community/components/shared/icons.tsx` draws Lucide-derived primitives (`lucide*`) from the shared
  `@livediagram/icons` catalogue, under Lucide's ISC licence, credited on the generated `/licences` page.
