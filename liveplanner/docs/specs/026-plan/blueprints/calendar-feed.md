# Calendar feed blueprint

Derived from [calendar-feed.md](../calendar-feed.md). Part 1 of Work Tracker 156: the store, the access check, the
iCalendar writer and the route. Part 2 adds the signed-in routes and the editor's Subscribe to Calendar; part 3 the
My Work feed at liveworkspace.

## Domain and naming

| Spec term     | Identifier                                                         |
| ------------- | ------------------------------------------------------------------ |
| calendar feed | `CalendarFeed` (row type), table `calendar_feeds`                  |
| feed link     | `calendarFeedPath(planId, token)`                                  |
| feed token    | `token`, prefix `FEED_TOKEN_PREFIX` (`lpf_`); its hash `tokenHash` |
| feed options  | `CalendarFeedOptions` `{ boardId, mine, includeDone }`             |
| Reset Link    | `issueCalendarFeed` over an existing row (replaces `token_hash`)   |
| event         | `FeedEvent` (one card, all-day, `startDay`..`endDay` inclusive)    |

## Files

- `apps/api/src/calendar/feed-token.ts`: `FEED_TOKEN_PREFIX`, `FEED_TOKEN_PATTERN`, `newFeedToken()`,
  `feedTokenHash(token)` (SHA-256, lowercase hex).
- `apps/api/src/calendar/feed-store.ts`: `CALENDAR_FEEDS_SCHEMA`, `issueCalendarFeed`, `revokeCalendarFeed`,
  `calendarFeedOf(env, planId, tokenHash)`.
- `apps/api/src/calendar/feed-events.ts`: `feedEventsOf(env, planId, feed, now)`: the plan's name and its capped
  events, read from the plan's own tables. `FEED_EVENTS_MAX`.
- `apps/api/src/calendar/ics.ts`: pure `writeCalendar(calendar)`, `escapeText`, `foldLine`.
- `apps/api/src/calendar/feed-access.ts`: `calendarFeedAccess(env, planId, personId)`.
- `apps/api/src/routes/calendar-feed-route.ts`: `handleCalendarFeed(request, env)`, dispatched in `index.ts` before
  identity (`segments[1] === 'calendar'`).
- `apps/api/src/calendar/feed-room.ts`: `answerFeedCall(env, planId, call)`, the room's one RPC for a fetch,
  `calendarFeed(planId, { kind: 'feed', tokenHash } | { kind: 'events', feed, now })` (`plan-room.ts`), which the
  worker's client names as `calendarFeed(tokenHash)` and `calendarFeedEvents(feed, now)` (`plan-client.ts`). An id
  nothing has written answers null without making a schema (`plan-room-content.ts` `bindStoredPlan`, which the other
  token doors share).
- `plan-schema.ts`: one step, V30, `CALENDAR_FEEDS_SCHEMA`. `plan-anonymise.ts`: a closed account's feed rows go.

## Data and persistence

```sql
CREATE TABLE IF NOT EXISTS calendar_feeds (
  plan_id      TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  person_id    TEXT    NOT NULL,          -- user_…, the account the feed is tied to
  token_hash   TEXT    NOT NULL,          -- SHA-256 hex of the feed token; the token is never stored
  board_id     TEXT,                      -- a plan-board element id, or NULL for every board
  mine         INTEGER NOT NULL DEFAULT 0,
  include_done INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,          -- epoch ms of the token (a reset renews it)
  PRIMARY KEY (plan_id, person_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS calendar_feeds_token ON calendar_feeds (token_hash);
```

- Classification: `token_hash` secret-derived (never logged, never returned), `person_id` personal (dropped by
  anonymise), the rest configuration. Not copied with the plan (a copy is someone else's plan), not in exports, not in
  the Drive file. Purge drops it with the plan's storage.
- A new plan schema step, append-only like every other; nothing applied remotely by hand (a room migrates itself on
  first use, as every step does).

## Behaviour and state

- `issueCalendarFeed(env, planId, personId, options, now)`: a fresh token, upserted on `(plan_id, person_id)`;
  returns the token once. Called over an existing row it is Reset Link: the old hash is gone in the same statement.
- `revokeCalendarFeed(env, planId, personId)`: deletes the row; answers whether one went.
- `calendarFeedOf(env, planId, tokenHash)`: the row for that hash, or null.
- Route, in order (each refusal a named reason in the log):
  1. Path `^/api/calendar/([A-Za-z0-9_-]{1,200})/(lpf_[A-Za-z0-9_-]{43})\.ics$`, else 404 `malformed`.
  2. Method `GET` or `HEAD`, else 405.
  3. `tokenHash = feedTokenHash(token)`; rate limit key `feed:<tokenHash first 32>`, over: 429 `Retry-After: 60`.
  4. Room `calendarFeed(tokenHash)`: null: 404 `unknown_token`.
  5. `calendarFeedAccess`: `refused`: 404 `no_access`; `unavailable`: 503 `Retry-After: 300`.
  6. Room `calendarFeedEvents(feed, now)`: null (no plan row): 404 `no_plan`.
  7. Write the body, `ETag: "<first 32 hex of SHA-256(body)>"`; `If-None-Match` naming it (or `*`, weak or strong
     form): 304 with the ETag and cache headers, no body; else 200 (HEAD: no body).
- Access (`calendarFeedAccess`): `person_id` must be an account (`isAccountId`), else `refused`. Teams from accounts
  now (`readAccountTeams`, uncached); the grant from the index now (`indexFor(env, delegate).grant(planId, null)`,
  never `requestGrant`, whose cache could outlive a removal). Refused when the grant is for a trashed plan or one tab;
  an `IndexError` under 500 is `refused`; no credentials, no index, a throw or a 5xx is `unavailable`.

## Events

- Cards: `listItems`, skipping `archived` true, status `trash`, done statuses (`cardPlacesOf(...).isDone`) unless
  `include_done`, cards whose board (`boardFor(status).elementId`) is not `board_id` when it is set, and, with
  `mine`, cards where no `notifiedPeople` entry is `await itemPersonId(person_id)`.
- Days: `dayNumber(fields.start)`, `dayNumber(fields.due)` (only `YYYY-MM-DD` values count; a timed value is skipped
  until timed events exist). Both, start ≤ due: start..due. Due only, or start > due: due..due. Start only:
  start..start with `Starts: ` before the title.
- Cap: when more than `FEED_EVENTS_MAX` (500), keep those with the least `distance(today)` (0 when today is inside
  the span, else days to the nearer end), ties by card number; then sort by start day, then card number.
  `today` is `floor(now / DAY_MS)` (UTC).
- Each `FeedEvent`: `uid` `<card id>.<plan id>@liveplanner.app`, `summary` `#<key> <title or Untitled>` cut to
  `FEED_SUMMARY_MAX` (200) characters, `url` `<APP_BASE_URL>/project/<plan id>#item=<card id>`, `description`
  `<board title> · <column name>` (whichever exist) then the url, `stamp` card `updatedAt`, `sequence` card `rev`.

## Interfaces and contracts

- `writeCalendar({ name, events })` lines: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//liveplanner//Calendar
Feed//EN`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:<name> · liveplanner`,
  `REFRESH-INTERVAL;VALUE=DURATION:PT1H`, `X-PUBLISHED-TTL:PT1H`, then per event `BEGIN:VEVENT`, `UID`,
  `DTSTAMP:<yyyymmddThhmmssZ>`, `DTSTART;VALUE=DATE:<yyyymmdd>`, `DTEND;VALUE=DATE:<end + 1 day>`, `SUMMARY`, `URL`,
  `DESCRIPTION`, `SEQUENCE`, `TRANSP:TRANSPARENT`, `END:VEVENT`, and `END:VCALENDAR`. CRLF after every line.
- `escapeText`: `\` → `\\`, `;` → `\;`, `,` → `\,`, newline (CRLF, CR, LF) → `\n`, other C0 controls and DEL dropped.
  `URL` is a URI value, not escaped.
- `foldLine`: at most 75 octets a line, continuation lines start with one space, never splitting a UTF-8 character.
- Headers on 200 and 304: `Content-Type: text/calendar; charset=utf-8` (200), `Cache-Control: private, max-age=300`,
  `ETag`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Content-Disposition: inline; filename="plan.ics"`.
  Refusals: JSON `{ error: 'feed_not_found' }` (every 404 alike), `Cache-Control: no-store`.

## Errors and edge cases

- An id nothing has written: the room answers null without making a schema (as `emailOptOut`).
- A deleted plan (purged): its storage is gone, so the token is unknown: 404. In the Trash: the grant says trashed: 404.
- A team member removed: accounts no longer lists the team, the index refuses: 404 on the next fetch.
- A closed account: anonymise drops the row; a fetch before that is refused by the index.
- A plan with no board: no done statuses, no board names; cards still listed, description is the url alone.
- A board option naming a board that went: no card matches, the feed is empty (a valid calendar).

## Security and trust

- The token is the only proof; 256 bits from `crypto.getRandomValues`, compared by its hash in an indexed lookup, so
  nothing is compared character by character and a guess costs one indexed miss.
- The route never takes an `Authorization` header, never sets cookies, and the token is never logged (the log names
  the reason and counts only).
- Access is the index's and accounts', asked fresh each fetch; the feed answers nothing it did not just check.
- Rate limit per feed (D114). An attacker guessing tokens wakes rooms, as any token door does; the plan id must also
  be known.

## Performance and limits

- Per fetch: one rate-limit call, two room RPCs (one indexed lookup; one read of the plan's items, board tabs and
  types), one accounts call, one index call. Items are read whole, as the Inbox push reads them (`cardsPushOf`), so the
  cost is the push's, at most the plan's item cap; writing 500 events is linear in the events.
- Body at the cap: about 500 × 600 bytes, 300 KB at most.
- Calendar apps poll every few hours (Google about every 8 to 24, Outlook about 3); `private, max-age=300` and 304s
  keep repeats cheap. The ETag stays put while no card changes (`DTSTAMP` is the card's, not the fetch's).

## Observability

- `[calendar-feed] refused { reason }` for each refusal (`malformed`, `method`, `rate_limited`, `unknown_token`,
  `no_access`, `unavailable`, `no_plan`), `[calendar-feed] served { events, truncated, notModified }` for each answer.

## Constants and configuration

| Constant              | Value                   | Why                                                     |
| --------------------- | ----------------------- | ------------------------------------------------------- |
| `FEED_TOKEN_PREFIX`   | `lpf_`                  | Says what the secret is; never `lwt_`                   |
| `FEED_TOKEN_BYTES`    | 32                      | 256 bits, base64url 43 characters                       |
| `FEED_EVENTS_MAX`     | 500                     | Several months of a busy plan; bounds the body and CPU  |
| `FEED_SUMMARY_MAX`    | 200                     | Calendar apps cut long titles anyway                    |
| `FEED_MAX_AGE_S`      | 300                     | The access check is never older than five minutes       |
| `UNAVAILABLE_RETRY_S` | 300                     | Retry-After when accounts or the index cannot say       |
| WRITE_RATE_LIMITER    | 300 a minute (wrangler) | The binding's own window, keyed `feed:`; no new binding |

## Testing

- `calendar/ics.test.ts`: escaping, folding (ASCII and multi-byte at the boundary), all-day DTEND, line endings.
- `calendar/feed-token.test.ts`: shape and hash.
- `calendar/feed-events.test.ts`: spans, start-only, archived/trash/done, board and mine options, the cap keeping the
  nearest, the description and url.
- `calendar/feed-access.test.ts`: owner, team member, removed member, share-link-only person, guest, trashed plan,
  index and accounts unavailable.
- `routes/calendar-feed-route.test.ts`: 200 calendar, HEAD, 304 by ETag, a reset token, a revoked feed, a removed
  member, a deleted plan, a trashed plan, malformed paths, 405, 429, 503.
- `plan-anonymise.test.ts`: a closed account's feed row goes.
