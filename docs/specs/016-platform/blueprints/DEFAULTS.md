# Platform blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint           | Spec silence                                       | Default applied                                                            |
| --- | ------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| D1  | new-version-prompt  | How often to check for a saved state               | Every 200 ms while waiting, locally (no request)                           |
| D2  | new-version-prompt  | Where the prompt sits                              | Bottom centre, 80 px up like the photo import bars, on the chrome layer    |
| D3  | new-version-prompt  | What "Not now" remembers                           | The dismissed server number, for this page only                            |
| D4  | stale-builds        | Which id names a build                             | The deploy's commit, from the one build job both deploys use               |
| D5  | stale-builds        | How long the loop guard remembers                  | One minute per destination, in `sessionStorage`                            |
| D6  | stale-builds        | Which URL a recovery loads                         | The navigation intent within 10 s, else the current URL                    |
| D7  | self-hosted-runtime | How the database file is journaled                 | WAL, with foreign keys on and `busy_timeout` at 5000 ms                    |
| D8  | self-hosted-runtime | What happens under a burst of writes               | A write queue in the runtime, not a failed request                         |
| D9  | self-hosted-runtime | How often the database is snapshotted              | Hourly, keeping 24 hourly and 7 daily snapshots                            |
| D10 | self-hosted-runtime | When an idle room leaves memory                    | After 5 minutes with no sockets and no pending timers                      |
| D11 | self-hosted-runtime | Where image bytes live by default                  | A directory in the stack's volume; S3 only when the operator configures it |
| D12 | self-hosted-runtime | Whether identity tables share the document file    | Yes: one file, one backup                                                  |
| D13 | self-hosted-runtime | Whether the MCP process ships in the default stack | Yes, and inert when no MCP hostname is set                                 |
| D14 | self-hosted-runtime | Whether Google sign-in is on out of the box        | Off until a client id and secret are set                                   |
