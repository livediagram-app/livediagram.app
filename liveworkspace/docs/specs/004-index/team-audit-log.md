# The team audit log

What a team's admins can look back on: who joined, left or changed role, who shared a team document publicly or
made or revoked its share links, which documents came into the team, left it or were deleted, and who added or
removed the team's webhooks (Work Tracker #160). It answers "who shared this?", "who joined?" and "who made that
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
| `webhook_added`       | An admin adds a team webhook (`kind`, `host`)                                                                     | the index |
| `webhook_removed`     | An admin deletes a team webhook (`kind`, `host`)                                                                  | the index |

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

A team's admins only, checked against accounts on each read, as a team webhook's are; a member, a guest, an app or the
Drive mirror acting for someone is refused. Members keep the Timeline's Team Activity, which is unchanged.

Still to come (Work Tracker #160): the admins' read, with filters by person, kind and date and a CSV export (part 2),
and the Activity section in team settings that shows it (part 3). Until then nothing reads the log.
