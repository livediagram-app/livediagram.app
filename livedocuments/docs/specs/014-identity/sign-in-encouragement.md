# Sign-in encouragement

A dismissible bottom-of-screen banner that nudges unsigned (guest)
visitors to sign in, plus a "Learn more" modal that lists the concrete
benefits. It shows on the Explorer and, after a delay, inside the
editor. Pure encouragement, never a wall: the canvas and the Explorer
keep working without signing in (see
[04-auth-and-guest-access.md](auth-and-guest-access.md)).

## Goals

- Convert guests to accounts by surfacing what they gain, at the
  moments they're invested in their work.
- Be attractive and modern: a floating gradient card, not a thin grey
  bar with a paragraph.
- Stay out of the way: one click dismisses it, the dismissal sticks,
  and on the canvas it never interrupts the first few minutes.

## Where it shows

The same `SignInBanner` component mounts on two surfaces. Both share
the visibility gate and the dismissal state, so dismissing it anywhere
hides it everywhere.

Common gate (all must hold):

- Clerk is configured for the deployment (`clerkEnabled`). A
  self-hosted, Clerk-less install ([Open source + distribution](../002-project-scope/open-source-and-business-model.md) + [Auth + guest access](auth-and-guest-access.md)) has no working
  sign-in, so the banner never renders there.
- The visitor is **not** signed in (no `clerkUserId`; a guest owner id
  doesn't count).
- The visitor hasn't dismissed it (see Dismissal).

**Explorer** (`app/explorer/ExplorerShell.tsx`): rides every
`/explorer/<section>` route, shown immediately when the gate holds.
The pane reserves extra bottom padding while it's up so the last row
never hides behind it.

**Toasts stand on it.** While the banner shows, in the Explorer or the editor, its card is part of the bottom chrome
the toast stack clears ([Toasts](../004-interface-design/toasts.md) "Placement"): the stack sits 8px above the card's
top instead of landing on its words, as a "Document deleted · Undo" once did.

**Editor** (`app/document/[id]/EditorView.tsx`): shown only **after a
~5 minute delay** into the session (`SIGNIN_BANNER_DELAY_MS`), so it
never greets someone the instant they open a document. It **stands on the
bottom chrome**, 8px above the tab bar and the bottom-right cluster (Undo / Redo,
Layers, Zoom), measured as
the toast stack measures its floor (`useChromeFloor`, `BOTTOM_CHROME_SELECTOR`), so it never
covers a control. It is drawn over the canvas, and is additionally hidden:

- in **embed** mode (the read-only `/embed` iframe, [Read-only embeds (`/embed`)](../013-workspace/embeds.md)), and
- in **zen** mode ([Zen mode](../007-editor/zen-mode.md)), but entering/leaving zen does **not**
  restart the delay; the timer runs on the stable gate (Clerk / signed
  in / embed / dismissed) and zen only hides the card at render, and
- while a **tour's offer or last card** is up ([Pages tour](../007-editor/pages-tour.md)): they take the same place
  at the bottom, so the banner steps aside until the card goes (`data-tour-card-open` on the body), and
- while a **panel opened from the chrome** is open (Tidy Up, Layers, Style and the rest of the bottom-right cluster, the
  Explorer panel): they reach up into the banner's band and it lay over their lower rows, so it steps aside until the
  panel closes (a `[data-dock-button]` control with `aria-expanded="true"`).

The delay is per editor session (per page load); it isn't persisted
across reloads. Opening document after document in quick succession
never triggers it; staying in one for 5+ minutes does.

## Banner

- Fixed to the bottom of the viewport, a centred floating card with a
  max width, rounded corners, shadow, and a brand gradient, visually a
  peer of the app's other branded surfaces, not chrome.
- Its gradient is `brand-700` to `brand-800` in light and dark alike, in white: the words read on it
  at 5.9:1 and 7.6:1, and the supporting line, at 90% white, at 5.1:1 (WCAG 2.2 AA,
  [Colour scheme](../004-interface-design/color-scheme.md)). The lighter brand steps fail it. The
  reasons modal's header wears the same gradient.
- Contents: a small icon/illustration, a headline ("Sign in to access
  Teams & AI"), one line of supporting copy saying what those give and
  that documents sync ("Share with your team, build with AI, sync across
  devices."), a primary **Sign in**
  button (→ `/sign-in/`), a secondary **Learn more** button (opens the
  reasons modal), and a dismiss (×) control.
- Responsive: the copy and buttons stack / shrink gracefully on a
  phone width. On a phone held sideways (the `landscape-phone` variant: a touch screen under 500px
  tall) it is one slim row: the supporting line is left out and the padding tightens, so it covers
  as little of the short screen as it can.

## Learn-more modal

Reuses the app's portal-based modal pattern (Escape + backdrop close).
Lists the benefits, each with an icon, headline, and a sentence:

1. **Keep your documents safe.** Guest documents live under a
   per-browser id; clearing your browser cache or cookies can lose
   access to them. Signing in ties them to your account so they
   survive a cache clear or browser restart.
2. **Open them anywhere.** Your work syncs to your account, so the
   same documents are there on your laptop, desktop, and phone.
3. **Work as a team.** Create teams, invite teammates by email, and
   share a team library everyone can manage ([Teams](../013-workspace/teams.md), [Team shared documents](../013-workspace/team-shared-documents.md)).
4. **Use your real name.** Shared documents and live cursors show your
   account name instead of a random guest identity, so collaborators
   know who did what.
5. **Your shares, organised.** Manage every share link and expiry from
   one account instead of one browser.

The modal's footer carries the same primary **Sign in** call to action.

It is fine to refine the exact wording over time; the five benefit
themes (durability, cross-device, teams, identity, share management)
are the substance.

## Dismissal

- The × hides it and records the dismissal in `localStorage` under
  `livedocuments:signin-banner-dismissed:v1` via the shared safe-storage
  helpers, synced across tabs through the native `storage` event.
  (Escape is reserved for the Learn-more modal, so it doesn't also
  dismiss the banner underneath.)
- Dismissal is per-device and permanent for that browser (there's no
  re-nag timer in V1). Signing in makes it moot; signing out later
  surfaces it again only if it was never dismissed on that device.

## Telemetry

Anonymous events only ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), reusing the closed enums (no new
category/action needed):

Every banner event names the **surface** it happened on, Explorer or
editor, since the same banner mounts on both and the two audiences differ
(someone browsing their library vs someone five minutes into drawing). The
host passes `surface` to `SignInBanner`; the type carries it as a suffix:

- `UI` / `Opened` / `SignInReasonsExplorer` | `SignInReasonsEditor`: Learn
  more opened the modal.
- `UI` / `Selected` / `SignInBannerExplorer` | `SignInBannerEditor`: a Sign in
  CTA (on the banner, or in the reasons modal it opened) was clicked.
- `UI` / `Closed` / `SignInBannerExplorer` | `SignInBannerEditor`: the banner
  was dismissed.

Before September 2026 these were sent without the surface (`SignInReasons`,
`SignInBanner`); those rows age out with the 60-day retention. The Assign
Action dialog's guest nudge is its own event, `UI` / `Opened` /
`ActionSignInNudge` ([Assigned actions](../012-collaboration/assigned-actions.md)). The dashboard's Sign-In Prompts stack charts
each of these by surface ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

No "shown" event: it would fire on nearly every guest Explorer load and
drown the signal ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) noise rule).

## Non-goals (V1)

- No re-engagement timer / "remind me later"; dismiss is final per
  device.
- No A/B copy variants or server-driven targeting.
- No banner in the editor or on marketing pages. Explorer only.
