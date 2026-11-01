# Accounts blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #     | Blueprint             | Default applied                                                                                                                                                      |
| ----- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACC1  | accounts              | the spec names no cron minute; the hourly run is `17 * * * *` (its daily steps in the 09:17 UTC run) and the frequent one `*/15 * * * *`.                            |
| ACC2  | accounts              | closing an account answers `200` once the account is gone, whether or not the index, the workbench or Drive took their part; the index's is retried, Drive's is not. |
| ACC3  | accounts              | a telemetry event with no app (someone who signed up on liveworkspace.app) is not counted.                                                                           |
| ACC4  | sign-in               | the spec names no per-address limit; sending a code is held to 3 a minute per address and 10 a minute per network, checking to 10 a minute per network.              |
| ACC5  | sign-in               | a hand-off token lives 60 seconds and its nonce 15 minutes (the code's ten and some).                                                                                |
| ACC6  | sessions-and-guests   | a guest id unseen for 400 days (past the token's year and a browser's cookie cap) has its settings and profile swept.                                                |
| ACC7  | sessions-and-guests   | a merge that fails keeps the guest cookie, so the next sign-in tries again; the sign-in itself never fails.                                                          |
| ACC8  | teams                 | the 50-team cap bounds the access token's `teams` claim.                                                                                                             |
| ACC9  | teams                 | a reminder that fails three sends in a row leaves the queue; the invitation still expires at 28 days.                                                                |
| ACC10 | teams                 | a Timeline event the index refuses 96 times is dropped, and the outbox keeps at most 5,000 events.                                                                   |
| ACC11 | tokens                | a token's last use is stamped at most once a minute, so a burst of MCP calls costs one write.                                                                        |
| ACC12 | tokens                | an expiry warning is sent only to a verified address; the Timeline note goes regardless.                                                                             |
| ACC13 | oauth                 | token lifetimes are left at Better Auth's defaults; the code sets only the 30-second refresh replay window.                                                          |
| ACC14 | settings-and-profiles | where a guest's settings and the account's share a key, the account's value is kept.                                                                                 |
| ACC15 | email                 | three failed sends in a row take an account off every due list for good; a success before then resets the count.                                                     |
| ACC16 | email                 | a series email for someone who has opened no app speaks for liveworkspace and is not counted under any app.                                                          |
| ACC17 | accounts              | checking and closing with a deletion code share `CODE_IP_LIMITER`'s 10 a minute, keyed by account, since the caller is always an app's server.                       |
| ACC18 | email                 | the send window is whole hours (the sweeps run hourly); a window that would cross midnight (`21:00-09:00`) doesn't parse and the default is used.                    |
| ACC19 | email                 | an invited address is timed by the zone of the account with that address, else the default.                                                                          |
| ACC20 | push                  | an account keeps at most 10 devices; registering an eleventh drops the oldest.                                                                                       |
| ACC21 | push                  | one request to accounts sends at most 200 posts across its people and devices, 8 at a time, 10 seconds each; the rest are dropped and logged.                        |
| ACC22 | push                  | a message lives 4 hours at the push service (`TTL`), at `Urgency: normal`; the VAPID subject is the Worker's `BASE_URL`.                                             |
| ACC23 | push                  | comments and assignments made with an API token send no phone notification, and one event reaches at most 50 people.                                                 |
| ACC24 | data-export           | items in the Trash and an item's folder are not exported; items are filed by app, named with their id.                                                               |
| ACC25 | data-export           | a team export carries no images and no profiles: an image is its uploader's, in their own export.                                                                    |
| ACC26 | data-export           | the readable pictures are each tab at twice its size, at most 4096 px on the long side, up to 20 tabs an item.                                                       |
| ACC27 | data-export           | the emailed link and the file last 3 days; the R2 rule deletes anything older than 4 days.                                                                           |
