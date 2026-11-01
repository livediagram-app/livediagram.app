# One Explorer, and content in Durable Objects

The calls, types and tokens are in [one-explorer-contracts.md](one-explorer-contracts.md); the service is
[index-service.md](index-service.md).

The four apps (livediagram, liveplanner, livedocuments, livedesign) share one Explorer over one index on
liveworkspace.app: one set of folders, favourites, Trash, sharing, Recent, Timeline and Inbox, so a folder can
hold a Canvas, a Plan, a Document and a Design, and an Explorer fix is made once. Each item's content lives
in its own Durable Object in its app, not in D1. This replaced a copy of the Explorer per app, each over its
own D1 database. It builds on the RFC "Move document content from D1 to
per-document Durable Objects" (livediagram discussion #508), and goes one step further: the small
index that RFC keeps in D1 leaves the apps and lives once, on liveworkspace.app.

## What each app calls its things

| App           | One item is a | Its Durable Object |
| ------------- | ------------- | ------------------ |
| livediagram   | Canvas        | `DocumentRoom`     |
| liveplanner   | Plan          | `PlanRoom`         |
| livedocuments | Document      | `DocumentRoom`     |
| livedesign    | Design        | `DesignRoom`       |

The names are used in the index rows and in what people see. livediagram's Durable Object keeps its
historical class name, `DocumentRoom`, which the migration from the historical livediagram.app writes into
(docs/migration.md at the repository root).

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
state, created, updated, last opened, and its share links and the people it is
shared with. Folders are not per app: a folder can hold a Canvas, a Plan, a Document and a Design.

The Durable Object never keeps its own copy of any of this. Renaming in the editor writes the
index. Moving, sharing, trashing and restoring happen only in the index. That removes the
"feed D1 from every object" problem the RFC reply called the bulk of the work: the only things an
app pushes are its content-derived summary (see 5). Its preview is drawn on request and kept by
liveworkspace ([previews.md](../006-media/previews.md)).

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

A guest's id is not kept in an app's own browser storage, which other sites cannot read and which would make the
same person a different guest on each site. Guests live in liveworkspace accounts: the first
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
"All Apps". Reached on liveworkspace.app from no app (its account menu's **Explorer**, say), it is in no app and
shows every app's items, with no app filter (there is no app to narrow to, so no "liveplanner | All Apps" switch
names one the person never chose), and a first run there greets the person to liveworkspace ("Welcome to
liveworkspace."), never to the app whose starts it shows. Opening an item goes to its app. The page is described in [site.md](../010-site/site.md#the-explorer-explorer).

Under All Apps each row, card and Timeline entry wears its **app's mark**: the app's logo, the Living Prism, drawn at
rest in the app's accent with each face at its own opacity (`BrandGlyph` from `@liveworkspace/brand`), never a
letter. Its title and a screen-reader label say "<Kind> in <app>". It is a stateless drawing with no gradients or
motion, so a list of thousands pays for paths only. Wherever the Explorer names another app (the Details view's Type
cell, a folder's "isn't empty" note and its counts), it is that mark, never a coloured dot.

Every ⋯ menu (a row's, a card's, a folder's, the panel's) opens below its trigger, or above it when there is no room
below. When it fits on neither side (a long menu from a card halfway down a short window) it slides up until its
last row is on screen, over its trigger; one taller than the window keeps to the window and scrolls. A menu never
runs off the page, so every verb on it can be reached.

Creating is aware of where the person came from: New from liveplanner makes a Plan, from livediagram a
Canvas, and so on. On liveworkspace.app in no app, where the list shows every app, New (the hero's and the pane's
Create) is a menu of every app's kind, each with its logo and its app's name; New Folder sits beside them where the
view takes one. Words about the person's whole collection follow the list: under All Apps they are **files** ("12
files", "Keep your files safe"), and the hero asks "what are you working on today?"; words about one item keep its
app's kind. It goes to the app's new-item route, where the app creates the Durable Object and
registers it in the index in one step, then opens it.

#### What you can make, on Home's hero

Home's hero shows **what the app makes**: four small pictures, one per kind of work, each drawn in its app's brand
colour with its name under it (`WorkKinds` in `@liveworkspace/explorer`, fed per app from its `WORK_KINDS`; the
pictures are `@liveworkspace/ui/work-art`, the same miniatures every help centre draws a product's work with). Filtered
to an app it shows that app's four. Under All Apps it shows one per app, that app's first kind in that app's colour,
named by the app's kind (Canvas, Plan, Document, Design). Every set has the same layout, size and spacing: from `lg`
up the tiles stand two by two in the hero's right column; below `lg` they sit under the search field, four across, a
phone included (smaller there, so the hero stays short), inside the page's 16 px gutter. The same set shows on a first run, in the welcome's hero.

Each tile starts that kind of work: it is a link to the app's own New route with the template that makes it
(`/new?template=<template>`, the address the app's welcome uses), on the app's address (the host's `templateHref`;
without one, the host app's own `/new` on the same origin and another app's on that app's site). Hover lifts its edge
in the app's colour over `duration-micro`. The pictures are static SVG drawn in the page's light or dark look; nothing
is fetched to draw them. They took the place of each app's fan of template previews (`heroArt`, from the apps' hero
manifests), which differed in number and kind from app to app, showed only on a wide screen, and showed nothing under
All Apps.

| App           | Its kinds, and the template each starts                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| livediagram   | Flowchart (`flowchart`), Mind Map (`mindmap`), Whiteboard (`whiteboard`), Workshop (`blank-session`)                          |
| liveplanner   | Board (`kanban`), Sheet (`blank-spreadsheet`), Dashboard (`project-planner`, whose Overview tab is one), Form (`blank-form`)  |
| livedocuments | Article (`blank-article`), Slide Deck (`blank-slide-deck`), Infographic (`blank-infographic`), Poster (`event-poster`)        |
| livedesign    | Logo (`blank-logo`), App Wireframe (`blank-wireframe-phone`), Web Wireframe (`blank-wireframe-browser`), Photo (`photo-edit`) |

#### Each app's backdrop, on Home's hero

The hero's words, pills, search and tiles are the same in every app; the **backdrop** behind them tells the apps apart
(`HeroBackdrop` in `@liveworkspace/explorer`). It follows the app the list is filtered to: under All Apps, and on
liveworkspace.app in no app, the hero keeps the dotted band.

| App           | Backdrop                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| liveplanner   | **Board lanes**: four lanes run the band's full height, alternate ones a shade deeper, named at the foot from `md` with their counts ("TO DO · 4", "DOING · 2/3", "REVIEW · 1", "DONE · 12"); in the gap between the words and the tiles a card is mid-drag, tilted, over the dashed slot it will drop into. Picked in October 2026. |
| All Apps      | **Dots**: the brand-tinted band with a dot every 22 px, and a soft brand glow in dark. Also no app's.                                                                                                                                                                                                                                |
| livediagram   | **Blueprint**: engineering paper, a fine 24 px grid with a heavier line every five squares, crop marks in the band's corners, a dimension line in the gap between the words and the tiles, and a drawing's title block ("HOME · SHEET 1 OF 1", "1:1") in the bottom right. Navy in dark.                                             |
| livedocuments | **Typesetter**: warm paper with an 8 px baseline grid, the heading set in serif, and a large pilcrow (¶) behind the tiles' edge.                                                                                                                                                                                                     |
| livedesign    | **Shape kit**: a few bold primitives placed like a composition in progress: a circle (selected, with handles) and a square turned on its corner in the gap, a triangle beside the pills, a quarter disc in the bottom left and a ring in the bottom right.                                                                           |

The textures (dots, lanes, grid, baseline grid) and the corner pieces run the band's full width at every size. The pieces
drawn in the gap between the words and the tiles show only from `xl`, where that gap is wide enough that they never
touch the words; the title block and the triangle show from `lg`. The serif heading is the system's serif (`ui-serif`,
Georgia, Times New Roman), so no font is fetched for it. Every backdrop is static SVG and CSS in the brand ramp, with no
motion and nothing fetched; it is hidden from screen readers and takes no pointer events.

What a browser keeps offline belongs to its app's origin. On the app's address it is a view of the Explorer, This
Browser, in the page and in the editor's panel alike; on liveworkspace.app, which can't read it, the sidebar links to
that view on the app's own address.

#### A place that is empty here but not elsewhere

Filtered to one app, a folder (or My Work, a team) holding only other apps' items would read as empty,
and someone might delete it thinking so. It never does:

- **The place itself.** Once the app's own list comes back empty, the Explorer asks the place's first page across
  every app (one request, `useOtherApps`). If other apps keep anything there, the page shows, in place of "This
  folder is empty", a fan of up to three of those items' own cards, each edged in its app's colour and named,
  "This folder isn't empty", what it holds ("3 plans and 1 document", "at least …" when there is more than a
  page), a chip per app, **Show All Apps** (switches the filter) and **New <Kind>**. The editors' Explorer panel
  shows the same, sized for the pane.
- **Its card.** A folder card whose preview has none of the app's items is asked again across every app, in one
  request for all such cards on screen. With any, its mosaic shows those items faded under "N in other apps";
  the panel's folder card reads "N in other apps".

Deleting a folder never deletes what is in it (its folders and items move up a level), so this is about not
misleading, not about loss.

#### The Explorer on each app's address

Each app's router answers `/explorer/*` by fetching the same page from liveworkspace.app, so the address bar
keeps the app's name (`liveplanner.app/explorer/recent`): path, query and hash unchanged, no redirect. The
routing is one shared helper, `@liveworkspace/sites/workspace-proxy`, the same for all four apps: livediagram,
liveplanner, livedocuments and livedesign.
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

The page reads where it is from its own address and there is that app's page: the app's live, `www.` and `staging.`
hosts, and locally any `localhost` port in the app's block (livediagram 3100–3199, and so
on, the root AGENTS.md), so the page an app's E2E stack serves on its own port (`:3102`) is that app's too.

- **Who it reads as.** The app's own session: the app's access token (`POST /api/auth/token`, from the app's
  refresh cookie, asked only while the app's signed-in hint says there is one, and never twice at once), else the
  app's guest token, both of which the index takes. The accounts Worker takes the same token on its account reads.
  The app's silent sign-in runs on the page, as in the app's editor.
- **The header.** The liveworkspace logo leads to liveworkspace.app, the app's logo to the app's home, and the
  account menu is the app's: Sign In and Sign Out are the app's, and its Settings opens the Settings panel here,
  in place. The logo's site switcher marks the app and keeps the person on the Explorer: each row opens that
  site's Explorer at the same view ([site-switcher.md](../010-site/site-switcher.md#on-an-explorer-page)).
- **Links.** Items of that app open on the same origin; other apps' items open on their own sites. Only what needs
  liveworkspace.app's session (the profile, API tokens) links there, to the panel on that section.
- **This Browser.** The app keeps a small list of its offline items (id, title and dates, never content) in
  localStorage under `liveworkspace:this-browser:<app>` (`@liveworkspace/explorer/this-browser`), written by its
  offline store as it writes. The Explorer reads it: a sidebar row with the count, `/explorer/offline`, a This
  Browser group in the Trash, and the opened ones in Home's Jump Back In. Each opens in the app's editor.
  liveworkspace.app can't read another origin's list, so its This Browser row (and `/explorer/offline` there) goes
  to the app's own `/explorer/offline` (the registry's `offlinePath`). That view is the only This Browser page: the
  apps' old `/offline` pages only redirect to it, their query kept. Each of its rows has **Sync** (signed in) and
  **Delete**, asked first and for good, since nothing else holds the item: the same verbs and confirmation as the
  panel's This Browser rows. The confirmation says it deletes only this browser's copy, the one there is, and that
  nothing in the account changes (`thisBrowserDeleteCopy`, the editors' handed-over Delete words it the same). Every
  host has `remove`, so Delete is never missing in one app and there in another: the editor's panel deletes in place
  (its offline store's delete); the page, which can't reach the app's offline store, asks on the page and then hands
  over to the editor (`?convert=delete`, below), which deletes it without asking again and comes back to
  `/explorer/offline`. Each row says when it last changed in relative words ("Changed 3 hours ago"), its full date
  and time in the browser's locale on hover (`title`), as the panel's rows do; with none, the page and the panel both
  say "Nothing is kept only in this browser." The view takes the filter lens like My Work (the field and chip
  row), matched in the browser over the list, since the index never sees these items.
- **This Browser in the Inbox.** The Inbox's rows from those offline items (actions, cards and threads, which the
  index never holds) are worked out by the app's own code. The editor's panel reads them from the offline store
  directly; for the page, the app also keeps a snapshot of them in localStorage under
  `liveworkspace:this-browser-inbox:<app>` (`@liveworkspace/explorer/this-browser`): the ids of the person they are
  for (the account, and this browser's guest), at most 100 actions and 100 threads, newest first. The app works it
  out again about 1.5 s after its offline store last writes, once a page load and as the panel's Inbox reads, and
  drops it when no offline items are left. The page lists it, with the This Browser pill, only to the person it
  names, and hears it change. liveworkspace.app can't read it, as it can't read the list.
- **Take Offline, Sync and Delete.** Where the app's editor runs them (the registry's `offlineConversions`), each of
  the app's own items the person edits and holds themselves has **Take Offline** on its menu, and each live This
  Browser row has **Sync** for a person signed in and **Delete** for anyone. Only the app can write its offline
  store: in the editor's panel all three run in place; the page hands over to the app's editor at the item's own
  address (`<itemPath><id>?convert=take-offline|sync|delete&item=<id>`, `thisBrowserConvertHref`), which takes the
  request out of the address, checks the item is the person's to move (or, for Delete, one this browser keeps), asks
  them to confirm, and runs the app's own conversion or delete. The page's Delete has already asked, on the page: it
  leaves a note for that one item in this tab's session storage (`markThisBrowserDeleteConfirmed`), and the editor
  takes the note (once, for that item) in place of asking again. A link without the note asks first. A request that
  reaches This Browser's view instead (`/explorer/offline?convert=…`, an older `/offline` link) goes on to the
  editor the same way. A link alone never moves or deletes anything.
- **This Browser in Jump Back In.** An opened This Browser item is one card among Home's others, the same size and
  shape as the rest of its group (a thumbnail area, the title, and a line with the **This Browser** badge and when it
  was opened). It has no snapshot (none leaves the browser), so its thumbnail is a picture of the browser it lives in,
  tinted in the accent of the app that owns it (`LocalPreview`): the same picture on its This Browser rows, on the page
  and in the panel. The **This Browser** badge, in teal (no app's accent and no status colour, with its icon and words), says where it lives; the tint says whose it is. It has the same ⋯ menu and right-click as any card, with This Browser's own verbs: **Open**, **Sync**
  (signed in, as This Browser's rows offer it: in place in the panel, handed over to the editor on the page) and,
  where the host has `remove`, **Delete**, asked first (in place in the panel, handed over on the page). It drags as
  the others do, and each target means what it can for an item the account doesn't hold. On the **Trash** it is
  deleted for good after a confirmation, since nothing else holds it; a host without `remove` (none today, kept for
  a host that can't reach the app's editor) makes the drop say so and offer Open, as the Trash's This Browser group
  does. On a **folder**, My Work
  or a team it has to be synced to the account first, so the drop asks to Sync: in place, it then moves there; on
  the page Sync hands over to the editor, and the dialog says it can be moved once it's in the account. Signed out,
  the drop says to sign in and sync it first.
- **Teams.** Made, run and answered here, as on liveworkspace.app: the accounts Worker takes the app's token for
  them ([Teams](#teams-are-run-in-the-explorer)). After a change the app is asked for a fresh token, which names
  the teams as they now are.
- **The Library and Settings.** The Image Gallery and Shape Libraries are read from the app's own API on the same
  origin (`imagesPath`, `shapeLibrariesPath`). The Gallery lists the person's images from every app, and its "Used
  in" badge counts every app's items that place one: another app's item is named with its app and opens there
  ([media.md](../006-media/media.md#usage)). Signed in, the bottom bar has a Settings button beside Appearance,
  opening the Settings panel in place, filtered to the app with All beside it ([site.md](../010-site/site.md#settings)), as the
  account menu's Settings does; `?settings=` addresses open the same panel here, on the section they name
  ([site.md](../010-site/site.md#the-explorer-explorer)).
- **Telemetry.** Every event counts for the app, sent to liveworkspace.app's telemetry service.

The extra hop costs one Worker-to-Worker fetch on the HTML and payloads (assets are cached at the edge); see
[site.md](../010-site/site.md#on-an-apps-own-address) for the measurements.

The editors' floating Explorer panel and move-to-folder picker use the same package, inside each app.
The panel is never docked and never open on its own: in every editor it starts closed, is never reopened
from a remembered state, and opens only as a popover from the canvas's top-left menu button (☰), closing on a
press outside, Esc, the button again or opening an item. Its code loads the first time it opens (fetched ahead
once the editor is idle). The editors' status screens (deleted, couldn't load, not found) show neither the panel
nor the menu button.

The panel keeps the person in the editor. Its rail's sections each open their pane in place, This Browser among
them (under More, with its count, while this browser keeps any of the app's items: each opens in the editor, Sync
moves one into the account and the panel asks before deleting one for good). Each pane's header names its section
in full, never cut short, beside quiet glyphs: **New Folder** (New Subfolder inside a folder) in a space, a team's
**Members**, each named by its label and tooltip, and the app switch (the app's logo and name, All with
liveworkspace's). There is no Open Page: the full Explorer is the menu button's own link and Home's See all.
The panel's Home lists This Browser's opened items among Jump Back In by the page's rule (`mergeOpened`: last opened
first, among the index's), each a card with This Browser's picture (`LocalPreview`), the **This Browser** pill, when
it was opened and This Browser's menu, so it never says "No <kind> yet" while this browser keeps opened ones. The
open item is left out there, as the index's is.

**The editors' panel: its size and the scrim.** On a desktop or tablet the popover is roomy: up to **64rem** (1024 px) wide, kept 1rem
inside the window, and up to **56rem** (896 px) tall, kept on the canvas below its button and 24 px short of the
canvas's bottom edge; the rail and pane fill what the card and footer leave, never shorter than 18rem. The rail is
**13rem** (208 px) wide, so its names sit with room either side, and the pane keeps a 1rem margin. The pane's preview
cards (Jump Back In, folders) are compact, so more fit in a row: two across in a narrow pane, three once it is 24rem
wide (a tablet, a wide phone's sheet), four once it is 42rem (every desktop popover, 1280 px and up), each card's
picture 16:9 over a 13 px name and a quiet line; Home's Jump Back In holds up to **eight**, two full rows of four.
The Library's pictures stay five across and its shapes six. On a phone it stays the sheet it was: two cards across
on a 390 px phone. The canvas stays in sight beside the popover at 1280 px (a quarter of the width), and the size
lives once in the package (`EXPLORER_POPOVER_WIDTH`, `EXPLORER_POPOVER_HEIGHT`) for every editor. On every screen size a **scrim** sits behind it: translucent
slate (lighter in light mode, deeper in dark), fading in where motion is allowed, over the canvas and its chrome but
under the panel and everything the panel opens (its menus, dialogs and legends); the editor's header keeps its own
layer above, its menus live. A press on the scrim closes the panel, as a press outside always did, and never reaches
the canvas under it; Esc still closes it; either way focus goes back to the menu button.

**New <Kind>**, first on the rail, is the panel's control height: 36 px under a mouse, 44 px on a touch screen, the
rail's full width, never squeezed when the rail scrolls, its words and plus centred on the cap height. On a phone's
chip row it reads **New**, 36 px to the eye with a 44 px tap, as the chips are. It wears the app's brand fill (700,
600 in dark) in every app.

**The Current card** shows the item open in the editor on top of the panel whenever there is one. The index's copy
draws it when the index has the item. An item kept only in This Browser, which the index never holds, is drawn from
This Browser's list instead: its title, the app's picture of a local item (`LocalPreview`), the **This Browser** pill
and "Updated <relative time>". Its name renames it through the editor's own rename (the app's offline store, which
writes This Browser's list), and its ⋯ menu and right-click are This Browser's (**Open**, **Sync <Kind>** signed in,
**Delete <Kind>** asked first, for good). Nothing about it is sent to the index. The editors read the index's copy
through the package's `useOpenItem`.

#### Teams are run in the Explorer

A team is the account's, the same in every app ([accounts.md](../003-accounts/accounts.md#teams)), and the Explorer is the one
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
   so in a toast. With none waiting it says where the teams are (Spaces) and offers **New Team**. When the teams
   couldn't be read (offline, refused) it says so, with **Try again**, rather than waiting for ever.
4. **Join by link.** The link (`liveworkspace.app/join?token=…`) lands on a thin page that shows the team and
   joins it, then opens the team's view in the Explorer. Signed out, it signs in and comes back.
5. **Decline from an email.** The email's Decline link (`/join/decline?token=…`) is a thin page that declines
   without an account, and points at the Explorer's Invites to accept instead.

Old addresses keep working: `liveworkspace.app/account/teams` goes to `/explorer/invites`, and
`/account/teams/<id>` to that team's view, `/explorer/team?id=<id>` ([site.md](../010-site/site.md#your-account-account)).

**What it loads.** The page asks accounts for the person's teams once as it opens (`GET /api/account/teams`, one
request, as before): the sidebar's member counts, the Invites row and its badge, and the team list itself, which
is fresher than the token's claim. A team's members and its join link are read only when its view opens (`GET
/api/account/teams/:id/members`), and again after a change there. The editor's panel asks nothing about teams until
its team's Members dialog opens. A change is shown at once: a team made, joined, renamed, left or deleted is laid
over the token's list for the rest of the page's life (in the panel too), and the host renews its token so the
next one names it.

**Dates.** Every date the Explorer, the Settings panel and liveworkspace.app's own pages show is written in the
browser's locale (its language and region order: "3 Nov 2026" in the UK, "Nov 3, 2026" in the US), never a fixed
one, through one shared formatter (`@liveworkspace/ui/date-format`). A time is written as the locale's clock writes it: "09:05" on a 24-hour clock, "9:05 AM" on a
12-hour one, never a padded "09:05 AM". It keeps one `Intl.DateTimeFormat` per set of
options and locale, made the first time it is asked for, so a list of thousands of rows makes none per row. A date
that has to be a given zone's day keeps its zone (the status page's days are UTC). Text a prerender would write
can't know the reader's locale, so dates are written only in the browser: the lists that carry them read their data
in the browser (the Explorer's items, This Browser's list, the status history, the Settings rows), and a prerender
shows none.

**Names in sentences.** A toast or a confirmation that names an item, a folder, a team or a picture ("Moved “Plan”
to the Trash.", "Delete “Plan” for good?") isolates the name (FSI … PDI, `quoted` and `isolated` in the package): a
right-to-left name, or one holding a bidi override, stays inside its own run and never turns the words after it
around.

### 5. Comments, actions and the Inbox live in liveworkspace

What the Inbox needs about comments and actions is stored in liveworkspace, keyed by app, item, tab and
element: each item pushes its threads and actions there as they change. The comment text itself stays in
the item's content, beside what it is about, so it saves, undoes and copies with it. The Inbox in the
Explorer is then one query across every app: threads you are in, mentions, and actions assigned to you or by you. Comment and mention emails
are sent from liveworkspace too.

The Inbox reads as a list and a reading pane (one-explorer-contracts.md "Inbox"): every row newest first under
Today, Earlier This Week and Older, a filter bar over it (All, My Actions, Assigned by Me, Comments, Form
Responses, each with its count), and the chosen row read in full beside it. On a phone and in the editor's panel the
pane takes the list's place, with Back. The pane offers only what the page can really do through the owning app's
own routes or editor (Reply and Resolve on a thread, Mark Done on an action in the editor that has it open); Open in
the app is always there.

The Timeline moves too, and spans apps the same way: the index records what it changes itself (made,
renamed, moved, trashed, restored, shared, favourited) and each app reports who edited what. The
Explorer shows it filtered to the app it is in, or All, and Home's What Happened is read from it. Coming back to the
browser tab reads its first page again and merges it in at the head (at most once in 30 seconds, as the Inbox
does), keeping the pages loaded and the visit's New marks. A team's view carries **Team Activity** under its library,
closed until opened: the team's own feed (`GET /timeline?team=`), every member seeing the team's whole history.

### 6. Content lives in one Durable Object per item

As the RFC proposes, and as its reply agreed: one SQLite-backed object per item, which is also the
live room. It holds tabs and their elements (as rows or chunks, which removes D1's 2 MB row limit),
the change log, the sequence counter and presence. Saves go to the object instead of to D1, and the
object gives each change its number and stores it in one step. Images stay in liveworkspace's media
service, and so do previews, which the object draws when asked ([previews.md](../006-media/previews.md)).

Each app's D1 shrinks to what is genuinely its own, if anything (for example livediagram's community
publishing or a Plan's cross-item caches); everything the Explorer needs is gone from it.

### 7. Google Drive

The Drive mirror covers every app, not just livediagram. It moves to liveworkspace: liveworkspace
walks the index, asks each item's app for an export of its content, and keeps Drive in step.

## Order it was built in

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
7. **livediagram last.** It runs on the liveworkspace account like the others; its people and documents
   from the historical livediagram.app come across with the migration (docs/migration.md at the repository
   root).

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
- **Content-derived summaries** (element counts for cards, whether it is empty) are pushed by the object on
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

## Open questions

- The CLI and MCP server across apps.
- Proposed, not built: the Inbox remembering what a person has seen, put off till later or marked done (Seen, Later,
  Done, snooze). It would need read state per person and row, which the index doesn't keep; the Inbox has
  none, and a row leaves only when its work is done in its app.
- Proposed, not built: Mark Done on a Plan card from the Inbox. Done is the board's done column, which the Inbox
  doesn't know; the card opens on its board instead.
