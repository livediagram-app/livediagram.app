# The team audit log

What a team's admins can look back on: who joined, left or changed role, who shared a team document publicly or
made or revoked its share links, which documents came into the team, left it or were deleted, and who added or
removed webhooks on the team's documents (Work Tracker #160). It answers "who shared this?", "who joined?" and "who made that
webhook?" for a team that relies on the product.

It is the index's: one log for every app (platform first, [platform.md](../001-platform-scope/platform.md)), next to
the Timeline it is written with. The Timeline ([one-explorer-contracts.md "Timeline"](one-explorer-contracts.md#timeline))
is what every member sees, and its rows go when nobody sees them any more; the audit log is a separate, append-only
record kept for a year, so it can't be cut short by a Timeline sweep, a moved item taking its events with it, or a
purge.

## What it records

Team-level events only, never what happens inside a document: an edit, a comment or a card moved is the Timeline's
and the app's (liveplanner's no-activity-log rule for content stands). A row records names and ids, never content.

| Kind                  | When                                                                                                              | From      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| `team_invite_sent`    | An admin invites an address                                                                                       | accounts  |
| `team_joined`         | An invitation is accepted, or someone joins by the link                                                           | accounts  |
| `team_declined`       | An invitation is turned down                                                                                      | accounts  |
| `team_role_changed`   | A member is made an admin, or an admin a member                                                                   | accounts  |
| `team_member_removed` | An admin removes a member, or a member leaves (`left`)                                                            | accounts  |
| `team_renamed`        | The team's name changes                                                                                           | accounts  |
| `shared`              | A share link is made on a team document (`level`; `public` for a Community post's)                                | the index |
| `unshared`            | A team document's share link is deleted, or all of them                                                           | the index |
| `moved`               | A document moves into the team, out of it, or between teams (`fromTeamId`, `teamId`)                              | the index |
| `trashed`             | A team document goes to the team Trash (a teammate's Take Offline included)                                       | the index |
| `restored`            | A team document comes back from the Trash                                                                         | the index |
| `deleted`             | A team document is deleted for good: Delete Forever, Empty Trash, or its owner's Take Offline (`reason: offline`) | the index |
| `webhook_added`       | Someone adds a webhook to a team document (`kind`, `host`)                                                        | the index |
| `webhook_removed`     | Someone deletes a webhook from a team document (`kind`, `host`)                                                   | the index |

Left out, as decided on the card: API tokens and OAuth apps belong to an account, not a team, so their events stay on
their owner's Timeline alone (team-scoped tokens are a separate idea). Also left out: `team_deleted` (the team is gone,
so nobody can read its log), a move between folders of the same team, a share link's level or tab changed or extended,
a withdrawn invitation (none of these is on the Timeline either), and the Trash's own 30-day purge (no person did it;
the `trashed` row already says who sent it there).

Each row: the team, its kind, the app (the document's; `liveworkspace` for a team's own and a webhook's), who did it
(their id, and the name accounts sent for a team event), whom a team event is about (`personId`), the document's id
and its name then, the event's detail, and when. A row of a document that is later deleted keeps its id and name.

## How it is written

- In the same D1 batch as the change and its Timeline event, so a change is never logged without happening, nor
  happens without being logged. A row is copied from the Timeline event the batch writes (its id, kind, app, actor,
  title, detail and time), so the two never disagree; webhooks and Delete Forever, which have no Timeline event, write
  theirs beside the webhook's or the item's own statements.
- A document event is logged for the team the document is in. A `moved` is logged for the team it left and the team it
  went to (both, when it moves between teams), and not at all when no team is involved.
- A team event from accounts (`POST /internal/timeline`) is logged for each `t:<team>` scope it names.
- Append-only: a row is never updated by a later event. A Timeline event sent again (accounts resends until the index
  takes it), or one that moves its time on, adds nothing: a row is one per team and event id.
- One statement per event or per batch of events, whatever the count, with an indexed lookup, so logging never slows
  the action being logged.

## How long it is kept

A year (`TEAM_AUDIT_RETENTION_MS`, 365 days) from when it happened, then deleted by the index's daily run, at most
5,000 rows a day, the oldest first.

## Privacy

- Closing an account anonymises its rows as it does the Timeline's ([one-explorer-contracts.md "Closing an account"](one-explorer-contracts.md#closing-an-account)):
  where they acted, the actor becomes `deleted` with no name; where a team event is about them, the person becomes
  `deleted` and their name or address goes from the detail. A team that closed with the account (one they ran alone)
  loses its whole log.
- A deleted team's rows are not readable by anyone (it has no admins) and go with the year like every row.
- Guests can't be team members, so no row names a guest; a guest merge has nothing to rewrite here.

## Who reads it

A team's admins only, checked against accounts on each read; a member, someone outside the
team, a guest, an app or the Drive mirror acting for someone is refused (`403 not_team_admin`), and when accounts
can't say who runs the team the read is refused too (`503 team_audit_unavailable`), never answered from a token's
hour-old claim. Members keep the Timeline's Team Activity, which is unchanged.

`GET /team-audit?team=<id>` answers the team's log, newest first, a page at a time:

- **Filters**, each optional and combinable: `person` (who did it), `kind` (one of the kinds above), `from` and `to`
  (milliseconds; `from` inclusive, `to` exclusive).
- **Pages**: `limit` rows (50 by default, at most 100) and `nextCursor` for the next page, or null at the end.
- **Each row**: its id, kind and app; who did it (`actor`: their id and name) and whom a team event is about
  (`subject`); the document's id and its name then; the event's detail; and when.
- **Names come from accounts** on each read, as the person is named now, members who have left included (they still
  have an account). A name accounts doesn't know falls back to the one accounts sent with the event; a closed
  account's rows read `deleted` with no name, as everywhere else.

`GET /team-audit?team=<id>&format=csv` is the same read as a CSV file (the same filters), for a spreadsheet: one row
per event, newest first, with the time (UTC, ISO 8601), kind, app, who did it, whom it is about, the document and the
detail, each with its id. One file holds at most 10,000 rows; when more match, the response says where the next file
starts (`X-Next-Cursor`, passed back as `cursor`), so a year of a busy team is a few files, or a narrower date range.
A cell a spreadsheet would run as a formula is opened with an apostrophe.

## The Audit Log on a team's view

A team's admins read the log in the Explorer, on the team's view (`/explorer/team?id=`, in every app), in a section
headed **Audit Log** under Team Activity. A member never sees the section: it is drawn only when the team card says
the reader is an admin, and the read would refuse them anyway. It is named apart from Team Activity, which every member
reads, so the two are never mistaken for each other.

- **Closed until opened**, like Team Activity: a disclosure (`h2`, `aria-expanded`) whose header says "Admins only ·
  kept a year". Nothing is read until it opens; another team's view starts it closed again.
- **Filters**, above the list, each reading the first page again: **Person** (who did it: Everyone, the team's joined
  members by name, then anyone else the loaded rows name, such as a member who has left), **Event** (All Events, or
  one kind by its label, grouped People, the host app's own items in its word (Canvases, Plans, Documents, Designs,
  Spaces) and Webhooks), and **From** and **To** (whole days in the reader's
  time zone, both included: To is sent as the next day's midnight). **Clear Filters** shows while any is set. There is
  no filter by whom an event is about (`IDX32`). A From after To is turned round, never refused. A day not on the
  calendar (2026-02-31) bounds nothing, never rolling into the next month.
- **Each row**: the kind's glyph; one line saying who did what ("Ann Lee made a share link on Roadmap", "Ann Lee
  removed Bo Chen", "Ann Lee added the webhook hooks.slack.com"); then the kind's label, the detail that matters
  (the link's level, into or out of the team, the webhook's kind, a renamed team's old name, Take Offline), the app
  (its mark and name; a team's own and a webhook's read liveworkspace) and the time. Rows sit under day bands
  (the reader's date), newest first; a row's time carries the UTC time as its tooltip. A closed account reads
  "Deleted account"; a person with no name reads "Someone".
- **Pages**: 50 rows, then **Show More** for the next page. A Show More that fails keeps the rows and says so, with
  Try again.
- **Export CSV** saves every row the filters match as one file, `<team>-audit-log-<YYYY-MM-DD>.csv`: it reads the
  CSV a file at a time (10,000 rows), follows `X-Next-Cursor` to the next, and joins them under one header, with a
  byte-order mark. At most 20 files (200,000 rows) are joined; past that, the file holds the newest 200,000 and a
  toast asks for a narrower date range. While it runs the button reads "Exporting…" and can't be pressed again; a
  failure is a toast, and nothing is saved.
- **States**: three placeholder rows while the first page loads; empty, "No Audit Events Yet" ("Who joins or leaves,
  shares, moves or deletes the team's documents, and the team's webhooks show here for a year."); nothing matching,
  "No Events Match" with Clear Filters; refused (`403 not_team_admin`, an admin who has just stepped down), "Only the
  team's admins can see its audit log."; anything else (`503 team_audit_unavailable` included), "Couldn't load the
  audit log" with Try again.
- **The help article** is each app's Teams › Audit Log (`collaboration/teams/audit-log`).
