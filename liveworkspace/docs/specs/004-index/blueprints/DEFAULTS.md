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
