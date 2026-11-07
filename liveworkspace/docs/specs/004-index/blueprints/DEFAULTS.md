# Index blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #     | Blueprint       | Default applied                                                                                                                              |
| ----- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| IDX1  | index           | the spec names no isolate memory for opens or checked passwords; the code bounds them at 5,000 and 1,000 keys, oldest out first.             |
| IDX2  | index           | the spec leaves the cron minutes open; the daily run is `23 4 * * *` and the frequent one `*/15 * * * *`.                                    |
| IDX3  | index           | a cron step that throws is logged and the run goes on to the next step.                                                                      |
| IDX4  | items           | a copy reached through a link lands at the root of the copier's own space, in no team.                                                       |
| IDX5  | items           | a move leaves `updated_at` alone; only a rename or a content push moves it.                                                                  |
| IDX6  | sharing         | a share password is trimmed before its length is checked, and whitespace alone clears it.                                                    |
| IDX7  | sharing         | a password set before the 6-character rule keeps working; only a new one is held to it.                                                      |
| IDX8  | inbox           | shown text in a push past its cap is cut rather than refused; ids and times are refused when malformed.                                      |
| IDX9  | timeline        | an event from a clock more than 5 minutes fast is dated now, so it can't pin itself to the top.                                              |
| IDX10 | timeline        | an empty item tidied away (`reason=empty`) records no `trashed` event.                                                                       |
| IDX11 | trash           | an app that does not answer a tombstone is retried hourly with no give-up; person notices and merges give up after 7 days.                   |
| IDX12 | trash           | a person purge is kept and run again for 2 hours after the request, the life of an access token.                                             |
| IDX13 | default-folders | with no working default an item lands at the root of the person's own space, never a team's.                                                 |
| IDX14 | guest-merge     | where a guest and the account both have a favourite, open, default or form read, the account's is kept (or the later or further of the two). |
| IDX15 | guest-merge     | a handed-off item always lands at the root of the person's own space, whatever its old document said.                                        |
| IDX15 | webhooks        | an address given as an IP literal is refused, public or not: the check is by name, resolved at add and at send.                              |
| IDX16 | webhooks        | only port 443 is taken; another port is refused as `webhook_url_invalid`.                                                                    |
| IDX17 | webhooks        | a redirect (3xx) gives the delivery up without retrying; other 4xx but 408, 410 and 429 give up too.                                         |
| IDX18 | webhooks        | accounts unreachable holds a team webhook's deliveries a minute, counting no try.                                                            |
| IDX19 | webhooks        | a card move dated more than 5 minutes ahead is dated now + 5 minutes; its texts are cut to 200.                                              |
| IDX20 | webhooks        | a webhook's deliveries list answers at most 40, newest first.                                                                                |
| IDX21 | webhooks        | a tab's push hands on at most 10 mentions; when accounts can't say who is in a team, a mention that needs it is not sent.                    |
| IDX22 | connected-tabs  | a connection id is `cn_` and 24 random letters and digits.                                                                                   |
| IDX23 | connected-tabs  | the open door allows 60 opens a minute per caller.                                                                                           |
| IDX24 | connected-tabs  | the reverse write waits at most 5 seconds for the target app before taking the reverse back.                                                 |
| IDX25 | connected-tabs  | Connect Again on a tab that still has a connection replaces it, deleting the old pass.                                                       |
| IDX26 | connected-tabs  | a connected tab's name follows the target's title on open; it is not renamed by hand.                                                        |
| IDX27 | connected-tabs  | a connection unconfirmed an hour after it was made is swept with its pass, at most 200 every 15 minutes.                                     |
| IDX28 | team-audit-log  | the daily run deletes at most 5,000 audit rows past the year, the oldest first.                                                              |
| IDX29 | team-audit-log  | a team item deleted for good by the Trash's own 30-day purge writes no audit row; its `trashed` row says who sent it there.                  |
| IDX30 | team-audit-log  | a deleted team's audit rows stay until the year takes them; nobody can read them, as the team has no admins.                                 |
| IDX31 | team-audit-log  | the admins' read pages 50 rows by default, at most 100; a CSV file holds at most 10,000 rows, read 2,000 a query.                            |
| IDX32 | team-audit-log  | the read's `person` filter is who did it, not whom an event is about; `kind` takes one kind.                                                 |
| IDX33 | team-audit-log  | when accounts can't name people, the read falls back to the names the events carried rather than failing.                                    |
| IDX34 | team-audit-log  | Export CSV joins at most 20 files (200,000 rows), newest first, and says so when more matched.                                               |
