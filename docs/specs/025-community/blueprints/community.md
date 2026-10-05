# Community blueprint

Derived from [Community](../community.md). Implementation detail only; design decisions live in the spec.

## 1. Domain and naming

| Spec term      | Identifier                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| post           | `CommunityPost` (DTO), table `community_posts`, id column `id`                                            |
| author         | `CommunityAuthor` (`{ name, color, picture }`), column `author_id`                                        |
| category       | `CommunityCategory` (union of ids), `COMMUNITY_CATEGORIES` (ordered `{ id, label, blurb }[]`)             |
| tag            | `string` after `normaliseCommunityTag`; table `community_post_tags`                                       |
| like           | table `community_likes`, column `like_count`                                                              |
| copy count     | table `community_copies`, column `copy_count`                                                             |
| report         | `CommunityReportReason`, `COMMUNITY_REPORT_REASONS`, table `community_reports`                            |
| hidden         | `CommunityPostState = 'listed' \| 'hidden'`, `CommunityHiddenBy = 'reports' \| 'operator'`                |
| community link | `share_links.purpose = 'community'` (`SharePurpose = 'share' \| 'community'`)                             |
| community key  | header `X-Community-Key`, localStorage `livediagram:v2:community-key`                                     |
| operator       | env `COMMUNITY_OPERATOR_IDS`, `isCommunityOperator(env, userId)`                                          |
| sort           | `CommunitySort = 'new' \| 'loved' \| 'copied'`                                                            |
| Edit Listing   | the same `PUT /api/documents/:id/community` as publishing; the editor names the act, the api does not     |

Shared vocabulary (categories, reasons, limits, `normaliseCommunityTag`, `validateCommunityPostInput`, DTOs, sorts,
query parsing) lives in `packages/api-schema/src/community.ts`, exported from the package index, so the worker, the
editor and the Community app cannot disagree.

## 2. Constants and configuration

All in `packages/api-schema/src/community.ts`.

| Constant                           | Value | Provenance                                     | Safe range |
| ---------------------------------- | ----- | ---------------------------------------------- | ---------- |
| `COMMUNITY_TITLE_MIN` / `_MAX`     | 3/80  | spec "Title"                                   | fixed      |
| `COMMUNITY_DESCRIPTION_MIN`/`_MAX` | 20/500| spec "Description"                             | fixed      |
| `COMMUNITY_TAGS_MAX`               | 5     | spec "Tags"                                    | 1..10      |
| `COMMUNITY_TAG_MIN` / `_MAX`       | 2/24  | spec "Tags"                                    | fixed      |
| `COMMUNITY_REPORT_NOTE_MAX`        | 300   | spec "Reports"                                 | fixed      |
| `COMMUNITY_POSTS_PER_AUTHOR`       | 50    | spec "Publishing"                              | 10..500    |
| `COMMUNITY_PAGE_SIZE`              | 24    | spec "Gallery"                                 | 12..48     |
| `COMMUNITY_MAX_OFFSET`             | 2400  | D3 (100 pages)                                 | 480..10000 |
| `COMMUNITY_AUTO_HIDE_REPORTERS`    | 3     | spec "Reports"                                 | 2..10      |
| `COMMUNITY_POPULAR_TAGS`           | 24    | D4                                             | 8..48      |
| `COMMUNITY_RELATED_POSTS`          | 6     | spec "More Like This"                          | 3..12      |
| `COMMUNITY_SEARCH_TERMS_MAX`       | 5     | D5                                             | 1..10      |
| `COMMUNITY_SEARCH_TERM_MAX`        | 40    | D5                                             | 10..80     |
| `COMMUNITY_KEY_PATTERN`            | UUID v4 regex | D6                                     | fixed      |

Worker binding `COMMUNITY_RATE_LIMITER` (ratelimit, 30 per 60 s, keyed `community:<ip>`), production and staging.
Worker var `COMMUNITY_OPERATOR_IDS` (comma-separated Clerk user ids; unset = no operators), documented in
`apps/api/.env.example` / `.dev.vars` notes.

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
  hidden_by    TEXT NULL CHECK (hidden_by IN ('reports', 'operator')),
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

Field classification: `author_id`, `copier_id` are owner credentials for guests (never on the wire); `liker_key`,
`reporter_key` are worthless random keys (never on the wire); `network_hash` is a one-way per-post hash (never on the
wire); everything else is public post content.

- `tags` holds the display array (JSON); `community_post_tags` holds the same set for filtering. Both are rewritten in
  one batch on publish/update.
- `search_text` = lowercased `title + '\n' + description + '\n' + tags.join(' ')`.
- `like_count` / `copy_count` are recomputed with `(SELECT COUNT(*) ...)` in the same batch as the insert/delete that
  changes them, so they cannot drift.
- Post ids: `generateShareCode(10)` (same alphabet), re-minted once on a primary-key collision.
- Trash: posts are excluded wherever `documents.trashed_at IS NOT NULL` (join), never modified. Restore needs nothing.
- Permanent delete: `documents` row deletion cascades to `share_links` and `community_posts` (and its children).
- Unpublish: `DELETE FROM share_links WHERE code = ? AND purpose = 'community'` cascades the post and its children.
- Restoring a post (operator) deletes its reports in the same batch.
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
  id: string; title: string; description: string; category: CommunityCategory; tags: string[];
  likeCount: number; copyCount: number; publishedAt: number; updatedAt: number;
  shareCode: string; author: CommunityAuthor; liked: boolean;
};
type CommunityOwnPost = CommunityPost & { state: CommunityPostState };
type CommunityModerationItem = CommunityPost & {
  state: CommunityPostState; hiddenBy: CommunityHiddenBy | null;
  reports: { reason: CommunityReportReason; note: string | null; createdAt: number }[];
};
type CommunityPostInput = { title: string; description: string; category: string; tags: string[] };
type CommunityListQuery = { q: string; category: CommunityCategory | null; tag: string | null; sort: CommunitySort; offset: number };
```

Routes (all JSON; errors `{ error: <code> }`):

| Method + path                                  | Who                      | Success                                   | Rejections                                                                                                                                         |
| ---------------------------------------------- | ------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/documents/:id/community`             | owner                    | `{ post: CommunityOwnPost \| null }`      | 404 missing, 403 not owner                                                                                                                         |
| `PUT /api/documents/:id/community`             | owner, signed in         | 201 new / 200 update `{ post }`           | 401 `sign_in_required`, 403, 404, 409 `team_document`, 409 `share_password_set`, 409 `empty_document`, 409 `post_limit`, 400 `invalid_<field>`     |
| `DELETE /api/documents/:id/community`          | owner                    | 204                                       | 404 (also when not published), 403                                                                                                                 |
| `GET /api/community/posts?q&category&tag&sort&offset` | anyone            | `{ posts, nextOffset: number \| null }`   | 400 `invalid_query`                                                                                                                                |
| `GET /api/community/facets`                    | anyone                   | `{ categories: Record<id, n>, tags: {tag, count}[], total }` | none                                                                                                             |
| `GET /api/community/posts/:id`                 | anyone                   | `{ post, related: CommunityPost[] }`      | 404 missing, hidden, trashed                                                                                                                       |
| `PUT /api/community/posts/:id/like`            | community key            | `{ likeCount, liked: true }`              | 400 `community_key_required`, 404, 429                                                                                                             |
| `DELETE /api/community/posts/:id/like`         | community key            | `{ likeCount, liked: false }`             | as above                                                                                                                                           |
| `POST /api/community/posts/:id/report`         | community key            | 204 (also for a repeat)                   | 400 `community_key_required` / `invalid_reason` / `invalid_note`, 404, 429                                                                         |
| `GET /api/community/moderation`                | operator                 | `{ items: CommunityModerationItem[] }`    | 403 `operator_only`                                                                                                                                |
| `PUT /api/community/posts/:id/moderation`      | operator                 | `{ item }`                                | 403 `operator_only`, 404, 400 `invalid_state`                                                                                                      |

- `liked` is filled from `X-Community-Key` when present and valid, else false.
- List responses without a community key send `Cache-Control: public, max-age=30`; with one, `private, no-store`.
- Query parsing is `parseCommunityListQuery(URLSearchParams)` (api-schema): unknown sort → `new`, unknown category or
  bad tag → `invalid_query`, offset clamped to `[0, COMMUNITY_MAX_OFFSET]` and to multiples of nothing (any int).
- Validation is `validateCommunityPostInput(input)` → `{ ok: true, value } | { ok: false, error }`, trimming title and
  description, collapsing description runs of 3+ newlines to 2, normalising and de-duplicating tags.
- Share resolve (`GET /api/share/:code`) for a community link answers
  `{ document, role: 'view', tabId: null, community: { postId, author: CommunityAuthor } }`; a hidden post's community
  link answers 404. `ShareResolveResponse.community` is optional on the DTO.
- Owner-side share routes: `PUT /api/documents/:id/share-password` with a non-empty password on a published document
  answers 409 `community_published`.

Live share links: the live `ShareLink` type gains `purpose` but the owner list never contains community links.

## 5. Behaviour and state

Post state machine: (none) → `listed` (publish) → `hidden` (auto: reports, or operator) → `listed` (operator restore,
reports cleared) → (none) (unpublish or document delete, from either state). Trash is orthogonal: a trashed document's
post is invisible in every public read whatever its state.

Guards:

- G1 publish: `ctx.clerkUserId` non-null and `ownsDocument` and `teamId === null`.
- G2 publish: `getDocumentSharePassword` empty.
- G3 publish (new post only): `getDocumentThumbnailSvg` non-null; author has fewer than `COMMUNITY_POSTS_PER_AUTHOR`.
- G4 public reads: `state = 'listed' AND trashed_at IS NULL`.
- G5 like/report: valid community key, post passes G4.
- G6 operator: `clerkUserId` in `COMMUNITY_OPERATOR_IDS` (trimmed, empty entries dropped).
- Auto-hide (after each new report row): if `state = 'listed'` and `COUNT(DISTINCT reporter_key) >= 3` and
  `COUNT(DISTINCT network_hash) >= 3` then `state = 'hidden', hidden_by = 'reports'`.

Community link behaviour (keyed off `link.purpose === 'community'`):

- `routes/share.ts`: skip `recordSharedAccess`, `Document·Joined` and `notifyDocumentJoin`; add `community`.
- `routes/document-room-routes.ts`: ticket mint and WebSocket upgrade refuse with 403 `community_link`.
- `DocumentGrant` gains `community: boolean`; the tab GET strips comment elements and comment threads for such a
  grant (`stripCommentsForCommunity`), and the comment thread listing refuses it (403).
- `routes/documents.ts` copy: when `scope.community` (grant from a community code), after the copy succeeds
  `INSERT OR IGNORE community_copies` for the caller and recompute `copy_count` (waitUntil).
- Visitor-opened timeline events for the author are kept (they are about the author's own document).

Editor:

- `lib/api/community.ts`: `apiGetCommunityPost`, `apiPublishCommunityPost`, `apiRemoveCommunityPost`,
  `apiListModeration`, `apiModeratePost`.
- `hooks/persistence/useCommunityPost.ts`: loads the owner's post when the Share dialog opens; exposes
  `{ post, loading, error, publish(input), remove() }`.
- `components/dialogs/community/CommunitySection.tsx` inside the Share dialog; `CommunityPublishDialog.tsx`
  (title, description with counter, `CategoryTiles`, `TagInput`, card preview, consequences list).
- Share-view mode: `useIdentityBootstrap` stores `sessionCommunity` from the share resolve; when set,
  `useRoomConnection` gets `enabled: false`, the identity prompt is not opened, and `CommunityBar` renders under the
  header.
- `?copy=1` on `/document/shared`: once the document hydrates with a session share code, `makeCopy` runs once and the
  param is stripped.
- `/moderation` page (`apps/live/app/moderation/page.tsx`): requires sign-in; 403 renders "Only operators can moderate
  Community." Lists items with reports and Hide / Restore buttons. `LIVE_ROUTE_SEGMENTS` gains `moderation`.

Community app:

- `lib/community-key.ts`: `getCommunityKey()` reads or mints (crypto.randomUUID) the key; SSR-safe; storage failures
  fall back to an in-memory key for the page's life.
- `lib/query-state.ts`: `readQueryState(URLSearchParams)` / `writeQueryState(state)` (pure, tested), via
  `parseCommunityListQuery`.
- `lib/api.ts`: `fetchPosts`, `fetchFacets`, `fetchPost`, `likePost`, `unlikePost`, `reportPost`, with
  `NEXT_PUBLIC_API_BASE ?? '/api'`.
- Gallery: `GalleryView` owns state; `CommunityHero`, `SearchBox` (debounced 300 ms, Enter commits), `CategoryChips`,
  `SortMenu`, `TagCloud`, `PostGrid` of `PostCard`, `LoadMore`. Optimistic like with rollback on failure.
- Post page: `PostView` with `EmbedFrame` (`/embed?s=<code>`, `loading="lazy"`, title attribute), `PostMeta`,
  `LikeButton`, `ReportDialog`, `RelatedPosts`. Make a Copy → `/document/shared?s=<code>&copy=1`.

## 6. Errors and edge cases

| Case                                              | Handling                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Publish on a document with a password             | 409 `share_password_set`; dialog explains and links to Share settings                       |
| Password set on a published document              | 409 `community_published`; Share dialog explains                                            |
| Empty document                                    | 409 `empty_document`; "Add something to your board before sharing it."                       |
| 51st post                                         | 409 `post_limit`                                                                            |
| Owner revokes all share links                     | Community link untouched (filtered)                                                         |
| Document trashed                                  | Hidden everywhere; post page 404; restore lists it again                                    |
| Post hidden while a visitor has it open           | Likes/reports 404; the UI shows "This post is no longer available."                         |
| Like twice / unlike twice                         | Idempotent; counts recomputed                                                               |
| Report twice from one browser                     | 204, row unchanged                                                                          |
| Storage blocked in the Community app              | In-memory key; likes work for the page's life                                               |
| Embed frame fails                                 | Falls back to the card image with Open Board                                                |
| Author has no participant row                     | Author `{ name: 'Someone', color: '#64748b', picture: null }`                               |
| Search with only stop characters                  | Treated as no search                                                                        |
| Offset past the end                               | Empty `posts`, `nextOffset: null`                                                           |
| Copy by the author of their own post              | Counted only if a share code was presented and the caller is not the author                 |

## 7. Security and trust

- Trust boundary: the Community app is a public, unauthenticated surface. It never sends `X-Owner-Id`; the community
  key grants nothing but a like and a report.
- Publishing requires a verified Clerk identity (G1), so every public post is tied to an account.
- No owner id leaves the worker in any Community DTO; authors are participant display identities only.
- The community link is read-only (view role), cannot open the room, and cannot read comments.
- Abuse: `COMMUNITY_RATE_LIMITER` per IP for all `/api/community/*` writes (the owner-keyed write limiter is skipped
  for these paths, because anonymous callers would all share its `anonymous` key); auto-hide needs three distinct
  networks; reports cleared only by an operator.
- `network_hash` = first 32 hex of SHA-256(`<postId>:<ip>`): not comparable across posts.
- LIKE patterns escape `%`, `_` and `\` with `ESCAPE '\'`.
- Operator ids come only from the worker env, compared against the verified Clerk id.

## 8. Performance and limits

- List: one indexed query, `LIMIT 25 OFFSET ?` (one extra row decides `nextOffset`), joined to `documents` (PK) and
  `participants` (PK). Search adds up to five `LIKE` predicates on `search_text`, acceptable at expected sizes (well
  under 100k posts); revisit with FTS5 beyond that.
- Facets: two aggregate queries over listed, untrashed posts.
- Card images reuse `/api/share/:code/image.svg` (R2-cached, `max-age=30, stale-while-revalidate=300`).
- Bodies are capped by the worker's existing `MAX_BODY_BYTES`; inputs by the constants above.

## 9. Presentation and UX

Final copy:

- Share dialog section heading: **Community**. Unpublished: "Share this board with the Community so others can find it,
  learn from it and make their own copy." Button: **Share to Community**. Guest: "Sign in to share your board with the
  Community." Button: **Sign In to Share**. Team document: "Team library documents can't be shared to the Community."
- Published: post title, category, "♥ n · Copied n times", **View Post**, **Edit Listing**, **Remove From Community**;
  hidden: "Hidden from the Community after reports."
- Publish dialog title: **Share to Community** / **Edit Listing**. Consequences: "Anyone can view this board and make
  their own copy." "Your later edits show in the Community too." "Comments stay private." "You can remove it at any
  time." Primary button: **Share to Community** / **Save Changes**.
- Gallery heading: **Community**; lead: "Boards people are proud of. Find inspiration, then make it your own."
- Empty (no posts): "Nothing here yet. Be the first to share a board." Empty (filters): "No boards match these
  filters." Button **Clear Filters**. Error: "We couldn't load the Community." Button **Try Again**.
- Post not found: "This board isn't in the Community any more." Link **Back to Community**.
- Community bar: "Shared to the Community by <name>" · **Back to Community** · **Make a Copy**.
- Report dialog: title **Report This Board**, reasons as radio rows, note optional, button **Send Report**,
  confirmation "Thanks. We'll take a look."

Layout: gallery grid 1 / 2 / 3 / 4 columns at <640 / 640 / 1024 / 1280 px; cards with a 4:3 image area on a subtle
dot-grid background; skeleton cards of the same size while loading.

## 10. Accessibility

Chips are `button`s with `aria-pressed`; the sort menu uses the shared menu keyboard; the like button has
`aria-pressed` and an `aria-label` with the count; card images carry `alt` = title; the embed frame has a `title`; the
report dialog traps focus and returns it; search has a visible label (sr-only) and `role="search"`. Colours from the
shared Tailwind theme meet AA in light and dark. Reduced motion disables card lift and heart animation.

## 11. Web Experience

The gallery shell, hero and filters render statically (no layout shift: the grid reserves skeleton cards); posts load
client-side. Card images are `loading="lazy"` with fixed aspect boxes (CLS 0). LCP is the hero heading. Interactions
(chip toggles, likes) update optimistically (INP).

## 12. Observability

Worker logs with fingerprints: `[community] published`, `[community] updated`, `[community] removed`,
`[community] auto-hidden`, `[community] moderated`, `[community] rejected <code>`. Telemetry per the spec.

## 13. Testing

| Spec rule                                    | Test                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Tag normalisation, input validation, query   | `packages/api-schema/src/community.test.ts`                              |
| Publish guards, update, unpublish, cap       | `apps/api/src/routes/community-owner-routes.test.ts` (sqlite D1)         |
| List filters, sorts, search, paging, trash   | `apps/api/src/db/community.test.ts` (sqlite D1)                          |
| Likes, reports, auto-hide, moderation        | `apps/api/src/db/community.test.ts`, `routes/community-routes.test.ts`   |
| Community link: unlisted, no room, no join   | `apps/api/src/routes/community-link.test.ts`                             |
| Copy counting                                | `apps/api/src/db/community.test.ts`                                      |
| Query state round trip                       | `apps/community/lib/query-state.test.ts`                                 |
| Community key fallback                       | `apps/community/lib/community-key.test.ts`                               |
| Router forwards `/community`                 | `apps/router/src/index.test.ts`                                          |

## 14. Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows C1 to C9.
