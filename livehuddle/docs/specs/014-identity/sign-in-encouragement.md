# Sign-in encouragement

A standing toast that nudges a guest to sign in, a while into a session in the editor, with **Sign In** as its one
action. Pure encouragement, never a wall: the canvas keeps working without signing in
([Auth + guest access](auth-and-guest-access.md)).

## Goals

- Convert guests to accounts by saying what they gain, at the moment they're invested in their work.
- Stay out of the way: it never greets someone the instant they open their work, one press closes it, and the close
  sticks.
- One notification surface: it is a toast on the one shared toast ([Toasts](../../../../liveworkspace/docs/specs/016-notifications/toasts.md)), not a banner of its own (the
  owner, 2026-11-20: "Make the sign-in banner a toast, losing the Learn More and keeping the Sign In as the CTA").

## Where it shows

In the editor only (`app/document/[id]/EditorView.tsx`, through the shared `useSignInToast`,
`packages/workbench/src/hooks/ui/useSignInToast.ts`). The Explorer shows no sign-in toast and no banner (the owner,
2026-11-20); its sidebar's Sign In to Use Teams nudge still asks a guest to sign in.

It shows when all of these hold:

- the visitor is **not** signed in (no `accountUserId`; a guest owner id doesn't count);
- the visitor hasn't closed it in this browser (see Dismissal);
- about **five minutes** have passed in this editor session (`SIGNIN_BANNER_DELAY_MS` in the shared
  `packages/workbench/src/hooks/ui/useSignInNudge.ts`), so it never greets someone the instant they open a space.

It is never shown:

- in **embed** mode (the read-only `/embed` iframe, [Read-only embeds (`/embed`)](../013-workspace/embeds.md)).

The delay is per editor session (per page load); it isn't persisted across reloads. Opening space after space in
quick succession never triggers it; staying in one for five minutes or more does.

## The toast

A standing toast in the highlight look, solid green so it is noticed ([Toasts](../../../../liveworkspace/docs/specs/016-notifications/toasts.md) "Timing" and "Look"), raised by `toast.action` under the `sign-in` key:

- One line: **"Sign in to get Teams, AI & even more powerful features."**
- One action, **Sign In** (Title Case, the primary button), which goes to the editor's sign-in page (`/sign-in/`) with
  the current address as the return path, so the guest lands back on the same tab after signing in.
- The toast's close button (or Escape with the focus inside it) closes it.
- It does not time out, and it shows even with In-Editor Notifications off, as every standing toast does. Where it
  sits, clear of the tab bar, the bottom-right cluster and the whiteboard dock, is the toast stack's to decide
  ("Placement"), so it never covers a control somebody is running a session with.
- When it stops being wanted while it is up (the guest signs in, the editor closes), it is taken down by
  its key.

The line is the owner's, the same in every editor (2026-11-20), kept short enough to sit on one line beside Sign In
and the close at a toast's usual widest, so every toast keeps one width ([Toasts](../../../../liveworkspace/docs/specs/016-notifications/toasts.md) \"One line by default\").
On a phone it may wrap.

There is no Learn More and no reasons dialog any more: the line says what an account gives, and the guest-vs-account
help article says the rest.

## Dismissal

- Closing the toast records the dismissal in `localStorage` under `livehuddle:signin-banner-dismissed:v1` (the key the
  banner it replaced used, so whoever closed the banner is never shown the toast) via the shared safe-storage
  helpers, synced across tabs through the native `storage` event.
- Dismissal is per-device and permanent for that browser (there's no re-nag timer). Signing in makes it moot;
  signing out later surfaces it again only if it was never dismissed on that device.
- Pressing Sign In does not dismiss it: a guest who comes back without signing in is reminded again in a later
  session.

## Telemetry

Anonymous events only ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), reusing the closed
enums. The toast keeps the banner's editor type, so its series carries on:

- `UI` / `Selected` / `SignInBannerEditor`: Sign In pressed.
- `UI` / `Closed` / `SignInBannerEditor`: the toast closed.

Retired with the banner in November 2026 (the dashboard drops them,
`liveworkspace/apps/site/app/telemetry/_shared/retired-sign-in-banner.ts`): Learn More (`UI` / `Opened` /
`SignInReasonsEditor`, `SignInReasonsExplorer`, and the older `SignInReasons`) and the Explorer's banner (`UI` /
`Selected` | `Closed` / `SignInBannerExplorer`). The dashboard's Sign-In Prompts stack charts the toast's Sign In and close
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

No "shown" event: it would fire for nearly every invested guest session and drown the signal
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) noise rule).

## Non-goals

- No re-engagement timer or "remind me later"; closing is final per device.
- No A/B copy variants or server-driven targeting.
- No sign-in toast in the Explorer or on marketing pages.
