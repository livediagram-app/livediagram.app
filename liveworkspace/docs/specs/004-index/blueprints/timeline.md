# The Timeline: blueprint

Derived from [one-explorer-contracts.md "Timeline"](../one-explorer-contracts.md#timeline). The spec decides; this
file only adds engineering precision, read from the code. Defaults are cited as `IDXn`. Paths are relative to the
repository root.

Scope, by file:

| File                                           | Role                                                                                                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/timeline.ts`     | `eventStatements`, `moveScopeStatements`, `bulkEventStatements`, `buildTimelineQuery`, `listTimeline`, `timelineNewQuery`, `handleTimeline`, `pushAppEvents`, `pushPersonEvents`, `handleAccountTimeline` |
| `liveworkspace/apps/index/src/collab-push.ts`  | `collabEvents`, `retractedComments`: collaboration events from a tab's push                                                                                                                               |
| `liveworkspace/apps/index/src/visitors.ts`     | Opened and Copied by a Visitor                                                                                                                                                                            |
| `liveworkspace/apps/index/src/share-expiry.ts` | Share Link Expiring ([sharing.md](sharing.md))                                                                                                                                                            |
| `packages/api-kit/src/d1-compound.ts`          | `unionAll` within D1's compound-select limit (5), shared with the Durable Objects                                                                                                                         |
| `liveworkspace/apps/index/src/fresh-teams.ts`  | `inTeamNow`: a Team Activity read checked against accounts                                                                                                                                                |
| `packages/index-app/src/person-events.ts`      | An app's `image_uploaded` report                                                                                                                                                                          |

## Domain and naming

| Type                                               | Source                              | Id                                               | Seen by                               |
| -------------------------------------------------- | ----------------------------------- | ------------------------------------------------ | ------------------------------------- |
| `created`, `synced`                                | `insertItem`                        | a UUID                                           | the item's scope                      |
| `renamed { from }`, `moved { folderName, teamId }` | `PATCH /items/:id`                  | a UUID                                           | the item's scope                      |
| `trashed`, `restored`                              | delete, restore                     | a UUID                                           | the item's scope                      |
| `shared { level }`, `unshared`                     | link routes                         | a UUID                                           | the item's scope                      |
| `favourited`                                       | `PUT /favourites/:id`               | a UUID                                           | the person only                       |
| `taken_offline`                                    | `DELETE ?reason=offline`            | `off:<item>:<now>`, no item                      | the person only                       |
| `edited`                                           | `PUT /app/items/:id/events`         | `ed:<item>:<person>:<day>`                       | the item's scope                      |
| `image_uploaded { count }`                         | `PUT /app/people/events`            | `im:<app>:<person>:<day>`, no item               | the person only                       |
| `commented { reply? }`                             | collab push                         | `cm:<item>:<tab>:<element>:<count>`              | the item's scope                      |
| `comment_resolved`                                 | collab push                         | `cr:<item>:<tab>:<element>:<count>`              | the item's scope                      |
| `action_assigned`                                  | collab push                         | `aa:<item>:<tab>:<element>:<action>:<assignee>`  | the item's scope and the assignee     |
| `action_done`                                      | collab push                         | `ad:<item>:<tab>:<element>:<action>:<updatedAt>` | the item's scope                      |
| `opened_by_visitor`                                | a grant through a link              | `vo:<item>:<visitor>:<day>`                      | the owner only                        |
| `copied_by_visitor`                                | a copy through a link               | `vc:<item>:<visitor>`                            | the owner only                        |
| `share_link_expiring`                              | link changes, daily pass            | `sx:<item>`                                      | the owner only                        |
| `team_*`, `token_*`                                | accounts, `POST /internal/timeline` | accounts' own                                    | the scopes named; app `liveworkspace` |

`<day>` is the UTC day number (`ms / 86,400,000`). A visitor with no identity is `link:<code>`.

## Behaviour and state

### Recording

- `eventStatements` (in the batch of the change): `INSERT … SELECT … FROM items WHERE id = ?` (so the app, title and
  scope come from the row, and an optional `when` clause gates it), `ON CONFLICT (id) DO UPDATE` for events that
  extend themselves (time, actor name, detail move on); one `INSERT OR IGNORE` scope row (`COALESCE(scope, i.scope)`);
  and for a self-extending event, its scope rows' times updated.
- `moveScopeStatements`: an item changing scope takes its events' scope rows with it, favourites excepted.
- `bulkEventStatements`: any number of events in three statements through `json_each` (events, scope rows, times);
  the same id again moves its time and takes the newest title and detail.
- A push from further ahead than 5 minutes is dated now (`FUTURE_SLACK_MS`).

### Reports from apps and accounts

| Route                       | Caller                 | Body                                                                                              | Effect                                                                                                                                                                                        |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /app/items/:id/events` | its app                | `{ events: [{ type: 'edited', actorId, actorName?, at }] }` (≤ 100)                               | one event per person and day, the latest time kept; each also a use day (Most Used); `204`; `400 invalid_events`                                                                              |
| `PUT /app/people/events`    | an app                 | `{ events: [{ type: 'image_uploaded', actorId, at, count? }] }` (≤ 100, count ≤ 1000)             | the day's count grows; the person's scope only                                                                                                                                                |
| `POST /internal/timeline`   | accounts (`MERGE_KEY`) | `{ events: [{ id (≤ 300), type, actorId?, actorName?, title, at, detail?, scopes }] }` (1 to 100) | three statements; resent ids change nothing new. `scopes` 1 to 250 of `^[pt]:.+$`; detail ≤ 12 string keys, values cut to 500; title cut to 200; actor name to 200; `at` at most now + 8 days |

### Collaboration events (`collabEvents`, at most 100 a push, newest)

Compared with what the tab held, in the batch that replaces it: more comments is `commented` (detail carries the
words, `reply` past the first); turned resolved is `comment_resolved`; an open action with a new assignee is
`action_assigned` (detail `{ action, assigneeId, assigneeName }`); turned done is `action_done`. Anything dated before
the item was made is not news. `retractedComments`: a thread with fewer comments drops its `commented` events past
the count; a thread gone drops them and its `comment_resolved` too; a push at the 500-thread cap is never read as
deletions.

### Reading (`GET /timeline?app=&item=&team=&limit=&cursor=`)

`limit` default 30, at most 100 (`400 invalid_query`); a bad cursor is `400 invalid_cursor`. One statement: for each of
the person's scopes (their own and each team's), one
index range of `limit + 1` rows on `timeline_scopes_app` (filtered: plus a second range for `liveworkspace`'s events,
which every app's view shows) or `timeline_scopes_all`, joined through `unionAll`; then the newest `limit + 1`,
joined to events and items, leaving out dismissed ones. `item=` reads one item's history through
`timeline_events_item`. `team=` is one team's Team Activity: an id (`400 invalid_query`), never with `item`
(`400 invalid_query`), the person in the team now by `inTeamNow` against accounts (`403 not_team_member`, so a member
who just left is refused at once, and one who just joined sees it); it reads the team's scope `t:<team>` alone, one
range (two with an app), events from before the person joined included. Answer: `{ events: TimelineEvent[],
nextCursor, seenAt }`.

| Route                    | Effect                                                                    |
| ------------------------ | ------------------------------------------------------------------------- |
| `POST /timeline/seen`    | `last_seen_at = MAX(old, now)`; `{ seenAt }`                              |
| `POST /timeline/dismiss` | `{ ids }` 1 to 100 strings ≤ 300; only events that exist are added; `204` |

The new count (`timelineNewQuery`, also in the Inbox): events by someone else since `last_seen_at`, not dismissed,
counted to 100 (shown as `99+`); never looked is 0.

## Data and persistence

| Table                   | Key                     | Indexes                                                                                                                                                      | Written by                     | Read by          |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---------------- |
| `timeline_events`       | `id`                    | `timeline_events_item (item_id, occurred_at DESC)`; `timeline_events_actor (actor_id)`                                                                       | every recorder; merge; purge   | pages, history   |
| `timeline_event_scopes` | `(scope, event_id)`     | `timeline_scopes_app (scope, app, occurred_at DESC, event_id DESC)`; `timeline_scopes_all (scope, occurred_at DESC, event_id DESC)`; `timeline_scopes_event` | recorders; moves; merge; purge | pages, new count |
| `timeline_scope_state`  | `person_id`             |                                                                                                                                                              | `seen`; merge                  | pages, new count |
| `timeline_dismissals`   | `(person_id, event_id)` | `timeline_dismissals_event`                                                                                                                                  | `dismiss`; merge               | pages, new count |

`item_id` cascades from `items`; scope rows and dismissals cascade from events. `actor_id` becomes `deleted` when an
account closes. Events about no item that no scope sees any more are swept daily (≤ 1000, [trash.md](trash.md)).

## Testing

| Test                                                    | Pins                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/timeline.test.ts` (25)    | what the index records; Remove from Timeline and the new count; a person in many teams; who sees what; what apps report; collaboration from the collab push; events about no item; the bound; one item's history; a team's activity (members only, newcomers included, one index range) |
| `liveworkspace/apps/index/src/visitors.test.ts` (2)     | visitors on the Timeline                                                                                                                                                                                                                                                                |
| `liveworkspace/apps/index/src/share-expiry.test.ts` (7) | share link expiring                                                                                                                                                                                                                                                                     |
| `packages/index-app/src/person-events.test.ts`          | the images report                                                                                                                                                                                                                                                                       |

## Constants and configuration

`TIMELINE_PAGE` 30, `TIMELINE_LIMIT_MAX` 100, `TIMELINE_DISMISS_MAX` 100, `TIMELINE_NEW_CAP` 99, `APP_EVENTS_MAX`
100, `COLLAB_EVENTS_MAX` 100, `ACCOUNT_EVENT_SCOPES_MAX` 250, `ACCOUNT_EVENT_AHEAD_MS` 8 d, `TIMELINE_PLATFORM`
`'liveworkspace'` (`packages/index-client`); `FUTURE_SLACK_MS` 5 min, `ACTOR_NAME_MAX` 200, `COUNT_MAX` 1000,
`EVENT_ID_MAX` 300, `TITLE_MAX` 200, `DETAIL_KEYS_MAX` 12, `DETAIL_VALUE_MAX` 500 (`timeline.ts`); `D1_COMPOUND_MAX`
5 (`packages/api-kit/src/d1-compound.ts`).

## Defaults ledger

- `IDX9`: an event from a clock more than 5 minutes fast is dated now, so it can't pin itself to the top.
- `IDX10`: an empty item tidied away (`reason=empty`) records no `trashed` event.
