# Google Drive mirror blueprint defaults

One row per default applied where the spec is silent or qualitative.

| #   | Blueprint    | Spec silence                                            | Default applied                                                                                          |
| --- | ------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| D1  | drive-mirror | When the first page token is taken                      | Before the root folder is created, so the mirror's own first writes are read back as echoes              |
| D2  | drive-mirror | Tab election without the Web Locks API                  | Every tab is elected; the D1 lease still keeps writes to one device                                      |
| D3  | drive-mirror | Envelope formatting                                     | Two-space indented JSON, matching the tab envelope                                                       |
| D4  | drive-mirror | "Shortly before expiry" for the access token            | 5 minutes before `expiresAt`                                                                             |
| D5  | drive-mirror | How often recorded items reach D1 during a pass         | Every 25 rows and at the end of the pass                                                                 |
| D6  | drive-mirror | Order of changes within one `changes.list` read         | Folders first, then files, each by `time`, so a restored folder exists before its diagrams are placed    |
| D7  | drive-mirror | A name from Drive longer than a livediagram name allows | Truncated to `MAX_NAME_LEN`                                                                              |
| D8  | drive-mirror | A page token Drive rejects                              | Take a new start token and re-run the adoption listing                                                   |
| D9  | drive-mirror | Progress denominator for the first mirror               | Live Personal Space diagrams at the start of the pass                                                    |
| D10 | drive-mirror | Where the reconnect banner sits                         | Bottom-left, dismissible for the browser session                                                         |
| D11 | drive-mirror | Relative wording of **Last synced**                     | "Just now" under a minute, then the shared relative-time formatter, "Not yet" before the first pass      |
| D12 | drive-mirror | Where `/drive/connected` returns to                     | The page the user connected from, else `/explorer`                                                       |
| D13 | drive-mirror | Lease holder identity                                   | A random per-browser id in `localStorage` (`livediagram:v2:drive-device`)                                |
| D14 | drive-mirror | When a content edit made in Drive is rewritten          | At the ordinary write cadence (idle and minimum interval), not at once                                   |
| D15 | drive-mirror | Where the unseen-folder notice shows on a row           | A small amber folder mark after the diagram's name, in list rows and cards alike                         |
| D16 | drive-mirror | Which pages run the engine                              | Every page of the live app except `/embed` and the `/drive` routes, from the root layout                 |
| D17 | drive-mirror | Test ports for the opt-in e2e                           | JWKS on 8795, the fake Google on 8796, both overridable (`E2E_DRIVE_JWKS_PORT`, `E2E_DRIVE_GOOGLE_PORT`) |
| D18 | drive-mirror | Telemetry pairs for the spec's events                   | Reuse `Linked`, `Unlinked`, `Changed`, `Created`, `Opened`; add only the `Drive` category and `Applied`  |
| D21 | drive-mirror | "On focus" guard at the 2-minute pace                   | At most one focus check every 30 seconds                                                                 |
| D22 | drive-mirror | Colours of the sync badge                               | Brand-600 disc syncing, emerald-600 synced, amber-600 needs attention                                    |
| D23 | drive-mirror | How long "syncing" must last before the mark shows it   | 600 ms, so the cheap start-token check never flashes the mark                                            |
| D24 | drive-mirror | Size and place of the avatar's cloud badge              | A 12 px disc (24 px target) on the avatar's upper-right corner, ringed in the header's background        |
| D25 | drive-mirror | Look of Disconnect                                      | The shared `warning` button (amber-400, slate-900 text), and an amber confirm                            |
