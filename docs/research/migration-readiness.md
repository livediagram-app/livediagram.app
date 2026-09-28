# Migration readiness: Google Drive mirror, Miro import, Whiteboard import

Research to de-risk three features that let a user bring 100+ boards from other
tools into livediagram and keep them mirrored in their own Google Drive. No
product code. The decisions below turned the proposals into specs:
[Board import](../specs/020-import-export/board-import.md),
[Miro import](../specs/020-import-export/miro-import.md) and
[Microsoft Whiteboard import](../specs/020-import-export/whiteboard-import.md);
the Drive decision amended [Save Locations](../specs/006-diagram/save-locations.md).

- **Checked:** 2026-09-27, against the official pages listed in [Sources](#sources)
  (each page's own "last updated" date is recorded there).
- **Verified** means the claim was read in an official source on that date, or
  reproduced by an experiment recorded in [Experiments run](#experiments-run).
- **Unverified** means inference, a third-party report, or a claim that needs an
  experiment we could not run without accounts (listed in
  [Experiments still needed](#experiments-still-needed)).

## Decisions

Taken by the operator on 2026-09-27, after the first version of this report.

| Question           | Decision                                                                                                                                                      | Recorded in                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Miro route         | **REST API only**; what it cannot read is reported as lost. No clipboard decoding.                                                                            | [Miro import](../specs/020-import-export/miro-import.md)                       |
| Whiteboard account | The boards are on a **personal** Microsoft account: the exported image is the import route.                                                                   | [Microsoft Whiteboard import](../specs/020-import-export/whiteboard-import.md) |
| Drive's role       | Drive is a **mirror** of cloud diagrams, never a save location.                                                                                               | [Save Locations](../specs/006-diagram/save-locations.md)                       |
| Drive bin          | Maps to the livediagram **Trash**, specified separately (soft delete for 30 days, team Trash, local Trash for Offline Mode, api and MCP deletes go to Trash). | [Trash](../specs/013-workspace/trash.md) (PR #178)                             |
| Safari images      | A **WASM WebP encoder**, loaded only when the browser cannot encode WebP.                                                                                     | [Board import](../specs/020-import-export/board-import.md)                     |

## Headlines

1. **Microsoft Whiteboard for personal accounts is being retired** (verified in
   the web app's own strings and Microsoft Support): boards became **read-only on
   2026-09-25** and are **permanently deleted on 2026-10-16**. The standalone
   Windows, iOS and Android apps retired on 2026-09-14; the web app still exports.
   Its richest export is a **Full export Zip (HTML + JSON)**, a snapshot of the
   board's own markup, beside the PNG image export. Steps:
   [Exporting personal boards before 2026-10-16](#exporting-personal-boards-before-2026-10-16).
2. **`drive.file` is non-sensitive: in production it needs no verification, no
   CASA assessment and has no user cap.** Brand verification is only needed to show the app
   name and logo. Testing mode caps at 100 test users and expires grants after 7 days.
3. **The browser cannot renew a Google access token without a user gesture** in
   the token model. The decided broker (refresh token held by the api Worker) is
   therefore required for background sync, not an optimisation.
4. **Drive thumbnails (`contentHints.thumbnail`) accept PNG, GIF or JPG only, not
   SVG,** at least 220 px wide and at most 2 MB. The SVG preview stays a separate
   file; the thumbnail must be rasterised in the browser.
5. **Drive API quotas changed on 2026-05-01:** 1,000,000 quota units per minute per
   project, and a **400,000,000 units per day per project** threshold above which
   charges are "planned later in 2026". At 10M users the naive polling budget
   overshoots it about twofold; the [proposed sync cadence](#proposed-sync-cadence)
   brings it to about 80%.
6. **Miro's REST API is browser-callable (CORS `*`)** so only the one-time
   code-for-token exchange needs the Worker. But it does not expose pen strokes,
   tables, kanban, mockups, emoji or user story maps, nor connector waypoints.
7. **Miro's clipboard carries the full board, pen strokes included,** behind a
   trivial obfuscation (third-party reverse engineering). Miro's terms forbid
   reverse engineering, so livediagram does not use it (decided).
8. **Microsoft Graph converts a `.whiteboard` file to HTML or PDF**
   (`GET /drive/items/{id}/content?format=html`), and Microsoft ships a
   PowerShell cmdlet that does it. This only reaches work or school boards stored in
   OneDrive for Business; personal boards are not files at all.
9. **Safari cannot encode WebP from a canvas** (`toBlob` / `convertToBlob` with
   `image/webp` are unsupported and silently return PNG; MDN browser-compat-data
   8.1.3, 2026-09-24). Decided: a WASM WebP encoder, loaded only on
   that path.

## A. Google Drive two-way mirror

### A1. Scope classification, verification, test users, CASA

| Claim                                                                                                                                                                                          | Status                                                           | Source      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------- |
| `drive.file` is **non-sensitive** ("Create new Drive files, or modify existing files, that you open with an app or that the user shares with an app while using the Google Picker API").       | Verified                                                         | [G1]        |
| `drive.install` (needed for "Open with") is also non-sensitive.                                                                                                                                | Verified                                                         | [G1]        |
| Apps using only non-sensitive scopes need not complete verification; brand verification is only required to display the app name and logo on the consent screen.                               | Verified                                                         | [G2]        |
| The 100-new-user cap and the "unverified app" screen apply to apps requesting unapproved **sensitive or restricted** scopes, so not to a `drive.file` + `drive.install` app in production.     | Verified                                                         | [G3], [G4]  |
| Brand verification requires: homepage on a verified domain describing the app, privacy policy on the same domain linked from the homepage and the consent screen, Search Console domain proof. | Verified                                                         | [G5]        |
| Testing status: at most **100 test users**; each authorisation (and any refresh token) **expires 7 days** after consent.                                                                       | Verified                                                         | [G4], [G24] |
| Testing-mode apps still show the unverified screen and the 100-user cap; only "In production" projects are submitted.                                                                          | Verified                                                         | [G7]        |
| **CASA** (annual third-party security assessment) applies to **restricted** scopes only.                                                                                                       | Verified                                                         | [G8], [G1]  |
| Google charges no fee for the security assessment; the CASA assessor fee is agreed privately. No fee is documented anywhere for OAuth or brand verification.                                   | Verified (the assessment); Unverified (absence of any other fee) | [G9]        |
| Changing redirect URIs, JavaScript origins, logo or product name after verification can trigger re-verification.                                                                               | Verified                                                         | [G3], [G11] |
| The new-user **authorisation rate** limit applies even to verified apps and depends on "history, developer reputation, and riskiness"; increases take about 5 business days.                   | Verified                                                         | [G12]       |

**Cost:** Google Cloud project, OAuth client and brand verification: no fee found.
The real cost is the privacy policy text about Google user data (Limited Use)
and a demo-free submission.

### A2. Drive UI integration ("Open with")

| Claim                                                                                                                                                                                                      | Status                                                         | Source              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------- |
| Configure it in Cloud Console, Drive API, **Drive UI integration** tab: app name, icons (PNG, transparent, up to 24 h to appear), **Open URL** (fully qualified domain, no localhost).                     | Verified                                                       | [G13]               |
| The app is installed for a user by requesting the **`drive.install`** scope; a Marketplace listing is **optional** ("If you publish ... users can install directly from the Marketplace").                 | Verified                                                       | [G13]               |
| The Open URL receives a URL-encoded JSON `state` query parameter: `{"ids":["ID"],"resourceKeys":{...},"action":"open","userId":"USER_ID"}`; the New URL gets `{"action":"create","folderId",...}`.         | Verified                                                       | [G13], [G14]        |
| The app must call `files.get` to check permissions before editing and set `X-Goog-Drive-Resource-Keys` when `resourceKeys` is present.                                                                     | Verified                                                       | [G14]               |
| Opening a file via "Open with" grants the app `drive.file` access to that file.                                                                                                                            | Verified (scope wording "files ... that you open with an app") | [G1]                |
| "Default MIME types / extensions" declare files the app is uniquely built to open; docs ask for "standard media types only".                                                                               | Verified                                                       | [G13]               |
| A made-up type such as `application/vnd.livediagram+json` is accepted as a default MIME type.                                                                                                              | Unverified                                                     | needs E-A5          |
| **Double-click** on a `.livediagram` file opens livediagram. The docs only describe the right-click "Open with" menu and say the most recently installed app is used "until the user chooses another app". | Unverified                                                     | needs E-A5          |
| Marketplace listing: no listing fee; a **public** listing is reviewed by Google ("several days") and requires completed OAuth verification and brand-clean name, icon and screenshots.                     | Verified                                                       | [G15], [G16], [G17] |
| Marketplace review rule for Drive apps: store files in a user-picked or app-specific folder, never dump them in My Drive root.                                                                             | Verified                                                       | [G16]               |

**Implication:** "Open with" works with `drive.file` + `drive.install`, without a
Marketplace listing. Marketplace is a discovery channel we can add later.
Double-click behaviour must be tested before the spec promises it.

### A3. Google Identity Services token model

| Claim                                                                                                                                                                               | Status                                                                               | Source       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ |
| Token model: "if the access token expires ... obtain a new token by calling `requestAccessToken()` from a user-driven event such as a button press". Automatic refresh was removed. | Verified                                                                             | [G18], [G19] |
| The token model is popup-only ("only the dialog UX is supported"); `error_callback` reports `popup_failed_to_open` and `popup_closed`.                                              | Verified                                                                             | [G18], [G20] |
| `prompt: ''` (empty) prompts only on first access; `prompt: 'none'` shows no screens. Both still open a popup window.                                                               | Verified                                                                             | [G20]        |
| A popup opened without transient user activation is blocked by browser popup blockers, so silent background renewal fails.                                                          | Verified by the GIS requirement above; browser behaviour itself not re-tested here   | [G18]        |
| "User authorization does not require the use of cookies", so third-party-cookie blocking does not break the token or code model.                                                    | Verified                                                                             | [G21]        |
| On iOS, GIS requires `redirect` mode for the **Sign In With Google** button because of ITP. For OAuth code flow, `ux_mode: 'redirect'` is available and avoids popups entirely.     | Verified (sign-in button); Unverified that iOS Safari breaks the authorisation popup | [G22], [G20] |
| A page setting `Cross-Origin-Opener-Policy: same-origin` can break the popup handshake. livediagram sets no COOP header today (repo search).                                        | Verified (GIS note + repo grep)                                                      | [G22]        |

**Implication:** the Worker broker is necessary for "sync while a tab is open"
without a click every hour. Self-hosters without a client secret fall back to
the token model and must accept a click-to-resume banner when the token lapses.
Recommend the broker's one-time consent uses the **code model in redirect mode**
(works on iOS, no popup blocker).

### A4. Refresh tokens

| Claim                                                                                                                                                                             | Status                                               | Source       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------ |
| A refresh token is returned only with `access_type=offline`, and only **the first time** a code is exchanged; to get a new one, revoke the grant or use `prompt=consent`.         | Verified                                             | [G23]        |
| Refresh tokens stop working when: the user revokes; **unused for six months**; account exceeds the live-token maximum; time-based access expires; an admin restricts the service. | Verified                                             | [G24]        |
| **100 refresh tokens per Google Account per OAuth client**; the 101st silently invalidates the oldest.                                                                            | Verified                                             | [G24]        |
| Testing-mode refresh tokens expire after 7 days.                                                                                                                                  | Verified                                             | [G24], [G4]  |
| Users may grant **time-based access**; the response then carries `refresh_token_expires_in`.                                                                                      | Verified                                             | [G23]        |
| Revoke via `https://oauth2.googleapis.com/revoke` or `google.accounts.oauth2.revoke`; the app must delete stored tokens on revoke or account deletion.                            | Verified                                             | [G23], [G25] |
| Access tokens are short-lived (`expires_in`, about an hour in every example).                                                                                                     | Verified (field); the exact hour is an example value | [G23]        |

**Implication:** one refresh token per user (not per device) keeps us far from
the 100 limit, so the broker must reuse the stored token rather than re-consent
per browser. Consent with `prompt=consent` only when D1 has no token.

### A5. `changes.list` and `getStartPageToken`

| Claim                                                                                                                                                                                              | Status                                                                                                   | Source       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| `changes.list` and `getStartPageToken` accept the `drive.file` scope.                                                                                                                              | Verified                                                                                                 | [G26]        |
| `nextPageToken` and `newStartPageToken` "don't expire".                                                                                                                                            | Verified                                                                                                 | [G26]        |
| `pageSize` default 100, max 1000; store `newStartPageToken` when `nextPageToken` is absent.                                                                                                        | Verified                                                                                                 | [G26], [G27] |
| A change has `fileId`, `removed`, `time`, `changeType`, and `file` (the **current state**) unless removed. `removed` means deleted **or loss of access**.                                          | Verified                                                                                                 | [G28]        |
| Under `drive.file` the list only contains files the app can access.                                                                                                                                | Unverified                                                                                               | E-A1         |
| Rename shows as a change with a new `file.name`; move as new `file.parents` (one parent only).                                                                                                     | Verified that the change carries current state; Unverified that each rename/move emits exactly one entry | [G28], [G29] |
| Trash: `file.trashed=true` (`explicitlyTrashed` distinguishes a trashed parent); restore: `trashed=false`; bin empties after **30 days**; permanent delete: `removed=true`.                        | Verified (fields and 30 days); Unverified that trashing a folder emits one entry per child               | [G29], [G30] |
| Detecting our own writes: `version` is monotonic but "reflects every change made to the file on the server, even those not visible to the user"; `md5Checksum` and `headRevisionId` track content. | Verified                                                                                                 | [G29]        |
| `appProperties` are private to the app, max 30 per app per file, **124 bytes** per key plus value.                                                                                                 | Verified                                                                                                 | [G31]        |

**Implication for the design:** store, per mirrored file, the last state we
wrote (`name`, `parents`, `trashed`, `md5Checksum`, `headRevisionId`) and treat a
change as foreign only when one of those differs. Do not rely on `version`.
Put `ldDiagramId` in `appProperties` so a file maps back to a diagram even after
a rename or move. Request `fields=` explicitly on every call (the default
subset omits these).

### A6. Drive API quotas and cost

| Claim                                                                                                                                                           | Status                                 | Source       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------ |
| New standard quotas since **2026-05-01** for projects without prior use: **1,000,000 units/min/project**, **325,000 units/min/user/project**, 1 TB egress/day.  | Verified                               | [G32]        |
| Units per call: read (`files.get`) 5, list (`files.list`) 100, download 200, edit (`files.update`) 50, other 5.                                                 | Verified                               | [G32]        |
| `changes.list` costs 100 units (it is a "list").                                                                                                                | Unverified (classification by analogy) | [G32]        |
| Daily billing threshold **400,000,000 units/day/project**, cannot be raised; exceeding it is "planned to incur charges ... later in 2026" with 90 days' notice. | Verified                               | [G32], [G33] |
| "All standard use of the Google Drive API is available at no additional cost." Quota increases via Cloud Console; later in 2026 they will require billing.      | Verified                               | [G32], [G33] |
| Errors: `403 userRateLimitExceeded` or `429`; use truncated exponential backoff.                                                                                | Verified                               | [G32]        |

### A7. CORS, uploads, thumbnails from the browser

| Claim                                                                                                                                                                                                                      | Status                                                                                                           | Source       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------ |
| Google APIs support CORS for bearer-token calls from the browser.                                                                                                                                                          | Verified                                                                                                         | [G18]; E-1   |
| `upload/drive/v3/files` (multipart and resumable) and `drive/v3/changes` answer preflights for origin `https://livediagram.app` with methods incl. PATCH and headers `authorization, content-type, x-upload-content-type`. | Verified                                                                                                         | E-1          |
| Multipart upload carries metadata plus content in one request, for files **up to 5 MB**; resumable is for larger files.                                                                                                    | Verified                                                                                                         | [G34]        |
| The resumable session URI (`Location`) is readable cross-origin.                                                                                                                                                           | Unverified (the 401 response exposes only `X-GUploader-UploadID` among custom headers; a real session is needed) | E-1, E-A4    |
| `contentHints.thumbnail.image` is URL-safe base64 in the metadata; **PNG, GIF or JPG**, min width 220 px, max 2 MB, recommended 1600 px; used only when Drive cannot make its own; invalidated on each content change.     | Verified                                                                                                         | [G35], [G29] |
| `thumbnailLink` is not intended for direct web use because of CORS.                                                                                                                                                        | Verified                                                                                                         | [G29]        |

**Implication:** each mirror write is one multipart `files.update` for the
`.livediagram` JSON (with a PNG thumbnail in `contentHints`) and one for the
`.svg` preview, both from the browser. Diagrams whose JSON exceeds 5 MB need
resumable upload (verify E-A4 first).

### What the findings change in the decided design

- **Thumbnail:** rasterise the existing SVG snapshot to PNG in the browser for
  `contentHints`; SVG is not accepted there.
- **Trash:** livediagram has no diagram Trash yet; it is being specified
  separately (see [Decisions](#decisions)). A Drive bin maps to it; a restore in
  Drive restores the diagram; a Drive permanent delete (`removed: true`)
  empties the diagram from Trash.
- **Save locations:** amended. Drive is a mirror, never a tile in the New
  Diagram wizard.
- **Quota budget:** polling `changes.list` every 5 minutes plus a write per
  autosave does not fit 10M users under the free daily threshold. The
  [proposed sync cadence](#proposed-sync-cadence) does.
- **Self-hosters:** files created by livediagram.app's Google project are not
  visible to a self-hoster's project (`drive.file` is per app). Unverified but
  follows from the scope's per-app grant; E-A6.

### Cost model

Pricing fetched 2026-09-27 from Cloudflare's pricing pages [C1] [C2] [C3]:

| Product          | Included (Workers Paid, $5/month) | Overage                         |
| ---------------- | --------------------------------- | ------------------------------- |
| Workers requests | 10M/month                         | $0.30 per million               |
| Workers CPU      | 30M CPU ms/month                  | $0.02 per million CPU ms        |
| D1 rows read     | 25 billion/month                  | $0.001 per million              |
| D1 rows written  | 50 million/month                  | $1.00 per million               |
| D1 storage       | 5 GB                              | $0.75 per GB-month              |
| Durable Objects  | 1M requests, 400,000 GB-s         | $0.15/M requests, $12.50/M GB-s |

Durable Object duration is billed on **wall-clock time** while the object is
active and not eligible for hibernation, always at 128 MB, shared across
concurrent requests; a WebSocket accepted without the Hibernation API bills for
its whole connection [C3]. Static asset requests are free; subrequests are not
billed [C1].

**Assumptions** (explicit so they can be argued with): 5% of users connect
Drive; a connected user is active 12 days a month, with about two hours of open
tab per active day; the broker is called 3 times per active day (arrival plus
hourly renewal); each broker call costs 1 Worker request, about 2 ms CPU and
2 D1 rows read; D1 is written about twice per active day (page token, only when
it changed and at most every 10 minutes); one D1 row of about 1 KB per connected
user. The mirror traffic itself goes browser to Google and costs us nothing.
Inbound Drive changes reuse existing api routes (rename, move, delete) and are
rare. No Durable Object is used.

| Users  | Connected | Worker requests/month | CPU ms/month | D1 reads | D1 writes | Storage | Marginal cost/month\* |
| ------ | --------- | --------------------- | ------------ | -------- | --------- | ------- | --------------------- |
| 50     | 3         | 108                   | 216          | 216      | 72        | 3 KB    | $0.00                 |
| 10,000 | 500       | 18,000                | 36,000       | 36,000   | 12,000    | 0.5 MB  | $0.00                 |
| 10M    | 500,000   | 18M                   | 36M          | 36M      | 12M       | 0.5 GB  | about $18.50          |

\*Marginal cost assumes the rest of the product has already used the included
allowances (worst case). At 10M: requests 18M × $0.30/M = $5.40, CPU 36M × $0.02/M
= $0.72, reads 36M × $0.001/M = $0.04, writes 12M × $1.00/M = $12.00, storage
0.5 GB × $0.75 = $0.38. Writes dominate: storing the page token on every poll
(24 a day) would cost about $144/month at 10M, so the token write must be
throttled. For contrast, a per-user Durable Object holding a non-hibernating
connection for those two hours would cost 500,000 × 12 × 7,200 s × 0.125 GB ≈
5.4 billion GB-s ≈ **$67,500/month**; do not coordinate the mirror through a
Durable Object.

**Google side** (free but capped). A naive cadence, 20 mirrored saves × 2 files
× 50 units plus a poll every 5 minutes (24 × 100 units), costs about 4,400
units per active connected user-day:

| Users  | Active connected/day | Naive units/day | Share of 400M threshold |
| ------ | -------------------- | --------------- | ----------------------- |
| 50     | about 1              | 4,400           | 0.001%                  |
| 10,000 | about 200            | 0.9M            | 0.2%                    |
| 10M    | about 200,000        | 880M            | **220%**                |

### Proposed sync cadence

Named constants in one module, so they can be tuned without touching the sync
logic. Units assume `files.update` costs 50 (edit) and `changes.list` 100
(list); the second is an inference (A6).

| Constant                                   | Value                 | Rule                                                                                                                                                                                |
| ------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DRIVE_POLLER`                             | one tab per browser   | The Web Locks API elects one tab to poll and write; other tabs of the same browser do neither.                                                                                      |
| `DRIVE_CATCH_UP`                           | on arrival            | The poller runs `changes.list` from the stored page token once when it takes the lock, and re-uploads any diagram whose `saved_at` is newer than its mirrored revision.             |
| `DRIVE_POLL_INTERVAL_MS`                   | 20 minutes            | Poll only while a livediagram tab is visible; never while hidden.                                                                                                                   |
| `DRIVE_FOCUS_POLL_MIN_GAP_MS`              | 5 minutes             | On window focus or `visibilitychange` to visible, poll if the last poll is older than this.                                                                                         |
| `DRIVE_CHANGES_PAGE_SIZE`                  | 1,000                 | The maximum, so a catch-up is usually one call.                                                                                                                                     |
| `DRIVE_WRITE_IDLE_MS`                      | 60 seconds            | Mirror a diagram once it has had no edits for this long.                                                                                                                            |
| `DRIVE_WRITE_MIN_INTERVAL_MS`              | 5 minutes             | At most one mirror write (JSON with thumbnail, then SVG) per diagram per interval.                                                                                                  |
| `DRIVE_WRITE_FLUSH`                        | on hide and on switch | Flush pending writes on `visibilitychange` to hidden and when the user leaves a diagram; anything missed is caught up on the next arrival.                                          |
| `DRIVE_BACKOFF`                            | double, capped        | On `403 userRateLimitExceeded` or `429`, double the poll interval (cap 60 minutes) and the write interval (cap 30 minutes); return to the base values after an hour without errors. |
| `DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS` | 10 minutes            | Write the page token to D1 only when it changed, at most this often, and on flush.                                                                                                  |

**What that costs.** A two-hour active day becomes about 6 writes × 100 units
plus about 10 polls (arrival, 6 on the interval, 3 on focus) × 100 units, so
about **1,600 units** instead of 4,400.

| Users  | Active connected/day | Units/day | Share of 400M threshold |
| ------ | -------------------- | --------- | ----------------------- |
| 50     | about 1              | 1,600     | 0.0004%                 |
| 10,000 | about 200            | 0.32M     | 0.08%                   |
| 10M    | about 200,000        | 320M      | **80%**                 |

The per-minute project quota (1M units) holds too: an open connected tab costs
about 10 units a minute (5 for polls, 5 for writes). At 10M users about 16,700
tabs are open on average (200,000 active users × 2 of 24 hours); at a peak three
times that, about 500,000 units a minute, half the quota. The backoff absorbs
spikes. The D1 figures in the table above already assume the throttled
page-token write.

## B. Miro board import

### B1. Exporting board data as a file

| Claim                                                                                                                                                                                                                                                                               | Status                                                   | Source       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------ |
| **Board backup** (`.rtb`): Starter, Business, Enterprise, Education plans; board owners and co-owners only; one board at a time ("backups of several boards in bulk ... isn't currently possible"); 1 GB limit.                                                                     | Verified                                                 | [M1]         |
| `.rtb` is a ZIP whose `canvas.json` (all widgets) is **encrypted**; images and other assets are plain files named by resource id.                                                                                                                                                   | Unverified (third-party reverse engineering, 2026-07-28) | [M9]         |
| **Save as image**: JPG, PDF or SVG; Free plan exports small size only; vector (PDF/SVG) quality on paid plans.                                                                                                                                                                      | Verified                                                 | [M2]         |
| **Save as PDF**: one page per frame.                                                                                                                                                                                                                                                | Verified                                                 | [M2]         |
| **Export to CSV** (all plans): text of stickies, tables, cards, text boxes, shapes; no geometry.                                                                                                                                                                                    | Verified                                                 | [M2]         |
| Board owners can disable export for collaborators.                                                                                                                                                                                                                                  | Verified                                                 | [M2]         |
| **Board Export API** (eDiscovery): Enterprise plan, Company Admin role, eDiscovery enabled; ZIP with SVG, HTML or PDF plus comments and metadata JSON; up to 1,000 boards per job.                                                                                                  | Verified                                                 | [M3], [M4]   |
| Copying objects puts Miro's full internal widget model on the clipboard (base64 plus a fixed byte shift), including pen strokes and link previews.                                                                                                                                  | Unverified (third-party)                                 | [M9]         |
| Miro Terms of Service 2.9(d) forbid customers to "scrape, data mine, reverse engineer ... or seek to access ... non-public APIs" except as expressly permitted by law, with prior notice; Developer Terms 3.3(g) forbid apps to "use or implement any undocumented feature or API". | Verified (text); legal effect not assessed               | [M12], [M13] |

No plan offers a documented, structured, per-board file export for a normal
user. The structured routes are the REST API (any plan) and the clipboard
(undocumented).

### B2. REST API v2: auth, CORS, limits, pagination

| Claim                                                                                                                                                                                       | Status                                | Source     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- |
| OAuth 2.0 authorisation code flow; the token exchange needs `client_id` **and `client_secret`**; no PKCE is documented.                                                                     | Verified (PKCE absence as documented) | [M5]       |
| Access token 60 minutes; refresh token 60 days, rotated on every refresh.                                                                                                                   | Verified                              | [M5]       |
| The token response carries `team_id`: the user installs the app **into one team** and picks it during consent.                                                                              | Verified                              | [M5], [M6] |
| A token reaches only boards of the team it was installed into.                                                                                                                              | Unverified                            | E-B2       |
| An app created in a developer team can be shared by its **installation URL** with users in other teams, without a Marketplace listing.                                                      | Verified                              | [M6]       |
| Scopes: `boards:read` is enough for import (all plans).                                                                                                                                     | Verified                              | [M7]       |
| `api.miro.com` answers CORS preflights with `access-control-allow-origin: *`, methods incl. GET, header `authorization`; error responses also carry ACAO `*`.                               | Verified                              | E-2        |
| The token endpoint `api.miro.com/v1/oauth/token` does not answer the preflight with CORS headers.                                                                                           | Verified                              | E-2        |
| Rate limits: per user per app; credits per minute, **100,000 credits/min** global; Level 1 = 50 credits, Level 2 = 100, Level 3 = 500, Level 4 = 2,000; `429` plus `X-RateLimit-*` headers. | Verified                              | [M8]       |
| `GET /v2/boards/{id}/items` is Level 2; cursor pagination, `limit` 10 to 50.                                                                                                                | Verified                              | [M10]      |
| Connectors are on their own endpoint (`/v2/boards/{id}/connectors`), not in `/items`.                                                                                                       | Verified                              | [M10]      |

**Implication:** the Worker is needed once per connection, for the code
exchange (it holds the client secret). Every read afterwards goes browser to
Miro. The refresh token can stay in browser memory for the session; nothing
needs storing in D1.

### B3. Item types

From the OpenAPI spec [M10] (last commit 2026-04-22) and the Web SDK
"Unsupported" page [M11] (2026-03-19):

| Miro item                                 | REST v2 readable?  | What comes back                                                                                                                                                 | Status                                  |
| ----------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Sticky note                               | Yes                | HTML `content`, `shape` square/rectangle, 16 named `fillColor`s, text alignment, geometry                                                                       | Verified                                |
| Shape                                     | Yes                | 21 basic shapes (rectangle, circle, rhombus, can, cloud, star, braces, arrows ...), fill/border style, font, HTML content                                       | Verified                                |
| Flowchart shapes                          | Experimental       | `/v2-experimental/boards/{id}/shapes`                                                                                                                           | Verified                                |
| Text                                      | Yes                | HTML `content`, colour, fill, font family and size, alignment                                                                                                   | Verified                                |
| Connector                                 | Yes                | start/end item id + **relative snap point** (`x`,`y` 0 to 100%), `shape` straight/elbowed/curved, caps, stroke, **captions** (HTML, position %, vertical align) | Verified                                |
| Connector waypoints, canvas-anchored ends | No                 | `isSupported: false` connectors "might not return ... intermediate points and connection points to the canvas"                                                  | Verified                                |
| Frame                                     | Yes                | `title`, `format`, `type` (only freeform custom frames supported); children via `parent`                                                                        | Verified                                |
| Image                                     | Yes, bytes via URL | `imageUrl` needs the token; `format=original` for the original; `redirect=false` returns a URL valid **60 s**                                                   | Verified                                |
| Image bytes readable cross-origin         | Unknown            | host of the 60-second URL is not documented                                                                                                                     | Unverified, E-B1                        |
| Card                                      | Yes                | title, description, due date, assignee id                                                                                                                       | Verified                                |
| App card                                  | Yes                | title, description, custom fields, status                                                                                                                       | Verified                                |
| Embed                                     | Yes                | `url`, `html`, provider, `previewUrl`, mode                                                                                                                     | Verified                                |
| Document (uploaded PDF etc.)              | Yes                | `documentUrl` with token                                                                                                                                        | Verified                                |
| Doc format (Miro doc)                     | Yes                | structured content                                                                                                                                              | Verified                                |
| Mind map nodes                            | Experimental       | `/v2-experimental/boards/{id}/mindmap_nodes`: text nodes, `isRoot`, `direction`                                                                                 | Verified                                |
| Code widget                               | Experimental       | code, language, title                                                                                                                                           | Verified                                |
| Groups                                    | Yes                | `/groups` endpoints (livediagram has no groups, so dropped)                                                                                                     | Verified                                |
| Tags                                      | Yes                | `/tags`                                                                                                                                                         | Verified                                |
| **Pen / freehand strokes**                | **No**             | Web SDK lists "Stroke" as unsupported; third party reports REST returns `paint` items with no geometry                                                          | Verified (SDK); Unverified (REST shape) |
| Link previews (`preview`)                 | Partly             | listed in the `type` filter; third party reports `isSupported:false` and no data                                                                                | Unverified                              |
| Tables, table text                        | No                 | Web SDK "Unsupported"; `data_table_format` appears only as a filter value                                                                                       | Verified (SDK)                          |
| Kanban, mockups, emoji, USM               | No                 | Web SDK "Unsupported"                                                                                                                                           | Verified                                |
| Comments                                  | No board endpoint  | only Enterprise export / content logs                                                                                                                           | Verified                                |

The third-party census of one real board found **54% of items content-free**
through REST (219 pen strokes and 91 link previews), against a full clipboard
decode [M9]. Unverified by us, but consistent with Miro's own "Unsupported" list.

### B4. Importer

Specified in [Miro import](../specs/020-import-export/miro-import.md), on the
shared stages of [Board import](../specs/020-import-export/board-import.md).

## C. Microsoft Whiteboard import

### C1. Retirement of personal-account Whiteboard

| Claim                                                                                                                                                                                                                                                                                                                        | Status                                                                               | Source     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------- |
| In-product banner for Microsoft accounts: "Microsoft Whiteboard for Microsoft account is being retired. Starting from September 25, 2026, you will no longer be able to create or edit whiteboards. Please export any whiteboards you'd like to keep before October 16, 2026, after which they will be permanently deleted." | Verified (shipped `en-us` strings, key `AzureDeprecation.InBoard.Phase1.MsaMessage`) | [W15]      |
| Current phase for Microsoft accounts: "Whiteboards are now read-only. Export any whiteboards you want to keep by October 16, 2026. After that, they will be permanently deleted."                                                                                                                                            | Verified (`...Phase2.MsaMessage`)                                                    | [W15]      |
| Azure-stored boards become read-only on 2026-09-25, are permanently deleted on **2026-10-16**, and the Azure Whiteboard service shuts down on 2026-11-30.                                                                                                                                                                    | Verified                                                                             | [W14]      |
| The standalone **Windows, iOS and Android apps retired on 2026-09-14**; Whiteboard on the web and in Teams remain until the deletion.                                                                                                                                                                                        | Verified                                                                             | [W14]      |
| Personal-account boards are stored in Azure and reachable only in the app, never as files.                                                                                                                                                                                                                                   | Verified                                                                             | [W8], [W9] |
| Microsoft's own advice for boards it will delete: Settings, Export image, before 2026-10-16.                                                                                                                                                                                                                                 | Verified                                                                             | [W14]      |

### C2. What the web app exports today

Read from the shipped web app (`whiteboard.cloud.microsoft`, build
26.10910.101) and its `en-us` strings on 2026-09-27; see E-4.

| Claim                                                                                                                                                                                                                                                   | Status                                                                                            | Source      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| Settings (gear) shows **Export**, which opens **Export board as** with two groups: **Quick export** ("Easy to save and share.") and **Full export**.                                                                                                    | Verified                                                                                          | [W15]       |
| Quick export, **Image**: a PNG, "Standard resolution. Good for email." (longest side up to **5,000 px**) or "High resolution. File size may be large." (up to **16,200 px**).                                                                           | Verified (constants `r=5e3`, `a=16200` logged as `MaxDimension`, `Type: PNG`)                     | [W15]       |
| Quick export, **PDF**: only in the Windows desktop app or on Surface Hub, behind a feature flag and minimum app version. Not on the web; the desktop app is retired.                                                                                    | Verified                                                                                          | [W15]       |
| Full export, **Zip (HTML+JSON)**: "Includes comments (JSON), alt text, and links that can be utilized for data analysis or exporting to another application." Hidden only in the iOS and Android apps and Teams on mobile.                              | Verified                                                                                          | [W15]       |
| The Zip holds `<title>.html`, a clone of the rendered canvas with images inlined as data URLs, Loop and app frames replaced by placeholders, over the canvas background SVG; and `<title>-comments.json` with comment threads keyed to ids in the HTML. | Verified (export code)                                                                            | [W15]       |
| Ink in the rendered canvas is vector SVG paths; notes and text are HTML.                                                                                                                                                                                | Unverified here (third-party report, consistent with the export code cloning the DOM)             | [W11]       |
| The Zip is offered, and completes, on a read-only personal board.                                                                                                                                                                                       | Unverified (the menu shows it wherever the board may be printed; the operator's export will tell) | E-C1        |
| Items outside the viewport are present in the HTML (the canvas may not render off-screen items).                                                                                                                                                        | Unverified                                                                                        | E-C1        |
| No SVG export exists in the current web app (the 2023 admin doc's "Export image (SVG)" is gone); the only export type logged is PNG.                                                                                                                    | Verified (absence in the export code)                                                             | [W15], [W3] |
| No bulk export: one board at a time.                                                                                                                                                                                                                    | Verified (every export acts on the open board)                                                    | [W15]       |

### C3. Other routes, for completeness

| Claim                                                                                                                                                                                                         | Status                   | Source           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| Graph converts work or school `.whiteboard` files (OneDrive for Business) to HTML or PDF (`content?format=html`), and Microsoft's `Export-WhiteboardHtml` cmdlet wraps it. Not applicable to personal boards. | Verified                 | [W4], [W5], [W6] |
| A 302 from Graph `/content` cannot be followed by a browser `fetch` with an `Authorization` header (CORS).                                                                                                    | Verified                 | [W12], [W4]      |
| The web app's internal API returns Fluid op batches; a third-party MIT tool bulk-exports screenshots, a reconstructed SVG and the raw ops with a token taken from the signed-in browser.                      | Unverified (third party) | [W11]            |

### C4. Import route

Specified in [Microsoft Whiteboard import](../specs/020-import-export/whiteboard-import.md):
v1 imports the exported **PNG** as one image. The Full export Zip is the richer
source (editable ink and notes) but its HTML is Whiteboard's internal markup,
so its mapping is specified only once real exports exist. Because the boards
disappear on 2026-10-16, both files must be exported now, whatever is built
later.

### Exporting personal boards before 2026-10-16

For the operator, and the basis of the help article. Do it in the browser; the
Windows app is retired.

1. On a desktop browser (Edge or Chrome), open
   [whiteboard.cloud.microsoft](https://whiteboard.cloud.microsoft) and sign in
   with the **personal** Microsoft account. Note how many boards the picker lists.
2. Make a folder, for example `Whiteboard export 2026-10`, and set the browser
   to ask where to save downloads (so each file can go there with a unique name).
3. For each board, in turn:
   1. Open it and wait until it has fully loaded, then zoom out until the whole
      board is on screen.
   2. Settings (gear, top right), **Export**, **Full export**, **Zip
      (HTML+JSON)**. Save it as `NN title.zip` (a number keeps boards with the
      same title apart).
   3. Settings, **Export**, **Quick export**, **Image**, **High resolution**,
      **Export**. Save it as `NN title.png`.
   4. Open the Zip's `.html` in the browser and check that ink, notes, text and
      images are all there. If it says "Failed to embed image" or content is
      missing, zoom to fit and export the Zip again.
4. When the count of Zips and PNGs matches the picker's count, copy the folder
   to a second place (Google Drive, a USB disk).
5. Finish well before **2026-10-16**; after that Microsoft deletes the boards
   and nothing can be recovered.
6. If the menu shows only "Export image" or no Full export, export the high
   resolution PNG, note which boards lacked the Zip, and tell the lead session.

Optional, only if there are too many boards to do by hand: the third-party
[PanoramicData.MicrosoftWhiteboardExport](https://github.com/panoramicdata/PanoramicData.MicrosoftWhiteboardExport)
(MIT) bulk-exports every board. It drives a signed-in browser and reads the
app's token, so read its code before running it; it is an archive aid, not
something livediagram depends on.

## Experiments run

- **E-1 Drive CORS preflights** (2026-09-27): `curl -X OPTIONS` with
  `Origin: https://livediagram.app` against
  `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
  `...uploadType=resumable` and `https://www.googleapis.com/drive/v3/changes`:
  all `200`, `access-control-allow-origin: https://livediagram.app`, methods
  `DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT`, headers
  `authorization,content-type,x-upload-content-type`, max-age 3600. An
  unauthenticated resumable POST returned `401` with ACAO set and
  `access-control-expose-headers: Content-Length, Date, Server,
Transfer-Encoding, X-GUploader-UploadID, ...` (no `Location` on a 401).
- **E-2 Miro CORS** (2026-09-27): preflight to
  `https://api.miro.com/v2/boards/{id}/items`: `200`, ACAO `*`, methods
  `POST,GET,PUT,PATCH,DELETE`, header `authorization`, max-age 1800.
  Unauthenticated `GET /v2/boards`: `401` with ACAO `*`. Preflight to
  `https://api.miro.com/v1/oauth/token`: `401`, no CORS headers.
- **E-3 Microsoft module source** (2026-09-27): downloaded
  `WhiteboardAdmin` 1.14.1 from the PowerShell Gallery; `Export-WhiteboardHtml.psm1`
  lists `drive/root:/Whiteboards:/children`, keeps `*.whiteboard` and `*.wbtx`, then
  calls `.../items/{id}/content?format=html`.
- **E-4 Whiteboard web app bundle** (2026-09-27): fetched the public shell of
  `https://whiteboard.cloud.microsoft/` (script `app.v26.10910.101.js`), its
  webpack chunk map, 975 of 978 chunks from `/whiteboard-app/chunks/`, and the
  strings at `/blueboard/26.10910.101/resources/locales/en-us/main.json`. Read:
  `ExportSizesDialog` (PNG, `MaxDimension` 5,000 or 16,200), the `callouts`
  chunk's export panel (Image always; PDF behind `EnableWindowsHostExportPDF`
  in the desktop or Surface Hub host only; Zip unless iOS, Android or Teams
  mobile) and its Zip writer (`getCanvasContentClone`, images to data URLs,
  `<title>.html` plus `<title>-comments.json`), and the `AzureDeprecation`
  strings. No sign-in was used; nothing was sent to the service beyond static
  file requests.

## Experiments still needed

| Id   | Experiment                                                                                                                                    | Needs                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| E-A1 | `changes.list` with `drive.file`: create, rename, move, trash a folder with children, restore, empty bin, edit in another app; record entries | Google Cloud test project, test user  |
| E-A2 | Refresh-token broker round trip on a Worker (code flow, AES-GCM at rest, refresh, revoke)                                                     | same                                  |
| E-A3 | Does `getStartPageToken` advance on changes to files the app cannot see? (cheap 5-unit poll gate)                                             | same                                  |
| E-A4 | Resumable upload from the browser: is `Location` exposed on the `200` session response?                                                       | same                                  |
| E-A5 | Custom MIME type and `.livediagram` extension in Drive UI integration; single-click, double-click, "Open with" behaviour                      | same, public HTTPS Open URL (staging) |
| E-A6 | A second Cloud project (self-host) cannot see files created by the first                                                                      | two projects                          |
| E-B1 | Miro image URL (`redirect=false`, `format=original`): host and CORS headers of the 60-second URL                                              | Miro developer team app               |
| E-B2 | Token scope across teams; REST shape of pen strokes and link previews on a real board                                                         | same                                  |
| E-C1 | Full export Zip on a read-only personal board: offered, complete (off-screen items, images), and the HTML's structure for the mapping         | the operator's exports                |
| E-C2 | Graph HTML conversion output structure (work or school only; parked)                                                                          | work or school account                |

## Open questions

Tracked here until answered; each answer moves into a spec.

1. **Whiteboard picture size:** at the shared 2,048 px limit, handwriting on a
   large board becomes unreadable. Keep it, raise it for whole-board pictures, or
   tile the picture?
2. **Whiteboard and the image cap:** the hosted cap is 100 images per owner, so
   more than 100 boards cannot all arrive as pictures. Accept placeholders, or
   treat board pictures differently?
3. **Whiteboard Zip:** once the operator's Zips are in, specify a structured
   import of them (editable ink and notes)?

## Sources

All fetched 2026-09-27. "Updated" is the page's own date where it shows one.

| Id  | Page                                                                                                                                                                                              | Updated              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| G1  | [Drive API-specific auth (scopes)](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)                                                                                    | 2026-09-03           |
| G2  | [OAuth App Verification Help Center](https://support.google.com/cloud/answer/13463073)                                                                                                            | not shown            |
| G3  | [Unverified apps](https://support.google.com/cloud/answer/7454865)                                                                                                                                | not shown            |
| G4  | [Manage App Audience](https://support.google.com/cloud/answer/15549945)                                                                                                                           | not shown            |
| G5  | [Verification requirements](https://support.google.com/cloud/answer/13464321)                                                                                                                     | not shown            |
| G7  | [When is verification not needed](https://support.google.com/cloud/answer/13464323)                                                                                                               | not shown            |
| G8  | [Security Assessment](https://support.google.com/cloud/answer/13465431)                                                                                                                           | not shown            |
| G9  | [Verification FAQ](https://support.google.com/cloud/answer/13463817)                                                                                                                              | not shown            |
| G11 | [Manage OAuth App Branding](https://support.google.com/cloud/answer/10311615)                                                                                                                     | not shown            |
| G12 | [OAuth Application Rate Limits](https://support.google.com/cloud/answer/9028764)                                                                                                                  | not shown            |
| G13 | [Configure a Drive UI integration](https://developers.google.com/workspace/drive/api/guides/enable-sdk)                                                                                           | 2026-09-03           |
| G14 | [Integrate with "Open with"](https://developers.google.com/workspace/drive/api/guides/integrate-open)                                                                                             | 2026-09-03           |
| G15 | [Marketplace overview](https://developers.google.com/workspace/marketplace/overview)                                                                                                              | 2026-09-03           |
| G16 | [Marketplace app review](https://developers.google.com/workspace/marketplace/about-app-review)                                                                                                    | 2026-09-03           |
| G17 | [Publish to the Marketplace](https://developers.google.com/workspace/marketplace/how-to-publish)                                                                                                  | 2026-09-03           |
| G18 | [GIS: use the token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)                                                                                              | 2026-05-26           |
| G19 | [GIS overview](https://developers.google.com/identity/oauth2/web/guides/overview)                                                                                                                 | 2026-05-26           |
| G20 | [GIS JavaScript reference](https://developers.google.com/identity/oauth2/web/reference/js-reference)                                                                                              | 2025-08-20           |
| G21 | [Migrate to GIS](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis)                                                                                                       | 2025-09-05           |
| G22 | [GIS supported browsers](https://developers.google.com/identity/gsi/web/guides/supported-browsers)                                                                                                | 2026-09-01           |
| G23 | [OAuth 2.0 for web server apps](https://developers.google.com/identity/protocols/oauth2/web-server)                                                                                               | 2026-09-14           |
| G24 | [OAuth 2.0 overview](https://developers.google.com/identity/protocols/oauth2)                                                                                                                     | 2026-05-26           |
| G25 | [GIS: use the code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model)                                                                                                | 2026-01-28           |
| G26 | [changes.list reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list)                                                                                        | 2026-07-07           |
| G27 | [Retrieve changes](https://developers.google.com/workspace/drive/api/guides/manage-changes)                                                                                                       | 2026-09-03           |
| G28 | [Change resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes)                                                                                                    | not shown            |
| G29 | [File resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)                                                                                                        | 2026-07-14           |
| G30 | [Trash or delete files](https://developers.google.com/workspace/drive/api/guides/delete)                                                                                                          | 2026-09-03           |
| G31 | [Custom file properties](https://developers.google.com/workspace/drive/api/guides/properties)                                                                                                     | 2026-09-03           |
| G32 | [Drive API usage limits](https://developers.google.com/workspace/drive/api/guides/limits)                                                                                                         | 2026-09-11           |
| G33 | [Workspace standardized model for agent tools and APIs](https://developers.google.com/workspace/tools-safety)                                                                                     | 2026-09-03           |
| G34 | [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads)                                                                                                       | 2026-09-03           |
| G35 | [Manage file metadata (thumbnails)](https://developers.google.com/workspace/drive/api/guides/file-metadata)                                                                                       | 2026-09-03           |
| C1  | [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)                                                                                                         | 2026-08-28           |
| C2  | [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)                                                                                                                   | 2026-04-21           |
| C3  | [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)                                                                                         | 2026-08-25           |
| M1  | [Miro: How to save board backup](https://help.miro.com/hc/en-us/articles/360017572774)                                                                                                            | 2026-09-08           |
| M2  | [Miro: How to export your board](https://help.miro.com/hc/en-us/articles/360017572754)                                                                                                            | 2026-09-08           |
| M3  | [Miro: Board Export API overview](https://help.miro.com/hc/en-us/articles/17774560667794)                                                                                                         | 2026-09-08           |
| M4  | [Miro OpenAPI: create board export job](https://developers.miro.com/reference/enterprise-create-board-export)                                                                                     | spec 2026-04-22      |
| M5  | [Miro: Get started with OAuth 2.0](https://developers.miro.com/docs/getting-started-with-oauth)                                                                                                   | "6 months ago"       |
| M6  | [Miro: Share an app outside of a developer team](https://developers.miro.com/docs/share-an-app-outside-of-a-developer-team)                                                                       | "6 months ago"       |
| M7  | [Miro: Permission scopes](https://developers.miro.com/reference/scopes)                                                                                                                           | "6 months ago"       |
| M8  | [Miro: Rate limiting](https://developers.miro.com/reference/rate-limiting)                                                                                                                        | "6 months ago"       |
| M9  | [Velm: Miro's formats, reverse-engineered](https://github.com/ibrahimbisen/Velm/blob/HEAD/docs/02-miro-formats.md) (third party, Apache-2.0)                                                      | 2026-07-30           |
| M10 | [Miro OpenAPI spec (`miroapp/api-clients`)](https://github.com/miroapp/api-clients/blob/main/packages/generator/spec.json)                                                                        | commit 2026-04-22    |
| M11 | [Miro Web SDK: Unsupported](https://developers.miro.com/docs/websdk-reference-unsupported)                                                                                                        | 2026-03-19           |
| M12 | [Miro Terms of Service, 2.9 Restrictions](https://miro.com/legal/terms-of-service/)                                                                                                               | effective 2021-09-01 |
| M13 | [Miro Developer Terms of Use, 3.3](https://miro.com/legal/developer-terms-of-use/)                                                                                                                | effective 2022-11-25 |
| W3  | [Whiteboard GDPR requests](https://learn.microsoft.com/en-us/microsoft-365/whiteboard/gdpr-requests)                                                                                              | 2023-02-17           |
| W4  | [Graph: download a file in another format](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content-format)                                                                              | not shown            |
| W5  | [Export-WhiteboardHtml](https://learn.microsoft.com/en-us/powershell/module/whiteboardadmin/export-whiteboardhtml)                                                                                | 2026-05-28           |
| W6  | [WhiteboardAdmin 1.14.1 package](https://www.powershellgallery.com/packages/WhiteboardAdmin)                                                                                                      | package              |
| W8  | [Save a whiteboard](https://support.microsoft.com/en-us/whiteboard/save-a-whiteboard)                                                                                                             | not shown            |
| W9  | [Differences between Azure and OneDrive whiteboards](https://support.microsoft.com/en-us/whiteboard/differences-between-azure-and-onedrive-work-or-school-whiteboards)                            | not shown            |
| W11 | [PanoramicData.MicrosoftWhiteboardExport](https://github.com/panoramicdata/PanoramicData.MicrosoftWhiteboardExport) (third party, MIT)                                                            | 2026-07-27           |
| W12 | [Graph: download driveItem content](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content)                                                                                            | not shown            |
| W14 | [Migration of Whiteboards from Azure to OneDrive](https://support.microsoft.com/en-us/whiteboard/migration-of-whiteboards-from-azure-to-onedrive)                                                 | not shown            |
| W15 | [Whiteboard web app](https://whiteboard.cloud.microsoft/) build 26.10910.101 and its [en-us strings](https://whiteboard.cloud.microsoft/blueboard/26.10910.101/resources/locales/en-us/main.json) | build 26.10910.101   |
