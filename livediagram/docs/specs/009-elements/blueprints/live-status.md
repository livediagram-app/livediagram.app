# Live service status: blueprint

Derived from [Live service status](../live-status.md). The spec decides; this file only adds engineering precision.

Scope, by file:

| File                                                                                     | Role                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/model-core/src/public-https-url.ts`                                         | `parsePublicHttpsUrl`, `INTERNAL_HOST_SUFFIXES`: the address shape check, shared with liveworkspace's webhooks                                                                                                                   |
| `packages/document/src/element-types.ts`                                                 | `ShapeElement.statusUrl`                                                                                                                                                                                                         |
| `packages/document/src/status-source.ts`                                                 | `STATUS_URL_MAX`, `isStatusUrl`, `statusUrlsOf`                                                                                                                                                                                  |
| `packages/document/src/validate-shape.ts`                                                | The `statusUrl` field check                                                                                                                                                                                                      |
| `packages/document/src/element-fields.ts`                                                | `statusUrl` in the shape's field list, so edit operations may set it                                                                                                                                                             |
| `packages/document/src/participant-content.ts`                                           | `PARTICIPANT_NEVER_FIELDS`: kept as stored on a Participant's update, dropped from its add                                                                                                                                       |
| `packages/api-schema/src/service-status.ts`                                              | `ServiceState`, `ServiceStatus`, `ServiceStatusReason`, the constants, `classifyStatusAnswer`, `readStatusBody`, `currentServiceState`                                                                                           |
| `../liveworkspace/apps/index/src/webhooks/address.ts`                                    | `parseWebhookUrl` over `parsePublicHttpsUrl`, adding its Slack and Teams host rules                                                                                                                                              |
| `apps/api/src/openapi/schemas.generated.ts`                                              | Regenerated: `statusUrl` on the shape schema                                                                                                                                                                                     |
| `apps/api/src/document-room/room-service-status.ts`                                      | `RoomServiceStatus` (rounds, join, save, leave, restore), `roomServiceStatus(room)` (its wiring to the room and the `LIVE_STATUS_ENABLED` switch), `readStatusSources`, `checkStatusUrl`, `SERVICE_STATUS_KEY` and the constants |
| `apps/api/src/document-room/document-room.ts`                                            | `serviceStatus = roomServiceStatus(this)`, restored behind the order state                                                                                                                                                       |
| `apps/api/src/document-room/room-lifecycle.ts`                                           | `serviceStatus.at` among the alarm's times; the round last in `alarm`; `forget` on purge                                                                                                                                         |
| `apps/api/src/document-room/room-message.ts`                                             | `serviceStatus.join(ws)` on hello                                                                                                                                                                                                |
| `apps/api/src/document-room/room-content-state.ts`                                       | `serviceStatus.noteWrite()` on every content write                                                                                                                                                                               |
| `apps/api/src/document-room/room-roster.ts`                                              | `serviceStatus.left(ws)` when a socket closes                                                                                                                                                                                    |
| `apps/api/src/types.ts`, `apps/api/hosted-vars.json`                                     | `LIVE_STATUS_ENABLED`: on the `Env`, and `"true"` in the hosted profile's shared vars only                                                                                                                                       |
| `../packages/api-kit/src/pooled.ts`                                                      | `pooled(tasks, limit)`: a round's checks three at a time (shared with the status Worker and the index)                                                                                                                           |
| `packages/api-schema/src/room-op-kinds.ts`, `room-op.ts`                                 | `service-status` in `SYSTEM_OP_KINDS`; `ServiceStatusOp` in `RoomOp`                                                                                                                                                             |
| `packages/api-schema/src/index.ts`, `apps/api/src/routes/capabilities.ts`                | `CapabilitiesResponse.liveStatusEnabled`: `env.LIVE_STATUS_ENABLED === 'true'`                                                                                                                                                   |
| `apps/editor/lib/service-status-store.ts`                                                | `parseServiceStatuses`, `createServiceStatusStore`, `ServiceStatusContext`, `SERVICE_STATUS_TICK_MS`                                                                                                                             |
| `apps/editor/lib/service-status-copy.ts`                                                 | `serviceStatusCopy(status, url, now)`: the badge's word, name and tooltip lines                                                                                                                                                  |
| `apps/editor/lib/live-status-input.ts`                                                   | `readStatusUrlInput(raw)`: the dialog's check, over `parsePublicHttpsUrl`; `canBindLiveStatus(el)`                                                                                                                               |
| `apps/editor/app/document/[id]/room-op-receive.ts`                                       | The `service-status` branch, `from: 'system'` only, to `receiveServiceStatus`                                                                                                                                                    |
| `apps/editor/app/document/[id]/editor-state/useEditorRoom.ts`                            | The page's one store, fed by the room, in the view as `serviceStatuses`                                                                                                                                                          |
| `apps/editor/app/document/[id]/EditorView.tsx`                                           | `ServiceStatusContext.Provider` around the canvas                                                                                                                                                                                |
| `apps/editor/components/canvas/ServiceStatusBadge.tsx`                                   | The badge, drawn by `boxed-element-chrome.tsx` on a bound shape                                                                                                                                                                  |
| `apps/editor/components/dialogs/LiveStatusDialog.tsx`                                    | The Editor's dialog, opened from `EditorElementDialogs.tsx` on `liveStatusOpenForId` (`editor-ui-state.ts`)                                                                                                                      |
| `apps/editor/components/palette/ElementMenuQuickBar.tsx`, `EditorContextMenuHost.tsx`    | `quickBarItems`' Live Status row, offered through `onEditLiveStatus` when `canBindLiveStatus` and `liveStatusEnabled`                                                                                                            |
| `packages/help-registry/src/index.ts`, `apps/help/app/canvas/links/live-status/page.mdx` | The help article                                                                                                                                                                                                                 |
| `packages/agent-verbs/src/mcp/schema.ts`                                                 | `statusUrl` named among the element format's fields                                                                                                                                                                              |

## Domain and naming

| Term    | Identifier                | Meaning                                                                 |
| ------- | ------------------------- | ----------------------------------------------------------------------- |
| Binding | `ShapeElement.statusUrl`  | The public https URL a shape is bound to                                |
| Source  | a distinct `statusUrl`    | What a round checks once, however many shapes share it                  |
| State   | `ServiceState`            | `'up' \| 'degraded' \| 'down' \| 'unknown'`                             |
| Status  | `ServiceStatus`           | `{ state, checkedAt, reason?, httpStatus? }`, one source's latest check |
| Round   | `RoomServiceStatus.round` | One alarm's checks of every due source, at most `STATUS_SOURCES_MAX`    |
| Live    | `RoomServiceStatus.live`  | Polling on (`LIVE_STATUS_ENABLED === 'true'`) and at least one socket   |

## Behaviour and state

- `parsePublicHttpsUrl(raw, max = 2048)`: not a string, empty after trimming, or longer than `max` is `invalid`;
  `new URL(trimmed)` throwing is `invalid`; protocol not `https:`, a user name or password, or a port other than
  empty or `443` is `invalid`. The host is lowercased with one trailing dot dropped. An IPv4 literal (four dotted
  decimal parts, after the URL parser's own normalising, so `0x7f000001` is caught), an IPv6 literal (contains `:`),
  `localhost`, a host with no `.`, or a host ending in an `INTERNAL_HOST_SUFFIXES` entry (`.local`, `.localhost`,
  `.internal`, `.lan`, `.home.arpa`, `.intranet`) is `private`. Otherwise `{ ok: true, url, host }`.
- `isStatusUrl(v)`: `parsePublicHttpsUrl(v, STATUS_URL_MAX).ok`, and `v` is already trimmed (stored values never
  carry outer whitespace).
- `statusUrlsOf(tabs, max)`: the distinct `statusUrl`s of every shape across the tabs, in tab then element order,
  at most `max`; the scan stops at `max`. Linear in elements.
- The participant rule: `PARTICIPANT_NEVER_FIELDS = ['statusUrl']`. `mergeOwn` copies each from the stored
  element (absent stays absent); `applyAdd` deletes each from the stamped element. `mergeOthers` never copies it
  because it is in no permitted list.
- `classifyStatusAnswer(result, now)` over api-kit's `PublicFetchResult`:
  - `ok`: `readStatusBody(bytes)`; `too_large` is `up` (the body cap is checked only after a 2xx).
  - `http_status` is `down` with `httpStatus` when given; `timeout`, `unreachable`, `unresolved` are `down` with
    that reason.
  - `too_many_redirects` (any redirect, since rounds pass `maxRedirects: 0`) is `unknown`, reason `redirect`;
    `private_address`, `invalid_url`, `not_https` are `unknown`, reason `refused`.
- `readStatusBody(bytes)`: decoded as UTF-8 (non-fatal); trimmed; not starting `{` is `up`; `JSON.parse` throwing
  is `up`. A record whose `status` is a record with a string `indicator` maps the indicator (`none` up; `minor`,
  `maintenance` degraded; `major`, `critical` down; another word up). Otherwise the first of `status`, `state`,
  `health` that is a string is looked up in the word sets; a word in none, or no such field, is `up`. Any state but
  `up` from the body carries reason `reported`.
- `currentServiceState(status, now)`: `unknown` when there is no status or `now - checkedAt` passes its stale age:
  `STATUS_TIMEOUT_STALE_MS` for a state with reason `timeout`, `STATUS_STALE_MS` for any other; otherwise the stored
  state.

### The room's rounds (part 2)

State: `at` (the next round, null for none, in memory), `statuses` (`Map<url, ServiceStatus>`) and `timeouts`
(`Map<url, number>`, the checks in a row that timed out), both mirrored to the storage key `service-status` as one
record (each entry the status, plus `timeouts` when above 0; the field never leaves the room). A URL's wait is
`statusWaitMs(timeouts)`: `min(STATUS_POLL_MS * 2^timeouts, STATUS_BACKOFF_MAX_MS)`, so 1, 2, 4, then 8 minutes. A URL
is due when it has no status or `checkedAt + wait <= now`. `nextDue(urls)` is the least of `checkedAt + wait`, or now
for a URL without a status. `bring(t)` sets
`at` to `t` only when `at` is null or later, then re-arms the room's alarm (which floors it a second ahead).

- `readStatusSources(sql, documentId)`: one query over `document_tabs` joined to `tabs`, `instr(data, '"statusUrl"')`
  picking the tabs that may hold a binding, in `order_index` then tab id order; each such tab parsed once, its
  elements (records only) through `statusUrlsOf(…, Infinity)`. A tab that doesn't parse or has no element list is
  skipped. `checked` is the first `STATUS_SOURCES_MAX` distinct URLs, `overflow` the rest, `byTab` each tab's own.
- `restore()` (in the constructor's `blockConcurrencyWhile`, before the first `armAlarm`): reads the key, keeping
  entries with a string `state` and numeric `checkedAt` (and a positive whole `timeouts` apart from the status); when any are kept and the room is live, `at = nextDue(kept)`,
  so a room woken by a message keeps the alarm its round set.
- `join(ws)` (on every hello): off, or no binding on any tab: nothing. Otherwise sends the session its states (below)
  and, when anything is checked, `bring(nextDue(checked))`: a URL never checked is due now (the alarm's floor makes
  it a second), so a join after an idle spell checks within a second.
- `noteWrite()` (every content write): when live, `bring(now + STATUS_BIND_DELAY_MS)`. The round it brings checks only
  due URLs, so a save checks a new binding and nothing else.
- `left(ws)` (socket closed): when `at` is set and no other socket remains, `at = null` and re-arm, so an idle room
  keeps no alarm for its checks.
- `alarm(now)` (the room's alarm, after every other duty): nothing unless `at <= now`; a round already running is
  awaited rather than started twice. The round: `at = null`; not live, return (nothing fetched, nothing re-armed);
  read the sources; drop each status whose URL is no longer in `checked`; check the due URLs through `pooled`,
  `STATUS_CHECKS_AT_ONCE` at a time, each stamped `checkedAt = now`; a check with reason `timeout` adds one to the
  URL's `timeouts`, any other result clears it (a dropped URL loses it too); persist when anything was checked or dropped
  (`delete` when none is left); when anything was checked, send every hello'd socket its states; then, when any URL
  is bound, `bring(nextDue(checked))`.
- A check: a URL `isStatusUrl` refuses (stored before a rule tightened) is never fetched: Unknown, `refused`.
  Otherwise `classifyStatusAnswer(await checkStatusUrl(url), now)`; a check that throws is Down, `unreachable`.
- `checkStatusUrl(url)`: `fetchPublicBytes` with `maxBytes: STATUS_BODY_MAX`, `timeoutMs: STATUS_TIMEOUT_MS`,
  `maxRedirects: 0`, `User-Agent: STATUS_USER_AGENT` and `Accept: application/json, */*;q=0.5`; the DNS over HTTPS
  check (A and AAAA) runs before the request, and a Worker's fetch carries no cookie.
- The states a session is sent: its scope (`scopeOf`) null means every URL in `checked` and `overflow`; a scope means
  `byTab.get(scope)`. Each checked URL with a status, each overflow URL as `{ state: 'unknown', checkedAt: now,
reason: 'too_many_sources' }`. Nothing is sent when that is empty. The frame is `{ kind: 'op', from: 'system', op:
{ kind: 'service-status', statuses } }`, sent with `sendTo`, so the scope filter (which withholds a tab-less op) is
  never asked.
- `forget()` (purge): clears `statuses` and `at`; the purge's `deleteAll` takes the key.

## Interfaces and contracts

- `ServiceStatusOp` (`@livediagram/api-schema`): `{ kind: 'service-status'; statuses: Record<string, ServiceStatus> }`,
  keyed by the stored `statusUrl` exactly as bound.
- `Env.LIVE_STATUS_ENABLED?: string`: only `"true"` turns rounds on.

## Data and persistence

- Storage key `service-status`: `Record<url, ServiceStatus>`, at most `STATUS_SOURCES_MAX` entries, each key at most
  2,048 characters with a few fields (under 60 KB in all, inside a value's 128 KiB). Live state: never in the
  document, a copy, an export or a snapshot; gone with the purge.

## Errors and edge cases

- Polling off: `join`, `noteWrite` and the round return before reading anything; no alarm is set for it; the binding
  is kept as stored.
- The last socket leaving mid-round: the round finishes, sends to nobody, and re-arms; the next round finds nobody and
  sets none.
- A tab-scoped session whose tab binds nothing is sent nothing; an unscoped one gets every bound URL's state.
- A socket that hasn't said hello is skipped by a round's fan-out and hears the states on its hello.
- Overlapping alarm calls share one round.

## Security and trust

- Only `isStatusUrl` URLs are fetched, and each fetch re-resolves the host first and refuses any private, loopback,
  link-local, carrier NAT, multicast, documentation or reserved answer (api-kit `public-address.ts`); no redirect is
  followed; the body is capped and dropped after classifying. What leaves the room is one of four states, a reason
  and an HTTP status code.
- No credentials: no cookie, no `Authorization`, a fixed `User-Agent`.
- Who binds is part 1's role rule; the room checks what the stored document holds, whoever bound it.

## Performance and limits

- An open document without bindings: one SQLite query per join and per round a save brings (`instr` over tab data,
  no parse), and no fetch.
- An open document with bindings: one round a minute, at most 25 checks, three at a time, each at most 5 s and 64 KiB,
  three subrequests each (A, AAAA, the GET): at most 75 subrequests a round, inside a Workers Paid invocation's limit.
  Worst case, every URL hanging: nine waves of 5 s, about 45 s of Durable Object duration a minute while open.
- One `service-status` frame per session per round that checked anything: a few hundred bytes per bound URL.

## Presentation and UX

- **The store.** `createServiceStatusStore()` holds `{ statuses: Record<url, ServiceStatus>, now }`. `receive(raw)`
  replaces `statuses` with `parseServiceStatuses(raw)` (each entry a string key at most `STATUS_URL_MAX`, a known
  `state`, a finite `checkedAt`, an optional known `reason` and integer `httpStatus`; anything else dropped) and sets
  `now`. While it holds any status and has a subscriber, one interval of `SERVICE_STATUS_TICK_MS` (15 s) moves `now`;
  it stops when the last subscriber leaves or the statuses empty. `getSnapshot` returns the same object until either
  changes. `useEditorRoom` makes one per page (`useState`), and `EditorView` provides it as `ServiceStatusContext`.
- **The badge.** `boxed-element-chrome.tsx` draws `<ServiceStatusBadge url />` for a `shape` whose `statusUrl` is a
  string and whose kind is not `isSelfDrawingShape`. The badge reads the context (`useSyncExternalStore`); no store, no
  status for its URL, or a zoom under `ADORNMENT_MIN_ZOOM` draws nothing. Otherwise `currentServiceState(status,
now)` picks the look. It is absolute at the bottom-right (`right: 10px`, `bottom: 0`, moved down half its height),
  18 px tall, fully rounded, white with a hairline ring (slate-800 in dark), a 6 px dot and a 10 px semibold word: Up
  emerald, Degraded amber, Down rose, Unknown slate, each the 700 ink in light and the 300 ink in dark. It sits in the
  shared `HoverCard` (title the state, description the reason, the time and the host), taking the pointer so the card
  opens, with no handler, so a press bubbles to the shape.
- `serviceStatusCopy(status, url, now)`: `{ state, word, label, title, detail }`. Words: Up, Degraded, Down, Unknown.
  The reason's words: `reported` "The service reports it", `http_status` "Answered {code}" (or "Answered with an
  error"), `timeout` "No answer in 5 seconds", `unreachable` "Couldn't connect", `unresolved` "The address doesn't
  resolve", `redirect` "This address redirects: use the address it moves to", `refused` "This address can't be
  checked", `too_many_sources` "Too many status links in this document"; stale: "Not checked recently". The time is
  "Checked just now" under 10 s, else "Checked {n} seconds ago" or "Checked {n} minute(s) ago". The host is
  `new URL(url).host`.
- **The dialog.** `LiveStatusDialog({ url, status, now, onSave, onRemove, onClose })` on the shared `Dialog` with
  `DialogHeader` (title "Live Status", the purpose line, `HelpArticleLink article="liveStatus"`, the close button), a
  `TextInput` (`type="url"`, autofocus, the current URL), the message line (the refusal in rose, else the secret
  note), the current badge row when bound, and a footer: Remove (bound only) at the left, Cancel and Save at the
  right. `readStatusUrlInput(raw)`: trimmed; empty is `{ ok: false, error: 'empty' }` (no message); an input with no
  `scheme://` gets `https://`; then `parsePublicHttpsUrl(…, STATUS_URL_MAX)`: `invalid` and `private` map to the
  spec's two messages; ok returns `url.href`. Enter and Save run the same check.
- **Who sees the row.** `canBindLiveStatus(el)`: a `shape`, not `isSelfDrawingShape`, not locked. The context menu
  host passes `onEditLiveStatus` only when `can.level === 'edit'`, `useCapabilities().liveStatusEnabled` and
  `canBindLiveStatus(target)`; `quickBarItems` adds the `live-status` row (label "Live Status…", detail "Whether its
  service is up", `on` when bound) only when it is passed. `EditorElementDialogs` renders the dialog for
  `liveStatusOpenForId` while `can.level === 'edit'` and the element passes `canBindLiveStatus`, and
  `useCloseVanishedDialogs` closes it otherwise.
- **Writes.** Save: `commitElements` mapping the one id to `{ ...el, statusUrl }`, then `track('Element', 'Linked',
'LiveStatus')`. Remove: the same, deleting the field, then `track('Element', 'Cleared', 'LiveStatus')`.

## Accessibility

- The badge: `role="img"`, `aria-label` from `serviceStatusCopy` ("Live status: Down"); the word is visible text, so
  colour is never the only cue; no motion.
- The dialog: the shared `Dialog`'s focus trap and Escape; the field's `aria-invalid` and `aria-describedby` point at
  the message line; Save's disabled state follows the check.

## Observability

- `[service-status] round` (debug) with `checked`, `down` and `overflow` counts after each round that checked
  anything; never a URL or a body.
- Telemetry: `Element · Linked · LiveStatus` on save and `Element · Cleared · LiveStatus` on remove, charted on the
  liveworkspace telemetry page as "Live Status Bindings"
  (`../liveworkspace/apps/site/app/telemetry/livediagram/catalogue/content.ts`).

## Constants and configuration

| Name                      | Value                                                   | Where                     |
| ------------------------- | ------------------------------------------------------- | ------------------------- |
| `STATUS_URL_MAX`          | 2,048                                                   | `status-source.ts`        |
| `STATUS_POLL_MS`          | 60,000                                                  | `service-status.ts`       |
| `STATUS_STALE_MS`         | 180,000                                                 | `service-status.ts`       |
| `STATUS_BACKOFF_MAX_MS`   | 480,000                                                 | `service-status.ts`       |
| `STATUS_TIMEOUT_STALE_MS` | 600,000                                                 | `service-status.ts`       |
| `STATUS_SOURCES_MAX`      | 25                                                      | `service-status.ts`       |
| `STATUS_TIMEOUT_MS`       | 5,000                                                   | `service-status.ts`       |
| `STATUS_BODY_MAX`         | 65,536                                                  | `service-status.ts`       |
| `STATUS_BIND_DELAY_MS`    | 3,000                                                   | `service-status.ts`       |
| `STATUS_CHECKS_AT_ONCE`   | 3                                                       | `room-service-status.ts`  |
| `STATUS_USER_AGENT`       | `livediagram-status/1.0 (+https://www.livediagram.app)` | `room-service-status.ts`  |
| `SERVICE_STATUS_KEY`      | `service-status`                                        | `room-service-status.ts`  |
| `SERVICE_STATUS_TICK_MS`  | 15,000                                                  | `service-status-store.ts` |

## Testing

- `public-https-url.test.ts`: each accept and refusal above; the webhooks guard's own tests keep passing over it.
- `status-source.test.ts`: `isStatusUrl`, `statusUrlsOf` (dedupe, order, cap, non-shapes ignored); validation
  names `statusUrl`.
- `participant-content.test.ts`: a Participant's own mind node keeps its stored `statusUrl` and can't add one; the
  leak test covers every other element.
- `service-status.test.ts`: every row of the spec's answer table; a CPU-time budget on a 64 KiB body; a timed-out
  state staying Down to `STATUS_TIMEOUT_STALE_MS` while any other turns Unknown past `STATUS_STALE_MS`.
- `room-service-status.test.ts`: one check per distinct URL per round for ten viewers and two tabs; no second check
  within a minute; nothing with polling off or nobody connected (save, round, last socket leaving); a save checks
  only the new URL; the 25 cap and the overflow's Unknown; three checks at once; one round at a time; scope
  filtering; the join greeting; dropping unbound URLs and the key; refused and throwing checks; restore; purge; a
  URL that times out waiting 2, 4, then 8 minutes and back on the minute once it answers, its count kept over a
  wake; the first hour of 25 hanging URLs keeping the room busy under 8 s a minute (6.75 s measured, was 45 s);
  `readStatusSources` (order, dedupe, per tab, non-shapes, bad data, other documents, overflow); `checkStatusUrl`
  refusing a host resolving private without fetching it, following no redirect, sending no credentials; and the real
  `DocumentRoom` wired end to end, on and off.
- `hosted-vars.test.ts`: the hosted profile sets `LIVE_STATUS_ENABLED`; `wrangler.toml` commits it nowhere.
- `document-room.test.ts`: a `service-status` from a client socket is dropped, even at edit role;
  `capabilities.test.ts`: `liveStatusEnabled` only for `"true"`.
- `service-status-store.test.ts`, `service-status-copy.test.ts`, `live-status-input.test.ts`: parsing, the clock,
  every reason's words, every refusal (and a CPU-time budget on a long input).
- `room-op-receive.test.ts`: a `service-status` from the system reaches the store; one from a peer is ignored.
- `ServiceStatusBadge.test.tsx`: each state, stale to Unknown as the clock moves, nothing unbound, unchecked or at
  overview zoom, drawn on a read-only (Viewer) canvas and inside `SuppressElementIndicators` (Present).
- `LiveStatusDialog.test.tsx`: refusals as typed, save and remove, Enter, the bound badge row;
  `ElementMenuQuickBar.test.tsx`: the row only with `onEditLiveStatus`.
