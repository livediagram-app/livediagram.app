# Community

Every liveworkspace product has a Community: **livediagram**, **liveplanner**, **livedocuments**,
**livedesign** and **livehuddle** (owner, 2026-11-02; launched with Work Tracker #189). Each keeps its listings in one service, whose API is **liveworkspace.app/api/community**. The
service stores them in its own D1 database. The pages are liveworkspace.app's too: one Community page, built once in
the site and served under every app's address by that app's router, the way the Explorer is (owner, 2026-11-06; "One
page for every app" below). On an app's address it shows that app's posts first, with All Apps a click away; on
liveworkspace.app it shows every app's.

```
packages/community               @liveworkspace/community: apps, vocabulary, limits, search grammar, wire shapes
packages/community-site          @liveworkspace/community-site: the routers' Community step (head, sitemap)
liveworkspace/apps/community     the API Worker (@liveworkspace/community-service) and its D1 migrations
liveworkspace/apps/site          the Community page (/community, /community/post), with the rest of liveworkspace.app
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
[025-community](../../../../livedocuments/docs/specs/025-community/community.md), livedesign's
[025-community](../../../../livedesign/docs/specs/025-community/community.md) and livehuddle's
[025-community](../../../../livehuddle/docs/specs/025-community/community.md).

- **Publishing**: a signed-in owner shares a document of theirs to the Community from the **Community** tab of
  the Share dialog, beside Passes. The tab is the same wherever the Share dialog opens: in the app's editor, in the
  app's Explorer, and in the Explorer on liveworkspace.app, for every app's documents. It is offered for the owner's
  personal documents; a team library's document says it can't be shared to the Community.
- **The gallery**: the Community page at `/community` on the app's site (liveworkspace.app's page, served there by
  the app's router): search, categories, tags, sorts and My Shares; a post page with a read-only preview, Make a
  Copy, likes and reports.
- **The landing page**: the app's home page carries a **From the Community** section, its six featured posts (the
  most liked over three months, topped up) leading to the gallery. Until an app's Community has six to feature, or
  while its service cannot be reached, the section is not shown at all: a half-empty showcase sells it short.
- **The link's doors**: the read-only view, the card image and copying, through a community link the post owns.
- **Moderation**: reports alone, as below, the same for every app.
- **Categories**: each app's are its Start With template categories (below), so a gallery's filters speak its
  product's language and the publish dialog offers only that app's.
- **Start With**: the app's new-document template picker shows each category's most liked Community posts of the
  month after its templates, marked **Community** (below, "Start With").

## One page for every app

The Community page lives in liveworkspace.app's site (`liveworkspace/apps/site`, [010-site](../010-site/site.md)
"The Community") and is served two ways, like the Explorer
([004-index/one-explorer.md](../004-index/one-explorer.md)):

- **On an app's address** (`livediagram.app/community`), its router hands `/community` and everything under it to
  liveworkspace.app with the address bar unchanged (`@liveworkspace/sites/workspace-proxy`, `COMMUNITY_ROUTE`, no
  cookies forwarded). The page is that app's: its posts by default, its words, its colours, its session for My
  Shares, its telemetry and its help centre.
- **On liveworkspace.app** (`liveworkspace.app/community`, linked from the site's footer), it shows every app's
  posts together, in the platform's words ("creations") and slate, with no switch.

**Which posts.** On an app's address a switch beside the search reads **<app>** and **All Apps**, the same switch
the Explorer's pane header draws (`@liveworkspace/ui` `AppScopeToggle`), each side with its logo and a hover card.
It starts on the app every time the page opens, as the Explorer's does, and lives in the page, not the address: a
shared gallery link opens on the app's own posts. All Apps lists every app's posts, and My Shares is not offered
there (it is one app's, on its own address); switching to All Apps takes `is:mine` out of the search.

**The category menu on All Apps.** Ids repeat across apps with different meanings (`meetings` is livediagram's
Meetings & Workshops and liveplanner's Meetings; `planning` is livediagram's Planning and liveplanner's Projects and
Teams), so All Apps never offers a bare id. Its Category menu lists each app's categories under the app's name (a
heading per app, in `COMMUNITY_APPS` order), each with that app's count (the facets' `apps`), and a screen reader
hears the app with each row ("Meetings, liveplanner"). Choosing one writes the category with its app,
`category:liveplanner/meetings`, and the list keeps to that app's posts in that category; the trigger reads the
category's label. On one app's gallery the menu is that app's categories alone, written bare (`category:meetings`).
A bare `category:` word or `?category=` on All Apps reads as no category; on an app's gallery another app's category
reads as none, and the app's own written with its app reads bare. The switch carries a chosen category across: to
All Apps it gains the app's name, and back on the app its own reads bare again while another app's is left out.

**A post opens on its own app's address**, where its viewer, embed, copy and session live. A card for the page's own
app opens in place; a card for another app's post (All Apps, or anything on liveworkspace.app) is a full link to
`<that app>/community/post?id=`. liveworkspace.app has no post pages of its own: `/community/post?id=…&app=<app>`
there moves to that app's address, and without `app` shows not-found.

**The header** reads `liveworkspace | app`, the Explorer's header (the liveworkspace logo with the site switcher,
a slanted hairline and the app's logo, which leads back to the app; the account control on the right). On
liveworkspace.app the app's half is left out. The site switcher leads each site to its own Community, and an app
whose router serves no Community page yet (liveplanner) to its home.

**Until the page knows where it is.** The page is one static export, so which address it is on is read in the
browser. While it is prerendered and hydrating nothing loads, and the words that depend on it (the hero's "Made
With …" and its line) hold their space unseen, so an app's visitor never sees liveworkspace's words first.

**Search engines.** The gallery's static head is liveworkspace.app's All Apps (`Community · liveworkspace`,
canonical `https://www.liveworkspace.app/community`). On an app's address the router's Community step
(`@liveworkspace/community-site/router`) rewrites it to the app's own before it leaves: `Community | <product>`, the
app's description, and the canonical, `og:url` and `og:site_name` on the app's origin, so each app's gallery is its
own page. A post's shell names no canonical; the step fills its head from the service (title, description,
canonical `https://www.<app>/community/post?id=`, JSON-LD) and answers 404 for a post that is gone. Each app's
`/community/sitemap.xml` is answered by the same step, and liveworkspace.app's sitemap lists `/community`. Pages have
no trailing slash, as the rest of the site: `/community/` and `/community/post/?id=` answer one redirect that stays
on the app.

**Likes** keep each app's per-browser key on the app's origin (`<product>:v2:community-key`), the key its own
Community app used, so a visitor's hearts carry over. On liveworkspace.app the key is `liveworkspace:v2:community-key`.

**Telemetry.** On an app's address the page sends the Community's events in that app's name, as its own Community
app did: `Community·Opened·Post`, `·Liked·Post`, `·Unliked·Post`, `·Copied·Post`, `·Reported·<Reason>`,
`·Searched·Query`, `·Selected·<Category|Tag|Sort|Mine>`, and `UI·Opened·<article>` for a help link
(`apps/site/lib/community/telemetry.ts`, every type literal; the dashboards' scan reads it as platform code). On
liveworkspace.app, where no app is the sender, it sends nothing.

## Categories

Each app's categories are exactly its **Start With template categories** (`TEMPLATE_CATEGORIES` in
`<product>/packages/templates/src/template-categories.ts`): the same ids, labels and order (by label, as its pickers
list them), each category's one-line description its template category's description, and then **Something Else**
(`other`) last (owner, 2026-11-07). So a post is filed where the app's own picker files its templates, Start With can
show it beside them, and the publish dialog offers only the categories that app's picker has. The id is stored; the
label is shown; the type (the id in PascalCase) is the telemetry value. Ids repeat across apps with different
meanings and labels, so a label, a description and a type are always looked up by app and id
(`communityCategoryOf(app, id)`, `communityCategoryLabel(app, id)`, `communityCategoryType(app, id)`). A post's
category must be one of its own app's (`invalid_category` otherwise). A gallery link naming another app's category
(`?category=software` or `category:software` on livedesign's) reads as no category, keeping the rest of the search.

The two lists live apart (`@liveworkspace/community` cannot import a product), so each product's templates package
pins its Community categories, less Something Else, to its `TEMPLATE_CATEGORIES` in a test
(`packages/templates/src/community-categories.test.ts`; liveplanner's is still to add). A new template category is a
new Community category in the same change, and a retired one a migration of the service.

**A retired category.** A stored post one of its app's categories no longer covers reads as `other` (Something
Else) wherever it is shown, even when another app still has that id, counts towards the gallery's total, and a link
naming the id reads as no category. When an app's categories change, a migration of the service moves its stored
posts to the closest new id (below), so a retired id is only a row the migration has not reached yet.

| App                 | Categories (id: label), then `other`: Something Else                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `livediagram.app`   | `ideas`: Brainstorming, `decisions`: Decisions, `goals`: Goals & Metrics, `meetings`: Meetings & Workshops, `people`: People & Teams, `planning`: Planning, `processes`: Processes & Workflows, `product`: Product & UX, `games`: Quizzes & Games, `retros`: Retrospectives, `software`: Software & IT, `strategy`: Strategy, `learning`: Teaching & Learning, `spaces`: Virtual Spaces |
| `liveplanner.app`   | `support`: Customer Support, `education`: Education, `events`: Events, `finance`: Finance, `hiring`: Hiring and People, `marketing`: Marketing, `meetings`: Meetings, `personal`: Personal, `product`: Product and Engineering, `planning`: Projects and Teams, `sales`: Sales                                                                                                          |
| `livedocuments.app` | `careers`: Careers, `events`: Events, `home`: Home, `learning`: Learning, `marketing`: Marketing, `pitches`: Pitches, `plans`: Plans, `reports`: Reports, `speeches`: Talks, `team`: Teams                                                                                                                                                                                              |
| `livedesign.app`    | `branding`: Branding, `health`: Health and Fitness, `media`: Music and Video, `photos`: Photos, `shopping`: Shopping, `onboarding`: Sign Up and Onboarding, `social`: Social and Messaging, `travel`: Travel and Transport, `websites`: Websites, `work`: Work and Productivity                                                                                                         |
| `livehuddle.app`    | `campus`: Campus, `events`: Events, `games`: Games Rooms, `homes`: Homes, `office`: Office, `outdoor`: Outdoor, `recreation`: Recreation, `venues`: Venues                                                                                                                                                                                                                              |

### Moving to the template categories

Before 2026-11-07 each app had a set of its own. Migration `0003_template_categories.sql` moves every stored post to
its own app's closest new category, or to Something Else where none is close: one `UPDATE` per app, safe to run
twice. It is applied locally only; the deploy applies it to staging and production.

| App           | Old id to new id                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| livediagram   | `architecture`, `data` to `software`; `flows` to `processes`; `planning` to `planning`; `workshops` to `meetings`; `mindmaps` to `ideas`; `design` to `product`; `learning` to `learning`; `infographics`, `art` to `other` |
| liveplanner   | `projects`, `roadmaps`, `workflows`, `trackers`, `dashboards` to `planning`; `budgets` to `finance`; `events` to `events`; `personal` to `personal`; `forms` to `other`                                                     |
| livedocuments | `articles` to `reports`; `decks` to `pitches`; `infographics` to `marketing`; `guides`, `newsletters` to `team`; `proposals` to `plans`; `learning` to `learning`                                                           |
| livedesign    | `logos`, `illustrations` to `branding`; `wireframes` to `websites`; `photos` to `photos`; `social` to `social`; `posters` to `other`                                                                                        |
| livehuddle    | `offices`, `meetings` to `office`; `socials`, `communities` to `recreation`; `learning` to `events`; anything else (the retired `workshops`) to `other`                                                                     |

In every app `other` stays `other`, and any id not in the table becomes `other`.

## Start With

Each app's new-document template picker (its **Start With** screen: Start Diagramming and its sister starts in
livediagram, each product's template start) shows the Community's best beside its templates (owner, 2026-11-07):

- **Which posts.** In each category, up to **3** of the app's public posts (listed, not hidden after reports, their
  document public; `COMMUNITY_START_PER_CATEGORY`), ranked by the likes they received in the last **30 days**
  (`COMMUNITY_START_WINDOW_MS`), then by copies, then newest. A post needs at least **5** likes in that window
  (`COMMUNITY_START_MIN_LIKES`, the one place the number lives) to appear at all, so a tile there is something
  people have really taken to. With fewer than 3 that qualify a category shows fewer, and with none it shows no
  Community tiles. Likes count as the like count does: at most 5 from one network (`COMMUNITY_COUNTED_PER_NETWORK`).
- **Where.** After the category's own templates, in the same grid, each tile the post's live card image, its title, a
  line from its description (`communityStartLine`, at most 120 characters) and who made it ("By Ada", or "Shared
  anonymously"), badged **Community** where a template has none. Popular (or Recommended) stays templates only, and
  the rail's counts are the templates'. The picker's search matches a tile by every word of its title, after its
  category's matching templates; a category the picker does not show in that mode has no Community tiles there.
- **Choosing one** makes the person's own copy of the post's document and opens it, through the post's community
  link, the same path as the gallery's Make a Copy (`/<document|design|project>/shared?s=<code>&copy=1` on the post's app,
  `communityViewerPath`), so it counts as a copy.
- **When it loads.** One read per app (`GET /start`) the first time a Start With screen opens in the session, never
  on the app's page load or while the screen is closed, then kept in memory for the session. Until it answers, and
  whenever it cannot, the picker is its templates alone: the tiles reserve nothing and join after the templates when
  they arrive, so nothing already drawn moves. Switched off (the app's `COMMUNITY_ENABLED`, or the service's
  capabilities), refused or unreachable, there are no Community tiles and nothing is said; a failure other than
  switched off is asked again the next time a screen opens.
- **Telemetry.** Choosing a tile sends `Community·Copied·StartWith` in the app's name.

**Placing it in a product.** The read, the tiles, their placing in the picker's groups and search, and the badge's
colours are shared (`@liveworkspace/community-ui/start`); a product only hands them its own api and colours, with no
glue file of its own (liveplanner keeps a thin one, since its rail is not the categories):

1. Call `useCommunityStart({ app, communityApi: process.env.NEXT_PUBLIC_COMMUNITY_API, apiBase }, open)` in the
   picker, which answers the posts per category (`CommunityStartPosts`, empty until they arrive).
2. Build the tiles' options (`CommunityStartTileOptions`): `imageUrl`, its api's `communityImagePath(shareCode)`
   under its api base; `note: communityStartCreditNote(palette.muted)`, the credit in the panel's muted ink; and,
   where the rail is not the Community's categories, `postsFor` (`communityStartPostsInto(group, categories)` folds
   every category into one group, as liveplanner's Inspiration). The tiles (`CommunityStartTile`) fit any card type
   with an id, name, line, picture, badge, aria kind and note, so they join the product's own cards as they are.
3. Append `communityStartCardsIn(posts, group, options)` to each rail group's cards. Leave Popular and the rail's
   counts as they are.
4. In the picker's search, pass its results through `withCommunityStartMatches(results, posts, query, rail,
options)`: each group's matching tiles after its matching templates, a group only the Community matched in its
   place in the rail's order, a group keeping its other fields (its `name`).
5. Draw the card's badge with `communityStartBadgeStyle(palette.focus, palette.surface)`: the accent's 14% tint
   (`COMMUNITY_START_BADGE_TINT`) over the card, its ink the accent deepened (or lifted) until it reads at WCAG AA
   (4.5:1) on that tint. The accent alone read 3.3:1 (livediagram's sky), 4.3:1 (livehuddle's emerald) and 4.4:1
   (liveplanner's violet) in light; a tab's own theme can lower it further.
6. On choose, `findCommunityStartPost(posts, cardId)` tells a tile from a template: send `Community·Copied·StartWith`
   and go to `communityStartHref(post)` (`communityViewerPath`, so liveplanner's goes to `/project/shared`).
7. Add the type to the app's telemetry explanations, and its categories' drift test (above).

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

Each one names its app with `?app=livediagram.app` (or `liveplanner.app`, `livedocuments.app`, `livedesign.app`,
`livehuddle.app`); without one the answer is
`400 invalid_app`, and another app's post answers `404`. The gallery's two reads also take `?app=all`, the Community
page's All Apps: `GET /posts` lists every app's public posts (each naming its `app`) and `GET /facets` counts them;
any other route with `app=all` answers `400 invalid_app`. Likes and reports carry the browser's
community key as `X-Community-Key`, never an owner id.

| Route                           | What it answers                                                       | Cache                           |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| `GET /posts`                    | A page of 24 (`q`, `category`, `tag`, `sort`, `offset`), `nextOffset` | 30 s public; private with a key |
| `GET /posts/<id>`               | One post and up to 6 related posts                                    | as `/posts`                     |
| `GET /featured`                 | The home page's six: most liked in 3 months, topped up                | 60 s at the edge                |
| `GET /start`                    | Start With's tiles: each category's top 3 by likes in 30 days         | 60 s at the edge                |
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
A post made by a document's previous owner is not the new owner's, and publishing replaces it, unless it was hidden
after reports: that stays final for whoever owns the document (`post_hidden`).

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
| App router     | `COMMUNITY_URL` var, for the Community page's head and the sitemap                                  |
| Both           | The app's own `COMMUNITY_ENABLED` still switches its Community off                                  |

Without `COMMUNITY_KEY`, an app has no Community: it reports `communityEnabled: false`, and publishing
answers 404. The service's own `COMMUNITY_ENABLED` (`false`, `0` or `off`) answers every route 404.

## Running it locally

```sh
cd liveworkspace/apps/community
corepack pnpm dev                     # the API, http://localhost:8791/api/community
```

Its `dev` script makes `.dev.vars` from `.dev.vars.example` when there is none (never over one) and applies the
local migrations before it starts ([sign-in.md](../003-accounts/sign-in.md#local-clients)).

`corepack pnpm dev:workspace` from the repo root runs it behind the site at
http://localhost:3000/api/community, and `corepack pnpm dev:community` runs it alone. Point livediagram's
api at it with `COMMUNITY_URL=http://localhost:8791/api/community` and
`COMMUNITY_KEY=dev-livediagram-community-key` in `apps/api/.dev.vars` (livedocuments', livedesign's and livehuddle's apis
the same, with `dev-livedocuments-community-key`, `dev-livedesign-community-key` and `dev-livehuddle-community-key`). The
Community page is the site's (http://localhost:3000/community, and each app's router's `/community`), which reads the
service through the site's own `/api/community`. Development accepts writes from any
`localhost` page and skips the edge cache.

## Deploys

CI's deploy ships it ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root): staging on every push to `main`, production through the manual gate, both on the liveworkspace Cloudflare account. The Worker is in the first tier, so its D1 migrations (`apps/community/migrations`) apply before its code,
and it takes the route `liveworkspace.app/api/community*` only (`staging.liveworkspace.app` for staging). The
databases are `liveworkspace-community` and `liveworkspace-community-staging`, with their ids in
`apps/community/wrangler.toml`.

Secrets are set once per environment with `wrangler secret put` and survive every deploy: one key per app,
`COMMUNITY_KEY_LIVEDIAGRAM`, `COMMUNITY_KEY_LIVEPLANNER`, `COMMUNITY_KEY_LIVEDOCUMENTS`,
`COMMUNITY_KEY_LIVEDESIGN` and `COMMUNITY_KEY_LIVEHUDDLE` (each `openssl rand -hex 32`), with the same value as that app's api Worker's
`COMMUNITY_KEY`. An app whose key is not set yet answers its app routes 401 and has no Community, the others are
unaffected.

## Shared pieces

Every app's Community is built from the same pieces, so the four look and behave alike and a fix lands in all of
them. An app keeps only thin doors: its routes, its storage and its words.

| Piece                           | What it holds                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@liveworkspace/community`      | The contract: apps, categories, limits, search grammar, wire shapes; the paths every app's site shares (`/paths`); and the app Worker's side (`/app`): the service's app routes and the copier hash, the room's `community_post` row and its check, the owner and My Shares routes, and what a community link's reads leave out |
| `@liveworkspace/community-ui`   | The Share dialog's **Community** tab (the section, Share to Community, Edit Listing, Remove), the post tile, the landing page's **From the Community** section, Start With's Community tiles (`/start`), the help deep link, the Community bar                                                                                  |
| `@liveworkspace/community-site` | The routers' Community step (`/router`): the gallery's head made the app's, a post's head, and the app's sitemap, in front of liveworkspace.app's page                                                                                                                                                                          |
| `liveworkspace/apps/site`       | The Community page itself (`app/community`, `components/community`): the gallery and post pages, their binding to where the page is, their header and their telemetry                                                                                                                                                           |

### An app's Community pages

An app keeps no Community pages of its own. Its router runs the Community step first
(`routeCommunity` from `@liveworkspace/community-site/router`), bound to the app (`livedocuments.app`), its canonical
origin, its product name and its nouns, and forwards the rest through `routeToWorkspace`. The page works out the rest
from its address (`components/community/CommunityBinding.tsx`):

- **Which posts**: the app's, or every app's, and their words from `COMMUNITY_APP_WORDS` ("creations" for All Apps).
- **Its api**: the app's own `/api` on its address, for My Shares and the capabilities; the Community service as
  seen from the page (`NEXT_PUBLIC_COMMUNITY_API` names another).
- **Who is signed in**: the app's session, the one the header and the Explorer read
  (`lib/explorer/app-session.ts` `appAccount`), asked only when the app's signed-in hint is set.
- **Its routes**: the read-only viewer, Make a Copy, the embed, a post's card image and the author's own document,
  each on the post's own app's address (`/design/…` for livedesign, `/document/…` for the rest); the app's sign-in;
  Share Your Own leads to Explorer Home.
- **Its telemetry** and **its help links**, as "One page for every app" says.

The landing section takes the app, its words, its card images and its help link.

### The Share dialog's Community tab

The shared Share dialog (`@liveworkspace/explorer` `ShareDialog`) takes the Community as its `appTab`, beside
Passes. The tab talks to the document's own app: it reads, publishes, edits and removes the post through that app's
owner route, `/api/documents/<id>/community`, with the person's token, never through the service directly (only the
app knows who owns the document and whether it may be published).

- **In an app's editor**, the tab is the app's own, for the open document.
- **In an Explorer** (each app's, and liveworkspace.app's), the host gives the tab per item through its
  `ShareHost`, for every app whose Community is on. liveworkspace.app reaches each app's owner route at the
  address its sites registry entry names (`APP_ITEMS[app].share.communityPath`), with the person's workspace token,
  as it reads an item's tabs. An app without a Community, or switched off, gives no tab. On liveworkspace.app,
  whether an app's Community is on is asked of that app's `GET /api/capabilities` the first time one of its items is
  shared there, never on page load, and once per app. An app's own Explorer reads its own capabilities once per page,
  the same cached answer the rest of the page uses, for guests and accounts alike. Until it answers, the tab is
  offered.
- The tab is offered for an owner's personal documents. A guest sees it too, with a one-line note that sharing to
  the Community needs an account and **Sign In to Share**, coming back to the document; nothing is read for a guest.
  Someone else's document and a team library's document get the Share dialog without it.
- The tab's pieces are the same everywhere (`@liveworkspace/community-ui/share`); a host binds them once with a
  `CommunityShareHost`: the app, its words ("canvas", "plan"), the owner client, where a post's page is, and
  optionally its toasts, telemetry, help link and the card preview's picture. The Explorer's Share dialog with the
  tab is `@liveworkspace/explorer` `ShareDialogWithCommunity`. liveworkspace.app's Explorer has no picture for the
  card preview (the snapshot is the app's) and sends no Community telemetry (its Explorer events are a closed set).
- On an app's own address the Explorer's token is that app's alone, so it offers the tab for that app's documents
  only.

## Adding an app

1. Add its site to `COMMUNITY_APPS` and its categories to `COMMUNITY_APP_CATEGORIES` in
   `packages/community/src` (its Start With template categories, then Something Else, with the drift test in its
   templates package; its origins come from `@liveworkspace/sites`), and a `COMMUNITY_KEY_<APP>` secret to
   the service's `src/env.ts` and `appKey`.
2. In the app's api: the document room's `community_post` row, the owner routes, the link doors and the check,
   on the shared server side of `@liveworkspace/community`.
3. Its pages: the router's Community step (`routeCommunity`, bound as "An app's Community pages" says) with its
   `COMMUNITY_URL`, its brand ramp in `apps/site/app/app-colours.css` and its routes in the page's links
   (`components/community/lib/links.ts`), the landing section and the Share dialog's tab from
   `@liveworkspace/community-ui`, Start With's tiles in its template picker ("Start With" above), and
   `APP_ITEMS[app].share.communityPath` so liveworkspace.app's Explorer offers the tab. Every app's router serves the
   page at its `/community` (`@liveworkspace/sites/workspace-proxy` `COMMUNITY_ROUTE`).

## Performance

Measured against the real schema in SQLite, with 1,000 posts by 40 owners:

| Request               | D1 statements                    | Body    |
| --------------------- | -------------------------------- | ------- |
| Gallery page (24)     | 1 (2 with a key, for its hearts) | 10.9 KB |
| One post with related | 2                                | 3.1 KB  |
| Featured              | 2                                | 2.6 KB  |
| Start With            | 1                                | 4.6 KB  |
| Facets                | 2                                | 153 B   |
| Sitemap               | 1                                | 46 KB   |
| Like                  | 4 (one batch)                    | 28 B    |
| Report                | 3                                | 0       |
| Publish               | 6                                | 370 B   |
| Sync of 500 documents | 1 batch of at most 4             | 0       |
| Hidden since          | 1                                | 13 B    |

- Every list and count is one indexed query per app (`posts (app, …, state, document_state, …)`). All Apps' list
  and count lead with the state instead (`posts (state, document_state, …)`, migration 0002), so they stay one
  indexed query across every app.
- The Community page is liveworkspace.app's static export, cached at the edge like the rest of the site; an app's
  router adds one rewrite of the head (and, for a post, one service read, bounded by `API_TIMEOUT_MS`).
- **Start With** is one statement for every category (`ROW_NUMBER() OVER (PARTITION BY category)`, never a UNION per
  category: production D1 refuses a compound of more than five terms). It walks the app's public posts on their
  `(app, state, document_state)` index and each one's likes in the window on the covering
  `likes (post_id, created_at, network_hash)` (migration 0004), so it grows with the app's own month of likes, not
  every app's; the plan is pinned by a test. Measured in SQLite: 9 ms with 2,000 posts and 20,000 likes, 19 ms with
  200,000 likes, 81 ms with a million (reading every app's month on `idx_likes_created` took 167 ms and 1,174 ms).
  The answer is edge-cached for a minute and slimmed to what a tile shows (title, a 120-character line, the author's
  name, the counts, the link's code): 4.6 KB typical, about 18 KB at most. The new index costs each like one more
  index write.
- The sync writes one statement per state, not per document, so a batch of 500 stays far inside D1's
  per-invocation query limit.
- The app's minute cron is one indexed D1 read and one request when nothing changed.
- **Cross-site**: the pages now read another origin. A read with a community key sends a custom
  header, so the browser preflights it once per URL (cached for a day by `Access-Control-Max-Age`);
  anonymous reads need none. Featured and facets are the same for everyone and served from the edge.
