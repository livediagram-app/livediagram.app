# Community: blueprint

Derived from [community.md](../community.md). The spec decides; this file only adds engineering precision, read from
the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `COMn`.
Paths are relative to the repository root.

Scope, by file:

| File                                                         | Role                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/community/src/index.ts`                  | The Worker: 404 outside `/api/community`; `/app/*` to `handleApp` (no CORS); `OPTIONS` to `preflight`; the rest to `handlePublic` through `withCors`                                                                                                           |
| `liveworkspace/apps/community/src/config.ts`                 | `API_PATH`, `LIST_MAX_AGE_S`, `FEATURED_MAX_AGE_S`, `SITEMAP_MAX_AGE_S`, `MAX_BODY_BYTES`                                                                                                                                                                      |
| `liveworkspace/apps/community/src/env.ts`                    | `Env`, `appKey`, `communityEnabled`                                                                                                                                                                                                                            |
| `liveworkspace/apps/community/src/http.ts`                   | `json`, `notFound`, `badRequest`, `conflict`, `noContent`, `originApp`, `withCors`, `preflight`, `edgeCached`                                                                                                                                                  |
| `liveworkspace/apps/community/src/network.ts`                | `networkHash(postId, ip)`, `clientIp`                                                                                                                                                                                                                          |
| `liveworkspace/apps/community/src/public-routes.ts`          | `handlePublic`, `withLikes`, `readReport`                                                                                                                                                                                                                      |
| `liveworkspace/apps/community/src/app-routes.ts`             | `handleApp`, `callerApp`, `publish`, `parseAuthor`, `parseSync`                                                                                                                                                                                                |
| `liveworkspace/apps/community/src/posts.ts`                  | Post writes (`createPost`, `updatePost`, `deletePost`, `syncDocuments`) and reads (`listPosts`, `facets`, `getPublicPost`, `listRelatedPosts`, `listFeaturedPosts`, `listSitemap`, `listHiddenSince`, `mineTotals`, `countPostsByOwner`, `getPostForDocument`) |
| `liveworkspace/apps/community/src/engagement.ts`             | `likedPostIds`, `setLike`, `recordCopy`, `forgetCopier`, `mergeCopier`, `recordReport`                                                                                                                                                                         |
| `liveworkspace/apps/community/src/rows.ts`                   | `PostRow`, `POST_COLS`, `PUBLIC_POST`, `rowToPost`, `rowAuthor`, `rowState`, `parseTags`, `searchText`, `likePattern`, `newPostId`                                                                                                                             |
| `liveworkspace/apps/community/src/test-sqlite-d1.ts`         | A real SQLite behind the D1 API for the tests                                                                                                                                                                                                                  |
| `liveworkspace/apps/community/migrations/0001_community.sql` | `posts`, `post_tags`, `likes`, `copies`, `reports` and their indexes                                                                                                                                                                                           |
| `packages/community/src/apps.ts`                             | `COMMUNITY_APPS`, `COMMUNITY_APP_ORIGINS`, `communityAppOfOrigin`                                                                                                                                                                                              |
| `packages/community/src/post.ts`                             | Categories, report reasons, every limit, `COMMUNITY_KEY_HEADER`, `isCommunityKey`, `normaliseCommunityTag`, `validateCommunityPostInput`, the wire shapes                                                                                                      |
| `packages/community/src/query.ts`                            | Sorts, search tokens (`#tag`, `sort:`, `category:`, `is:mine`), `parseCommunityListQuery`, `communityQueryParams`                                                                                                                                              |
| `packages/community/src/network.ts`                          | `communityNetwork(ip)`: IPv4 /24, IPv6 /56                                                                                                                                                                                                                     |
| `packages/community/src/service.ts`                          | `COMMUNITY_API_PATH`, `COMMUNITY_API_URL`, `COMMUNITY_APP_PARAM`, `COMMUNITY_APP_HEADER`, document states, `COMMUNITY_SYNC_MAX`, the app wire shapes                                                                                                           |
| `packages/community/src/authors.ts`                          | `COMMUNITY_ANONYMOUS_AUTHOR`, `COMMUNITY_UNKNOWN_AUTHOR`                                                                                                                                                                                                       |

## Domain and naming

| Term           | Identifier                                                                   | Meaning                                                                             |
| -------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| App            | `CommunityApp`: `livediagram.app`, `liveplanner.app`                         | The two apps with a Community                                                       |
| Post           | `posts` row; id `newPostId()` (10 characters)                                | One published document, per app                                                     |
| Document       | `posts.document`                                                             | The app's document id; opaque, never in a public answer                             |
| Share code     | `posts.share_code`                                                           | The document's community link; the only document handle the public sees             |
| Owner          | `posts.owner`                                                                | The author's account id in the app; never in a public answer                        |
| Document state | `CommunityDocumentState` `public` / `closed` / `away`                        | Where the document stands in its app, as the app last said                          |
| Post state     | `CommunityPostState` `listed` / `hidden`                                     | `hidden` after reports, final                                                       |
| Public post    | `PUBLIC_POST` = `app = ? AND state = 'listed' AND document_state = 'public'` | What the public sees                                                                |
| Own post       | `OWN_POST` = `app = ? AND owner = ? AND document_state <> 'away'`            | My Shares (hidden and closed included)                                              |
| Community key  | `X-Community-Key`, a v4 UUID (`isCommunityKey`)                              | A per-browser random key for likes and reports; never an owner id                   |
| Network        | `communityNetwork(ip)`                                                       | `a.b.c.0/24` for IPv4, the /56 for IPv6, the raw string otherwise                   |
| Network hash   | `networkHash(postId, ip)`                                                    | First 16 bytes of SHA-256 of `<postId>:<network>`, hex; not comparable across posts |
| Copier         | `copies.copier`                                                              | The app's one-way hash of who copied                                                |

Categories (`COMMUNITY_CATEGORIES` ids): `architecture`, `flows`, `planning`, `workshops`, `mindmaps`, `design`,
`data`, `learning`, `infographics`, `art`, `other`. Report reasons: `spam`, `offensive`, `personal-info`, `copyright`,
`other`. Sorts: `new`, `loved`, `copied`.

## Behaviour and state

### A post's states

| From                      | Event                                                              | To                               |
| ------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| none                      | `PUT /app/documents/:doc` by an owner under the limit              | listed, `document_state` as sent |
| listed or hidden, owner X | `PUT` by X with `create: true`                                     | same; `409 already_published`    |
| listed, owner X           | `PUT` by X                                                         | listed, details updated          |
| hidden, owner X           | `PUT` by X                                                         | hidden; `409 post_hidden`        |
| any, owner X              | `PUT` by Y (the document changed hands), Y under the limit         | X's post deleted, Y's created    |
| listed, owner X           | `DELETE` by X                                                      | none (cascade)                   |
| hidden                    | `DELETE` by its owner                                              | hidden; `409 post_hidden`        |
| any                       | `POST /app/sync` with a state                                      | `document_state` set             |
| any                       | `POST /app/sync` with it in `gone`                                 | none (cascade)                   |
| listed                    | a third report, from 3 distinct keys and 3 distinct network hashes | hidden, `hidden_at = now`        |

### Publish (`publish`), in order

1. JSON body ≤ `MAX_BODY_BYTES` (64 KiB), else `400 invalid_body`.
2. `validateCommunityPostInput(body.input)`: title trimmed and whitespace-collapsed, 3 to 80; description trimmed,
   `\r\n` to `\n`, three or more newlines to two, 20 to 500; a known category; tags each normalised
   (`normaliseCommunityTag`: lowercase, whitespace and `_` to `-`, only `a-z0-9-`, hyphen runs collapsed, 2 to 24) and
   de-duplicated, at most 5, any tag failing normalisation fails the field; `anonymous` true unless exactly `false`.
   The first failing field's code: `400 invalid_title` / `invalid_description` / `invalid_category` / `invalid_tags`.
3. `owner` and `shareCode` ids (1 to 200 characters), `documentState` one of three, and an author (`parseAuthor`:
   name trimmed and cut to 80, non-empty; colour `#rrggbb`; picture kept only when `https://` and ≤ 2048), else
   `400 invalid_body`.
4. The document's existing post, if any. Same owner: `create: true` is `409 already_published`; hidden is
   `409 post_hidden`; else `updatePost` (details, author, share code, document state, `updated_at`; likes, copies,
   state and `published_at` kept; tags rewritten) and `200 { post }`.
5. `countPostsByOwner(app, owner) >= COMMUNITY_POSTS_PER_AUTHOR` (50): `409 post_limit`.
6. Another owner's post on the document: deleted (logged `replaced a previous owner post`).
7. `createPost`: one batch (the row, its `post_tags`). An id collision (`posts.id` in the error) retries once with a
   new id; a `UNIQUE` failure on the document is `409 already_published`.
8. `201 { post: CommunityAppPost }` (`own: true`, `state`).

### Sync (`syncDocuments`)

`{ documents: [{ document, state }], gone: [document] }`, together at most `COMMUNITY_SYNC_MAX` (500), each id 1 to
200, each state valid, else `400 invalid_sync`. One batch: one `UPDATE … WHERE document IN (json_each(?))` per
distinct state, one `DELETE` for `gone`; at most four statements whatever the count.

### Likes, copies, reports (`engagement.ts`)

- **Like** `setLike`: `INSERT OR IGNORE` or `DELETE` by `(post_id, liker_key)`, then `RECOUNT_LIKES`, then read the
  count, in one batch, so the answer is the count this change left.
- **Counted count**: `SUM(MIN(n, 5))` over `COUNT(*)` grouped by `network_hash` (`COMMUNITY_COUNTED_PER_NETWORK`);
  every row is stored, but one network adds at most five.
- **Copy** `recordCopy`: `INSERT OR IGNORE` by `(post_id, copier)`, then the capped recount.
- **Forget a copier** (account deleted): their copies of the app's posts deleted, those posts recounted.
- **Merge a copier** (guest signed up): copies re-keyed to `to` with `INSERT OR IGNORE` (a post both copied keeps
  one), the old rows deleted, `to`'s posts recounted.
- **Report** `recordReport`: `INSERT OR IGNORE` by `(post_id, reporter_key)`; when it inserted, `UPDATE posts SET
state = 'hidden', hidden_at = now WHERE state = 'listed'` and at least 3 distinct keys and 3 distinct network
  hashes (`COMMUNITY_AUTO_HIDE_REPORTERS`). Logged `[community] auto-hidden` when it hid.

### Reads

- **List** `listPosts`: `PUBLIC_POST` (or `OWN_POST` for My Shares); `category`; every tag (`tag` param and each
  `#tag` in `q`, at most 5) as `EXISTS (post_tags …)`; every plain term (lowercased, at most 5, each cut to 40) as
  `search_text LIKE '%term%' ESCAPE '\'` with `\ % _` escaped; ordered `new` = `published_at DESC, id`, `loved` =
  `like_count DESC, published_at DESC, id`, `copied` likewise by `copy_count`; `LIMIT 25 OFFSET offset`. `nextOffset`
  is `offset + 24` when a 25th row came back and that does not pass `COMMUNITY_MAX_OFFSET` (2400), else null.
- **Query parsing** `parseCommunityListQuery`: `q` trimmed and cut to 200; an unknown `category` or a tag that does not
  normalise fails (`400 invalid_query`); an unknown sort is `new`; `offset` clamped to 0..2400; `sort:` and
  `category:` tokens in `q` win over the params.
- **One post**: `getPublicPost`, then `listRelatedPosts` (same category, not itself, `like_count DESC,
published_at DESC`, at most 6).
- **Featured**: likes in the last 90 days (`COMMUNITY_FEATURED_WINDOW_MS`) through `INDEXED BY idx_likes_created`,
  grouped by post and network and capped at 5 per network, joined to public posts, `recent_likes DESC, like_count
DESC, published_at DESC`, at most 6; fewer than 6 is topped up by `like_count + copy_count DESC, published_at DESC`.
- **Facets**: one batch, per-category counts and the top 24 tags (`COMMUNITY_POPULAR_TAGS`, `n DESC, tag`), over
  public posts; `total` is the category sum.
- **Sitemap**: public posts `published_at DESC, id`, at most 5000 (`COMMUNITY_SITEMAP_MAX`), `{ id, updatedAt }`.
- **Hidden since**: `{ document, hiddenAt }` of the app's posts with `hidden_at >= since`, by `hidden_at`.
- **My Shares totals**: `COUNT(*)`, `SUM(like_count)`, `SUM(copy_count)` over `OWN_POST`.
- **Likes for a page**: one `SELECT post_id FROM likes WHERE liker_key = ? AND post_id IN (json_each(?))`.

## Interfaces and contracts

### Public routes (`/api/community`, `?app=` required)

| Route                                        | Key header | Answers                                                                                                                                                                       | Cache                                                            |
| -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /posts?q=&category=&tag=&sort=&offset=` | optional   | `200 { posts: CommunityPost[], nextOffset }`; `400 invalid_query`                                                                                                             | `public, max-age=30` without a key; `private, no-store` with one |
| `GET /posts/:id`                             | optional   | `200 { post, related }`; `404 not_found`                                                                                                                                      | as `/posts`                                                      |
| `GET /featured`                              | ignored    | `200 { posts }` (`liked` always false)                                                                                                                                        | edge and `public, max-age=60`                                    |
| `GET /facets`                                | ignored    | `200 { total, categories, tags: [{ tag, count }] }`                                                                                                                           | edge and `public, max-age=30`                                    |
| `GET /sitemap`                               | ignored    | `200 { posts: [{ id, updatedAt }] }`                                                                                                                                          | edge and `public, max-age=3600`                                  |
| `PUT`/`DELETE /posts/:id/like`               | required   | `200 { likeCount, liked }`; `400 community_key_required`; `429 rate_limited`; `404`                                                                                           | none                                                             |
| `POST /posts/:id/report`                     | required   | `{ reason, note? }` (note trimmed, ≤ 300): `204` always on success; `400 invalid_reason` / `invalid_note`; `429`; `404`                                                       | none                                                             |
| any, without a valid `app`                   |            | `400 invalid_app`                                                                                                                                                             |                                                                  |
| `OPTIONS` any                                |            | `204`, `Allow-Methods: GET, PUT, DELETE, POST`, `Allow-Headers: Content-Type, X-Community-Key`, `Max-Age: 86400`, `Vary: Origin`; `Allow-Origin` only for an app's own origin |                                                                  |

`CommunityPost`: `{ id, title, description, category, tags, likeCount, copyCount, publishedAt, updatedAt, shareCode,
author: { name, color, picture }, anonymous, liked }`; an anonymous post's author is `COMMUNITY_ANONYMOUS_AUTHOR`.
Reads carry `Access-Control-Allow-Origin: *`; writes echo the `Origin` (with `Vary: Origin`) only when it is an app's
own (`COMMUNITY_APP_ORIGINS`) or, in development, localhost. Edge entries are keyed `<origin><path>?app=<app>`.

### App routes (`/api/community/app`, server to server)

Every request carries `X-Community-App: <app>` and `Authorization: Bearer <COMMUNITY_KEY_<APP>>`, compared with
`timingSafeEqual`; otherwise `401 { error: 'unauthorized' }`.

| Route                                              | Request                                                       | Answers                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /documents/:doc?owner=`                       |                                                               | `200 { post: CommunityAppPost \| null }`; `400 invalid_owner`                                               |
| `PUT /documents/:doc`                              | `{ input, owner, shareCode, documentState, author, create? }` | `201`/`200 { post }`; `400` field or `invalid_body`; `409 already_published` / `post_hidden` / `post_limit` |
| `DELETE /documents/:doc?owner=`                    |                                                               | `204`; `404` (none, or not the owner's); `409 post_hidden`; `400 invalid_owner`                             |
| `POST /sync`                                       | `{ documents: [{ document, state }], gone: [] }`              | `204`; `400 invalid_sync`                                                                                   |
| `GET /hidden?since=`                               |                                                               | `200 { hidden: [{ document, hiddenAt }] }`; `400 invalid_since`                                             |
| `GET /mine?owner=&q=&category=&tag=&sort=&offset=` | optional `X-Community-Key` (the page's)                       | `200 { posts: CommunityMinePost[], nextOffset, totals }`, `private, no-store`                               |
| `POST /copies`                                     | `{ document, copier, ip }`                                    | `204`; `404`; `400 invalid_copy`                                                                            |
| `POST /copiers/forget`                             | `{ copier }`                                                  | `204`; `400 invalid_copier`                                                                                 |
| `POST /copiers/merge`                              | `{ from, to }`                                                | `204`; `400 invalid_copier`                                                                                 |
| anything else                                      |                                                               | `404`                                                                                                       |

`CommunityAppPost` is a `CommunityPost` plus `state` and `own`; `CommunityMinePost` plus `state` and `documentId`.

## Data and persistence

`posts`:

| Column                                                 | Notes                                   | Written by                     | Read by                        |
| ------------------------------------------------------ | --------------------------------------- | ------------------------------ | ------------------------------ |
| `id` TEXT PK                                           | `newPostId()`                           | `createPost`                   | every read                     |
| `app`, `document`                                      | `UNIQUE (app, document)`                | `createPost`                   | `getPostForDocument`, sync     |
| `share_code`                                           | `UNIQUE (app, share_code)`              | `createPost`, `updatePost`     | `rowToPost`                    |
| `owner`                                                |                                         | `createPost`                   | limit, My Shares, delete check |
| `author_name`, `author_color`, `author_picture` (null) |                                         | publish, edit                  | `rowAuthor`                    |
| `anonymous` INT default 1                              |                                         | publish, edit                  | `rowAuthor`, `rowToPost`       |
| `title`, `description`, `category`                     |                                         | publish, edit                  | reads, facets                  |
| `tags` TEXT JSON default `'[]'`                        | display; `post_tags` holds the same set | publish, edit                  | `parseTags`                    |
| `search_text`                                          | lowercased title, description, tags     | publish, edit                  | `LIKE` terms                   |
| `document_state` default `public`                      | `CHECK IN ('public','closed','away')`   | publish, edit, sync            | `PUBLIC_POST`, `OWN_POST`      |
| `like_count`, `copy_count` default 0                   | capped recounts                         | `setLike`, copies              | sorts, featured                |
| `state` default `listed`                               | `CHECK IN ('listed','hidden')`          | `recordReport`                 | `PUBLIC_POST`, `rowState`      |
| `hidden_at` null                                       |                                         | `recordReport`                 | `/hidden`                      |
| `published_at`, `updated_at`                           |                                         | create; edit sets `updated_at` | sorts, sitemap                 |

Indexes: `idx_posts_new (app, state, document_state, published_at DESC)`; `idx_posts_loved (…, like_count DESC,
published_at DESC)`; `idx_posts_copied (…, copy_count DESC, published_at DESC)`; `idx_posts_category (app, category,
state, document_state, published_at DESC)`; `idx_posts_owner (app, owner)`; `idx_posts_hidden (app, hidden_at) WHERE
hidden_at IS NOT NULL`.

| Table       | Key                       | Columns                                                                            | Index                            |
| ----------- | ------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `post_tags` | `(post_id, tag)`          | cascade on post delete                                                             | `idx_post_tags_tag (tag)`        |
| `likes`     | `(post_id, liker_key)`    | `network_hash`, `created_at`; cascade                                              | `idx_likes_created (created_at)` |
| `copies`    | `(post_id, copier)`       | `network_hash`, `created_at`; cascade                                              | `idx_copies_copier (copier)`     |
| `reports`   | `(post_id, reporter_key)` | `network_hash`, `reason` (`CHECK` five values), `note` null, `created_at`; cascade | none                             |

## Errors and edge cases

| Case                                            | Answer                                                       |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `COMMUNITY_ENABLED` `false`/`0`/`off`           | every route `404 not_found` (public ones with CORS)          |
| Path outside `/api/community`                   | `404 Not found` (liveworkspace.app hosts no Community pages) |
| A post of another app, hidden, or not public    | `404` on public reads and writes                             |
| Two first publishes at once                     | the second `409 already_published`                           |
| A JSON `null` report body                       | `400 invalid_reason`, never a 500                            |
| A `tags` column that is not a JSON string array | read as no tags                                              |
| An unknown stored category                      | read as `other`                                              |
| Load More past offset 2400                      | `nextOffset: null`, so the last page never repeats           |
| An edge-cached answer (immutable headers)       | copied before CORS headers are set                           |
| A report that hid the post                      | the same `204` as one that did not                           |

## Security and trust

- The public never sees an owner or a document id; likes and reports carry the community key, never an owner.
- Writes from browsers are limited per network (`COMMUNITY_RATE_LIMITER`, 30 per 60 s, key `communityNetwork(ip)`),
  checked before the post is read; `clientIp` is `CF-Connecting-IP`, `127.0.0.1` locally.
- Network hashes are salted with the post id, so nothing is comparable across posts.
- App routes need the app's key; each app's key speaks only for it. Only `COMMUNITY_KEY_LIVEDIAGRAM` and
  `COMMUNITY_KEY_LIVEPLANNER` exist.
- The app checks what only it can (ownership, publishable document) before calling.

## Performance and limits

Every list is one indexed query plus one row; a sync is at most four statements; featured is two queries over the
`created_at` index; three answers sit at the edge (30 s, 60 s, 3600 s). Figures are in
[community.md "Performance"](../community.md#performance).

## Observability

| Level   | Line                                                | Where              |
| ------- | --------------------------------------------------- | ------------------ |
| `log`   | `[community] published { app, postId, category }`   | `app-routes.ts`    |
| `log`   | `[community] updated { app, postId }`               | `app-routes.ts`    |
| `log`   | `[community] removed { app, postId }`               | `app-routes.ts`    |
| `log`   | `[community] replaced a previous owner post`        | `app-routes.ts`    |
| `log`   | `[community] auto-hidden { app, postId }`           | `public-routes.ts` |
| `warn`  | `[community] publish retried after an id collision` | `posts.ts`         |
| `error` | `cache put failed`                                  | `http.ts`          |

## Testing

| Test                                     | Pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/community/src/index.test.ts`       | app auth; publish and edit with normalised input; second first publish; field codes; keep; the per-app limit; replacing a previous owner; hidden posts never edited or removed; remove; sync bounds; My Shares totals and hearts, uncached; copies once per person, forget and merge; hidden list per app; `app` required; public reads cacheable without a key, private with one; writes only from an app; three reports hide; the network budget; off; nothing outside the API |
| `apps/community/src/posts.test.ts`       | one post per document per app; edits keep counts and date; cascades; Anonymous; no owner or document id; app, hidden and document-state visibility; filters, literal `LIKE`, sorts, paging and the deepest offset; facets; related; owner lists; gone documents; hidden since; idempotent likes and copies; the five-per-network cap; forget and merge; auto-hide; featured ranking, the per-network cap there, six public posts of the app                                      |
| `apps/community/src/network.test.ts`     | the network hash's form                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/community/src/post.test.ts`    | tag normalisation; input validation (title, description, missing body, anonymous); error fields; query parsing (defaults, lenient sort and offset, strict category and tag, round trip); search terms, tags, sort, category and `is:mine` tokens; the key pattern; categories' ids and types                                                                                                                                                                                     |
| `packages/community/src/network.test.ts` | IPv4 /24, IPv6 /56 in any notation, anything else as itself                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/community/src/apps.test.ts`    | the two apps' origins and nobody else's                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Constants and configuration

| Constant                             | Value                                            | Where                               | Used by                   |
| ------------------------------------ | ------------------------------------------------ | ----------------------------------- | ------------------------- |
| `COMMUNITY_API_PATH`                 | `'/api/community'`                               | `packages/community/src/service.ts` | routing                   |
| `COMMUNITY_APP_PARAM`                | `'app'`                                          | `service.ts`                        | public routes             |
| `COMMUNITY_APP_HEADER`               | `'X-Community-App'`                              | `service.ts`                        | app routes                |
| `COMMUNITY_KEY_HEADER`               | `'X-Community-Key'`                              | `post.ts`                           | likes, reports, My Shares |
| `COMMUNITY_SYNC_MAX`                 | `500`                                            | `service.ts`                        | `parseSync`               |
| `COMMUNITY_TITLE_MIN` / `_MAX`       | `3` / `80`                                       | `post.ts`                           | validation                |
| `COMMUNITY_DESCRIPTION_MIN` / `_MAX` | `20` / `500`                                     | `post.ts`                           | validation                |
| `COMMUNITY_TAGS_MAX`                 | `5`                                              | `post.ts`                           | validation, search tags   |
| `COMMUNITY_TAG_MIN` / `_MAX`         | `2` / `24`                                       | `post.ts`                           | `normaliseCommunityTag`   |
| `COMMUNITY_REPORT_NOTE_MAX`          | `300`                                            | `post.ts`                           | `readReport`              |
| `COMMUNITY_POSTS_PER_AUTHOR`         | `50`                                             | `post.ts`                           | publish                   |
| `COMMUNITY_PAGE_SIZE`                | `24`                                             | `post.ts`                           | lists                     |
| `COMMUNITY_MAX_OFFSET`               | `2400`                                           | `post.ts`                           | paging                    |
| `COMMUNITY_AUTO_HIDE_REPORTERS`      | `3`                                              | `post.ts`                           | `recordReport`            |
| `COMMUNITY_COUNTED_PER_NETWORK`      | `5`                                              | `post.ts`                           | counts, featured          |
| `COMMUNITY_POPULAR_TAGS`             | `24`                                             | `post.ts`                           | facets                    |
| `COMMUNITY_RELATED_POSTS`            | `6`                                              | `post.ts`                           | related                   |
| `COMMUNITY_SEARCH_TERMS_MAX`         | `5`                                              | `post.ts`                           | search terms              |
| `COMMUNITY_SEARCH_TERM_MAX`          | `40`                                             | `post.ts`                           | search terms              |
| `COMMUNITY_SEARCH_MAX`               | `200`                                            | `post.ts`                           | `q`                       |
| `COMMUNITY_FEATURED_COUNT`           | `6`                                              | `post.ts`                           | featured                  |
| `COMMUNITY_FEATURED_WINDOW_MS`       | `90 * 24 * 60 * 60 * 1000`                       | `post.ts`                           | featured                  |
| `COMMUNITY_SITEMAP_MAX`              | `5000`                                           | `post.ts`                           | sitemap                   |
| `LIST_MAX_AGE_S`                     | `30`                                             | `apps/community/src/config.ts`      | lists, facets             |
| `FEATURED_MAX_AGE_S`                 | `60`                                             | `config.ts`                         | featured                  |
| `SITEMAP_MAX_AGE_S`                  | `3600`                                           | `config.ts`                         | sitemap                   |
| `MAX_BODY_BYTES`                     | `64 * 1024`                                      | `config.ts`                         | every body                |
| `ID_MAX`                             | `200`                                            | `app-routes.ts`                     | ids from an app           |
| `NAME_MAX` / `PICTURE_MAX`           | `80` / `2048`                                    | `app-routes.ts`                     | `parseAuthor`             |
| `ID_ALPHABET`                        | 55 unambiguous letters and digits, unbiased draw | `rows.ts`                           | `newPostId`               |

| Setting                  | Production                                                                 | Staging                                    |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------ |
| Name                     | `liveworkspace-community`                                                  | `liveworkspace-community-staging`          |
| Route                    | `www.liveworkspace.app/api/community*`, `liveworkspace.app/api/community*` | `staging.liveworkspace.app/api/community*` |
| D1 `COMMUNITY_DB`        | `liveworkspace-community`                                                  | `liveworkspace-community-staging`          |
| `COMMUNITY_RATE_LIMITER` | namespace `1102`, 30 per 60 s                                              | namespace `2102`, 30 per 60 s              |
| `ENVIRONMENT`            | `production`                                                               | `staging`                                  |
| Secrets                  | `COMMUNITY_KEY_LIVEDIAGRAM`, `COMMUNITY_KEY_LIVEPLANNER`                   | the same                                   |

No cron. Locally (`.dev.vars.example`): `ENVIRONMENT=development` (localhost pages, no edge cache) and
`dev-<app>-community-key`; `wrangler dev --port 8791`.

## Assets and external resources

D1, the rate-limit binding, `caches.default`. Author pictures are URLs the app sends (`https://` only); the service
never fetches them.

## Defaults ledger

- `COM1`: Load More stops at offset 2,400 (`nextOffset: null`).
- `COM2`: a report answers the same `204` whether or not it hid the post.
- `COM3`: an unknown stored category reads as `other`, and a malformed `tags` column as no tags.
