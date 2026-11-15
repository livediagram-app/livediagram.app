# Calendar feed

A **calendar feed** brings a plan's card dates to the calendar people already look at every day (Google Calendar,
Outlook, Apple Calendar): a private `.ics` address, subscribed to once, that the calendar app polls and shows beside
the person's meetings. It is read-only: nothing a calendar app does changes a card.

Built so far: the feed's store, its address (`GET /api/calendar/…`), and Subscribe to Calendar on a plan with its
options, Reset Link and Turn Off. The cross-plan My Work feed (part 3) is next ([Work Tracker 156](#parts)).

## Domain language

| Term              | Meaning                                                                                 | Not                     |
| ----------------- | --------------------------------------------------------------------------------------- | ----------------------- |
| **calendar feed** | One person's subscription to one plan's card dates (or, on My Work, to their own cards) | calendar sync, export   |
| **feed link**     | The feed's private address, the one thing a calendar app is given                       | share link, invite      |
| **feed token**    | The secret in the feed link (`lpf_…`); the whole proof a fetch carries                  | API token, `lwt_` token |
| **feed options**  | What the feed shows: which board, only my cards, include done cards                     | filters, settings       |
| **Reset Link**    | A new feed token for the same feed; the old link stops answering at once                | regenerate, rotate      |

## Who may have one

- **The plan's owner and the members of its team**, signed in with an account. Access is checked on **every fetch**,
  not when the link was made: the person's teams are read from accounts at that moment, and the index is asked for
  their grant on the plan at that moment, neither from a cache. A member removed from the team, an owner who gave
  the plan away, or a plan moved out of the team stops the feed on its next fetch.
- **Nobody through a share link.** A share link is not a person (prototype-scope.md "Access"), so someone who reached
  the plan only through one gets no feed, whatever its role (Editor, Participant or Viewer). The owner's decision on
  the card (2026-11-15, option A).
- **No guest.** A guest's identity lapses with its token and the index never acts for a guest, so a feed needs an
  account.
- **Share roles** ([share-roles.md](../013-workspace/share-roles.md)): the feed reads, so any level the owner or a
  team member holds may have one; it never writes, so no role gains anything through it.

## The feed link

- `https://www.liveplanner.app/api/calendar/<plan id>/lpf_<43 characters>.ics`. The token is 32 random bytes,
  base64url, behind the `lpf_` prefix that says what it is. It is **never** an `lwt_` API token or any token that
  opens the API: a leaked feed link reads one feed and nothing else.
- The plan keeps only the token's SHA-256, never the token; the link is shown once, when made or reset.
- **One feed per person per plan**, tied to that person. Reset Link replaces its token, so the old link answers as
  though it never existed. A feed has no expiry: it ends by Reset Link, by the person turning it off, by their access
  ending (checked on every fetch), by their account closing (its row is dropped with their name, and the access check
  refuses it anyway), or by the plan's purge.

## What it shows

- **Every live card with a date**: not archived, not in the Trash, on any board (or the board the options name).
- Done cards (a [done column](plan-board.md#done-columns)'s status) are left out unless the options include them.
- **Only my cards**: just the cards a notifying Person field of their type names the person in, as the Inbox's
  Assigned to You does ([item-types.md "Notifies"](item-types.md)).
- **Dates**: the built-in Start Date and Due Date, which are days. Each card is one **all-day event**:
  - with a Due and a Start on or before it, from its Start to its Due, both days included;
  - with only a Due (or a Start after its Due), on its Due day;
  - with only a Start, on its Start day, titled `Starts: …`.
  - Timed events come with the Card fields: date and time work; until then a feed is days only.
- **Title**: the card's number and title, `#12 Launch the site` (`Untitled` for none), up to 200 characters.
- **Link back**: each event's URL opens the card in the plan (`/project/<plan id>#item=<card id>`), and its
  description names the board and column it sits in, then the same link.
- The calendar is named after the plan (`Website relaunch · liveplanner`).

## Subscribe to Calendar

Where a person makes, copies, resets and turns off their feed of one plan.

### Where it lives

- **Subscribe to Calendar…** in the **tab menu** (the tab's ⋯ and the canvas's right-click menu, which are one menu),
  under Export: getting the plan's dates out sits beside getting its tab out. It names the whole plan, whichever tab
  the menu opened on.
- Shown only to someone who may have a feed: **signed in**, on a plan **saved to an account**, holding the plan as its
  **owner or a team member** (a grant with no share link and no tab), and not in an embed or a workbench frame.
  Everyone else sees no row: a share-link holder at any level (Editor, Participant, Viewer), a guest, a plan in This
  Browser. The api refuses them all the same, so the row is presentation, never the rule.

### The dialog

A centred dialog (a bottom sheet on a phone) titled **Subscribe to Calendar**, under the dialog hero header, subtitled
"Card dates from this plan in Google Calendar, Outlook or Apple Calendar." It opens on the person's own feed, read
fresh, and has three states:

- **Off** (no feed yet): the options, the privacy note, and **Make Calendar Link**.
- **Just made** (made or reset a moment ago): the link in a read-only field with **Copy Link**, then **Google
  Calendar** and **Apple Calendar**, which hand the link to that calendar's own subscribe page (Google's add-by-address
  page; Apple's through `webcal://`), and a line for the rest: "In Outlook, choose Add Calendar, then Subscribe from
  Web, and paste the link." (Outlook's page differs between personal and work accounts, so it gets words, not a
  button.) Under them: "This is the only time the link is shown. Copy it now: if you lose it, Reset Link makes a new
  one." The link is never read back later: the plan keeps only its hash.
- **On** (a link made earlier, not shown again): "Your calendar link is on. Made <date>." with **Reset Link** and
  **Turn Off**, each behind a confirm that says what it does:
  - Reset Link: "Make a new link? The old one stops working at once, so calendars using it stop updating until you
    add the new one." Then the Just made state, with the same options.
  - Turn Off: "Turn off your calendar link? Calendars using it stop updating." Then the Off state.

While it reads, a quiet loading row; when the read fails, "Couldn't load your calendar link." with **Try Again**.
When a write fails, the dialog stays as it was and says "Couldn't save. Try again."

### The options

The same three in every state, under the heading **What It Shows**:

- **Board**: **All Boards**, or one of the plan's boards by its title (with its tab's name after it when two boards
  share a title, and its tab's name alone for a board with no title). A board that went since shows as **Removed
  Board** until another is picked, and its feed is empty meanwhile.
- **Only My Cards**: just the cards whose notifying Person fields name me.
- **Include Done Cards**: cards in a done column too.

In the Off state they are what Make Calendar Link makes the feed with. Once a feed exists, a change saves at once and
**keeps the link**: the calendar app shows the new set on its next fetch, so nobody re-subscribes to change a filter.

### Keeping it private

Every state carries the privacy note, in the dialog's warning tone: "Anyone with this link can see the titles and
dates of the cards in this feed. Don't share it or post it anywhere. If it leaks, press Reset Link: the old link
stops at once." The help article says the same.

### Managing a feed (signed-in routes)

`/api/projects/:id/calendar-feed`, answered inside the plan's room, for the person's own feed only:

- `GET`: their feed's options and when it was made (never the link), or none, and the plan's boards to pick from.
- `POST`: make the feed with the body's options, or, over an existing one, Reset Link with them; answers the link once.
- `PATCH`: change an existing feed's options, keeping its link; 404 when they have none.
- `DELETE`: Turn Off; answers 204 whether or not there was one.

Each needs a person **signed in, in person**: never an API token (read-only or not) or a workbench session, which
could otherwise mint a lasting secret, and never a guest. And their grant on the plan must be the owner's or a team
member's: a share link at any level, or a grant confined to one tab, is refused with 403 `calendar_feed_needs_member`.
A board option must name one of the plan's boards (400 `calendar_feed_invalid`). Every answer is `no-store`.

### Telemetry

Counts only, never a plan, a board or a link: the dialog opened (UI·Opened·CalendarFeed), a link made
(Plan·Created·CalendarFeed), reset (Plan·Changed·CalendarFeedLink), its options changed
(Plan·Changed·CalendarFeedOptions), copied (Plan·Copied·CalendarFeed), handed to a calendar
(Plan·Shared·CalendarFeedGoogle or CalendarFeedApple) and turned off (Plan·Ended·CalendarFeed).

## How it answers

- **iCalendar** ([RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)): `text/calendar; charset=utf-8`, CRLF lines
  folded at 75 octets, text escaped, one `VEVENT` per card with a stable `UID`, so a calendar app updates an event in
  place when its card changes rather than adding another. `DTSTAMP` is the card's last change, so an unchanged plan
  answers the same bytes.
- **Cacheable**: `Cache-Control: private, max-age=300` (five minutes; the access check is never older than that), an
  `ETag` of the body, and **304 Not Modified** for a fetch whose `If-None-Match` names it. The calendar asks clients to
  come back hourly (`REFRESH-INTERVAL`, `X-PUBLISHED-TTL`).
- **Capped**: at most **500 events**. A plan with more keeps the 500 whose dates are nearest today, so the weeks a
  person is planning are always there.
- **One answer for every refusal**: an unknown or reset token, a person who can no longer read the plan, a plan in the
  Trash, a deleted plan and a malformed link all answer the same `404`, so a link reveals nothing about why. Only
  `GET` and `HEAD` are served (`405` otherwise). A feed fetched more than 300 times a minute answers `429`. When accounts
  or the index cannot be asked, `503` with `Retry-After`, never a feed nobody checked.
- Every answer carries `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`.

## Parts

Work Tracker 156 builds it in three parts, each leaving main working:

1. This spec, the feed's store in the plan's own storage, and the feed link's route.
2. Subscribe to Calendar on a plan: make, copy, reset and turn off a feed, with its options (board, only my cards,
   include done cards), signed in, for the owner and team members only; telemetry and a help article.
3. Subscribe to Calendar on My Work: one feed of the cards assigned to the person across plans, built by adding Due
   and Start to the Inbox push (open cards only), with its own hashed token at liveworkspace.
