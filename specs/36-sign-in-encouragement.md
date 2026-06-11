# Sign-in encouragement

A dismissible bottom-of-screen banner that nudges unsigned (guest)
visitors to sign in, plus a "Learn more" modal that lists the concrete
benefits. It shows on the Explorer and, after a delay, inside the
editor. Pure encouragement, never a wall: the canvas and the Explorer
keep working without signing in (see
[04-auth-and-guest-access.md](04-auth-and-guest-access.md)).

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
  self-hosted, Clerk-less install (spec/03 + spec/04) has no working
  sign-in, so the banner never renders there.
- The visitor is **not** signed in (no `clerkUserId`; a guest owner id
  doesn't count).
- The visitor hasn't dismissed it (see Dismissal).

**Explorer** (`app/explorer/ExplorerShell.tsx`): rides every
`/explorer/<section>` route, shown immediately when the gate holds.
The pane reserves extra bottom padding while it's up so the last row
never hides behind it.

**Editor** (`app/diagram/[id]/EditorView.tsx`): shown only **after a
~5 minute delay** into the session (`SIGNIN_BANNER_DELAY_MS`), so it
never greets someone the instant they open a diagram. It sits above
the tab bar and over the canvas chrome, and is additionally hidden:

- in **embed** mode (the read-only `/embed` iframe, spec/33), and
- in **zen** mode (spec/26), but entering/leaving zen does **not**
  restart the delay; the timer runs on the stable gate (Clerk / signed
  in / embed / dismissed) and zen only hides the card at render.

The delay is per editor session (per page load); it isn't persisted
across reloads. Opening diagram after diagram in quick succession
never triggers it; staying in one for 5+ minutes does.

## Banner

- Fixed to the bottom of the viewport, a centred floating card with a
  max width, rounded corners, shadow, and a brand gradient, visually a
  peer of the app's other branded surfaces, not chrome.
- Contents: a small icon/illustration, a headline ("Sign in to keep
  your work safe"), one line of supporting copy, a primary **Sign in**
  button (→ `/sign-in/`), a secondary **Learn more** button (opens the
  reasons modal), and a dismiss (×) control.
- Responsive: the copy and buttons stack / shrink gracefully on a
  phone width.

## Learn-more modal

Reuses the app's portal-based modal pattern (Escape + backdrop close).
Lists the benefits, each with an icon, headline, and a sentence:

1. **Keep your diagrams safe.** Guest diagrams live under a
   per-browser id; clearing your browser cache or cookies can lose
   access to them. Signing in ties them to your account so they
   survive a cache clear or browser restart.
2. **Open them anywhere.** Your work syncs to your account, so the
   same diagrams are there on your laptop, desktop, and phone.
3. **Work as a team.** Create teams, invite teammates by email, and
   share a team library everyone can manage (spec/32, spec/35).
4. **Use your real name.** Shared diagrams and live cursors show your
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
  `livediagram:signin-banner-dismissed:v1` via the shared safe-storage
  helpers, synced across tabs through the native `storage` event.
  (Escape is reserved for the Learn-more modal, so it doesn't also
  dismiss the banner underneath.)
- Dismissal is per-device and permanent for that browser (there's no
  re-nag timer in V1). Signing in makes it moot; signing out later
  surfaces it again only if it was never dismissed on that device.

## Telemetry

Anonymous events only (spec/22), reusing the closed enums (no new
category/action needed):

- `UI` / `Opened` / `SignInReasons`: Learn more opened the modal.
- `UI` / `Selected` / `SignInBanner`: a Sign in CTA (banner or modal)
  was clicked.
- `UI` / `Closed` / `SignInBanner`: the banner was dismissed.

No "shown" event: it would fire on nearly every guest Explorer load and
drown the signal (spec/22 noise rule).

## Non-goals (V1)

- No re-engagement timer / "remind me later"; dismiss is final per
  device.
- No A/B copy variants or server-driven targeting.
- No banner in the editor or on marketing pages. Explorer only.
