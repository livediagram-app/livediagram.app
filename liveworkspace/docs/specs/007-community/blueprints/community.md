# Community: blueprint

Derived from [community.md](../community.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term   | Identifier                                  | Meaning                                      |
| ------ | ------------------------------------------- | -------------------------------------------- |
| Post   | `posts` row                                 | A public listing of a shared item            |
| Copy   | `copies` row                                | Someone copying a post                       |
| Like   | `likes` row, by community key               | Idempotent per browser key                   |
| Report | `reports` row                               | Three browsers on three networks hide a post |
| App    | `?app=livediagram.app` or `liveplanner.app` | The two apps with a Community                |

## Interfaces and contracts

Public routes under `/api/community`, app routes under `/api/community/app` with `COMMUNITY_KEY_<APP>` (keys
exist for livediagram and liveplanner).

Every route the specs name, with the section that defines it (each checked to have its path's literal in the code):

| Route                                | Specified in                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `GET /posts`                         | [community.md "Public routes"](../../007-community/community.md#public-routes) |
| `GET /posts/<id>`                    | [community.md "Public routes"](../../007-community/community.md#public-routes) |
| `GET /featured`                      | [community.md "Public routes"](../../007-community/community.md#public-routes) |
| `GET /facets`                        | [community.md "Public routes"](../../007-community/community.md#public-routes) |
| `GET /sitemap`                       | [community.md "Public routes"](../../007-community/community.md#public-routes) |
| `DELETE /posts/<id>/like`            | [community.md "Public routes"](../../007-community/community.md#public-routes) |
| `POST /posts/<id>/report`            | [community.md "Public routes"](../../007-community/community.md#public-routes) |
| `GET /app/documents/<doc>?owner=`    | [community.md "App routes"](../../007-community/community.md#app-routes)       |
| `PUT /app/documents/<doc>`           | [community.md "App routes"](../../007-community/community.md#app-routes)       |
| `DELETE /app/documents/<doc>?owner=` | [community.md "App routes"](../../007-community/community.md#app-routes)       |
| `POST /app/sync`                     | [community.md "App routes"](../../007-community/community.md#app-routes)       |
| `GET /app/hidden?since=<ms>`         | [community.md "App routes"](../../007-community/community.md#app-routes)       |
| `GET /app/mine?owner=&…`             | [community.md "App routes"](../../007-community/community.md#app-routes)       |
| `POST /app/copies`                   | [community.md "App routes"](../../007-community/community.md#app-routes)       |
| `POST /app/copiers/forget`           | [community.md "App routes"](../../007-community/community.md#app-routes)       |

## Security and trust

Reads allow any origin; browser writes get CORS only for the app's own origins. Likes and reports are limited per
network (30 a minute). Secrets are set once per Worker and environment with `wrangler secret put` and survive every deploy; the
`Env fields` line under the Worker's configuration below lists every name the Worker reads, vars and secrets
together (a name not in a `[vars]` table is a secret). App keys are compared in constant time, and each key speaks
only for its own app.

## Performance and limits

Pages of 24; the edge caches each public read (30 s to 1 hour, per [community.md "The API"](../community.md#the-api)).

## Observability

Every log line the service writes, by its fingerprint (the first literal of the call; `…` marks an interpolation):

| Level   | Fingerprint                                         | Where              |
| ------- | --------------------------------------------------- | ------------------ |
| `log`   | `[community] auto-hidden`                           | `public-routes.ts` |
| `warn`  | `[community] publish retried after an id collision` | `posts.ts`         |
| `log`   | `[community] published`                             | `app-routes.ts`    |
| `log`   | `[community] removed`                               | `app-routes.ts`    |
| `log`   | `[community] replaced a previous owner post`        | `app-routes.ts`    |
| `log`   | `[community] updated`                               | `app-routes.ts`    |
| `error` | `cache put failed`                                  | `http.ts`          |

## Files

| File                                                | Role                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/community/src/app-routes.ts`    | The app routes (`/api/community/app/*`, liveworkspace/docs/specs/007-community/community.md "The API"): what only an app's own Worker may do, for the people it has signed in and the document… |
| `liveworkspace/apps/community/src/config.ts`        | The Worker's settings                                                                                                                                                                           |
| `liveworkspace/apps/community/src/engagement.ts`    | What people do to posts (liveworkspace/docs/specs/007-community/community.md "Public routes"): likes keyed by the community key, distinct copiers, and reports with automatic hiding, the only… |
| `liveworkspace/apps/community/src/env.ts`           |                                                                                                                                                                                                 |
| `liveworkspace/apps/community/src/http.ts`          | Responses, CORS and the edge cache for the Community API (liveworkspace/docs/specs/007-community/community.md "The API").                                                                       |
| `liveworkspace/apps/community/src/index.ts`         | liveworkspace's Community (liveworkspace/docs/specs/007-community/community.md): one Worker for every app's Community listings, on liveworkspace.app/api/community                              |
| `liveworkspace/apps/community/src/network.ts`       | Where a like, copy or report comes from (liveworkspace/docs/specs/007-community/community.md "Public routes"): the caller's network (communityNetwork, shared with the apps' rate limits), onl… |
| `liveworkspace/apps/community/src/posts.ts`         | Community posts (liveworkspace/docs/specs/007-community/community.md): what an app's Worker writes (publish, Edit Listing, remove, and where each post's document stands), and the public read… |
| `liveworkspace/apps/community/src/public-routes.ts` | The public Community API (liveworkspace/docs/specs/007-community/community.md "The API"): what every app's Community pages read, and the likes and reports they send                            |
| `liveworkspace/apps/community/src/rows.ts`          | posts rows (migrations/0001_community.sql) and their mapping to the wire shapes                                                                                                                 |
| `packages/community/src/apps.ts`                    | The apps with a Community (liveworkspace/docs/specs/007-community/community.md)                                                                                                                 |
| `packages/community/src/authors.ts`                 | Who a Community post is credited to (livediagram/docs/specs/025-community/community.md "Posts"): the author shape and the two stand-ins                                                         |
| `packages/community/src/index.ts`                   | The Community's shared contract (liveworkspace/docs/specs/007-community/community.md): the vocabulary, limits, search grammar and wire shapes the service, every app's Workers and every app's… |
| `packages/community/src/network.ts`                 | The network a request comes from (liveworkspace/docs/specs/007-community/community.md "Public routes"): the caller's address range rather than the exact address, so one person cannot pass fo… |
| `packages/community/src/post.ts`                    |                                                                                                                                                                                                 |
| `packages/community/src/query.ts`                   | The Community's search grammar and list query (livediagram/docs/specs/025-community/community.md "Gallery", "My Shares"): the sorts, the list query and its URL form, and …                     |
| `packages/community/src/service.ts`                 | How the apps talk to liveworkspace's Community service (liveworkspace/docs/specs/007-community/community.md "The API"): where it lives, and the shapes its app-only routes take and give        |

## Constants and configuration: the Worker

`liveworkspace/apps/community/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                             | Value                                              |
| ----------------------------------- | -------------------------------------------------- |
| Worker name                         | `liveworkspace-community`                          |
| Route                               | `liveworkspace.app/api/community*`                 |
| D1 `COMMUNITY_DB`                   | `liveworkspace-community`, migrations `migrations` |
| Rate limit `COMMUNITY_RATE_LIMITER` | 30 per 60 s                                        |
| Var `ENVIRONMENT`                   | `production`                                       |

**`env.staging`**

| Setting                             | Value                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| Worker name                         | `liveworkspace-community-staging`                          |
| Route                               | `staging.liveworkspace.app/api/community*`                 |
| D1 `COMMUNITY_DB`                   | `liveworkspace-community-staging`, migrations `migrations` |
| Rate limit `COMMUNITY_RATE_LIMITER` | 30 per 60 s                                                |
| Var `ENVIRONMENT`                   | `staging`                                                  |

Env fields (`env.ts`): `COMMUNITY_ENABLED`, `COMMUNITY_KEY_LIVEDIAGRAM`, `COMMUNITY_KEY_LIVEPLANNER`, `ENVIRONMENT`.

## Data and persistence

Migrations, in order:

- `0001_community.sql`

| Table       | Columns                                                                                                                                                                                                                                                                   | Created in           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `copies`    | `post_id`, `copier`, `network_hash`, `created_at`                                                                                                                                                                                                                         | `0001_community.sql` |
| `likes`     | `post_id`, `liker_key`, `network_hash`, `created_at`                                                                                                                                                                                                                      | `0001_community.sql` |
| `post_tags` | `post_id`, `tag`                                                                                                                                                                                                                                                          | `0001_community.sql` |
| `posts`     | `id`, `app`, `document`, `share_code`, `owner`, `author_name`, `author_color`, `author_picture`, `anonymous`, `title`, `description`, `category`, `tags`, `search_text`, `document_state`, `like_count`, `copy_count`, `state`, `hidden_at`, `published_at`, `updated_at` | `0001_community.sql` |
| `reports`   | `post_id`, `reporter_key`, `network_hash`, `reason`, `note`, `created_at`                                                                                                                                                                                                 | `0001_community.sql` |

## Constants and configuration: named constants

| Constant                        | Value                                                              | File         |
| ------------------------------- | ------------------------------------------------------------------ | ------------ |
| `API_PATH`                      | `COMMUNITY_API_PATH`                                               | `config.ts`  |
| `LIST_MAX_AGE_S`                | `30`                                                               | `config.ts`  |
| `FEATURED_MAX_AGE_S`            | `60`                                                               | `config.ts`  |
| `SITEMAP_MAX_AGE_S`             | `3600`                                                             | `config.ts`  |
| `MAX_BODY_BYTES`                | `64 * 1024`                                                        | `config.ts`  |
| `POST_COLS`                     | ``p.id, p.app, p.document, p.share_code, p.owner, p.author_na…`    | `rows.ts`    |
| `PUBLIC_POST`                   | `p.app = ? AND p.state = 'listed' AND p.document_state = 'public'` | `rows.ts`    |
| `COMMUNITY_APPS`                | `['livediagram.app', 'liveplanner.app'] as const`                  | `apps.ts`    |
| `COMMUNITY_APP_ORIGINS`         | `(object or list, see file)`                                       | `apps.ts`    |
| `COMMUNITY_ANONYMOUS_AUTHOR`    | `(object or list, see file)`                                       | `authors.ts` |
| `COMMUNITY_UNKNOWN_AUTHOR`      | `(object or list, see file)`                                       | `authors.ts` |
| `COMMUNITY_CATEGORIES`          | `(object or list, see file)`                                       | `post.ts`    |
| `COMMUNITY_CATEGORY_TYPES`      | `COMMUNITY_CATEGORIES.map((c) => c.type)`                          | `post.ts`    |
| `COMMUNITY_REPORT_REASONS`      | `(object or list, see file)`                                       | `post.ts`    |
| `COMMUNITY_TITLE_MIN`           | `3`                                                                | `post.ts`    |
| `COMMUNITY_TITLE_MAX`           | `80`                                                               | `post.ts`    |
| `COMMUNITY_DESCRIPTION_MIN`     | `20`                                                               | `post.ts`    |
| `COMMUNITY_DESCRIPTION_MAX`     | `500`                                                              | `post.ts`    |
| `COMMUNITY_TAGS_MAX`            | `5`                                                                | `post.ts`    |
| `COMMUNITY_TAG_MIN`             | `2`                                                                | `post.ts`    |
| `COMMUNITY_TAG_MAX`             | `24`                                                               | `post.ts`    |
| `COMMUNITY_REPORT_NOTE_MAX`     | `300`                                                              | `post.ts`    |
| `COMMUNITY_POSTS_PER_AUTHOR`    | `50`                                                               | `post.ts`    |
| `COMMUNITY_PAGE_SIZE`           | `24`                                                               | `post.ts`    |
| `COMMUNITY_MAX_OFFSET`          | `2400`                                                             | `post.ts`    |
| `COMMUNITY_AUTO_HIDE_REPORTERS` | `3`                                                                | `post.ts`    |
| `COMMUNITY_COUNTED_PER_NETWORK` | `5`                                                                | `post.ts`    |
| `COMMUNITY_POPULAR_TAGS`        | `24`                                                               | `post.ts`    |
| `COMMUNITY_RELATED_POSTS`       | `6`                                                                | `post.ts`    |
| `COMMUNITY_SEARCH_TERMS_MAX`    | `5`                                                                | `post.ts`    |
| `COMMUNITY_SEARCH_MAX`          | `200`                                                              | `post.ts`    |
| `COMMUNITY_FEATURED_COUNT`      | `6`                                                                | `post.ts`    |
| `COMMUNITY_FEATURED_WINDOW_MS`  | `90 * 24 * 60 * 60 * 1000`                                         | `post.ts`    |
| `COMMUNITY_SEARCH_TERM_MAX`     | `40`                                                               | `post.ts`    |
| `COMMUNITY_KEY_HEADER`          | `'X-Community-Key'`                                                | `post.ts`    |
| `COMMUNITY_INPUT_FIELDS`        | `['title', 'description', 'category', 'tags'] as const`            | `post.ts`    |
| `COMMUNITY_SITEMAP_MAX`         | `5000`                                                             | `post.ts`    |
| `COMMUNITY_SORTS`               | `(object or list, see file)`                                       | `query.ts`   |
| `EMPTY_COMMUNITY_QUERY`         | `(object or list, see file)`                                       | `query.ts`   |
| `COMMUNITY_API_PATH`            | `'/api/community'`                                                 | `service.ts` |
| `COMMUNITY_API_URL`             | `https://liveworkspace.app${COMMUNITY_API_PATH}`                   | `service.ts` |
| `COMMUNITY_APP_PARAM`           | `'app'`                                                            | `service.ts` |
| `COMMUNITY_APP_HEADER`          | `'X-Community-App'`                                                | `service.ts` |
| `COMMUNITY_DOCUMENT_STATES`     | `['public', 'closed', 'away'] as const`                            | `service.ts` |
| `COMMUNITY_SYNC_MAX`            | `500`                                                              | `service.ts` |

## Testing

6 test files:

- `liveworkspace/apps/community/src/index.test.ts`
- `liveworkspace/apps/community/src/network.test.ts`
- `liveworkspace/apps/community/src/posts.test.ts`
- `packages/community/src/apps.test.ts`
- `packages/community/src/network.test.ts`
- `packages/community/src/post.test.ts`
