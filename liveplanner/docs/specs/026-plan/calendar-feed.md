# Calendar feed

A **calendar feed** brings a plan's card dates to the calendar people already look at every day (Google Calendar,
Outlook, Apple Calendar): a private `.ics` address, subscribed to once, that the calendar app polls and shows beside
the person's meetings. It is read-only: nothing a calendar app does changes a card.

Built so far: the feed's store and its address (`GET /api/calendar/…`). Subscribe to Calendar on a plan, its options
and Reset Link (part 2), and the cross-plan My Work feed (part 3) are next ([Work Tracker 156](#parts)).

## Domain language

| Term              | Meaning                                                                                     | Not                       |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| **calendar feed** | One person's subscription to one plan's card dates (or, on My Work, to their own cards)     | calendar sync, export     |
| **feed link**     | The feed's private address, the one thing a calendar app is given                           | share link, invite        |
| **feed token**    | The secret in the feed link (`lpf_…`); the whole proof a fetch carries                      | API token, `lwt_` token   |
| **feed options**  | What the feed shows: which board, only my cards, include done cards                         | filters, settings         |
| **Reset Link**    | A new feed token for the same feed; the old link stops answering at once                    | regenerate, rotate        |

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
