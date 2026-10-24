# One Explorer, and content in Durable Objects

Status: plan, October 2026, being built in the order below. The calls, types and tokens are in
[one-explorer-contracts.md](one-explorer-contracts.md).

Today each app (livediagram, liveplanner, livedocuments, livedesign) runs its own copy of the same
Explorer over its own D1 database: its own folders, tags, favourites, Trash, sharing, Recent,
Timeline and Inbox. A folder in livediagram and a folder in liveplanner have nothing to do with each
other, and every Explorer fix has to be made four times.

This plan moves the Explorer and everything it lists to liveworkspace, and moves each item's content
out of D1 into its own Durable Object. It builds on the RFC "Move document content from D1 to
per-document Durable Objects" (livediagram discussion #508), and goes one step further: the small
index that RFC keeps in D1 leaves the apps and lives once, on liveworkspace.app.

## What each app calls its things

| App           | One item is a | Its Durable Object |
| ------------- | ------------- | ------------------ |
| livediagram   | Canvas        | `CanvasRoom`       |
| liveplanner   | Plan          | `PlanRoom`         |
| livedocuments | Document      | `DocumentRoom`     |
| livedesign    | Design        | `DesignRoom`       |

The new names are used from the start in the new Durable Objects, routes and index rows, so nothing
is renamed twice. Until each app moves, only what people see is renamed.

## The shape

```
                 liveworkspace.app
   ┌─────────────────────────────────────────────┐
   │ accounts   people, guests, teams, tokens    │
   │ index      items, folders, favourites,      │
   │            sharing, opens, Trash,           │
   │            comments, actions, Inbox         │
   │ grants     short-lived "may open item X"    │
   │ explorer   the UI, as a package, and the    │
   │            one Explorer page, /explorer     │
   └─────────────────────────────────────────────┘
        ▲ register / rename / move     │ grant
        │                              ▼
   livediagram.app   liveplanner.app   livedocuments.app   livedesign.app
   the Explorer link opens liveworkspace.app/explorer?from=<app>, filtered to this app or All
   one Durable Object per item: tabs, elements, change log, presence
```

### 1. The index is the only record of where an item is and who can reach it

liveworkspace keeps one row per item: id, app, title, owner, team, folder, favourite, Trash
state, created, updated, last opened, a thumbnail key, and its share links and the people it is
shared with. Folders are not per app: a folder can hold a Canvas, a Plan, a Document and a Design.

The Durable Object never keeps its own copy of any of this. Renaming in the editor writes the
index. Moving, sharing, trashing and restoring happen only in the index. That removes the
"feed D1 from every object" problem the RFC reply called the bulk of the work: the only things an
app pushes are its content-derived summary (see 5) and a thumbnail.

Search is title and folder search over the index. It does not search inside content.

### 2. Who may open an item: short-lived grants

When the editor opens an item, it asks liveworkspace for a grant: a token signed by the index
naming the person (or guest), the item, the app and the access (view, participate or edit), valid for
ten minutes. The app's Durable Object checks it against the index's published keys without calling
liveworkspace, and the editor asks for a fresh one before it runs out. Share-link visitors get a grant from the link. Removing someone's access takes effect
within those few minutes.

Because the index decides access, including team access, each app's copy of the teams (the mirror
added this month) is no longer needed and goes away.

### 3. One identity for guests across every app

A guest's id today lives in each app's own browser storage, which other sites cannot read, so the
same person is a different guest on each site. Guests move into liveworkspace accounts: the first
time an app needs an identity, it sends the browser through liveworkspace.app (a quick redirect, the
same hand-off sign-in uses), which keeps a long-lived guest identity there and hands the app a guest
token. Every app gets the same guest. Signing up keeps the guest's items: the guest becomes the
account.

That first visit costs one redirect, once per browser per app. Opening an item without any identity
(a share link, an embed) needs no redirect: the link grants view access on its own.

### 4. The Explorer is built once, by liveworkspace.app, and shown at every app's address

`@liveworkspace/explorer` is a package in liveworkspace holding the whole Explorer UI and its client
for the index API. The page is built once, by liveworkspace.app, and shown at liveworkspace.app/explorer and
at each app's own `/explorer` (see [The Explorer on each app's address](#the-explorer-on-each-apps-address)).
The page wears the colours of the app the person came from, its header shows the
liveworkspace logo and then that app's logo (which leads back), and a filter shows "this app's items" or
"All Apps". Opening an item goes to its app. The page is described in [site.md](site.md#the-explorer-explorer).

Creating is aware of where the person came from: New from liveplanner makes a Plan, from livediagram a
Canvas, and so on. It goes to the app's new-item route, where the app creates the Durable Object and
registers it in the index in one step, then opens it.

What a browser keeps offline belongs to its app's origin. On the app's address the Explorer lists it
(This Browser); on liveworkspace.app, which can't read it, the sidebar links to the app's own offline view.

#### The Explorer on each app's address

Each app's router answers `/explorer/*` by fetching the same page from liveworkspace.app, so the address bar
keeps the app's name (`liveplanner.app/explorer/recent`): path, query and hash unchanged, no redirect. The
routing is one shared helper, `@liveworkspace/sites/workspace-proxy`, with a switch per app
(`EXPLORER_ON_APP_ORIGIN`); it is on for all four apps: livediagram, liveplanner, livedocuments and livedesign.
What it forwards:

- `/explorer`, `/explorer/…` and the page's payloads (`/explorer.txt`, `/explorer/….txt`) to the same place on
  liveworkspace.app, the app's cookies left behind and liveworkspace's never set on the app's origin. The page is
  never cached (`no-store`, as every page).
- The site's build assets under `/_liveworkspace/…` (the site's `assetPrefix`), a path that never meets the app's
  own `/_next` or `/live`. They are content-hashed and cached for a year. Each router names its environment's
  liveworkspace.app (`WORKSPACE_ORIGIN`: `http://localhost:3000` in local dev, `https://staging.liveworkspace.app`
  on staging, production's by default), so the chunks always come from the build that made the page; a test in
  `@liveworkspace/sites` (`workspace-proxy.test.ts`) holds all four routers to it.
- `/api/workspace/account/…` to liveworkspace's `/api/account/…`: what the page asks of the account (people's
  names, their settings, and their teams: reading them and running them, [Teams](#teams-are-run-in-the-explorer)),
  with the page's bearer token. The editors' panels, on the same address, use the same route.

In local dev, `next dev`'s overlay font (`/__nextjs_font/…`, requested from the page's origin, not under the asset
prefix) is not forwarded: the router sends it to the app's own editor dev server, which serves the same file. A 500
on it means that dev server is unhealthy (a Turbopack cache error, for one), and restarting the app's `pnpm dev`
clears it. Staging and production never request it.

The page reads where it is from its own address and there is that app's page:

- **Who it reads as.** The app's own session: the app's access token (`POST /api/auth/token`, from the app's
  refresh cookie, asked only while the app's signed-in hint says there is one, and never twice at once), else the
  app's guest token, both of which the index takes. The accounts Worker takes the same token on its account reads.
  The app's silent sign-in runs on the page, as in the app's editor.
- **The header.** The liveworkspace logo leads to liveworkspace.app, the app's logo to the app's home, and the
  account menu is the app's: Sign In and Sign Out are the app's, its account pages are on liveworkspace.app.
- **Links.** Items of that app open on the same origin; other apps' items open on their own sites. Account and
  settings pages (and the addresses that retired to them) go to liveworkspace.app.
- **This Browser.** The app keeps a small list of its offline items (id, title and dates, never content) in
  localStorage under `liveworkspace:this-browser:<app>` (`@liveworkspace/explorer/this-browser`), written by its
  offline store as it writes. The Explorer reads it: a sidebar row with the count, `/explorer/offline`, a This
  Browser group in the Trash, and the opened ones in Home's Jump Back In. Each opens in the app's editor.
- **Take Offline and Sync.** Where the app's This Browser page runs them (the registry's `offlineConversions`),
  each of the app's own items the person edits and holds themselves has **Take Offline** on its menu, and each live
  This Browser row has **Sync** for a person signed in. Only the app can write its offline store, so both hand over
  to that page (`<offlinePath>?convert=take-offline|sync&item=<id>`, `thisBrowserConvertHref`), which takes the
  request out of the address, checks the item is the person's to move, asks them to confirm, and runs the app's own
  conversion. A link alone never moves anything.
- **Teams.** Made, run and answered here, as on liveworkspace.app: the accounts Worker takes the app's token for
  them ([Teams](#teams-are-run-in-the-explorer)). After a change the app is asked for a fresh token, which names
  the teams as they now are.
- **The Library and Settings.** The Image Gallery and Shape Libraries are read from the app's own API on the same
  origin (`imagesPath`, `shapeLibrariesPath`). Signed in, the header has a Settings button beside Appearance, opening
  the app's own settings on liveworkspace.app (`/account/settings?app=<app>`), where `?settings=` addresses go too.
- **Telemetry.** Every event counts for the app, sent to liveworkspace.app's telemetry service.

The extra hop costs one Worker-to-Worker fetch on the HTML and payloads (assets are cached at the edge); see
[site.md](site.md#on-an-apps-own-address) for the measurements.

The editors' floating Explorer panel and move-to-folder picker use the same package, inside each app.

#### Teams are run in the Explorer

A team is the account's, the same in every app ([accounts.md](accounts.md#teams)), and the Explorer is the one
place it is made and run: on liveworkspace.app/explorer, on each app's own `/explorer`, and in each editor's
Explorer panel. liveworkspace.app has no Teams page of its own any more. The host hands the Explorer the
operations as a `TeamsHost` (`teamsHost`, as it hands over `share` and `inbox`), built by one shared client,
`createTeamsHost` in `@liveworkspace/explorer`, over the account API (`/api/account/teams…`). liveworkspace.app
sends its session cookie; an app's page and its editor send the app's access token through the app's router
(`/api/workspace/account/…`). A guest, an embedded workbench frame and a deployment without accounts get no
`teamsHost`, so none of this shows.

The journeys, one way each:

1. **Make a team.** Sidebar › Spaces › **New Team** (the group's last row, signed in): a dialog asks for the
   name and an optional organisation, and **Create Team** makes it with you as its admin and opens its view, where
   you invite people. In the editor's panel the same **New Team** sits under the rail's Spaces. The Move dialog
   keeps its **New Team** tile, a shortcut for filing the item being moved into a team made on the spot (name
   only); it is the same team and the same request.
2. **Run a team.** Choose the team (sidebar or panel rail). Its view opens on the team's card, above its library:
   the organisation, how many have joined and how many are invited; every member with their role; and, by role:
   - **Invite** (admins): an address and Member or Admin, at the foot of the card. The invitation is emailed.
   - **Invite by Link** (admins): turn the join link on, copy it, make a new one (the old one stops working),
     or turn it off. It lasts 7 days.
   - **Roles and removal** (admins): each row's role select, and its × to remove someone, withdraw an invitation
     or clear a declined or expired one, each confirmed in words that say which. The only admin's own row is
     pinned (no select, no ×), with why.
   - **The ⋯ menu**: Edit Team (name and organisation; admins), Leave Team (anyone but the only admin while
     others remain; leaving alone deletes the team, and says so), Delete Team (admins). Each asks once. Leaving
     or deleting goes to My Work, with a toast.
     In the editor's panel the team's pane has a **Members** button that opens the same card in a dialog.
3. **Answer an invitation.** Sidebar › Spaces › **Invites** (shown while any wait, with their count): a card per
   invitation with **Accept** and **Decline**. Accepting opens the team; declining takes the card away. Each says
   so in a toast. The account menu's **Teams** (`@liveworkspace/account-menu`, in every header) opens this view;
   with none waiting it says where the teams are (Spaces) and offers **New Team**.
4. **Join by link.** The link (`liveworkspace.app/join?token=…`) lands on a thin page that shows the team and
   joins it, then opens the team's view in the Explorer. Signed out, it signs in and comes back.
5. **Decline from an email.** The email's Decline link (`/join/decline?token=…`) is a thin page that declines
   without an account, and points at the Explorer's Invites to accept instead.

Old addresses keep working: `liveworkspace.app/account/teams` goes to `/explorer/invites`, and
`/account/teams/<id>` to that team's view, `/explorer/team?id=<id>` ([site.md](site.md#your-account-account)).

**What it loads.** The page asks accounts for the person's teams once as it opens (`GET /api/account/teams`, one
request, as before): the sidebar's member counts, the Invites row and its badge, and the team list itself, which
is fresher than the token's claim. A team's members and its join link are read only when its view opens (`GET
/api/account/teams/:id/members`), and again after a change there. The editor's panel asks nothing about teams until
its team's Members dialog opens. A change is shown at once: a team made, joined, renamed, left or deleted is laid
over the token's list for the rest of the page's life (in the panel too), and the host renews its token so the
next one names it.

### 5. Comments, actions and the Inbox live in liveworkspace

What the Inbox needs about comments and actions is stored in liveworkspace, keyed by app, item, tab and
element: each item pushes its threads and actions there as they change. The comment text itself stays in
the item's content, beside what it is about, so it saves, undoes and copies with it. The Inbox in the
Explorer is then one query across every app: threads you are in, mentions, and actions assigned to you or by you. Comment and mention emails
are sent from liveworkspace too.

The Timeline moves too, and spans apps the same way: the index records what it changes itself (made,
renamed, moved, trashed, restored, shared, favourited) and each app reports who edited what. The
Explorer shows it filtered to the app it is in, or All, and Home's What Happened is read from it.

### 6. Content lives in one Durable Object per item

As the RFC proposes, and as its reply agreed: one SQLite-backed object per item, which is also the
live room. It holds tabs and their elements (as rows or chunks, which removes D1's 2 MB row limit),
the change log, the sequence counter and presence. Saves go to the object instead of to D1, and the
object gives each change its number and stores it in one step. Images stay in liveworkspace's media
service; snapshots stay in R2.

Each app's D1 shrinks to what is genuinely its own, if anything (for example livediagram's community
publishing or a Plan's cross-item caches); everything the Explorer needs is gone from it.

### 7. Google Drive

The Drive mirror covers every app, not just livediagram. It moves to liveworkspace: liveworkspace
walks the index, asks each item's app for an export of its content, and keeps Drive in step.

## Order of work

1. **Contracts.** The index schema, the grant format, the registration and summary calls an app
   makes, and the content API each item's object exposes (read, save, export). Written down before
   code, in this folder.
2. **Guests in accounts.** The guest identity and hand-off on liveworkspace.app, with the
   guest-to-account merge.
3. **The index service** on liveworkspace.app: items, folders, favourites, sharing, opens,
   Trash, comments, actions, the Inbox query, and grants. Starts empty.
4. **`@liveworkspace/explorer`**, built against the index service and tried on liveworkspace.app.
5. **liveplanner first** (it holds no data): `PlanRoom` holds content, creation registers in the
   index, its Explorer opens on liveworkspace.app, comments, actions and the Timeline go to liveworkspace,
   and its own folders, tags, sharing, Timeline, Inbox, teams mirror and content tables are removed.
6. **livedocuments, then livedesign**, the same way.
7. **livediagram last.** It ships fresh on new infrastructure, so it starts empty like the others and
   needs no migration.

## Cost and performance

- **Opening an item** adds one grant request to liveworkspace before the room connects. It can run
  in parallel with loading the editor's code, and the grant is reused for its lifetime.
- **The index is one D1 database for every app.** It takes only metadata writes (create, rename,
  move, share, open, comment), not content saves, which is what made D1's single write queue a worry
  in the RFC. "Last opened" writes are the most frequent; they are batched and debounced. If the
  index ever reports "overloaded", it can be split by owner.
- **Explorer lists** are index queries with indexes on owner, team, folder, app and last-opened, and
  are paged.
- **Durable Objects** cost what the RFC estimates (roughly $14 a month at a million items), with
  hibernating WebSockets.
- **Content-derived summaries** (thumbnails, element counts for cards) are pushed by the object on
  idle, at most once a minute per item, with retries.

## Decided

- The index is the source of truth for everything but content.
- Access is checked offline with short-lived grants signed by liveworkspace.
- Guests have one identity across every app.
- The Explorer UI is one package, shown once on liveworkspace.app/explorer, filtered to the app the
  person came from or All, and New creates that app's kind. Each app keeps the floating panel.
- Search covers the index only. The Timeline, comments, actions and the Inbox are centralised.
- Teams are made, run and answered in the Explorer, wherever it shows, and nowhere else.
- The Drive mirror covers every app.
- Item names: Canvas, Plan, Document, Design, applied as each app moves.

## Not decided yet

- Self-hosting an app without liveworkspace.
- The CLI and MCP server across apps.
