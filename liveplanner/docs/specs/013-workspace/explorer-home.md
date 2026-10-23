# Explorer Home

**Moved to liveworkspace's index (October 2026).** liveplanner's own Home (Jump Back In with its Within reach set, then What Happened, read from `/api/home`) is gone. `/explorer` and `/explorer/home` render the shared Explorer's Home view: the hero, Jump Back In (your most recently opened items, from every app) and Shared With You Recently, read from the index. What Happened went with the [Timeline](timeline.md).

## The hero

The shared Explorer draws Home's hero ([`@liveworkspace/explorer`'s `HomeHero`](../../../../packages/explorer/src/explorer/HomeHero.tsx)); liveplanner gives it its words, its art, its Help article and its setting ([`apps/editor/app/explorer/ExplorerShell.tsx`](../../../apps/editor/app/explorer/ExplorerShell.tsx)). It is a band the page's full width, under the Explorer header and above the sidebar and Home's sections, on Home only. Its ground is a soft wash of the app's accent under a dotted grid, a hairline under it; in dark mode, the dark ground with a soft glow from the top. Its content sits in the Explorer's content width.

Top to bottom, left column:

- **Status pills**, two, each a link with a coloured dot:
  - the person's plans: "1 plan" / "N plans" (My Work, the person's own space, in this app), opening **My Work**; a
    green dot. The count is one request of up to 200 items, made only while the hero shows; past that it reads "200+ plans";
  - the Inbox: "Inbox is clear" when nothing open is assigned to the person, else "N open in your Inbox", the
    sidebar's Inbox count ([Inbox](inbox.md)), opening the **Inbox**; a sky dot.
  - A pill is drawn once its count is known: never "0 plans" while the lists load or after the count failed to, nor
    "Inbox is clear" for an Inbox that has not loaded or failed to.
- **The greeting**, the page's `h1`: "Good morning,", "Good afternoon," or "Good evening," by the reader's local
  hour (5 to 11 morning, 12 to 17 afternoon, else evening), then "what are you planning today?". Large display type
  (about 56 px on a desktop, 36 px on a phone), extra bold, tight tracking. The tab's title stays **Home**.
- **The lead**: "Jump back into what you use most, or see what changed while you were away."
- **The search field**: the Explorer's search drawn large (60 px high, a 2 px accent edge and a soft glow), with
  **New Plan** as a solid button inside its right end. On Home it is the only search field: the header's is not
  drawn, so the page never shows two. Typing in it opens Search results, and the header's field there takes the
  focus with the caret after what was typed, so the typing carries on uninterrupted.

The right column, on a wide screen only (`lg` and up), shows **fanned previews** of what a plan holds
([`apps/editor/components/panels/home/HeroFeatureFan.tsx`](../../../apps/editor/components/panels/home/HeroFeatureFan.tsx), the Explorer's `heroArt`): a **Board**, a **Sheet**, a **Dashboard** and a **Form**, the Board and the Sheet behind
turned out to either side, the Dashboard and the Form in front, each on a white sheet with a soft shadow and its name
in a small pill. They are the same for everyone: static art drawn from the pictures Start Planning offers
([Plan mode](../026-plan/plan-mode.md) "Starting a board"), in the page's light or dark look, and **nothing is
fetched** to draw them. They are not links: Jump Back In is the way in. For assistive technology they are one group,
"What a plan can hold", of four images named Board, Sheet, Dashboard and Form. Their one motion is a short fade as
they land, and none under reduced motion. On a phone or a tablet the column is not drawn.

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
in on. It folds away as it does on leaving Home. **Settings > Plans > Explorer > Show Home Banner** turns it back on.
Either flip reports `UI / Toggled / HomeBannerOff` or `HomeBannerOn` before the preference is written.

With the banner hidden, Home is drawn like every other Explorer page: the header's search field is drawn on Home too,
and Home takes the ordinary page header (the title "Home", its Help link and, on a phone, the menu button), so it
keeps its `h1`.

What liveplanner still does is say when a plan is opened: the editor records the open with the index (`POST /items/:id/open`, debounced there to one write a minute) when it loads the plan, and that is what Recent and Jump Back In sort by.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
