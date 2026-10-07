# Load recovery

Status: accepted

## Problem

A person opening a document can sit on the opening screen ("Opening your
document", [New document route](new-document-route.md) "The opening screen")
forever while a colleague opens the same document fine. Nothing in the load
ever gave up: no step had a time limit, and a step that threw outside the
handled branches left the screen up with no error. The only way out was the
Refresh button, which re-runs the same load against the same browser state.
Support had nothing to go on either: the person could only say "it spins".

Three per-browser causes survive a refresh:

- **IndexedDB never answers.** Every load first asks the offline store whether
  the id is an Offline Mode document ([Offline mode](../006-document/offline-mode.md)), and a browser
  whose IndexedDB `open` never settles held that question open forever.
- **A sign-in session that never hands out a token.** A signed-in load awaits
  the session token on every request, with no limit.
- **An exception in the load**, such as an out-of-date browser missing a
  platform API, which left the screen up instead of showing an error.

## The load always ends

The editor's load (the identity bootstrap) ends in exactly one of: the
editor, Not found, the password gate, the deleted card, or the load-error
screen. It never stays on the opening screen indefinitely.

- **A watchdog.** If the load has not ended **30 seconds** after it started,
  it times out and shows the load-error screen, with the recovery card below.
- **A guarded load.** Anything the load throws shows the load-error screen
  rather than leaving the opening screen up.
- **A late load still wins.** A load that finishes after its watchdog fired
  replaces the load-error screen with the editor, so a slow connection is never
  stuck behind an error it outlived.
- **The offline-store check gives up.** Opening the offline store waits at
  most **4 seconds**. A store that does not open in time (or reports
  `blocked`) counts as having no offline documents, for the rest of that page
  load, so the cloud load continues. An offline document in that browser
  cannot open until its IndexedDB recovers, which was already true.
- **The session token gives up.** Asking the sign-in session for a token waits
  at most **10 seconds** per attempt. A signed-in load with no token fails
  with the existing "no session token" error, which shows the load-error
  screen.

## Self-healing on the opening screen

The opening screen escalates on its own:

1. **10 seconds:** "This is taking longer than usual." with a Refresh button
   (unchanged).
2. **30 seconds (the watchdog):** the first time in a tab, the page reloads
   itself once, showing "Still working on it. Trying a fresh start." for a
   moment first. That claim is remembered per page in the tab's
   `sessionStorage` for 10 minutes, so a reload that does not help is not
   repeated in a loop.
3. **After that:** the load-error screen with the recovery card.

## The recovery card

The load-error screen ("Couldn't load document") carries, beneath its Retry
button, a recovery card. It shows for every load error, timed out or not:

- **Copy Diagnostics** copies a plain-text report (below) for the person to
  paste to support. The button confirms with "Copied".
- **Repair This Browser** clears this browser's saved livediagram settings and
  caches (below) and reloads. It asks first, inline under the button: "This
  clears livediagram's saved settings and caches in this browser." and what is
  kept, with **Repair and Reload** and **Cancel**. Inline rather than a modal,
  so the same component serves the editor and the help page.
- **Troubleshooting steps** links to the "A Document Will Not Load" help
  article.
- When copying is refused (no clipboard permission), the report shows in a
  read-only text box to copy by hand.

The card shows under "Still not loading?" in the full app only; an embed's
load-error card keeps just Retry. The load-error message reads "We couldn't
load this document: it didn't finish loading. Check your connection and try
again.", since a timed-out load is not always the server's silence.

## Diagnostics

A plain-text report, built when the button is pressed (never on page load),
holding identifiers and states only, never document content:

- the time (ISO) and the page path, with the share code replaced by
  "share link: yes" (a share code is a credential);
- the editor build id;
- the identity, the same lines on every surface:
  - **Signed in:** yes or no. The editor adds the account id it resolved. The
    help page, which has no sign-in provider loaded, reads the provider's
    `__client_uat` cookie (`0` signed out, a timestamp signed in), which says
    whether but not who; with no such cookie it reports "unknown".
  - **Guest id in this browser:** only its first 8 characters (a full guest id
    is an `X-Owner-Id` credential) and whether it is signed, or "none".
  - **Identity upgrade pending:** yes or no.
  - When signed in with a guest id still present: "Guest documents moved to
    the account: NOT YET". Signing in moves a guest's documents and then
    clears the guest id, so one still there means the move has not happened,
    the usual cause of "my documents went missing after I signed in";
- the load: the step it reached (`identity`, `participant`, `document`,
  `share`, `first-tab`, `done`), how long it has run, and whether it timed out;
- the browser: the user agent, online state, and the results of the browser
  checks (below).

**Browser checks**, shared with the help centre's Repair page: local storage
and session storage writable, cookies enabled, IndexedDB opens within the
offline-store limit, and `crypto.randomUUID` present (missing means an
out-of-date browser).

## Repairing a browser

Repair clears what is safe to lose and keeps what would lose work or identity.

**Cleared:** every `localStorage` and `sessionStorage` key starting with
`livediagram:` or `livediagram-` that is not kept below. This covers editor
preferences, panel layout, dismissed banners and tours, the recent-documents
cache, cached share passwords, and the stale-build reload guards.

**Kept, always:**

- the guest identity: `self-id`, `self-sig`, `pending-signed-id`,
  `name-confirmed` (all under `livediagram:v2:`). Losing the guest id loses
  every document a guest owns;
- `collab-key` and `community-key`, the per-browser keys that past answers and
  likes are matched against;
- Google Drive mirror state (`livediagram:v2:drive-*`,
  `livediagram:drive-mirror*`);
- the offline store (IndexedDB `livediagram-offline`): Offline Mode documents
  exist nowhere else;
- cookies and the sign-in provider's own storage: repair never signs anyone
  out.

The kept list lives in one shared module, so the editor's Repair button and the
help centre's Repair page clear exactly the same set, and a test fails if a
guest-identity key is not on it.

There is no "wipe everything" button. A full wipe destroys a guest's documents
and Offline Mode documents, and the problems a wipe would fix are covered by
the repair plus signing out.

## Repair page in the help centre

A help article, **Repair This Browser** (`/help/troubleshooting/repair-this-browser/`),
runs the same repair from the help centre ([Help app](../018-help/help-app.md)).
It lives there, not only in the editor, because every app shares one origin:
the help page can repair the editor's storage even when the editor itself
cannot start. The page lists what is cleared and kept, runs the browser checks
and the identity lines on open and shows both, and offers Copy Diagnostics
(identity and browser checks, as it has no load) and Repair This Browser. After a repair it says "Done. Open your document
again." with a link to the Explorer. The "A Document Will Not Load" article
gains two sections: "Stuck on "Opening your document"" (the escalation above)
and "It opens for a colleague but not for you" (account first, then the share
link, the repair, another browser or network).

## Telemetry

([Telemetry](../017-telemetry/telemetry.md))

- `Error·Warning·DocumentLoad.Slow`: the 10-second message showed.
- `Error·Warning·DocumentLoad.TimedOut.<Step>`: the watchdog fired, with the
  step the load reached (`Identity`, `Participant`, `Document`, `Share`,
  `FirstTab`).
- `Error·Warning·DocumentLoad.AutoReload`: the self-healing reload ran.
- `Error·Warning·DocumentLoad.Late`: a load finished after its watchdog.
- `Error·Client·DocumentLoad.<ErrorName>`: the load threw.
- `Error·Warning·OfflineStore.Unavailable`: the offline store did not open in
  time.
- `Error·Warning·SessionToken.TimedOut`: a token request gave up.
- `UI·Copied·Diagnostics` and `UI·Cleared·BrowserRepair`, typed by surface
  where it matters (`Diagnostics` from the editor, `Diagnostics.Help` from the
  help page; `BrowserRepair` and `BrowserRepair.Help`). A repair fires before
  it clears anything.

## Offline

"Offline" is the browser's own answer (`navigator.onLine` false, and the
`offline` / `online` events). It is trusted only in that direction: a browser
that says offline is offline, while one that says online may still not reach
the server, which the rest of this spec covers.

- **Opening screen.** While offline it says "You're offline. Waiting for the
  connection…" in place of the 10-second message, with no Refresh (reloading
  offline only swaps in the browser's own error page).
- **No self-healing reload offline.** A watchdog that fires while offline goes
  straight to the load-error screen; reloading cannot help until the
  connection is back.
- **Load-error screen.** While offline its card reads eyebrow "Offline", title
  "You're offline", message "This document will open as soon as you
  reconnect." The recovery card stays below it. When the connection comes back
  the page reloads on its own, once; a card shown while online never reloads
  itself.
- **In the editor.** While offline a banner sits at the top of the canvas
  stack: "You're offline. Changes stay in this tab and save when you
  reconnect." for someone who can edit, "You're offline. You'll see changes
  when you reconnect." for a viewer. Changes are held in memory only, so the
  banner says "in this tab": closing it while offline loses them. The save
  failure toast reads "You're offline. Your changes will save when you
  reconnect. Keep this tab open." instead of the connection message.
- **A document that did not load is never written.** The load-error and Not
  found paths still hand the editor the document id, and its empty default tab
  used to look like an unsaved change: on reconnect it was saved into the real
  document as a second "Tab 1". The autosave treats both states as read-only.
- **Reconnecting saves at once.** A failed save waiting on its retry timer (5 s
  to 60 s) is retried as soon as the browser comes back online.
- **A code chunk that fails to load while offline is not a stale build.** The
  stale-build safety net ([Stale builds](../016-platform/stale-builds.md))
  stands down offline instead of reloading into the browser's error page and
  spending its one reload; the same failure reported once back online still
  recovers. The load-error card ships in the editor's bundle for the same
  reason, lazy-loading only its recovery tools, which show online only.
- No telemetry: events cannot leave while offline, and the reload on reconnect
  drops anything buffered.

## Out of scope

- A request id on API responses for matching a report to a log line.
- A service worker or any offline copy of the editor itself: without a
  connection the editor still cannot start.
- Timeouts on every API request. The watchdog bounds the load; requests after
  it are already reported when they fail.
