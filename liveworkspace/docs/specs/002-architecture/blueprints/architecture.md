# Architecture: blueprint

Derived from [architecture.md](../architecture.md) and [integrating-an-app.md](../integrating-an-app.md). The spec decides; this file only adds engineering precision, read from the code. Defaults are cited as `ARCn`. Paths are relative to the repository root.

## Domain and naming

| Term             | Identifier                                                      | Meaning                                                                   |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Origin           | `https://www.liveworkspace.app`                                 | Production; staging is `https://staging.liveworkspace.app`                |
| Path route       | `routes` in `wrangler.toml`                                     | A Worker on a path of the zone; wins over the site's custom domain        |
| Router           | `<app>/apps/router`                                             | An app's front Worker; forwards the platform's paths on the app's address |
| Workspace proxy  | `@liveworkspace/sites/workspace-proxy`                          | The routers' one shared forwarding table                                  |
| Workspace origin | `WORKSPACE_ORIGIN`                                              | Which platform a router forwards to                                       |
| Service binding  | `[[services]]`                                                  | A direct Worker-to-Worker call, inside the account                        |
| Request guard    | `@liveworkspace/api-kit/request-failure`                        | `guardRequest`: every storage-owning Worker's one answer to a throw       |
| Storage outage   | `storageOutageOf(err)`                                          | `'d1'`, `'durable-object'` or null: the storage failing on its own side   |
| Route words      | `createApiRouteLabel` (`@liveworkspace/telemetry/error-tokens`) | Method and known path words (`Get.Index.Items.Share`), never an id        |

### When a request fails

Each storage-owning Worker's `fetch` is `guardRequest(run, answer)`: an app's api around `routeApiRequest`, each
service around its own dispatch (`serve` in accounts, index, media, community, telemetry and status; `handle` in
Drive's `dispatch.ts`). `answer` is built only when `run` threw: the route words, the Worker's own `json` (so CORS and
caching headers are its usual ones: community adds CORS on public routes only, telemetry `*`, index and Drive
`private, no-store`, accounts `no-store`), and, in an app's api only, `reportCrash`, its `Error·Api·Internal.<Route>`
emit (kept in `apps/api/src/index.ts`, where the telemetry emitter scan reads it). `failedRequestResponse`:

1. `storageOutageOf(err)`: `'d1'` when the message matches D1's own failures (`D1_ERROR: internal error`, `network
connection lost`, `D1 DB is overloaded`, `cannot resolve D1 DB due to transient issue`, `D1 DB storage operation
exceeded timeout`, `internal error while starting up D1 DB storage`, `D1 DB reset because its code was updated`);
   else `'durable-object'` when the error carries `retryable === true` or `overloaded === true`; else null.
2. An outage: `console.error('[<outage>] unavailable route=<route>', err)`, then `503 { error: 'storage_unavailable' }`
   with `Retry-After: 5`. No crash is reported.
3. Anything else: `console.error('api error route=<route>', err)`, `reportCrash()` (a throw there logs
   `[telemetry] crash report failed` and is swallowed), then `500 { error: 'internal_error' }`.

### A Durable Object's alarm (`packages/api-kit/src/room-alarm.ts`)

- `roomAlarmAt(due, now)`: `max(due, now + ROOM_ALARM_FLOOR_MS)`.
- `armRoomAlarm(storage, due, now)`: drops the nulls in `due`; none left, `deleteAlarm()`; else
  `setAlarm(roomAlarmAt(min(due), now))`. It keeps the time it set per `storage` object (a `WeakMap`, so a woken
  object starts empty) and skips the call when the time is the same and still ahead (or both are "none"). Answers the
  time set, or null. Each room's `armAlarm` (livediagram, livedocuments, livehuddle `document-room.ts`, livedesign
  `design-room.ts`, liveplanner `plan-room.ts`) hands it its list.
- `disarmRoomAlarm(storage)`: forgets the remembered time, then awaits `deleteAlarm()`. Each room's `purge` deletes
  its alarm through it, never `storage.deleteAlarm()` directly, so the next `armRoomAlarm` on that storage always
  writes (a stale remembered time would skip re-setting an alarm still ahead).
- The index's `WebhookDispatcher.alarm` sets `roomAlarmAt(nextAt, now)`; the Drive mirror's `nextPassAt` floors
  its time the same way (it was `max(now, …)`), before `alarm` compares it with the alarm already set.
- Left at now, on purpose: `kick()`, Drive's `connect`, `check` and folder adoption, the export's `start` and its next
  chunk.

A handler that catches broadly and would turn an outage into another answer rethrows it first: status's snapshot read
(else an empty status, edge-cached), accounts' session read (else `401 signed_out`) and Drive's open and import (else
`502 google_failed`).

### A room's collaboration ledger (`packages/api-kit/src/room-ledger-store.ts`)

- `new RoomLedgerStore(storage, rules, clock?)`: `rules` is the product's pure module (`ledgerKey`, `ledgerPrefix`,
  `recordInLedger`, `tabLedgerFrom`, and `ledgerEntryAccumulates` where it has entries that need every op of a round:
  livediagram and liveplanner, a tab's `:vote` key, and livediagram's an element entry holding idea cards). Each
  room (livediagram, livedocuments, livehuddle `document-room.ts`, livedesign `design-room.ts`, liveplanner
  `plan-room.ts`) builds one over its DO storage; the five `room-ledger-store.ts` copies it replaces differed only in
  their imports.
- `record(op, seq)`: chained on one queue, so entries apply in the room's order. Reads the key, takes the stamp off,
  hands the product's `recordInLedger` the entry, and puts the result with `ledgerStamp: { seq, at }` added; an
  entry past `LEDGER_VALUE_MAX_CHARS` (120,000, measured without the stamp) is not written. A throw is swallowed.
- `record` also keeps the entry's index row, `ledger-seq:<tab>:<seq padded to 16 digits>:<entry key>` valued with
  its `at`: the row of the entry's previous stamp is deleted and the new one put in the same write as the entry (no
  await between them, so the runtime lands them together). A key that names no tab (`ledger:<tab>:...`) gets no
  row. At most every `LEDGER_MARK_EVERY_MS` it appends `{ seq, at }` to `ledger-marks`, keeping every mark from the
  last `LEDGER_RECENT_MS` and the newest before it (about 26 at most).
- `read(tabId, since?)`: waits for the queue. With `since`, a tab id with no `:`, a product prefix of
  `ledger:<tab>:`, `ledger-indexed` set and a mark at or before `now - LEDGER_RECENT_MS`, it walks the tab's index
  rows after `min(since, that mark's seq)` and fetches their entries with batched gets (`LEDGER_GET_BATCH` 128);
  otherwise it lists the tab's prefix. Either way it drops each entry whose stamp has `seq <= since` and
  `at <= now - LEDGER_RECENT_MS`; an entry with no stamp always goes. No `since`: every entry. The stamps are taken
  off before `tabLedgerFrom`. A `since` below the stored floor (`ledger-floor`, read once per instance) logs
  `[ledger] stale cursor`. `ledger-indexed` and `ledger-marks` are read once per instance.
- The room's `GET /ledger?tab=&epoch=&since=` passes the save's cursor seq; the api's `fetchRoomLedger` sends it.
  The Participant answers write (`room-participant.ts`) reads with no `since`.
- `upkeep({ now, seq, tabs })`: on the queue, pages through every `ledger:` key (`LEDGER_UPKEEP_PAGE` 128, by
  `startAfter`, skipping any key not past the last one so a store that ignores the cursor still ends). An entry with
  no stamp is stamped `{ seq, at: now }`. An entry stamped at or before `now - LEDGER_RETENTION_MS` is deleted unless
  `ledgerEntryAccumulates` says so and its key starts with a stored tab's prefix (`tabs`, the ids in the room's
  `tabs` table; null when the room has no schema or no tabs, which keeps every accumulating entry). The highest seq
  deleted raises `ledger-floor`. A stamped or deleted entry's index row is put or deleted with it; until
  `ledger-indexed` is set, the pass also puts the row of every entry it keeps, and sets `ledger-indexed` once it
  finishes. Answers `{ dropped, stamped }`. Each room runs it first in its daily `maintain`,
  logged `[ledger] upkeep` when it changed anything, `[ledger] upkeep failed` on a throw, never stopping the rest.
- `settled()`: the queue; `purge` awaits it before `deleteAll`.

## Behaviour and state

### How a request reaches a service

1. On `liveworkspace.app` (and `staging.`), a Worker's `routes` path pattern wins over the site's custom domain, so
   `/api/auth/*` reaches accounts, `/api/index*` the index, and so on (the table under "The services"); every other
   path is the site.
2. Between services, a call goes over a service binding (`[[services]]`, never leaving the account) where one is
   declared, else over the public route.
3. On an app's address, its router first answers its platform paths through `routeToWorkspace`
   (`packages/sites/src/workspace-proxy.ts`), and everything else goes to the app's own Workers.

### A router's forward (`routeToWorkspace`, in order)

1. The first route whose `prefix` matches the path (as itself, anything under it, or a file beside it); none: `null`,
   and the router carries on.
2. The target is the path with `prefix` swapped for `target`, the query kept, on `WORKSPACE_ORIGIN` (unset is
   production's). The fragment never leaves the browser.
3. A request already carrying `X-Liveworkspace-Proxy`, or a target on this same host, is answered `508` (`router:
already forwarded once` or `router: WORKSPACE_ORIGIN is this site`), so a misconfigured origin can't loop.
4. Cookies by the route's mode: `drop` removes them; `flow` sends only the sign-in's own `lw_flow.`-prefixed cookies,
   under their own names; `pass` sends them as they are.
5. Headers set: `X-Liveworkspace-Proxy: <app>`, `X-Liveworkspace-Client-IP` from `CF-Connecting-IP`,
   `X-Liveworkspace-Proxy-Secret` from the router's `WORKSPACE_PROXY_SECRET` (`proxySecret`; any copy the caller sent
   is removed first, and none is sent when the router has no secret), and `X-Forwarded-Host`. Method, body and
   `Authorization` come along; redirects are not followed.
6. The answer: a `Location` inside a forwarded route is turned back to the app's address (`locationOnApp`); a
   `Set-Cookie` is removed, except on a `flow` route, where each is renamed `lw_flow.<name>`, scoped to the route's
   path, `HttpOnly`, `Secure`, `SameSite=Lax`, and capped at 900 s (a cleared cookie stays cleared).

| Route         | Prefix → target                                            | Cookies |
| ------------- | ---------------------------------------------------------- | ------- |
| Explorer      | `/explorer` → `/explorer`                                  | drop    |
| Site assets   | `/_liveworkspace` → `/_liveworkspace`                      | drop    |
| Sign-in pages | `/sign-in`, `/sign-up`, `/consent` (with an OAuth request) | drop    |
| Accounts API  | `/api/workspace/auth` → `/api/auth`                        | flow    |
| Account API   | `/api/workspace/account` → `/api/account`                  | drop    |
| Workbench     | `/api/workbench` → `/api/account/workbench`                | drop    |

The index (`forwardToIndex`, `INDEX_ORIGIN`), Drive (`forwardToDrive`) and previews (`previewsTargetFor`) have their
own forwards in the same file, each dropping the app's cookies and carrying the visitor's address. The index's also
carries the router's secret; Drive's and previews' never do (they count no address), and drop any copy the caller sent.

## Interfaces and contracts

The tables below are read from each `wrangler.toml`, the root `package.json`, `apps/site/next.config.ts` and
`packages/sites/src/workspace-proxy.ts`.

## Security and trust

Forwarded requests from a router carry the visitor's address in `X-Liveworkspace-Client-IP`, set from
`CF-Connecting-IP` and never copied from the caller. The Explorer's, the index's and Drive's forwards drop the app's
cookies, so no app cookie reaches the platform.

accounts and the index are publicly routed, so anyone can send them `X-Liveworkspace-Client-IP`. They count a named
address as the visitor's (`trustedClientAddress`, `@liveworkspace/sites/network`) only when the request's
`X-Liveworkspace-Proxy-Secret` matches their own `WORKSPACE_PROXY_SECRET` (compared in constant time); otherwise they
count the connection's own `CF-Connecting-IP`, so a direct caller can't rotate a made-up address past a per-network
limit. The secret is one value, set on every app's router and on accounts and the index, per environment. A receiver
with no secret set trusts the named address as before, so the code deploys safely in any order; the secret goes on
the routers first, then on the receivers (on a receiver first, every app's visitors would count as their router's one
address until the routers have it too).

## Performance and limits

One origin means no CORS preflight for the site's own calls. Each service's blueprint holds its budgets.

## Observability

Every storage-owning Worker logs a request that threw as `[d1] unavailable route=<route>`, `[durable-object]
unavailable route=<route>` or `api error route=<route>`, with the error; the route never carries an id.
Each Worker's own logs are in its blueprint. The status service checks every service hourly
([009-status](../../009-status/README.md)).

## The services

Production names and bindings (staging adds `-staging` to every Worker, database and bucket name and routes on
`staging.liveworkspace.app`), from each `apps/<service>/wrangler.toml`:

| Service   | Worker                    | Routes                                                                                                            | D1                        | R2                    | Durable Objects  | Service bindings              | Crons                        | Dev port |
| --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------- | ---------------- | ----------------------------- | ---------------------------- | -------- |
| accounts  | `liveworkspace-accounts`  | `/api/auth/*`, `/api/account/*`, `/.well-known/openid-configuration*`, `/.well-known/oauth-authorization-server*` | `liveworkspace-accounts`  |                       | `WorkbenchStore` | `INDEX`, `TELEMETRY`, `DRIVE` | `17 * * * *`, `*/15 * * * *` | 8787     |
| index     | `liveworkspace-index`     | `/api/index*`                                                                                                     | `liveworkspace-index`     |                       |                  | `DRIVE`                       | `23 4 * * *`, `*/15 * * * *` | 8793     |
| drive     | `liveworkspace-drive`     | `/api/drive*`                                                                                                     |                           |                       | `DriveMirror`    | `INDEX`                       | (alarms per Durable Object)  | 3011     |
| media     | `liveworkspace-media`     | `/api/media*`, `/api/previews*`                                                                                   | `liveworkspace-media`     | `liveworkspace-media` |                  | `INDEX`                       | `41 3 * * *`                 | 8792     |
| community | `liveworkspace-community` | `/api/community*`                                                                                                 | `liveworkspace-community` |                       |                  |                               |                              | 8791     |
| telemetry | `liveworkspace-telemetry` | `/api/telemetry*`                                                                                                 | `liveworkspace-telemetry` |                       |                  |                               | `17 3 * * *`                 | 8790     |
| status    | `liveworkspace-status`    | `/api/status*`                                                                                                    | `liveworkspace-status`    |                       |                  |                               | `7 * * * *`                  | 3010     |
| site      | `liveworkspace-site`      | `liveworkspace.app`, `www.liveworkspace.app` (custom domains)                                                     |                           |                       |                  |                               |                              | 3000     |

Every route is on the `liveworkspace.app` zone and every `wrangler.toml` pins `account_id =
"851be7d244b76a6557bcbe6c4ded80f5"`. `apps/migrate` has no `wrangler.toml`: it is never deployed.

## Root scripts

From the root `package.json`:

| Script          | Runs                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| `dev:workspace` | `turbo run dev` for the site and all seven services                                    |
| `dev:site`      | `@liveworkspace/site` alone (`next dev --port 3000`)                                   |
| `dev:accounts`  | `@liveworkspace/accounts` (`wrangler dev --port 8787 --local-upstream localhost:3000`) |
| `dev:telemetry` | `@liveworkspace/telemetry-service` (`--port 8790`)                                     |
| `dev:community` | `@liveworkspace/community-service` (`--port 8791`)                                     |
| `dev:media`     | `@liveworkspace/media-service` (`--port 8792`)                                         |
| `dev:index`     | `@liveworkspace/index-service` (`--port 8793`)                                         |
| `dev:status`    | `@liveworkspace/status-service` (`--port 3010`)                                        |
| `dev:drive`     | `@liveworkspace/drive-service` (`--port 3011`)                                         |

Inspector ports, one per Worker: 9130 accounts, 9131 telemetry, 9132 community, 9133 media, 9134 index, 9135 status, 9136 drive. Status runs with `--test-scheduled`, `ENVIRONMENT=development` and `PLATFORM_ORIGIN=http://localhost:3000`; accounts with `--local-upstream localhost:3000`.

## The site's dev forwards

`apps/site/next.config.ts` rewrites, in development only, each path to its Worker, each origin overridable by an
env var:

| Path                                                          | Default target          | Override               |
| ------------------------------------------------------------- | ----------------------- | ---------------------- |
| `/api/auth/*`, `/api/account/*`, `/.well-known/*`             | `http://localhost:8787` | `ACCOUNTS_DEV_ORIGIN`  |
| `/api/telemetry/*`                                            | `http://localhost:8790` | `TELEMETRY_DEV_ORIGIN` |
| `/api/community/*`                                            | `http://localhost:8791` | `COMMUNITY_DEV_ORIGIN` |
| `/api/previews/*` (not `/api/media/*`: no site page calls it) | `http://localhost:8792` | `MEDIA_DEV_ORIGIN`     |
| `/api/index/*`                                                | `http://localhost:8793` | `INDEX_DEV_ORIGIN`     |
| `/api/status/*`                                               | `http://localhost:3010` | `STATUS_DEV_ORIGIN`    |
| `/api/drive/*`                                                | `http://localhost:3011` | `DRIVE_DEV_ORIGIN`     |

## The routers' forwards

`packages/sites/src/workspace-proxy.ts`, used by all four routers:

| On the app's address                                              | Goes to on liveworkspace.app       | Constant                                   |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| `/explorer`, `/explorer/*`                                        | the same path                      | the explorer route (`prefix: '/explorer'`) |
| `/_liveworkspace/*`                                               | the site's build assets            | `SITE_ASSET_PREFIX`                        |
| `/sign-in`, `/sign-up`, `/consent`                                | the same pages                     | the sign-in page list                      |
| `/api/workspace/auth/*`                                           | `/api/auth/*`                      | `ACCOUNTS_ON_APP_PATH`                     |
| `/api/workspace/account/*`                                        | `/api/account/*`                   | the account route                          |
| `/api/workbench/*`                                                | `/api/account/workbench/*`         | the workbench route                        |
| `/api/drive/*`                                                    | the same path, cookies dropped     | `DRIVE_PATH`, `forwardToDrive`             |
| `/api/previews/*`, `/api/share/<code>/image.svg\|image.png\|card` | `/api/previews/…`                  | `PREVIEWS_PATH`, `previewsTargetFor`       |
| `/status`                                                         | the status page at the app's group | `STATUS_PATH`, `statusPageUrl`             |

The visitor's address travels as `X-Liveworkspace-Client-IP` (`WORKSPACE_CLIENT_IP_HEADER`), set from
`CF-Connecting-IP`, never from what the caller sent. `workspace-proxy.test.ts` holds all four routers to this.

## Errors and edge cases

| Case                                            | Answer                                                |
| ----------------------------------------------- | ----------------------------------------------------- |
| A forward that arrives at a router again        | `508 router: already forwarded once`                  |
| `WORKSPACE_ORIGIN` naming the app itself        | `508 router: WORKSPACE_ORIGIN is this site`           |
| A redirect leaving the forwarded routes         | passed through as it is                               |
| A malformed `Set-Cookie` name on a flow route   | dropped                                               |
| A storage-owning Worker's D1 down               | `503 storage_unavailable`, `Retry-After: 5`           |
| A Durable Object marked retryable or overloaded | `503 storage_unavailable`, `Retry-After: 5`           |
| Anything else a request throws                  | `500 internal_error`; the body never echoes the error |

## The shared element model (`packages/element-model`)

`@liveworkspace/element-model` has no barrel: `package.json` exports `./*` only, one subpath per module. It depends on
`@liveworkspace/model-core`, `@liveworkspace/icons` and `perfect-freehand` (the pen strokes).

- `src/element.ts`: the structural types (`Element`, `BoxedElement`, `ShapeElement`, `TextElement`,
  `FreehandElement`, `OtherBoxedElement`, `ArrowElement`, `Anchor`, `Endpoint`, `PathHandleMode`) and `isBoxed`, which
  is true for the eleven boxed kinds any product has (`shape`, `text`, `freehand`, `sticky`, `image`, `path`, `table`,
  `annotation`, `link-card`, `video`, `article-note`). A field joins a type only when a shared module reads it.
- The modules, each from the products whose copies were byte-identical (D livediagram, O livedocuments, H livehuddle,
  S livedesign, P liveplanner): `anchors` (DOSP), `arrow-reciprocal` (DS), `arrow-scale` (DOSP), the auto-layout
  graph (`auto-layout-crossings`, `-long-edges`, `-shared`, `-tidy-graph` DOSP; `-mindmap`, `-route` DOP;
  `-tidy-rank` DOS; `-tree` DSP), `element-display-label` (DOSP), `element-grid`, `geometry-guides`, `label-body` and
  `layer-order` (all five), `hierarchy` (DOS), `legacy-groups` (DS), `legacy-stroke-points` (DO), `malformed-bends`
  (DOSP), `malformed-chart-rows` (OSP), `malformed-ids` (OHS; livediagram's and liveplanner's also check
  `flowchartId`, so they keep their own), `nearest-towards` (DSP), `path-geometry` (DS), `sankey-model` (DO),
  `shadow` (DHSP), `tab-folders` (DOH) and `tag-colours` (DOSP). `entity-geometry` (DP) reads no element, so it is
  `@liveworkspace/model-core/entity-geometry`.
- Each of those products keeps `src/<module>.ts` as the binding `export * from '@liveworkspace/element-model/<module>'`
  (the copies guard leaves such a file out).
- Generic over the caller's own type: `bringToFront`, `sendToBack`, `bringManyToFront`, `sendManyToBack`,
  `bowReciprocalEdges`, `reanchorArrow`, `routeTidyArrows` (and `RouteInput`, `RouteRequest`), `nearestElementTowards`,
  the element grid (`ElementGrid<E>`, `buildElementGrid`, `updateElementGrid`, `queryElementGrid`, `elementGridFor`,
  `createElementGridTracker`), `dropMalformedBends`, `settleChartRows`, `dropMalformedIds`, `migrateLegacyGroups`,
  `migrateLegacyStrokePoints` and `withTagAccent`.
- The tests that were identical beside a moved module moved with it; a product's own test of a moved module stays in
  the product and runs through its binding.
- Settled, then moved (part 2; the version every product took is named, and each behaviour a product gained is in its
  own specs): `svg-render-primitives` (D's, with S's plain-text fast path; P gains emoji-safe word breaking),
  `svg-render-labels` (D's; P gains the mid-word run glue), `arrow-style` (D's `arrowheadLengthPx`), `colour-math`
  (split out of each `colors.ts`, D's: O, S and P gain shorthand, alpha and named colours in contrast, P in every
  read), `readable-colour` (D's: O, S and P gain the shorthand label pick, P the walk back past a mid grey),
  `pen-colours` (D's), `shape-geometry` (D's table, every product's kinds; `DRAWN_GEOMETRY_KINDS`, each product's
  `SHAPE_GEOMETRY_KINDS` the ones it holds), `shape-outline`, `geometry` (D's: the entity field ends, never reached
  where a product has no entity) and `svg-shape-role` (each `svg-render-shapes.ts`'s role paint). With them, the
  groups they held back: `actor-figure` (DHP), `anchor-choice`, `anchor-layouts`, `arrow-dash`, `arrow-path`,
  `arrow-path-hits`, `arrow-snapping`, `auto-layout-placement`, `er-heads`, `sankey-text` (DOSP), `concept-ramp`
  (DOSP), `page-ink-contrast` (OS) and `standard-colours` (all five). livehuddle keeps its own `geometry`,
  `shape-geometry` and `shape-outline` (its furniture and retired kinds).
- `ElementIndex<E>`, `buildElementIndex`, `elementIndexFor`, `isElementIndex` and `pinnedBoxedElement` are generic;
  each product's index binds `ElementIndex` to its `Element`.
- Settled, then moved (part 3, each behaviour a product gained in its own specs): the finish and its drawing
  (`finish` D's with every product's finish kinds, `self-painting` the union of every `SELF_PAINTING_SHAPES`, `sketch`,
  `sketch-element`, `sketch-backdrop`, `marker`, `marker-element`, `marker-face` P's with its optional frame budget,
  `svg-render-face-finish`, `svg-render-border`, `svg-render-page`, `svg-shape-fit`); strokes and paths
  (`freehand-points`, `pen-stroke` D's, `stroke-fit`, `stroke-loop-fill`, `path-element` S's, `drawn-outline-finish`,
  `hand-drawn`, `svg-render-sketch`, and `export-shape`, the export's shape and resolver types out of each
  `svg-render-describe.ts`); the web components (`web-components`, `card`, `concept`, `concept-timeline`, their
  `svg-render-*`, O's funnel split; `diagram-key`, `boundary`, `person-node` DP); containment and the arrow layout
  family (`containment` D's, `arrow-endpoint-spread` O's, `arrow-orthogonal`, `arrow-label-layout`, `arrow-bend`,
  `arrow-behind`, `arrow-rebind-swap` D's, `arrow-body-drop`, `chip`); attachment and layout (`attachment` S's, pointer
  notes settling first; `pointer-note`, `svg-render-pointer-note`, `svg-render-chip`, `geometry-snapping`, `stack`
  D's, `rotation` and `unturnable-rotation` OSP, livediagram keeping its own for its retired furniture;
  `auto-layout` D's, `auto-layout-tidy` S's, `auto-layout-tidy-flow`); and `data-shapes` with `chart-palettes`, every
  product's self-drawing kinds, livediagram wrapping `isSelfDrawingShape` for its retired pieces. livehuddle keeps its
  own `finish`, `sketch-element`, `sketch-backdrop`, `svg-render-sketch` and `colors` (its furniture and placeholder
  kinds). New generics: `settleChips`, `settleStacks`, `dropUnturnableRotation`, `autoLayoutElements`,
  `tidyLayoutElements`, `withOrthogonalBends`, `withFacingBends`, `settleDiagramKeys`, `migrateLegacyCallouts`,
  `isChip`, `renumberSteps`, `withStepSequence`, `fillStrokeLoop` and the path reshapers.
- `text-presets` (livedocuments' Write text styles, moved when livedesign took them too): the `TextPreset` shape and
  `TextPresetId` vocabulary (title, subtitle, heading, subheading, paragraph, quote, caption), `presetTextFields`,
  `splitTextPx`, `textBoxFor`, `NEW_TEXT_ALIGN`, and the generic `restyleText<E>` and `textPresetOf`. A style is data:
  each product keeps its own table and factory in its `text-presets.ts` (livedocuments' six at a written page's 24 to
  72 px, livedesign's seven at a screen's 12 to 40 px) and binds the helpers to it; livedocuments'
  `label-text-scale.ts` re-exports `splitTextPx`. Nothing a product stores changed.
- Settled, then moved (part 4, each behaviour a product gained in its own specs): the element defaults
  (`element-colours`, out of each `colors.ts`: every product's kinds, the control skin of the buttons, picker and
  reveal cover; livediagram's `colors.ts` wraps the three defaults for its retired pieces, livediagram's and
  liveplanner's pass `hasOwnFace` to `acceptsInlineIcon` and `positionsInlineIcon`); the themes (`themes`,
  `themes-data`, `theme-halves`, `theme-presets`, `quick-swatches`; O's `themedForTab` and page-paper read,
  `ThemedElement`, `switchThemeBackdrop` generic over a product's patterns; livehuddle binds `themes-data` only, its
  retired tables keep its own); tables and readouts (`cell-colours` with D's shorthand-safe `readableInk`,
  `table-header-colours` D's, `svg-render-table` D's with O's comparison tables behind `{ comparison: true }`, which
  only O's `svg-render-table.ts` passes, and their `table-marks`; `progress-colours`, `page-ink-rules` S's with O's
  quote, OS); arrows in the
  export (`svg-render-arrows` with D's `finishArrowEnds` (O's line motion retired with the tab window), `stock-colours` D's, `mind-flow`,
  `mind-connector-route` DP); and the charts (`chart-types`, `chart-marks` D's below-zero layout with O's
  not-a-number guard, `chart-values` D's with O's decimals, `chart-axis` O's tick decimals, `chart-frame` and
  `svg-render-charts` O's page ground, `chart-mark-ink` the pure half of O's and S's `chart-ink`, `sankey-layout`,
  `svg-render-data`, `glyph-width` P's; S and P bind `sankey-model`). New shared types: `TableElement` and
  `TableCellLook`; a chart's, a progress element's and a rating's fields on `ShapeElement`; an arrow's `finish`,
  `font`, `textColor` and `labelFill`; a path's `closed`. `arrow-types` (each product's own `ArrowElement`, with
  D's and P's entity `field` and S's `componentMember`) and `svg-render-describe` (each product's faces, retired and
  Collaborate kinds) stay per product.
- `src/testing/elements.ts`: product-neutral builders for the package's own tests (`createShape` at the products'
  default sizes, `createText`, `createTable`, `createSticky`, `createFreehand`, `createArrow`, `createPinnedArrow`).
  With them, 24 tests moved in from the products (one copy each, the identical copies deleted); the package's floor
  is what they reach.
- Moved (part 5, the model packages' remaining copies that read no product-only module): `element-action`,
  `comment-thread` (D's put-back `before` for every product, generic over a product's `Comment`), `custom-colours`,
  `legacy-text-sizing`, `legacy-links`, `malformed-styles` (D, H, P; O and S keep their `textScale` check),
  `tab-has-drawing`, `whiteboard`, `retired-custom-themes`, `quick-swatch-rederive` and `theme-graph` (H keeps its
  arrow-swatch rederive and its own themes), `accent-edge` (every product's straight-edged kinds), `shape-variants`,
  `element-field-values` (O and S; D, H and P keep the lists of their own kinds), the entity rules and rows
  (`entity-fields`, `entity-look`, `svg-render-entity`, D and P), the sequence diagram's rows and text
  (`sequence-element`, `sequence-text`, D and P; `SequenceElementDiagram` is assignable to each product's Mermaid
  `SequenceDiagram`), the wordmark (`wordmark`, `svg-render-wordmark`, D and H), the Sankey frame and export
  (`sankey-frame`, `svg-render-sankey`: S's page ground, unused by D and P), the export's image and icon bodies
  (`svg-render-image-icon`, `svg-render-inline-icon` with O's and S's `textScale`), the table helpers (`table`, D, S and P,
  over `TableGrid`; O keeps its comparison-table copy), and `element-fingerprint` as `fingerprintsFor`, bound in each
  product's `element-fingerprint.ts` to its `LIVE_ELEMENT_FIELDS`. `@liveworkspace/model-core` gains `civil-dates`;
  livediagram's and livehuddle's `slug.ts` bind model-core's. New shared fields: a shape's icon size, weight and
  position, its Sankey fields, its sequence rows and its entity fields as `EntityField`; a text's wordmark type; a
  label's underline and strikethrough. Each product's `MAX_TABLE_*` is the shared `TABLE_*_MAX`.
- Left per product, and why: the flowchart modules, `mind-grow` and `component-factories` (D, P) build with each
  product's own `createShape` and factories; `svg-render-sequence` and `svg-render-temperature` (D, P) draw through
  each product's renderer and Collaborate kinds; `label-backdrop`, `tab-as-seen` and
  `collab-index-rows` read livediagram's wrapped or livehuddle's own colours, themes and labels; `savable` and
  `malformed-ids` read each product's validator and catalogue keys; the page modules (`page-lock`, `page-of`,
  `page-paint`, `page-ink-ground`, `chart-ink`) and `indicator-placement` (O, S) read each product's page model and
  hit outlines.
- Retired themes: `retired-themes` is the role-by-role rewrite (`bindRetiredThemes(retired, deps?)`, deps the
  product's `half` and `colourFields` when its theme engine is its own, livehuddle's; `UML_AS_RETIRED`, frozen), and
  `retired-uml` the retirement four products share (`RETIRED_THEME_IDS`, `THEMES` less UML, `RETIRED_THEMES` with UML
  to Mono, `migrateRetiredTheme`). liveplanner's and livedocuments' `themes-data.ts`, `themes.ts` and
  `retired-themes.ts`, and livedesign's and livehuddle's `themes-data.ts`, re-export it; livedesign's and livehuddle's
  `retired-themes.ts` add their Autumn and Jewel to its table. livediagram keeps UML and its own `retired-themes`.
- `@liveworkspace/workbench/components/canvas/useFaceFinishPass` is the canvas finish pass of livediagram,
  livedocuments, livedesign and livehuddle; liveplanner keeps its own (its Plan boards spend a frame budget).

## Testing

| Test                                                                                         | Pins                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/sites/src/workspace-proxy.test.ts`                                                 | every router's forwards: routes, cookies, loop guard, visitor address and proof (a caller's copy removed), redirects, the status page                                                                                                                                                               |
| `packages/sites/src/network.test.ts`                                                         | a named address trusted only beside the right secret, a spoofed one ignored, and trusted as named while no secret is set                                                                                                                                                                            |
| `packages/sites/src/previews-proxy.test.ts` (3)                                              | the previews forward and the share link's picture doors                                                                                                                                                                                                                                             |
| `packages/sites/src/cache-policy.test.ts`                                                    | every router's caching rules: pages `no-store`, hashed build assets immutable for a year, a missing one a plain 404, redirects and upgrades untouched                                                                                                                                               |
| `.github/scripts/duplicate-guard.test.mjs`                                                   | the copies guard: candidates, bindings left out, a new group or a new copy failing, a gone or shrunk group failing with the `--update` hint, the committed baseline matching the tree                                                                                                               |
| `packages/api-kit/src/request-failure.test.ts` (23)                                          | D1 and Durable Object outages named, bugs left to the 500, the answers and their logs, the guard (held at 100%)                                                                                                                                                                                     |
| `packages/api-kit/src/room-alarm.test.ts`                                                    | the floor, the earliest time, none due, a repeat skipped, a time passed or changed set again, an arm after a disarm set again (held at 100%)                                                                                                                                                        |
| `packages/api-kit/src/room-ledger-store.test.ts`                                             | stamps, the save's read by cursor and by age, upkeep's cut, accumulating entries kept while their tab lives, legacy entries, paging, the stale-cursor log, storage counts before and after, the index read matching the listing for every cursor, rows read per save on a busy board (held at 100%) |
| each room's `*-grants.test.ts`                                                               | a time stuck in the past arms the alarm a second from now, and again a second on once it fires                                                                                                                                                                                                      |
| index `webhooks/dispatch.test.ts`, Drive `mirror/pass.test.ts`                               | the dispatcher's next alarm and the next pass, already past, set a second from now                                                                                                                                                                                                                  |
| `<app>/apps/api/src/request-failure.test.ts` (4 each)                                        | an outage and a bug before any route (the token lookup) and inside one, CORS and the release on the answer                                                                                                                                                                                          |
| each service's `request-failure.test.ts`, `index.test.ts`, `api.test.ts` or `routes.test.ts` | its D1 or mirror outage answered 503 with its own headers and route words, through `unavailableD1()` (`@liveworkspace/api-kit/testing/unavailable-d1`)                                                                                                                                              |

Each service's own tests are in its blueprint.

## Constants and configuration

`PRODUCTION_WORKSPACE_ORIGIN`, `PRODUCTION_INDEX_ORIGIN`, `PRODUCTION_DRIVE_ORIGIN`, `PRODUCTION_PREVIEWS_ORIGIN`
`https://www.liveworkspace.app`; `WORKSPACE_PROXY_HEADER` `X-Liveworkspace-Proxy`; `WORKSPACE_CLIENT_IP_HEADER`
`X-Liveworkspace-Client-IP`; `ACCOUNTS_ON_APP_PATH` `/api/workspace/auth`; `FLOW_COOKIE_PREFIX` `lw_flow.`;
`FLOW_COOKIE_MAX_AGE_SECONDS` 900; `SITE_ASSET_PREFIX` `/_liveworkspace`; `DRIVE_PATH` `/api/drive`; `PREVIEWS_PATH`
`/api/previews`; `STATUS_PATH` `/status`; `LOOP_DETECTED` 508 (`packages/sites/src/workspace-proxy.ts`). Each router's
`WORKSPACE_ORIGIN` and `INDEX_ORIGIN` vars. `WORKSPACE_PROXY_SECRET_HEADER` `X-Liveworkspace-Proxy-Secret`, and the
`WORKSPACE_PROXY_SECRET` secret on each router, accounts and the index. `UNAVAILABLE_RETRY_AFTER_SECONDS` 5
(`packages/api-kit/src/request-failure.ts`): the `Retry-After` of every storage and accounts outage; long enough for a
short D1 or Durable Object reset, short enough that a caller's retry lands soon after one; safe from 1 to 60.
`ROOM_ALARM_FLOOR_MS` 1,000 (`packages/api-kit/src/room-alarm.ts`): the soonest any re-armed alarm goes; it caps a
stuck time at one alarm a second, and every wait it can add to is seconds or more already; safe from 100 to 5,000.
`LEDGER_RECENT_MS` 24 h (`packages/api-kit/src/room-ledger-store.ts`): an entry changed this recently goes with every
save whatever its cursor; it covers a comment's author save and an idea's first save landing late; safe from 1 h to
7 days. `LEDGER_RETENTION_MS` 30 days: an entry untouched this long is cut by upkeep; the Trash's and the changesets'
retention; safe from 7 to 365 days. `LEDGER_UPKEEP_PAGE` 128: keys per upkeep page, bounding the memory one page holds. `LEDGER_MARK_EVERY_MS` 1 h: how often the room notes its seq for the index; a save walks up to this much more than the last day; safe from 1 min to 6 h.

## Defaults ledger

- `ARC1`: a forward loop is answered `508 Loop Detected` as plain text, never retried.
- `ARC2`: a sign-in's cookies live on an app's address for at most 15 minutes, whatever liveworkspace set.
