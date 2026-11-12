# Explorer Home

`/explorer` and `/explorer/home` render the shared Explorer's Home view: the hero, New (the four documents made most recently in this app, newest first, mine and my teams', made by AI ones included, wearing Made by AI; hidden while there are none: [One Explorer "New, on Home"](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#new-on-home)), Most Used and Recent (Most Used: up to eight items you opened in the last 14 days, the most opened first, then Recent: up to eight of your most recently opened, from every app, four across in two rows on a desktop and one strip of up to eight on a phone, each with a line such as "Opened 12 times" or "Opened 2 hours ago") and Shared With You Recently, read from the index.

## The hero

The shared Explorer draws Home's hero ([`@liveworkspace/explorer`'s `HomeHero`](../../../../packages/explorer/src/explorer/HomeHero.tsx)); livedocuments gives it its words, its Help article and its setting: on the Explorer page, liveworkspace's, served on livedocuments' address (`liveworkspace/apps/site/lib/explorer/welcome.ts`, `settings.ts`), and in a workbench frame its own copy ([`apps/editor/app/embed/workbench/ExplorerHost.tsx`](../../../apps/editor/app/embed/workbench/ExplorerHost.tsx)). It is a band the page's full width, under the Explorer header and above the sidebar and Home's sections, on Home only. Its ground is a soft wash of the app's accent under a dotted grid, a hairline under it; in dark mode, the dark ground with a soft glow from the top. Its content sits in the Explorer's content width.

Top to bottom, left column:

- **Status pills**, two, each a link with a coloured dot:
  - the person's documents: "1 document" / "N documents" (every space the person is in, in this app: My Work and each of their teams, each item counted once; not what was shared with them through a link), opening **My Work**, or for someone in a team, Search results narrowed to those spaces (`space:mine,team:…`); a
    green dot. The count is one request of up to 200 items, made only while the hero shows; past that it reads "200+ documents";
  - the Inbox: "Inbox is clear" when nothing open is assigned to the person, else "N open in your Inbox", the
    sidebar's Inbox count ([Inbox](inbox.md)), opening the **Inbox**; a sky dot.
  - A pill is drawn once its count is known: never "0 documents" while the lists load or after the count failed to, nor
    "Inbox is clear" for an Inbox that has not loaded or failed to.
- **The greeting**, the page's `h1`: "Good morning,", "Good afternoon," or "Good evening," by the reader's local
  hour (5 to 11 morning, 12 to 17 afternoon, else evening), then "what are you writing today?". Large display type
  (about 56 px on a desktop, 36 px on a phone), extra bold, tight tracking. The tab's title stays **Home**.
- **The lead**: "Jump back into what you use most, or start something new."
- **The search field**: the Explorer's search drawn large (60 px high, a 2 px accent edge and a soft glow), with
  **New Document** as a solid button inside its right end. On Home it is the only search field: the header's is not
  drawn, so the page never shows two. Typing in it opens Search results, and the header's field there takes the
  focus with the caret after what was typed, so the typing carries on uninterrupted.

**The first run.** When Home finds nothing yet, the shared Explorer shows its welcome in place of empty lists, from
livedocuments' welcome manifest (`packages/templates/welcome.json`, the templates it offers to start from),
loaded once, only then, in a chunk of its own (`liveworkspace/apps/site/lib/explorer/welcome.ts` on the Explorer page, `loadWelcome` in
`apps/editor/app/embed/workbench/ExplorerHost.tsx` in a workbench frame).

Beside the field (from `lg` up) or under it, the hero shows **what livedocuments makes**: an **Article**, a
**Slide Deck**, an **Infographic** and a **Poster**, each a small picture in livedocuments' amber with its name, laid
out as every app's are ([one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) "What you can make, on Home's hero"). Each starts one (`/new?template=` `blank-article`, `blank-slide-deck`,
`blank-infographic`, `event-poster`). **Nothing is fetched** to draw them.

**It comes and goes with Home.** Leaving Home for another Explorer page folds the hero away (its height to nothing as
it fades), and the page under it slides up; returning to Home unfolds it again, over the `long` motion token
(250 ms). Landing on Home from outside the Explorer shows it at once. Under reduced motion it appears and goes at
once. While folding away it takes no focus.

The hero's top right holds Home's **Help** link ([Contextual help links](../018-help/contextual-help-links.md)). On a
phone (below `sm`) the sections bar above the hero opens the sidebar's drawer, and the hero has no menu button of its
own ([one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) "The sidebar", On a phone).

## Hiding the banner

Next to Help, wherever the hero puts it (a phone's row, the pills' row, the wide top right), sits a **close** (an ×
button named and tooltipped "Hide Home Banner"). Pressing it hides the hero for good, as the synced `homeBanner`
preference set to `false` ([User preferences](../007-editor/user-preferences.md)), on every device the person signs
in on. It folds away as it does on leaving Home. **Settings > Explorer > Show Home Banner** turns it back on.
Either flip reports `UI / Toggled / HomeBannerOff` or `HomeBannerOn` before the preference is written.

With the banner hidden, Home is drawn like every other Explorer page: the header's search field is drawn on Home too,
and Home takes the ordinary page header (the title "Home" and its Help link), so it keeps its `h1`.

## What Happened (retired)

Home's What Happened section, what other people did to the items the person could open, is retired with the
Timeline (November 2026, [History](history.md)). Home ends with Shared With You Recently; what happened to one item
is its History.

Telemetry, through the Explorer's `onHome` prop: `Home·Loaded·Retry` (a failed read of Home tried again). The What
Happened events (`Home·Selected·WhatHappened`, `Home·Selected·SeeTimeline`, `Home·Opened·Group`) are no longer sent.

livedocuments says when a document is opened: the editor records the open with the index (`POST /items/:id/open`, debounced there to one write a minute) when it loads the document. The index keeps the time for Recent and counts the open on that day for Most Used (opens over the last 14 days), and Most Used and Recent reads both in one request.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
