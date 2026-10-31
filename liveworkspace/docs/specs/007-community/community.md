# Community

Every liveworkspace product has a Community: **livediagram**, **liveplanner**, **livedocuments** and
**livedesign**. Each keeps its listings in one service, whose API is **liveworkspace.app/api/community**. The
service stores them in its own D1 database. It is an API only: liveworkspace.app has no Community pages. Each app
hosts its own gallery and post pages, in its own look, and they show that app's posts only.

```
packages/community               @liveworkspace/community: apps, vocabulary, limits, search grammar, wire shapes
liveworkspace/apps/community     the API Worker (@liveworkspace/community-service) and its D1 migrations
```

Before October 2026, livediagram, livedocuments and livedesign each kept their posts, likes, copies and reports in
their own database and answered `/api/community/*` themselves. Those tables are gone (each app's migration 0100), and
livedocuments and livedesign lost their Community with them while the products split into their own sites. Nothing
was carried over: the service started empty, and every app's Community now stands on it.

## Every app's Community

Each app offers the same Community, in its own words and look, built from the same shared pieces (below,
"Shared pieces"). The product specs say what differs: livediagram's
[025-community](../../../../livediagram/docs/specs/025-community/community.md), liveplanner's
[025-community](../../../../liveplanner/docs/specs/025-community/community.md), livedocuments'
[025-community](../../../../livedocuments/docs/specs/025-community/community.md) and livedesign's
[025-community](../../../../livedesign/docs/specs/025-community/community.md).

- **Publishing**: a signed-in owner shares a document of theirs to the Community from the **Community** tab of
  the Share dialog, beside Passes. The tab is the same wherever the Share dialog opens: in the app's editor, in the
  app's Explorer, and in the Explorer on liveworkspace.app, for every app's documents. It is offered for the owner's
  personal documents; a team library's document says it can't be shared to the Community.
- **The gallery**: the app's own Community pages at `/community` on its site: search, categories, tags, sorts and
  My Shares; a post page with a read-only preview, Make a Copy, likes and reports.
- **The landing page**: the app's home page carries a **From the Community** section, its six featured posts (the
  most liked over three months, topped up) leading to the gallery.
- **The link's doors**: the read-only view, the card image and copying, through a community link the post owns.
- **Moderation**: reports alone, as below, the same for every app.
- **Categories**: each app has its own closed set (below), so a gallery's filters speak its product's language.

## Categories

Each app has its own closed set, in display order. The id is stored; the label is shown; the type is the
telemetry value. An id two apps share means the same thing in both and has the same label and type. A post's
category must be one of its own app's (`invalid_category` otherwise).

| App                 | Categories (id: label)                                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `livediagram.app`   | `architecture`: Architecture, `flows`: Flows & Processes, `planning`: Planning, `workshops`: Workshops, `mindmaps`: Mind Maps, `design`: Design & Wireframes, `data`: Data & Databases, `learning`: Learning & Teaching, `infographics`: Infographics, `art`: Drawing & Art, `other`: Something Else        |
| `liveplanner.app`   | `projects`: Project Plans, `roadmaps`: Roadmaps & Timelines, `workflows`: Kanban & Workflows, `trackers`: Trackers & Sheets, `budgets`: Budgets & Finance, `events`: Events & Schedules, `forms`: Forms & Surveys, `dashboards`: Dashboards & Reports, `personal`: Personal & Home, `other`: Something Else |
| `livedocuments.app` | `articles`: Articles & Reports, `decks`: Slide Decks, `infographics`: Infographics, `guides`: Guides & How-Tos, `proposals`: Proposals & Briefs, `newsletters`: Newsletters & Updates, `learning`: Learning & Teaching, `other`: Something Else                                                             |
| `livedesign.app`    | `logos`: Logos & Branding, `wireframes`: Wireframes & Mockups, `photos`: Photo Edits, `social`: Social & Marketing, `posters`: Posters & Flyers, `illustrations`: Icons & Illustrations, `other`: Something Else                                                                                            |

Each category's one-line description (shown under the publish dialog's chips) is in the product spec.

## What lives where

The service holds the **listing**; the app holds the **document**.

| The service (liveworkspace)                                                  | The app (livediagram)                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The post: title, description, category, tags, anonymous                      | The document, its tabs and its snapshots                                                   |
| How the author is shown (name, colour, picture), as of publish and each edit | Who owns the document, and whether it may be published                                     |
| Likes, copies and reports, each counted at most 5 per network                | The post's community link (an index share link, view, never expiring)                      |
| Hidden after reports (final)                                                 | The link's doors: the share resolve, the card image, view, copy                            |
| Where each post's document stands (`document_state`)                         | The document room's `community_post` row: the link, its post id and title, last state sent |

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

Each one names its app with `?app=livediagram.app` (or `liveplanner.app`, `livedocuments.app`, `livedesign.app`); without one the answer is
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

Each published document keeps its post in its own room (the Durable Object that holds the document), as one
`community_post` row with the state it last sent. Where the document stands is the index's (its Trash, its team,
its share password, its owner), so the room asks it as the post's author, and sends the service whatever differs:

- **Right after a change** the room hears of (a share password set, the document moved or trashed), off the
  response path.
- **Every ten minutes** while it has a post, from the room's own alarm, which also reads the post back and hears
  whether the service hid it after reports, closing its link if so.

So the gallery can lag a document by up to ten minutes when the inline send fails, and a post hidden after reports
keeps its link open for up to ten minutes. A failed send is retried by the next check.

The link's own doors never wait for the service: whether a community link opens is decided in the app, from its
document and its `community_post` row, so a trashed document's link closes at once.

## Configuring an app

| Where          | Setting                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| api Worker     | `COMMUNITY_URL` var (default `https://www.liveworkspace.app/api/community`), `COMMUNITY_KEY` secret |
| Browser builds | `NEXT_PUBLIC_COMMUNITY_API` (same default)                                                          |
| Pages Worker   | `COMMUNITY_URL` var, for the post page's head and the sitemap                                       |
| Both           | The app's own `COMMUNITY_ENABLED` still switches its Community off                                  |

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

## Deploys

CI's deploy ships it ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root): staging on every push to `main`, production through the manual gate, both on the liveworkspace Cloudflare account. The Worker is in the first tier, so its D1 migrations (`apps/community/migrations`) apply before its code,
and it takes the route `liveworkspace.app/api/community*` only (`staging.liveworkspace.app` for staging). The
databases are `liveworkspace-community` and `liveworkspace-community-staging`, with their ids in
`apps/community/wrangler.toml`.

Secrets are set once per environment with `wrangler secret put` and survive every deploy: one key per app,
`COMMUNITY_KEY_LIVEDIAGRAM`, `COMMUNITY_KEY_LIVEPLANNER`, `COMMUNITY_KEY_LIVEDOCUMENTS` and
`COMMUNITY_KEY_LIVEDESIGN` (each `openssl rand -hex 32`), with the same value as that app's api Worker's
`COMMUNITY_KEY`. An app whose key is not set yet answers its app routes 401 and has no Community, the others are
unaffected.

## Shared pieces

Every app's Community is built from the same pieces, so the four look and behave alike and a fix lands in all of
them. An app keeps only thin doors: its routes, its storage and its words.

| Piece                           | What it holds                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@liveworkspace/community`      | The contract: apps, categories, limits, search grammar, wire shapes; and the app Worker's side of the service (its app routes, the copier hash)                                   |
| `@liveworkspace/community-ui`   | The Share dialog's **Community** tab (the section, Share to Community, Edit Listing, Remove), the post tile, the landing page's **From the Community** section, the help deep link, the Community bar |
| `@liveworkspace/community-site` | The gallery and post pages, and the small Worker in front of them (a post's head, the sitemap), on which each app's `apps/community` is a thin shell, as Help is on help-site                         |

### An app's Community pages

An app's `apps/community` keeps only its layout (its header, footer, boot scripts and metadata), its routes and its
binding; the pages are `@liveworkspace/community-site`'s, so they look and behave the same in every app, in the app's
words and brand. The binding is a `CommunitySite`, which the layout's own small client provider hands the pages once:

- **Which posts**: the app (`livedocuments.app`), and its words ("document", "documents", the product's name), from
  `COMMUNITY_APP_WORDS`.
- **Its api**: where it is (`/api` behind the router), which answers My Shares, the session and the capabilities;
  and the Community service the build names, if any (`NEXT_PUBLIC_COMMUNITY_API`).
- **The browser's community key**: where the app keeps it (its own localStorage key, on its own origin).
- **Who is signed in**: the app's readable signed-in hint, so a signed-out browser asks nothing.
- **Its routes**: the read-only viewer, Make a Copy, the embed, a post's card image, the author's own document,
  sign-in, and where Share Your Own leads (the person's own documents).
- **Its telemetry** (`Community·…`, as above) and **its help links** (its two Community articles, sent as its own
  `UI·Opened`).

The Worker is the same factory in every app, bound to the app, its canonical origin and its product name. The
landing section takes the app, its words, its card images and its help link.

### The Share dialog's Community tab

The shared Share dialog (`@liveworkspace/explorer` `ShareDialog`) takes the Community as its `appTab`, beside
Passes. The tab talks to the document's own app: it reads, publishes, edits and removes the post through that app's
owner route, `/api/documents/<id>/community`, with the person's token, never through the service directly (only the
app knows who owns the document and whether it may be published).

- **In an app's editor**, the tab is the app's own, for the open document.
- **In an Explorer** (each app's, and liveworkspace.app's), the host gives the tab per item through its
  `ShareHost`, for every app whose Community is on. liveworkspace.app reaches each app's owner route at the
  address its sites registry entry names (`APP_ITEMS[app].share.communityPath`), with the person's workspace token,
  as it reads an item's tabs. An app without a Community, or switched off, gives no tab.
- The tab is offered for a signed-in owner's personal documents. A guest, someone else's document and a team
  library's document get the Share dialog without it.
- The tab's pieces are the same everywhere (`@liveworkspace/community-ui/share`); a host binds them once with a
  `CommunityShareHost`: the app, its words ("canvas", "plan"), the owner client, where a post's page is, and
  optionally its toasts, telemetry, help link and the card preview's picture. The Explorer's Share dialog with the
  tab is `@liveworkspace/explorer` `ShareDialogWithCommunity`. liveworkspace.app's Explorer has no picture for the
  card preview (the snapshot is the app's) and sends no Community telemetry (its Explorer events are a closed set).
- On an app's own address the Explorer's token is that app's alone, so it offers the tab for that app's documents
  only.

## Adding an app

1. Add its site to `COMMUNITY_APPS` and its categories to `COMMUNITY_APP_CATEGORIES` in
   `packages/community/src` (its origins come from `@liveworkspace/sites`), and a `COMMUNITY_KEY_<APP>` secret to
   the service's `src/env.ts` and `appKey`.
2. In the app's api: the document room's `community_post` row, the owner routes, the link doors and the check,
   on the shared server side of `@liveworkspace/community`.
3. Its pages: `apps/community` on `@liveworkspace/community-site` (its layout, routes and `CommunitySite` binding, as
   "An app's Community pages" says), the landing section and the Share dialog's tab from `@liveworkspace/community-ui`, and `APP_ITEMS[app].share.communityPath` so liveworkspace.app's Explorer
   offers the tab.

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
