# Community

Every liveworkspace app with a Community keeps its listings in one service, whose API is
**liveworkspace.app/api/community**. The service stores them in its own D1 database. It is an API
only: liveworkspace.app has no Community pages. Each app hosts its own gallery and post pages, in its
own look, and they show that app's posts only.

```
packages/community               @liveworkspace/community: apps, vocabulary, limits, search grammar, wire shapes
liveworkspace/apps/community     the API Worker (@liveworkspace/community-service) and its D1 migrations
```

Before October 2026, livediagram kept its posts, likes, copies and reports in its own database and
answered `/api/community/*` itself. Those tables are gone (livediagram migration 0100). Nothing was
carried over: the service started empty.

## What lives where

The service holds the **listing**; the app holds the **document**.

| The service (liveworkspace)                                                  | The app (livediagram today)                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The post: title, description, category, tags, anonymous                      | The document, its tabs and its snapshots                            |
| How the author is shown (name, colour, picture), as of publish and each edit | Who owns the document, and whether it may be published              |
| Likes, copies and reports, each counted at most 5 per network                | The post's community link (`share_links.purpose = 'community'`)     |
| Hidden after reports (final)                                                 | The link's doors: the share resolve, the card image, view, copy     |
| Where each post's document stands (`document_state`)                         | `community_links`: the link, its post id and title, last state sent |

A post is listed only while its document is public in its app. The app tells the service where each
document stands, one of three states:

- **public**: it passes the app's public rule (not trashed, not in a team library, still the author's,
  no share password). Listed, unless hidden after reports.
- **closed**: in a team library or behind a share password. Not listed, but still the author's, so
  still in their My Shares.
- **away**: in the Trash, or now someone else's. Not listed, and not in My Shares.

A document deleted for good, or whose link went with its author's account, is **gone**: its post is
deleted with everything on it.

The service never sees a document, and never shows an owner id or an app document id to the public.

## The API

Every route is under `/api/community`. Answers are JSON; errors are `{ "error": "<code>" }`.

### Public routes

Each one names its app with `?app=livediagram.app` (or `liveplanner.app`); without one the answer is
`400 invalid_app`, and another app's post answers `404`. Likes and reports carry the browser's
community key as `X-Community-Key`, never an owner id.

| Route                           | What it answers                                                       | Cache                           |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| `GET /posts`                    | A page of 24 (`q`, `category`, `tag`, `sort`, `offset`), `nextOffset` | 30 s public; private with a key |
| `GET /posts/<id>`               | One post and up to 6 related posts                                    | as `/posts`                     |
| `GET /featured`                 | The home page's six: most liked in 3 months, topped up                | 60 s at the edge                |
| `GET /facets`                   | Counts per category and the popular tags                              | 30 s at the edge                |
| `GET /sitemap`                  | Every public post's id and `updatedAt`, newest first                  | 1 hour at the edge              |
| `PUT`/`DELETE /posts/<id>/like` | Like or unlike, idempotent per key; `{ likeCount, liked }`            | none                            |
| `POST /posts/<id>/report`       | `{ reason, note? }`; `204` always. 3 browsers on 3 networks hide it   | none                            |

Reads are open to any page (`Access-Control-Allow-Origin: *`). Writes from a browser are answered
with CORS only for an app's own origins (its site in `@liveworkspace/sites`, with and without `www.`,
and its staging; and localhost in development), so another site's page can't like or report through a
visitor's browser. Likes and reports are rate-limited per network (30 a minute; IPv4 /24, IPv6 /56).

### App routes

`/api/community/app/*` is for an app's own Workers, never a browser. Each request names the app in
`X-Community-App` and carries that app's key as `Authorization: Bearer <key>`, checked in constant
time; a key only speaks for its own app. These routes send no CORS headers.

| Route                                | What it does                                                             |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `GET /app/documents/<doc>?owner=`    | The document's post as its owner sees it (state, `own`), or `null`       |
| `PUT /app/documents/<doc>`           | Publish (`create: true`), or save an Edit Listing                        |
| `DELETE /app/documents/<doc>?owner=` | Remove From Community (its author only; never a hidden post)             |
| `POST /app/sync`                     | `{ documents: [{ document, state }], gone: [...] }`, at most 500         |
| `GET /app/hidden?since=<ms>`         | The posts hidden after reports since then, for the app to close links    |
| `GET /app/mine?owner=&…`             | My Shares: the owner's posts and totals; passes on `X-Community-Key`     |
| `POST /app/copies`                   | `{ document, copier, ip }`: someone copied the document through its link |
| `POST /app/copiers/forget`, `/merge` | An account deleted; a guest's copies moving to their account             |

A publish carries the owner, the community link's code, the document's state, how the author is
shown, and the post itself. The app has already checked what only it can: the caller owns the
document, signed in, and the document may be published (not empty, not a team library's, no share
password). The service checks the rest: the input, at most 50 posts per owner per app
(`post_limit`), one post per document (`already_published`), a hidden post is final (`post_hidden`).
A post made by a document's previous owner is not the new owner's, and publishing replaces it.

`copier` is a one-way hash the app makes of the person (a guest's owner id is its credential, so it
never leaves the app). `ip` is only ever stored as a hash of its network salted with the post id.

### The shared contract

`@liveworkspace/community` holds what the service, the apps' Workers and the apps' pages agree on:
`COMMUNITY_APPS` and their origins, the categories, limits and search grammar, the wire shapes,
`communityServiceUrl(app, path)` for a public route, and `communityNetwork` (which the apps also key
their own per-network rate limits on). livediagram's `@livediagram/api-schema` re-exports it.

## Keeping in step

The app keeps a row per post in its own `community_links` table, with the state it last sent. Its
sync sends whatever differs:

- **Right after a change** to a document (trash, restore, purge, a move into or out of a team, a share
  password, an account deleted), the request that made it sends that document's state, off the
  response path.
- **Every minute**, a cron sends anything still pending (a batch of up to 500, at most 10 batches a
  run), then asks for the posts hidden after reports since the newest hide it knows, and closes their
  links.

So the gallery can lag a document by up to a minute when the inline send fails, and a post hidden
after reports keeps its link open for up to a minute. A failed send is retried by the next run.

The link's own doors never wait for the service: whether a community link opens is decided in the
app, from its documents and `community_links`, so a trashed document's link closes at once.

## Configuring an app

| Where          | Setting                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| api Worker     | `COMMUNITY_URL` var (default `https://liveworkspace.app/api/community`), `COMMUNITY_KEY` secret |
| Browser builds | `NEXT_PUBLIC_COMMUNITY_API` (same default)                                                      |
| Pages Worker   | `COMMUNITY_URL` var, for the post page's head and the sitemap                                   |
| Both           | The app's own `COMMUNITY_ENABLED` still switches its Community off                              |

Without `COMMUNITY_KEY`, an app has no Community: it reports `communityEnabled: false`, and publishing
answers 404. The service's own `COMMUNITY_ENABLED` (`false`, `0` or `off`) answers every route 404.

## Running it locally

```sh
cd liveworkspace/apps/community
cp .dev.vars.example .dev.vars
corepack pnpm db:migrate:local
corepack pnpm dev                     # the API, http://localhost:8791/api/community
```

`corepack pnpm dev:workspace` from the repo root runs it behind the site at
http://localhost:3000/api/community, and `corepack pnpm dev:community` runs it alone. Point livediagram's
api at it with `COMMUNITY_URL=http://localhost:8791/api/community` and
`COMMUNITY_KEY=dev-livediagram-community-key` in `apps/api/.dev.vars`, and its pages with
`NEXT_PUBLIC_COMMUNITY_API=http://localhost:8791/api/community`. Development accepts writes from any
`localhost` page and skips the edge cache.

## First deploy

1. Create the databases and put their ids in `apps/community/wrangler.toml` (they are placeholders):
   `wrangler d1 create liveworkspace-community` (and `liveworkspace-community-staging`).
2. Set one key per app: `openssl rand -hex 32`, then `wrangler secret put COMMUNITY_KEY_LIVEDIAGRAM`
   (and `COMMUNITY_KEY_LIVEPLANNER`). Give the app's api Worker the same value as `COMMUNITY_KEY`
   (livediagram's deploy syncs it from the `COMMUNITY_KEY` / `COMMUNITY_KEY_STAGING` GitHub secrets).
3. `corepack pnpm db:migrate:remote`, then `corepack pnpm deploy`.
4. The Worker takes the route `liveworkspace.app/api/community*` only.
5. Deploy livediagram's api after the service: its migration 0100 drops the old tables.

## Adding an app

1. Add its site to `COMMUNITY_APPS` in `packages/community/src/apps.ts` (its origins come from
   `@liveworkspace/sites`), and a `COMMUNITY_KEY_<APP>` secret to `src/env.ts` and `appKey`.
2. In the app's api: a `community_links` table, the owner routes, the link doors and the sync, as
   livediagram's (`apps/api/src/community-service.ts`, `db/community-links.ts`).
3. Its pages read the public routes with `communityServiceUrl(<app>, path)`.

liveplanner is listed and has a key, but has no Community yet: its editor can't publish, and it has
no Community pages. Its pages would read this API as livediagram's do.

## Performance

Measured against the real schema in SQLite, with 1,000 posts by 40 owners:

| Request               | D1 statements                    | Body    |
| --------------------- | -------------------------------- | ------- |
| Gallery page (24)     | 1 (2 with a key, for its hearts) | 10.9 KB |
| One post with related | 2                                | 3.1 KB  |
| Featured              | 2                                | 2.6 KB  |
| Facets                | 2                                | 153 B   |
| Sitemap               | 1                                | 46 KB   |
| Like                  | 4 (one batch)                    | 28 B    |
| Report                | 3                                | 0       |
| Publish               | 6                                | 370 B   |
| Sync of 500 documents | 1 batch of at most 4             | 0       |
| Hidden since          | 1                                | 13 B    |

- Every list and count is one indexed query per app (`posts (app, …, state, document_state, …)`).
- The sync writes one statement per state, not per document, so a batch of 500 stays far inside D1's
  per-invocation query limit.
- The app's minute cron is one indexed D1 read and one request when nothing changed.
- **Cross-site**: the pages now read another origin. A read with a community key sends a custom
  header, so the browser preflights it once per URL (cached for a day by `Access-Control-Max-Age`);
  anonymous reads need none. Featured and facets are the same for everyone and served from the edge.
