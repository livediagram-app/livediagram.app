# Explorer Home

**Moved to liveworkspace's index (October 2026).** livedocuments' own Home (Jump Back In with its Within reach set, then What Happened, read from `/api/home`) is gone. `/explorer` and `/explorer/home` render the shared Explorer's Home view: the hero, Jump Back In (Most Used: the items you used on the most days in the last 90, then your most recently opened, up to eight from every app, each with a line such as "Used on 6 days" or "Opened 2 hours ago") Shared With You Recently, and What Happened, read from the index.

## The hero

The shared Explorer draws Home's hero ([`@liveworkspace/explorer`'s `HomeHero`](../../../../packages/explorer/src/explorer/HomeHero.tsx)); livedocuments gives it its words, its art, its Help article and its setting: on the Explorer page, liveworkspace's, served on livedocuments' address (`liveworkspace/apps/site/lib/explorer/hero.ts`, `welcome.ts`, `settings.ts`), and in a workbench frame its own copy ([`apps/editor/app/embed/workbench/ExplorerHost.tsx`](../../../apps/editor/app/embed/workbench/ExplorerHost.tsx)). It is a band the page's full width, under the Explorer header and above the sidebar and Home's sections, on Home only. Its ground is a soft wash of the app's accent under a dotted grid, a hairline under it; in dark mode, the dark ground with a soft glow from the top. Its content sits in the Explorer's content width.

Top to bottom, left column:

- **Status pills**, two, each a link with a coloured dot:
  - the person's documents: "1 document" / "N documents" (My Work, the person's own space, in this app), opening **My Work**; a
    green dot. The count is one request of up to 200 items, made only while the hero shows; past that it reads "200+ documents";
  - the Inbox: "Inbox is clear" when nothing open is assigned to the person, else "N open in your Inbox", the
    sidebar's Inbox count ([Inbox](inbox.md)), opening the **Inbox**; a sky dot.
  - A pill is drawn once its count is known: never "0 documents" while the lists load or after the count failed to, nor
    "Inbox is clear" for an Inbox that has not loaded or failed to.
- **The greeting**, the page's `h1`: "Good morning,", "Good afternoon," or "Good evening," by the reader's local
  hour (5 to 11 morning, 12 to 17 afternoon, else evening), then "what are you writing today?". Large display type
  (about 56 px on a desktop, 36 px on a phone), extra bold, tight tracking. The tab's title stays **Home**.
- **The lead**: "Jump back into what you use most, or see what changed while you were away."
- **The search field**: the Explorer's search drawn large (60 px high, a 2 px accent edge and a soft glow), with
  **New Document** as a solid button inside its right end. On Home it is the only search field: the header's is not
  drawn, so the page never shows two. Typing in it opens Search results, and the header's field there takes the
  focus with the caret after what was typed, so the typing carries on uninterrupted.

**The first run.** When Home finds nothing yet, the shared Explorer shows its welcome in place of empty lists, from
livedocuments' welcome manifest (`packages/templates/welcome.json`, the templates it offers to start from),
loaded once, only then, in a chunk of its own (`liveworkspace/apps/site/lib/explorer/welcome.ts` on the Explorer page, `loadWelcome` in
`apps/editor/app/embed/workbench/ExplorerHost.tsx` in a workbench frame).

The right column, on a wide screen only (`lg` and up), shows livedocuments' **hero art**, the Explorer's `heroArt`
([`apps/editor/components/panels/home/HeroTemplateFan.tsx`](../../../apps/editor/components/panels/home/HeroTemplateFan.tsx)):
three template previews (`HERO_FAN`: a slide deck, an event poster and a year in review) fanned out, each on a
white sheet with a soft shadow, in the page's light or dark look, so a person sees what livedocuments makes. **Nothing is fetched** to draw them. They are not
links: Jump Back In is the way in. For assistive technology they are one group of images. Their one motion is a
short fade as they land, and none under reduced motion. On a phone or a tablet the column is not drawn.

On liveworkspace.app, which carries none of the editor's code, the same previews ship as data in
`packages/templates/hero.json` (the templates package's `hero.json` export), written from these components by
[`hero-manifest.test.tsx`](../../../apps/editor/components/panels/home/hero-manifest.test.tsx) through
`@liveworkspace/explorer/hero-manifest` (`HERO_WRITE=1 pnpm vitest run components/panels/home/hero-manifest.test.tsx`
in `apps/editor`; without it the test fails when the file has drifted), and drawn there by the Explorer's
`HeroArt`, the slide deck in front, loaded only on a wide screen.

**It comes and goes with Home.** Leaving Home for another Explorer page folds the hero away (its height to nothing as
it fades), and the page under it slides up; returning to Home unfolds it again, over the `long` motion token
(250 ms). Landing on Home from outside the Explorer shows it at once. Under reduced motion it appears and goes at
once. While folding away it takes no focus.

The hero's top right holds Home's **Help** link ([Contextual help links](../018-help/contextual-help-links.md)). On a
phone (below `sm`) its top left holds the menu button that opens the sections drawer.

## Hiding the banner

Next to Help, wherever the hero puts it (a phone's row, the pills' row, the wide top right), sits a **close** (an ×
button named and tooltipped "Hide Home Banner"). Pressing it hides the hero for good, as the synced `homeBanner`
preference set to `false` ([User preferences](../007-editor/user-preferences.md)), on every device the person signs
in on. It folds away as it does on leaving Home. **Settings > Documents > Explorer > Show Home Banner** turns it back on.
Either flip reports `UI / Toggled / HomeBannerOff` or `HomeBannerOn` before the preference is written.

With the banner hidden, Home is drawn like every other Explorer page: the header's search field is drawn on Home too,
and Home takes the ordinary page header (the title "Home", its Help link and, on a phone, the menu button), so it
keeps its `h1`.

## What Happened

Home's last section is what other people did to the items the person can open, from one page (30 events) of the
index's [Timeline](timeline.md) (`GET /timeline`, in Home's This app / All filter), read once per visit and filter.
It keeps others' doings only: never the reader's own, never one nobody did, never a favourite (only its person's).

- One group per item per local day, under day headings ("Today", "Yesterday", "Tue, 14 Oct").
- A group with one person lists each doing as a link that opens the item in its app (a document in the Trash opens the
  Trash): an initials avatar (the person glyph when the index has no name), "**Sam Lee** renamed **Budget 2027**",
  what it changed ("Was “Budget”", "To Launch documents", the share level, "Made by AI"), then where it lives (its space
  › its folder), the time and, under All, the app's mark.
- A group with several people is one button: "**Sam Lee and Ana Ruiz** edited and renamed **Budget 2027**", "2
  updates", dealing out every doing (collapsed each visit, never remembered).
- **New** marks a doing since the person last looked at the Timeline; reading Home does not mark it seen.
- **See Timeline** at the heading's end opens the Timeline, once the entries are in.
- With nothing from anyone, or a failed read, the section is left out. It is the page's last, so nothing moves.

Comments, replies, resolved threads and actions are not Timeline events: they are in the [Inbox](inbox.md), and the
index's names come only from what an app reports (livedocuments' edits carry none yet, so they read "A teammate").

The help centre's [Home](../../../apps/help/app/explorer/timeline/page.mdx) article describes Home (Jump Back In, What Happened) and the Timeline.

Telemetry, through the Explorer's `onHome` prop: `Home·Selected` (`WhatHappened`, `SeeTimeline`) and `Home·Opened`
(`Group`).

What livedocuments still does is say when a document is opened: the editor records the open with the index (`POST /items/:id/open`, debounced there to one write a minute) when it loads the document. The index keeps the time for Recent and the day as a use day for Most Used, and Jump Back In reads both in one request.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
