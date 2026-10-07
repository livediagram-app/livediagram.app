# Workbench embeds: blueprint

Derived from [Workbench embeds](../workbench-embeds.md), with the frame headers of [Embeds](../embeds.md), the token
choke point of [API](../../015-api/api.md#auth) and [Public API and API tokens](../../015-api/public-api-and-tokens.md),
the whole-tab save rule of [Agent changesets](../../024-agents/agent-changesets.md#whole-tab-saves-and-tab-renames),
the person tag of [Agent presence](../../024-agents/agent-presence.md), the levels of
[Share roles](../share-roles.md#api-tokens), the commands of [CLI](../../015-api/cli.md) and the refs and kind words of
[Document views](../../024-agents/document-views.md). The device-grant wait it models the pairing wait on is
`loginWithDevice` in `apps/cli/src/auth/oauth.ts`. The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `WBn`.

**Levels today.** [Share roles](../share-roles.md) is specified, not built: a token carries `read_only`
(`resolveApiToken` returns `readOnly`). A workbench level is `'view' | 'edit'` today, read from `read_only`, stored
and sent as `role` with the share-roles `CHECK` so the participate level slots in with no migration (WB1).

It provides these names to sibling blueprints ([CLI](../../015-api/blueprints/cli.md),
[Share roles](share-roles.md), [Agent changesets](../../024-agents/blueprints/agent-changesets.md)):

| Name                                                                 | What it is                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `RouteContext.workbench: WorkbenchContext \| null`                   | The presenting workbench session; null for every other caller            |
| `workbenchRouteVerdict(method, segments, session)`                   | The confinement allow-list, shared by the api choke point and the editor |
| `parseWorkbenchOrigin(input)`                                        | The one origin rule, shared by the api, the CLI and the page             |
| `WORKBENCH_SESSION_PREFIX` `lvw_`, `isWorkbenchSessionFormat`        | The third bearer kind                                                    |
| `endWorkbenchAccess(env, scope, reason)`                             | Unpair and token revocation: rows gone, rooms closed                     |
| `WORKBENCH_ENDED_CLOSE` 4006                                         | The room's close code for a session whose pairing or token ended         |
| `selectionReference(input)`                                          | The selection reference text, in `@livediagram/document-views`           |
| `EditorSurface = 'app' \| 'embed' \| 'workbench'`                    | The editor's surface, replacing the `embed` boolean                      |
| `POST /api/workbench/tickets`, `/sessions`, `/pairing-requests`, ... | The routes, below                                                        |

## Scope, by file

| File                                                                                                                                                                                                       | Role                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/migrations/0077_workbench.sql`                                                                                                                                                                   | Tables `workbench_pairing_requests`, `workbench_pairings`, `workbench_tickets`, `workbench_sessions`; `ws_tickets.workbench_pairing`                                                                |
| `packages/api-schema/src/workbench.ts` (new, + test)                                                                                                                                                       | Constants; wire types of every route; `parseWorkbenchOrigin`; `isWorkbenchSessionFormat`; `WorkbenchRole`, `capWorkbenchRole`; `WORKBENCH_ERROR_CODES`; `WORKBENCH_ROUTES`, `workbenchRouteVerdict` |
| `packages/api-schema/src/workbench-messages.ts` (planned) (new, + test)                                                                                                                                    | The ten message types, `WORKBENCH_MESSAGE_TYPES`, `parseWorkbenchMessage`                                                                                                                           |
| `packages/api-schema/src/room-messages.ts`                                                                                                                                                                 | `WORKBENCH_ENDED_CLOSE = 4006`                                                                                                                                                                      |
| `packages/api-schema/src/page-views.ts`                                                                                                                                                                    | `LIVE_ROUTE_SEGMENTS` gains `workbench`, so the router sends `/workbench/pair` to the live app                                                                                                      |
| `packages/api-schema/src/index.ts`                                                                                                                                                                         | Re-exports the two new modules                                                                                                                                                                      |
| `apps/api/src/db/workbench.ts` (new, + test)                                                                                                                                                               | Every query on the four tables (Data and persistence)                                                                                                                                               |
| `apps/api/src/auth/workbench-session.ts` (new, + test)                                                                                                                                                     | `generateWorkbenchSecret`, `generateWorkbenchTicket`, `generatePairingCode`, `hashWorkbenchSecret`, `resolveWorkbenchSession`                                                                       |
| `apps/api/src/auth/workbench-confinement.ts` (new, + test)                                                                                                                                                 | `workbenchRefusal(ctx-like, method, segments, headers)`: the choke point's verdict to a `Response`                                                                                                  |
| `apps/api/src/workbench-end.ts` (new, + test)                                                                                                                                                              | `endWorkbenchAccess`: list sessions, delete rows, close rooms, log                                                                                                                                  |
| `apps/api/src/routes/workbench.ts`                                                                                                                                                                         | `handleWorkbench(ctx)`: dispatch of `segments[2]` to the three modules below                                                                                                                        |
| `apps/api/src/routes/workbench-ticket-route.ts` (new, + test)                                                                                                                                              | `POST /api/workbench/tickets`                                                                                                                                                                       |
| `apps/api/src/routes/workbench-session-routes.ts` (new, + test)                                                                                                                                            | `POST /api/workbench/sessions`, `DELETE /api/workbench/sessions/current`                                                                                                                            |
| `apps/api/src/routes/workbench-pairing-routes.ts` (new, + test)                                                                                                                                            | `/api/workbench/pairing-requests*`, `/api/workbench/pairings*`                                                                                                                                      |
| `apps/api/src/routes/workbench-access.ts`                                                                                                                                                                  | `ownerDocumentAccess`: the owner's own access to a document, shared by the mint and redemption (WB3)                                                                                                |
| `apps/api/src/routes/workbench-test-fixtures.ts`                                                                                                                                                           | The route suites' shared real-SQLite arrangement (not a suite)                                                                                                                                      |
| `apps/api/src/routes/context.ts`                                                                                                                                                                           | `RouteContext.workbench`; `WorkbenchContext`                                                                                                                                                        |
| `apps/api/src/index.ts`                                                                                                                                                                                    | `lvw_` resolution beside `lvd_`; confinement; level refusal; rate limiter; `case 'workbench'`; the daily sweep                                                                                      |
| `apps/api/src/routes/document-room-routes.ts`                                                                                                                                                              | Ticket mint under a session: `account` true, owner's person tag, role capped at the session's level, `workbenchPairing`; upgrade forwards `X-Verified-Workbench-Pairing`                            |
| `apps/api/src/db/ws-tickets.ts`                                                                                                                                                                            | `WsAdmission.workbenchPairing`; insert and consume the column                                                                                                                                       |
| `apps/api/src/document-room.ts`                                                                                                                                                                            | Attachment `workbenchPairing` from the header; `/close-sessions` closes a `workbench` match with 4006                                                                                               |
| `apps/api/src/room-access.ts`                                                                                                                                                                              | `AccessCloseMatch` gains `{ match: 'workbench'; pairingId }`; parse and match                                                                                                                       |
| `apps/api/src/room-access-client.ts`                                                                                                                                                                       | `closeWorkbenchSessions(env, documentId, pairingId)`                                                                                                                                                |
| `apps/api/src/routes/images.ts`                                                                                                                                                                            | Under a session, `GET /api/images/:id` takes the document path only, with `d` the session's document                                                                                                |
| `apps/api/src/routes/tokens.ts`                                                                                                                                                                            | Both revokes call `endWorkbenchAccess({ tokenId }, 'revoked')` after `revokeApiToken`                                                                                                               |
| `apps/api/src/db/account.ts`, `apps/api/src/db/account-owner-columns.test.ts`                                                                                                                              | `deleteAccount` deletes the four tables' rows before `api_tokens`; four `account-only` ledger rows                                                                                                  |
| `apps/api/src/responses.ts`                                                                                                                                                                                | `workbenchConfined()`, `pairingRequired(body)`                                                                                                                                                      |
| `apps/api/src/types.ts`, `apps/api/wrangler.toml`                                                                                                                                                          | `WORKBENCH_TICKET_RATE_LIMITER` (namespace `1010`, 30 per 60 s), production and `[env.staging]`                                                                                                     |
| `apps/api/src/openapi/manifest.ts`, `document.ts`, `schemas.generated.ts`                                                                                                                                  | Eleven operations under segment `workbench`, tag `Workbench`; the 428 and 401 bodies                                                                                                                |
| `packages/document-views/src/selection-reference.ts` (planned) (new, + test), `index.ts`                                                                                                                   | `selectionReference(input)`                                                                                                                                                                         |
| `apps/live/app/embed/workbench/page.tsx` (planned)                                                                                                                                                         | The static route; metadata title `Workbench \| livediagram`, `robots: { index: false }`; renders `WorkbenchPage`                                                                                    |
| `apps/live/app/embed/workbench/WorkbenchPage.tsx` (planned)                                                                                                                                                | Runs the page machine; renders a status or, once bound, `WorkbenchAuthBridge` around `EditorPage surface="workbench"`                                                                               |
| `apps/live/app/embed/workbench/workbench-machine.ts` (planned) (new, + test)                                                                                                                               | The page's states and transitions, pure                                                                                                                                                             |
| `apps/live/app/embed/workbench/workbench-fragment.ts` (planned) (new, + test)                                                                                                                              | `takeTicketFromAddress(location, history)`: reads `#ticket=`, clears the fragment                                                                                                                   |
| `apps/live/app/embed/workbench/useWorkbenchHandshake.ts` (planned)                                                                                                                                         | Redeem, document check, hello, ack wait, revoke on failure                                                                                                                                          |
| `apps/live/app/embed/workbench/useWorkbenchRenewal.ts` (planned) (new, + test)                                                                                                                             | Renew timing, ticket redemption, provider swap, old session revoked                                                                                                                                 |
| `apps/live/app/embed/workbench/WorkbenchStatus.tsx` (planned)                                                                                                                                              | The status screens and their copy                                                                                                                                                                   |
| `apps/live/lib/workbench/workbench-port.ts` (planned) (new, + test)                                                                                                                                        | `createWorkbenchPort(origin, win)`: send to the bound origin, accept from it, unknown types logged once                                                                                             |
| `apps/live/lib/api/workbench.ts` (planned) (new, + test)                                                                                                                                                   | `apiRedeemWorkbenchTicket`, `apiEndWorkbenchSession`, `apiReadPairingRequest`, `apiAnswerPairingRequest`, `apiListWorkbenchPairings`, `apiUnpairWorkbench`                                          |
| `apps/live/lib/api/core.ts`                                                                                                                                                                                | `setWorkbenchConfinement(session \| null)`; `apiFetch` refuses locally what `workbenchRouteVerdict` refuses, throwing `WorkbenchConfinedError`                                                      |
| `apps/live/lib/api/images.ts`                                                                                                                                                                              | `fetchImage` always sets `d` to the session's document under confinement                                                                                                                            |
| `apps/live/lib/api/room.ts`                                                                                                                                                                                | `RoomHandlers.onWorkbenchEnded` on close 4006, the connector stops                                                                                                                                  |
| `apps/live/lib/user-preferences.ts`                                                                                                                                                                        | `writeUserPreferences` skips `apiPutPreferences` under confinement                                                                                                                                  |
| `apps/live/components/providers/workbench-session-context.ts` (planned)                                                                                                                                    | `WorkbenchSession`, `WorkbenchSessionContext`, `useWorkbenchSession()`                                                                                                                              |
| `apps/live/components/providers/WorkbenchAuthBridge.tsx` (planned) (new, + test)                                                                                                                           | A nested `DeferredAuthContext.Provider` with the session's identity; registers the `lvw_` token provider in a layout effect                                                                         |
| `apps/live/components/providers/deferred-auth.tsx`                                                                                                                                                         | `DEFERRED_AUTH_PENDING` (`authLoaded: false`, signed out)                                                                                                                                           |
| `apps/live/components/providers/ClerkProvider.tsx`                                                                                                                                                         | `WORKBENCH_ROUTE = '/embed/workbench'`: the Clerk and E2E bridges stand down there and the state holds `DEFERRED_AUTH_PENDING`                                                                      |
| `apps/live/hooks/persistence/useClerkApiBootstrap.ts`                                                                                                                                                      | Reads `useWorkbenchSession()` first; under a session no migration, no timeout, no provider, the session's identity returned                                                                         |
| `apps/live/app/document/[id]/editor-page.tsx`                                                                                                                                                              | `LivePage({ surface })`; `Session·Opened·Workbench`; status branches for the workbench                                                                                                              |
| `apps/live/app/embed/page.tsx`                                                                                                                                                                             | `<EditorPage surface="embed" />`                                                                                                                                                                    |
| `apps/live/app/document/[id]/editor-surface.ts` (planned) (new, + test)                                                                                                                                    | `EditorSurface`, `surfaceFlags(surface)`: `embedMode`, `workbenchMode`, `appChrome`                                                                                                                 |
| `apps/live/app/document/[id]/useEditorState.ts`                                                                                                                                                            | `useEditorState({ surface })`; every gate in the Surface table; `useWorkbenchMessages`, `useTabRevisions`                                                                                           |
| `apps/live/app/document/[id]/useIdentityBootstrap.ts`, `seed-fetched-document.ts`                                                                                                                          | The workbench branch (Behaviour, "The editor in a workbench")                                                                                                                                       |
| `apps/live/app/document/[id]/useTabRevisions.ts` (planned) (new, + test)                                                                                                                                   | The last known `rev` per tab: loads, saves, changesets                                                                                                                                              |
| `apps/live/lib/api/tabs.ts`, `apps/live/app/document/[id]/useAutosave.ts`                                                                                                                                  | `apiSaveTab` returns the saved `rev`; the autosave notes it in `useTabRevisions`                                                                                                                    |
| `apps/live/app/document/[id]/useWorkbenchMessages.ts` (planned) (new, + test)                                                                                                                              | `ready`, `tab`, `selection` (settled), `reveal`, `theme`                                                                                                                                            |
| `apps/live/app/document/[id]/EditorView.tsx`                                                                                                                                                               | Header, Explorer, banners, Open in livediagram, read-only line                                                                                                                                      |
| `apps/live/components/chrome/WorkbenchChrome.tsx` (planned)                                                                                                                                                | The **Open in livediagram** button and the "Reconnect in ..." line                                                                                                                                  |
| `apps/live/components/canvas/useCanvasChromePanels.tsx`, `CanvasAiPanel.tsx`                                                                                                                               | No Explorer and no AI panel in a workbench                                                                                                                                                          |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`                                                                                                                                              | `settingsCatalogue(surface)`: the workbench hides `ai`, `documents`, `account`, `tokens` and the Appearance choice                                                                                  |
| `apps/live/lib/editor-commands.ts`                                                                                                                                                                         | No share, delete, move, take offline, copy or AI commands in a workbench                                                                                                                            |
| `apps/live/components/panels/ImagePicker.tsx`                                                                                                                                                              | Upload only in a workbench: no gallery                                                                                                                                                              |
| `packages/ui/src/appearance/appearance-store.ts` (+ test)                                                                                                                                                  | `setAppearanceOverride(appearance \| null)`: wins over the setting, never stored                                                                                                                    |
| `apps/live/app/workbench/pair/page.tsx` (planned), `PairWorkbench.tsx` (new, + test)                                                                                                                       | The pairing page                                                                                                                                                                                    |
| `apps/live/components/dialogs/settings/SettingsTokenPairings.tsx` (planned) (new, + test)                                                                                                                  | A token card's paired workbenches with **Unpair**                                                                                                                                                   |
| `apps/live/components/dialogs/settings/SettingsTokenCard.tsx`, `SettingsTokenList.tsx`, `SettingsTokensRow.tsx`                                                                                            | The card renders its pairings; the list passes them; the row loads them                                                                                                                             |
| `apps/live/hooks/persistence/useWorkbenchPairings.ts` (planned) (new, + test)                                                                                                                              | List, group by token, unpair                                                                                                                                                                        |
| `apps/live/src/worker.ts` (+ test)                                                                                                                                                                         | Unchanged code; the test pins `/embed/workbench` frameable and `/workbench/pair` `DENY`                                                                                                             |
| `packages/agent-verbs/src/verbs/workbench.ts` (new, + test), `catalogue.ts`, `index.ts`                                                                                                                    | `workbench.open`, `workbench.pair` (local); resource `workbench`; `workbenchOriginOf`, `workbenchNameOf`: the refusals both verbs share                                                             |
| `apps/cli/src/commands/workbench-pair.ts` (new, + test)                                                                                                                                                    | `pairWorkbench(io, api, input, json, log)`: request, print, open, wait                                                                                                                              |
| `apps/cli/src/main.ts`                                                                                                                                                                                     | Dispatches `workbench.pair` beside the other local verbs                                                                                                                                            |
| `apps/cli/src/io.ts`                                                                                                                                                                                       | `CliIo.stdoutIsTTY`, shared with the repository link's picker: whether a person reads stdout (WB25)                                                                                                 |
| `apps/cli/src/output/failure-of.ts`                                                                                                                                                                        | `isNetworkFailure`, shared by `failureOf`, the telemetry and the pairing wait                                                                                                                       |
| `apps/cli/src/commands/workbench-open.test.ts`                                                                                                                                                             | `workbench open` as the CLI exits                                                                                                                                                                   |
| `packages/agent-verbs/src/guides/index.ts`, `skill.ts`                                                                                                                                                     | Topic `workbench`; `GUIDE_TOPIC_MAX_TOKENS`, `SKILL_FRONTMATTER_MAX_TOKENS`, `SKILL_BODY_MAX_TOKENS`; the skill's `[livediagram]` line                                                              |
| `docs/specs/015-api/cli.md`                                                                                                                                                                                | The two command rows, the guide topic and the skill's pointer                                                                                                                                       |
| `apps/telemetry/app/cli-commands.ts`                                                                                                                                                                       | Rows `WorkbenchOpen`, `WorkbenchPair`                                                                                                                                                               |
| `apps/telemetry/app/catalogue/collaboration.ts`, `connections.ts`, `event-explanations.ts`                                                                                                                 | `WORKBENCH_SESSIONS` (`Session·Opened·Workbench`), `WORKBENCHES_PAIRED` (`Token·Linked·Workbench`) in API Token Activity                                                                            |
| `apps/live/e2e/workbench-embed.spec.ts` (planned), `apps/live/e2e/workbench-support.ts` (planned), `apps/live/e2e/fixtures/fake-workbench.html` (planned), `playwright.config.ts`, `scripts/e2e-stack.mjs` | Project `workbench` (dark), opt-in `E2E_WORKBENCH=1` like `E2E_DRIVE`                                                                                                                               |
| `docs/specs/015-api/api.md`                                                                                                                                                                                | Segment row `workbench`; four Owner-keyed data rows; rate-limiting row; Auth's third bearer                                                                                                         |
| `docs/specs/017-telemetry/telemetry.md`                                                                                                                                                                    | The three types                                                                                                                                                                                     |
| `docs/operations/self-hosting.md`, `docs/development/local-development.md`, `README.md`                                                                                                                    | `APP_BASE_URL` builds workbench and pairing URLs; the rate-limiter binding; the e2e flag                                                                                                            |
| `apps/help/app/**`, `packages/help-registry`                                                                                                                                                               | The workbench help article, registered per `docs/instructions/register-a-help-article.md` (plan phase 8)                                                                                            |

## Domain and naming

| Term                | Identifier                                                            | Meaning                                                                    |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Workbench           | the frame's parent, known by its origin                               | A developer tool that frames the editor beside an agent                    |
| Workbench name      | `name` (pairing, request), `hello-ack.name`                           | The tool's display name ("Spinner"), shown in copy, never enforced         |
| Origin              | `WorkbenchOrigin` (branded string), `parseWorkbenchOrigin`            | `scheme://host[:port]`, the enforced identity of a workbench               |
| Pairing request     | `workbench_pairing_requests` row, `PairingRequestStatus`              | One ask to pair a token with an origin, answered once                      |
| Pairing code        | `code` (`?code=`)                                                     | The request's public handle in the pairing URL                             |
| Pairing             | `workbench_pairings` row, `WorkbenchPairing`                          | A token and an origin its owner approved                                   |
| Unpair              | `DELETE /api/workbench/pairings/:id`                                  | Removing a pairing and ending its sessions                                 |
| Workbench ticket    | `workbench_tickets` row; the 22-character secret                      | Single-use, one-minute credential that opens one session                   |
| Workbench session   | `workbench_sessions` row; `lvw_` secret; `WorkbenchContext`           | The frame acting as the person on one document                             |
| Session level       | `WorkbenchRole` (`role` on the wire)                                  | `view` or `edit` (participate reserved), the token's level on the document |
| Confinement         | `WORKBENCH_ROUTES`, `workbenchRouteVerdict`, `403 workbench_confined` | What a session may reach                                                   |
| Workbench page      | `/embed/workbench`, `WorkbenchPage`, `WorkbenchPhase`                 | The frameable page that binds and hosts the editor                         |
| Binding             | `hello` / `hello-ack`                                                 | Proof that the parent is the minting origin                                |
| Renewal             | `livediagram:renew` / `livediagram:ticket`                            | A fresh ticket redeemed before the session expires                         |
| Workbench message   | `WorkbenchMessage`, `type` `livediagram:*`, `v: 1`                    | One `postMessage` between the page and its workbench                       |
| Selection reference | `selectionReference()`, `SelectionReference { text, count }`          | The text a workbench attaches to the person's message                      |
| Editor surface      | `EditorSurface` `'app' \| 'embed' \| 'workbench'`                     | Where the editor runs; `workbench` is a distinct surface                   |
| Ended               | `WorkbenchEndReason` `expired`, `revoked`, `trashed`, `refused`       | Why a page stopped editing                                                 |

Banned: "integration", "host app" or "client" for a workbench; "link" or "connect" for pairing (a repository link
is another thing); "token" for a workbench session or a ticket (`lvd_` is the token); "share", "embed code" or
"share code" for a ticket; "iframe mode" for the surface; "authorise" for approve (the page's verbs are Allow and
Don't allow).

## Behaviour and state

### Invariants

- **I1** A workbench session never reaches a document other than its own: such a request answers 404, decided at
  the choke point before any route runs.
- **I2** A workbench session never reaches a route outside `WORKBENCH_ROUTES`: `403 workbench_confined`.
- **I3** A session's level never exceeds its token's, and every gate re-evaluates the owner's access now (the gates
  run with the owner's identity on every request).
- **I4** `ctx.clerkUserId` is null and `ctx.token` is null under a session; `resolveOwner()` and `verifiedUserId`
  are the owner. So administration (`clerkUserId` only) is unreachable and `405 use_changesets` never fires.
- **I5** No ticket is minted for an origin its token is not paired with.
- **I6** No pairing is answered except by the token's owner in a Clerk session; a token and a workbench session can
  neither read a request's page view nor answer it.
- **I7** Secrets (ticket, session) are stored as SHA-256 hex only; logs carry the session id's first 8 characters
  and the token id, never a secret, a code or an origin path.
- **I8** The workbench page mounts no editor and sends no `livediagram:*` message other than `hello` (and `ended`
  `refused`, to the session's origin) before a valid `hello-ack`.
- **I9** The editor in a workbench never runs the guest migration, never writes the participant record, and never
  writes preferences to the api.

### Pairing

```text
            mint (unpaired) / POST pairing-requests
 (none) ───────────────────────────────────────────▶ pending ──Allow──▶ approved ─▶ pairing row
                                                        │ └──Don't allow──▶ declined
                                                        └──now ≥ expires_at──▶ expired (read as such)
```

1. **Ask from a mint.** `POST /api/workbench/tickets` for an origin with no `workbench_pairings` row for the token
   calls `livePairingRequest(tokenId, origin)` (`status = 'pending' AND expires_at > now`); none creates one with
   `name` null. The answer is `428 pairing_required { pairingUrl, expiresAt }`. Log `[workbench] pairing-requested`.
2. **Ask from `workbench pair`.** `POST /api/workbench/pairing-requests { origin, name? }` returns
   `{ status: 'paired', pairing }` when the pairing exists, else the live request (created when none, with `name`;
   an existing request takes the given `name` when one is given, WB2) as
   `{ status: 'pending', pairingUrl, code, expiresAt, interval }`. One live request per token and origin, enforced by
   a partial unique index; a pending row past its expiry is deleted before the insert.
3. **Read.** `GET /api/workbench/pairing-requests/:code` (Clerk session, owner only) returns the page's view:
   `{ origin, name, tokenName, expiresAt, status }`, `status` read as `expired` when pending past its expiry.
4. **Answer.** `POST .../:code/approve` in one batch: the request's `status` from `pending` to `approved`
   (`UPDATE ... WHERE status = 'pending' AND expires_at > now`) and `INSERT OR IGNORE` the pairing (`name` from the
   request). `POST .../:code/decline` sets `declined` and records nothing else. A request already answered answers
   `409 pairing_answered`; one expired `410 pairing_expired`. Logs `[workbench] paired`, `[workbench] pairing-declined`.
5. **Wait.** `GET /api/workbench/pairing-requests/:code/status` (the requesting token only, by the code, WB45) returns
   `{ status, expiresAt, interval }`; the CLI polls it every `interval` seconds.
6. **Paired.** Mints for that token and origin now pass the pairing check.
7. **Unpair.** `DELETE /api/workbench/pairings/:id` (Clerk session, the token's owner) runs
   `endWorkbenchAccess({ pairingId }, 'unpaired')`.
8. **Token revoked.** Both revoke routes run `endWorkbenchAccess({ tokenId }, 'revoked')`: pairings, pending
   requests, tickets and sessions of the token go.

A request row stays after its answer until the sweep, so the waiting CLI reads the answer; it is never answered
twice (the `status = 'pending'` guard).

### The ticket mint (`POST /api/workbench/tickets`)

In order; the first failure answers:

1. Bearer is a workbench session: `403 workbench_confined` (choke point). No `ctx.token` (a Clerk session or a
   guest): `403 token_required`.
2. `WORKBENCH_TICKET_RATE_LIMITER` keyed `workbench-ticket:<tokenId>`: over, `429 rate_limited`. The write limiter
   (`token:<tokenId>`) applies too, as for every token write.
3. Body through `readBody`; `documentId` a string of 1 to 64 characters, `tabId` absent or the same, else
   `400 bad_request` (`invalid documentId`, `invalid tabId`). `origin` through `parseWorkbenchOrigin`: refused,
   `400 invalid_origin`.
4. Pairing: no row for `(token_id, origin)`, step 1 of Pairing, `428 pairing_required`.
5. `getDocumentMeta`; absent, `missingDocument` (404, or 410 `document_trashed`). The grant is
   `resolveDocumentGrant(env, id, owner, null, ownerId, null, teamId, owner)`: the owner's own access, never a share
   code (WB3). None, 404. A `tabId` the document does not link, 404.
6. Level: `grant.role`, lowered to `view` when the token is read-only.
7. Insert the ticket (`expires_at = now + WORKBENCH_TICKET_TTL_MS`) and answer
   `201 { url, documentId, tabId, expiresAt }` (`tabId` null when none was given, WB44), `url` =
   `${appBaseUrl(env)}/embed/workbench?d=${encodeURIComponent(documentId)}#ticket=${ticket}` (WB4). Log
   `[workbench] ticket-minted`.

### Redemption (`POST /api/workbench/sessions`)

Credential-free: an `Authorization` other than `lvw_` is ignored; `lvw_` is confined (WB5).

1. Body `{ ticket }`, `ticket` matching `^[A-Za-z0-9_-]{22}$`, else `400 bad_request` (`invalid ticket`).
2. Consume: `UPDATE workbench_tickets SET used_at = ? WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?
RETURNING ...`. No row: `SELECT used_at, expires_at` classifies `used`, `expired` or `unknown`, logged
   `[workbench] session-refused`, answered `401 invalid_ticket { reason }`.
3. The token must be live and the pairing present (joined in step 2's `RETURNING` query through `token_id` and
   `pairing_id`); else `401 invalid_ticket { reason: 'unknown' }`.
4. The document: `getDocumentMeta`; absent, `missingDocument`; the owner's grant as in the mint, none, 404. The
   level is the ticket's `role` lowered by the grant (`edit` only when both are `edit`).
5. Insert the session: `id` a UUID, the secret `lvw_` + 43 base64url characters (32 random bytes), its hash,
   `expires_at = min(now + WORKBENCH_SESSION_TTL_MS, token.expires_at)` (WB6).
6. `person`: the owner's `participants` row as `{ id, name, color, pictureUrl }`; no row gives `name` and `color`
   null (WB7). Answer `201 WorkbenchSessionResponse`. Log `[workbench] session-opened`.

### A request bearing `lvw_` (the choke point, `index.ts`)

Resolved where `lvd_` is, only when no Clerk JWT verified:

1. `bearer` matching `isWorkbenchSessionFormat` → `resolveWorkbenchSession(env, bearer, now)`:
   `SELECT s.*, t.read_only, t.revoked, t.expires_at AS token_expires_at FROM workbench_sessions s JOIN api_tokens t
ON t.id = s.token_id WHERE s.secret_hash = ?`. No row → `unknown`; token revoked or expired → `revoked`;
   `s.expires_at <= now` → `expired`. Refused: log `[workbench] bearer-refused { reason, sessionPrefix }`, answer
   `401 invalid_session` with `WWW-Authenticate: Bearer error="invalid_token"`.
2. `ctx.workbench = { sessionId, ownerId, tokenId, pairingId, documentId, tabId, origin, level }`, `level` lowered to
   `view` when the token is read-only; `clerkUserId` null; `resolveOwner = () => ownerId`;
   `verifiedUserId = ownerId`; `ctx.token = null`.
3. A request carrying `X-Share-Code`, `X-Owner-Id` or `X-Share-Password` beside `lvw_`: `403 workbench_confined`
   (WB8).
4. `workbenchRouteVerdict(method, segments, ctx.workbench)`: `'allow'`, `'other-document'` → 404 `not_found`,
   `'confined'` → `403 workbench_confined`, logged `[workbench] confined { method, route, sessionPrefix }` with
   `route` from `apiRouteLabel`.
5. Level: a `view` session's `POST`, `PUT` or `DELETE` is refused `403 workbench_read_only`, except
   `POST /api/documents/:doc/room-ticket` and `DELETE /api/workbench/sessions/current` (WB9).
6. Rate limits: writes key `workbench:<sessionId>` on `WRITE_RATE_LIMITER` (WB10); reads are unmetered, as a
   signed-in editor's are.

`WORKBENCH_ROUTES` (`:doc` is the session's document; a document route naming any other id is `other-document`):

| Method           | Path under `/api`                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET              | `capabilities`, `openapi.json`, `templates`, `templates/:kind`, `icons`, `schema`, `schema/:kind`                                                                                     |
| GET              | `participants/:owner` (the session's owner only; another id is `confined`), `preferences`, `custom-themes`, `shape-libraries`                                                         |
| POST             | `images`                                                                                                                                                                              |
| GET              | `images/:id` (the route then requires `?d=:doc`)                                                                                                                                      |
| GET, PUT         | `documents/:doc`                                                                                                                                                                      |
| GET, PUT, DELETE | `documents/:doc/tabs/:tabId`                                                                                                                                                          |
| PUT              | `documents/:doc/tabs/:tabId/name`                                                                                                                                                     |
| POST             | `documents/:doc/tabs/:tabId/changesets`, `documents/:doc/changesets/:changesetId/revert`                                                                                              |
| GET              | `documents/:doc/changesets`, `documents/:doc/changesets/:changesetId`, `documents/:doc/comments`                                                                                      |
| GET              | `documents/:doc/tabs/:tabId/render.svg`, `documents/:doc/tabs/:tabId/comment-pictures`                                                                                                |
| POST             | `documents/:doc/tabs/:tabId/comments`, `.../comments/:commentId/reply`, `.../resolve`, `.../reopen`                                                                                   |
| DELETE           | `documents/:doc/tabs/:tabId/comments/:commentId`                                                                                                                                      |
| POST             | `documents/:doc/tabs/:tabId/qa`, `documents/:doc/room-ticket`                                                                                                                         |
| GET, POST        | `documents/:doc/items`                                                                                                                                                                |
| POST             | `documents/:doc/items/bulk`, `items/:itemId`, `items/:itemId/move`, `items/:itemId/vote`, `items/:itemId/comments`, `items/:itemId/comments/resolve`, `items/:itemId/comments/reopen` |
| DELETE           | `documents/:doc/items/:itemId`, `documents/:doc/items/:itemId/comments/:commentId`                                                                                                    |
| PUT              | `documents/:doc/item-types`                                                                                                                                                           |
| DELETE           | `workbench/sessions/current`                                                                                                                                                          |

Everything else is `confined`, among it: `documents/:doc` `DELETE`, `copy`, `folder`, `shared-tabs`, `share*`,
`community`, `thumbnail`, `tabs/:tabId/link`, `tabs/:tabId/presence` (an agent's door), `documents` (the library),
`folders`, `shared`, `favourites`, `home`, `timeline`, `activity`, `trash`, `placement-defaults`, `tokens`, `teams`,
`account`, `migrate`, `guest-id`, `ai`, `drive`, `oauth`, every write to `preferences`, `participants`,
`custom-themes`, `shape-libraries`, `images/:id` `DELETE`, `images/usage`, `GET images`, and every
`workbench/*` route but the one above. `/ws` carries no bearer and is decided by its ticket. `events`, `unfurl` and
`share/:code` are called without credentials by the editor and never see `lvw_`.

### Route effects under a session

- `document-room-routes.ts` mint: `account: ctx.clerkUserId !== null || ctx.workbench !== null`; `personTag` from
  `ctx.clerkUserId ?? ctx.workbench?.ownerId`; `role: capWorkbenchRole(grant.role, ctx.workbench?.level)`;
  `workbenchPairing: ctx.workbench?.pairingId ?? null`. The upgrade sets `X-Verified-Workbench-Pairing` on every
  path (empty when none), as every other trust header.
- `images.ts` `GET /api/images/:id`: under `ctx.workbench` the owner shortcut is skipped and `d` must equal the
  session's document (else 404); the document path decides as for a share visitor.
- The tab `PUT`, comments, changesets and revert see `ctx.token === null`: a person's editor. A changeset a session
  submits (only Undo's revert in practice) is a person's, never held.
- Changesets submitted by the owner's agent while the frame selects: the room's `/selections` marks the frame's
  socket `mine` through the person tag, so it never holds against the owner's agent, and the CLI's `selected`
  reads it.

### Ending access (`endWorkbenchAccess`)

`scope` is `{ pairingId }` or `{ tokenId }`; `reason` is `unpaired` or `revoked`.

1. Read the pairings in scope with every document any of their sessions names (`SELECT DISTINCT pairing_id,
document_id FROM workbench_sessions WHERE pairing_id IN (...)`).
2. One batch: `DELETE FROM workbench_pairings` in scope (sessions and tickets cascade); for a token, also
   `DELETE FROM workbench_pairing_requests WHERE token_id = ?`.
3. Close: `closeWorkbenchSessions(env, documentId, pairingId)` per pair, `TEAM_ROOM_CLOSE_CONCURRENCY` at a time,
   best-effort (the D1 delete is the change).
4. Log `[workbench] session-ended { reason, documentId, tokenId, sessionPrefix }` per session read in step 1, and
   `[workbench] unpaired { tokenId, pairingId, rooms, unreached }` for each pairing.

The room closes every socket whose attachment `workbenchPairing` equals the id with `WORKBENCH_ENDED_CLOSE`, reason
`workbench-ended`. The page's own `DELETE .../sessions/current` deletes its row and closes nothing (renewal keeps
the socket, WB11).

### The workbench page (`/embed/workbench`)

`WorkbenchPhase`:

| Phase       | Entered when                                               | Shows                                                                 | Leaves to                                                       |
| ----------- | ---------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `reading`   | first render                                               | "Opening your diagram…"                                               | `redeeming` (ticket read), `refused('no-ticket')`               |
| `redeeming` | `takeTicketFromAddress` returned a ticket                  | as `reading`                                                          | `binding`, `refused('ticket')`, `refused('mismatch')`, `failed` |
| `binding`   | redeem answered with the address's `d`                     | as `reading`                                                          | `mounted`, `unbound`                                            |
| `mounted`   | a valid `hello-ack` within `WORKBENCH_HANDSHAKE_MS`        | the editor                                                            | `ended(expired \| revoked \| trashed)`                          |
| `ended`     | expiry unrenewed, 401 `invalid_session`, close 4006, trash | the editor, read-only, the Reconnect line (trashed: the deleted card) | terminal (WB12)                                                 |
| `unbound`   | not framed, or no valid ack in time                        | "This view opens only inside <origin>."                               | terminal                                                        |
| `refused`   | no ticket, ticket refused, document mismatch               | the refused copy                                                      | terminal                                                        |
| `failed`    | redeem's network failure or 5xx                            | the load error card (`embed`)                                         | terminal                                                        |

Transitions, in order:

1. `reading`: `takeTicketFromAddress` reads `location.hash` as `URLSearchParams`, takes `ticket`, and calls
   `history.replaceState(null, '', pathname + search)` before any request. `d` from `?d=`. A ticket failing the
   22-character shape, or none: `refused('no-ticket')`.
2. `redeeming`: `apiRedeemWorkbenchTicket(ticket)` with no credential. `401 invalid_ticket`, 404 or 410:
   `refused('ticket')`. A 201 whose `documentId` differs from `d`: `apiEndWorkbenchSession(secret)`, post
   `ended { reason: 'refused' }` to `origin`, `refused('mismatch')`.
3. `binding`: `window.parent === window` → `unbound` at once. Else `createWorkbenchPort(origin, window)`, post
   `hello`, wait `WORKBENCH_HANDSHAKE_MS` for a message whose `event.origin === origin`, `event.source ===
window.parent` and `parseWorkbenchMessage` gives `hello-ack`. None: `unbound`, `apiEndWorkbenchSession`, log
   `[workbench] handshake-failed`. Got: log `[workbench] handshake-ok`, store the name (WB13), `mounted`.
4. `mounted`: `WorkbenchAuthBridge` renders with the session; `setWorkbenchConfinement(session)`; the editor mounts
   with `surface="workbench"`; `track('Session', 'Opened', 'Workbench')` once.
5. Renewal (`useWorkbenchRenewal`): at `expiresAt - WORKBENCH_RENEW_LEAD_MS` post `renew`, then every
   `WORKBENCH_RENEW_RETRY_MS` until a ticket lands or the session expires. A `livediagram:ticket` is redeemed; a 201
   whose `documentId` and `origin` equal the bound ones swaps the session (provider, confinement, context), deletes
   the old one, logs `[workbench] renewed`; anything else is logged `[workbench] renew-failed { reason }` and the
   retry continues. A `ticket` outside the renew window is redeemed alike (WB14).
6. `ended`: at `expiresAt` unrenewed (`expired`); any api answer `401 invalid_session` (`revoked` before
   `expiresAt`, `expired` after); room close 4006 (`revoked`); `documentTrashed` (`trashed`). On entering: post
   `ended { reason }`, the editor's `sessionRole` forced to `view`, the autosave and the room stop
   (`room.close()`), `setWorkbenchConfinement(null)` is NOT called (a dead bearer keeps refusing locally), log
   `[workbench] ended { reason }`.

### The editor in a workbench

`WorkbenchAuthBridge` publishes `{ authLoaded: true, isSignedIn: true, userId: person.id, user: { id, firstName:
person.name, lastName: null, fullName: person.name, username: null, email: null, createdAt: null, pictureUrl },
getToken: async () => currentSecret, signOut: noop, deleteAccount: null }` and registers
`registerTokenProvider(() => currentSecret)` in a layout effect, before the editor's first fetch.

`ClerkProvider` on `pathname.startsWith('/embed/workbench')` renders neither bridge and holds
`DEFERRED_AUTH_PENDING`, so nothing above the page ever reads as a settled guest, Clerk configured or not.

`useClerkApiBootstrap` reads `useWorkbenchSession()` first in both variants. With a session: no
`settleGuestMigration`, no `subscribeGuestMigration` pending, no 5 s timeout, no provider registration; it returns
`{ isSignedIn: true, authLoaded: true, clerkUserId: person.id, clerkDisplayName: person.name }`.

`useIdentityBootstrap`, when `workbenchMode`:

- The id is `workbench.documentId`; `?s=` and `documentIdFromPath` are not read.
- `self` from `apiLoadSelf(person.id)`, else `{ id, name: person.name ?? randomName(), color: person.color ??
randomColor() }`; `apiSaveSelf` never runs (I9).
- The owner branch runs (`apiLoadDocument`); `isOwner` is set as today but `apiListShareLinks` is not called;
  `setSessionRole(workbench.level)`; the identity screen never opens.
- `refreshDocumentList` and `refreshSharedList` are not called on any path; `recordOpen` is false.
- When the session carries `tabId`, that tab is made active after seeding.

The Surface table, every gate `workbenchMode` touches (`appChrome` is `surface === 'app'`):

| Gate                                                                                                                                        | File                                                         | In a workbench                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| `EditorHeader` (and with it the account menu, Share, Make a copy, role pill)                                                                | `EditorView.tsx`                                             | Not rendered                                              |
| `CommunityBar`, Community badge request                                                                                                     | `EditorView.tsx`                                             | Not rendered, not requested                               |
| TabBar, palette, toolbars, Quick style, panels, search                                                                                      | `EditorView.tsx`                                             | Rendered as in the app                                    |
| `EmbedChrome`                                                                                                                               | `EditorView.tsx`                                             | Not rendered; `WorkbenchChrome` instead                   |
| Explorer (floating and toolbar)                                                                                                             | `useCanvasChromePanels.tsx`, `editor-page.tsx` status shells | Not rendered; status screens use `EmbedShell`             |
| AI panel, AI palette entries, photo-import note reading                                                                                     | `CanvasAiPanel.tsx`, `useCapabilities` consumer              | `aiEnabled` read as false                                 |
| Sign-in banner, theme-mode banner, power-user offer                                                                                         | `EditorView.tsx`, `usePowerUserOffer`                        | Off                                                       |
| Settings categories `ai`, `documents`, `account`, `tokens`; the Appearance choice                                                           | `settings-catalogue.ts`                                      | Hidden                                                    |
| Share, delete, move, take offline, copy, AI commands                                                                                        | `editor-commands.ts`                                         | Absent                                                    |
| TabBar "copy to another document"                                                                                                           | `EditorView.tsx` `otherDocuments`                            | `[]`                                                      |
| Image picker gallery                                                                                                                        | `ImagePicker.tsx`, `useEditorImages`                         | Upload only; `apiListImages` never called                 |
| Shape library and custom theme writes (save to My shapes, theme builder save and delete)                                                    | their hosts                                                  | Absent; reads stay                                        |
| `useDriveFollow`, `useFolders`, `useFavourites`, `useTeams`, `useTeamPeople`, `useTeamLibrariesSweep`, `useShareLinks`, `usePublishPicture` | `useEditorState.ts`                                          | `enabled: false`                                          |
| `useCommentMentions`, `useAssigneeOptions`                                                                                                  | `hooks/collab`                                               | Candidates from presence only; no team read, no notify    |
| Identity screen                                                                                                                             | `useEditorState.ts` `joinScreenOpen`                         | Never                                                     |
| `defaultPan`, `useModeDefaultTool` embed arguments                                                                                          | `useEditorState.ts`                                          | As the app (`false`)                                      |
| Element indicators, comment badges                                                                                                          | `EditorView.tsx`                                             | As the app                                                |
| `DocumentTrashedCard`                                                                                                                       | `editor-page.tsx`                                            | `restorable={false}`                                      |
| `LoadErrorCard`, `NotFound`                                                                                                                 | `editor-page.tsx`                                            | `embed` forms (no recovery card; create-new in a new tab) |

Preferences: `fetchUserPreferences` runs; `writeUserPreferences` keeps the local write and the event and skips
`apiPutPreferences` under confinement. Appearance: `livediagram:theme` calls `setAppearanceOverride(scheme)`; before
one arrives the override is `null` and the system scheme applies (the stored setting in the frame's partitioned
storage is ignored while `workbenchMode`, WB15).

Client confinement: `apiFetch` with an `Authorization: Bearer lvw_` header and a verdict other than `allow` throws
`WorkbenchConfinedError` without a request and logs `[workbench] request-confined { method, route }` once per
route label; `reportNetworkError` is not called (WB16).

### Workbench messages (`useWorkbenchMessages`)

- `ready` once, after `hydrated` and the first active tab: `documentId`, `documentName`, `tabId`, `tabName`, `role`
  (`sessionRole`).
- `tab` on every later active-tab change; the selection resets to none, which sends a `selection` after the settle.
- `selection` after the selection store has not changed for `WORKBENCH_SELECTION_SETTLE_MS`, only when its text
  differs from the last sent (WB17).
- `reveal`: each ref resolved with `resolveRef` over the active tab's element ids; found ids are brought into view
  (the changeset toast's Show) and outlined through `ChangesetRevealContext` in the person's colour for
  `CHANGESET_REVEAL_MS` (WB18); refs not found or ambiguous are skipped and logged
  `[workbench] reveal-missed { count }`.
- `theme`: `setAppearanceOverride(colourScheme)`.
- `renew`, `ticket`, `ended`: the page (above).

### The selection reference (`selectionReference`)

Input `{ documentId, documentName, tab, tabIds, rev, selectedIds }`, `rev` from `useTabRevisions` (the last revision
the editor knows for the tab: its load, its own saves' answers, relayed changesets). Built on `buildViewModel(tab,
{ rev, tabIds })`, so refs, kind words and labels are the outline's own.

1. Header: `[livediagram] ${jsonString(documentName)} › tab ${jsonString(tab.name)} (doc ${documentId}, tab
${tabRefOf(tab.id)}, rev ${rev})`. The document is named by its full id (WB19).
2. Selected elements, in the tab's element order (WB20), ids not on the tab dropped. None: the second line is
   `whole tab` and there is no third (WB21).
3. Second line: `selected: ` and the first `WORKBENCH_SELECTION_MAX_REFS` items joined by `, `. Item, as the outline's
   `nodeLine` prints an element: the kind word (`kindOf(el)`), the ref (`refs.refOf(id)`) and the label (`jsonString(label, LABEL_CUT_CHARS)` from
   `textField(el, 'label')`, omitted when null), joined by a space in that order (`button 146b "Play"`). More:
   ` … and ${n} more: livediagram tab view ${documentId} --tab ${tabRef} --view show --ref selected` appended to
   the same line (WB22).
4. Third line: `read: livediagram tab view ${documentId} --tab ${tabRef} --view show --ref ${firstRef}`.

Lines joined by `\n`, no trailing newline. `count` is the number of selected elements on the tab.

### The CLI

`workbench open <doc> [--tab <t>] --origin <origin> [--json]` (verb `workbench.open`, behaviour `write`):

1. `parseWorkbenchOrigin(--origin)`; refused, exit 1 `invalid_origin` naming the shapes.
2. `resolveDocument` without a share code (a share-link URL exits 2: "a workbench opens your own documents"), then
   `resolveTab` when `--tab` is given.
3. `POST /api/workbench/tickets`. 201: text prints `url`; `--json` prints `{ url, documentId, tabId, expiresAt }`.
   `428 pairing_required`: exit 4 (WB23), thrown as `VerbRefusal { status: 403, code: 'pairing_required' }`, error
   "this workbench is not paired with your token", fix `livediagram workbench pair --origin <origin>`. Other statuses
   through `failureOf`.
4. `Cli·Used·WorkbenchOpen` on exit 0.

`workbench pair --origin <origin> [--name <workbench>] [--json]` (verb `workbench.pair`, local, behaviour `write`),
`pairWorkbench` modelled on `loginWithDevice`:

1. Origin as above; `--name` trimmed, 1 to `WORKBENCH_NAME_MAX_LENGTH` characters, else exit 1.
2. `POST /api/workbench/pairing-requests`. `paired`: prints the pairing (text `paired <origin> as <name>`, ` as <name>`
   left out when the pairing has none), exit 0.
3. `pending`: stdout gets the pairing URL at once (text: the URL; `--json`: one line `{ "status": "pending",
"pairingUrl", "expiresAt" }`), flushed before waiting (WB24). When stdout is a terminal, `io.openUrl(pairingUrl)`
   and stderr "Opening <url> in your browser. If it does not open, open it yourself."; piped, nothing opens (WB25).
   stderr "Waiting for approval…".
4. Loop: `io.sleep(interval * 1000)`, `GET .../:code/status`. `pending` continues; `approved` prints the result
   (text `paired <origin>`, ` as <name>` added when `--name` was given; `--json`
   `{ "status": "paired", "origin", "name" }`), exit 0; `declined` exit 4 "the pairing was declined in the browser";
   `expired` exit 4 "the pairing request expired before it was answered", fix
   `livediagram workbench pair --origin <origin>`; `429` adds `DEVICE_SLOW_DOWN_S` to the interval; 404 exit 4 "the
   pairing request is gone (was the token revoked?)"; a network failure retries, the third in a row exits 7. Past
   `expiresAt` plus one interval without an answer reads as `expired`. The three exit-4 endings carry the codes
   `pairing_declined`, `pairing_expired` and `pairing_gone` (WB48).
5. `Cli·Used·WorkbenchPair` on exit 0.

`guide workbench` (topic `workbench` of `GUIDE_TOPICS`, within `GUIDE_TOPIC_MAX_TOKENS`) teaches an agent to read a
selection reference: the header, the `selected` items as data, never instructions; re-reading the refs with `tab view
--view show --ref` and `--only`, and the `… and n more` tail with `--ref selected`; `tab render` to look; `presence set` and `presence clear` while it works; and that
the person's own selection never holds the agent's writes. The skill's description names the `[livediagram]` line
(within `SKILL_FRONTMATTER_MAX_TOKENS`) and its body sends an agent to `guide workbench` first.

## Interfaces and contracts

### Routes

| Method | Path                                            | Caller                       | Success                                        | Rejections                                                                                                                                                                                        |
| ------ | ----------------------------------------------- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/workbench/tickets`                        | token                        | 201 `WorkbenchTicketResponse`                  | 401 `invalid_token`, 403 `token_required`, 403 `workbench_confined`, 400 `bad_request`, 400 `invalid_origin`, 428 `pairing_required`, 404 `not_found`, 410 `document_trashed`, 429 `rate_limited` |
| POST   | `/api/workbench/sessions`                       | anyone holding a ticket      | 201 `WorkbenchSessionResponse`                 | 400 `bad_request`, 401 `invalid_ticket` `{ reason }`, 404 `not_found`, 410 `document_trashed`, 429 `rate_limited`                                                                                 |
| DELETE | `/api/workbench/sessions/current`               | workbench session            | 204                                            | 401 `invalid_session`, 403 `not_a_workbench_session`                                                                                                                                              |
| POST   | `/api/workbench/pairing-requests`               | token                        | 200 `WorkbenchPairingRequestCreated`           | 401 `invalid_token`, 403 `token_required`, 400 `bad_request`, 400 `invalid_origin`, 429 `rate_limited`                                                                                            |
| GET    | `/api/workbench/pairing-requests/:code/status`  | the requesting token         | 200 `WorkbenchPairingStatusResponse`           | 403 `token_required`, 404 `not_found`                                                                                                                                                             |
| GET    | `/api/workbench/pairing-requests/:code`         | Clerk session, owner         | 200 `{ request: WorkbenchPairingRequestView }` | 401 `sign_in_required`, 404 `not_found`                                                                                                                                                           |
| POST   | `/api/workbench/pairing-requests/:code/approve` | Clerk session, owner         | 200 `{ pairing: WorkbenchPairing }`            | 401 `sign_in_required`, 404 `not_found`, 409 `pairing_answered`, 410 `pairing_expired`                                                                                                            |
| POST   | `/api/workbench/pairing-requests/:code/decline` | Clerk session, owner         | 204                                            | 401 `sign_in_required`, 404 `not_found`, 409 `pairing_answered`, 410 `pairing_expired`                                                                                                            |
| GET    | `/api/workbench/pairings` (WB46)                | Clerk session                | 200 `WorkbenchPairingsResponse`                | 401 `sign_in_required`                                                                                                                                                                            |
| DELETE | `/api/workbench/pairings/:id`                   | Clerk session, token's owner | 204                                            | 401 `sign_in_required`, 404 `not_found`                                                                                                                                                           |

The status and name of each rejection the spec leaves unnamed are WB43. Any `lvw_` request (choke point): 401 `invalid_session`, 403 `workbench_confined`, 403 `workbench_read_only`, 404
`not_found` (another document). `invalid_origin`, `pairing_required`, `invalid_ticket`, `invalid_session`,
`workbench_confined`, `workbench_read_only`, `token_required`, `not_a_workbench_session`, `pairing_answered` and
`pairing_expired` are `WORKBENCH_ERROR_CODES` in `packages/api-schema/src/workbench.ts`, as `CHANGESET_ERROR_CODES` are (WB26). `:code` must match `^[A-Za-z0-9_-]{22}$`,
else 404. 401 `sign_in_required` is answered to tokens and sessions too (`clerkUserId` null).

### Wire types (`packages/api-schema/src/workbench.ts`)

```ts
export type WorkbenchRole = 'view' | 'participate' | 'edit';
export type WorkbenchTicketRequest = { documentId: string; tabId?: string; origin: string };
export type WorkbenchTicketResponse = {
  url: string;
  documentId: string;
  tabId: string | null;
  expiresAt: number;
};
export type WorkbenchPairingRequired = {
  error: 'pairing_required';
  pairingUrl: string;
  expiresAt: number;
};
export type WorkbenchSessionRequest = { ticket: string };
export type WorkbenchPerson = {
  id: string;
  name: string | null;
  color: string | null;
  pictureUrl: string | null;
};
export type WorkbenchSessionResponse = {
  session: string;
  documentId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchRole;
  expiresAt: number;
  person: WorkbenchPerson;
};
export type InvalidTicket = { error: 'invalid_ticket'; reason: 'expired' | 'used' | 'unknown' };
export type WorkbenchPairing = {
  id: string;
  tokenId: string;
  origin: string;
  name: string | null;
  pairedAt: number;
};
export type WorkbenchPairingsResponse = { pairings: WorkbenchPairing[] };
export type WorkbenchPairingRequestCreate = { origin: string; name?: string };
export type PairingRequestStatus = 'pending' | 'approved' | 'declined' | 'expired';
export type WorkbenchPairingRequestCreated =
  | { status: 'paired'; pairing: WorkbenchPairing }
  | { status: 'pending'; pairingUrl: string; code: string; expiresAt: number; interval: number };
export type WorkbenchPairingStatusResponse = {
  status: PairingRequestStatus;
  expiresAt: number;
  interval: number;
};
export type WorkbenchPairingRequestView = {
  origin: string;
  name: string | null;
  tokenName: string | null;
  expiresAt: number;
  status: PairingRequestStatus;
};
```

`parseWorkbenchOrigin(input: string): { ok: true; origin: WorkbenchOrigin } | { ok: false }`: at most
`WORKBENCH_ORIGIN_MAX_LENGTH` characters; parsed with `URL`; `protocol` `https:`, or `http:` with `hostname` one of
`localhost`, `127.0.0.1`, `[::1]`; `username`, `password`, `search`, `hash` empty; `pathname` `/` and the input
not ending in `/` (WB27); the input equal to `url.origin` (so no default port, no upper case, no trailing dot is
accepted that the browser would rewrite). `*` and `null` fail the parse.

`capWorkbenchRole(role, ceiling?)`: the lower of the two on the ladder `view < participate < edit`; no ceiling
gives `role`. Today both inputs are `view` or `edit`, so a room ticket never carries `participate` before share
roles teach `consumeWsTicket` to read it.

`pairingUrl` is `${appBaseUrl(env)}/workbench/pair?code=${code}`.

### Workbench messages (`packages/api-schema/src/workbench-messages.ts` (planned))

Every message is `{ type, v: 1, ... }`; strings are bounded as stated; anything else is invalid.

```ts
type HelloMessage = { type: 'livediagram:hello'; v: 1 };
type HelloAckMessage = { type: 'livediagram:hello-ack'; v: 1; name: string }; // 1..40 after trim
type ReadyMessage = {
  type: 'livediagram:ready';
  v: 1;
  documentId: string;
  documentName: string;
  tabId: string;
  tabName: string;
  role: WorkbenchRole;
};
type TabMessage = { type: 'livediagram:tab'; v: 1; tabId: string; tabName: string };
type SelectionMessage = {
  type: 'livediagram:selection';
  v: 1;
  documentId: string;
  documentName: string;
  tabId: string;
  rev: number;
  count: number; // 0 when nothing is selected
  reference: string; // selectionReference().text, always present (WB28)
};
type RenewMessage = { type: 'livediagram:renew'; v: 1 };
type TicketMessage = { type: 'livediagram:ticket'; v: 1; ticket: string }; // 22 base64url
type RevealMessage = { type: 'livediagram:reveal'; v: 1; refs: string[] }; // 1..20, each 1..64
type ThemeMessage = { type: 'livediagram:theme'; v: 1; colourScheme: 'light' | 'dark' };
type EndedMessage = {
  type: 'livediagram:ended';
  v: 1;
  reason: 'expired' | 'revoked' | 'trashed' | 'refused';
};
```

`parseWorkbenchMessage(data, direction)` returns the message, `{ ignored: type }` for an unknown type or another
`v`, or `{ invalid: type }` for a known type with a bad field. The port accepts only `event.origin === origin &&
event.source === window.parent`; anything else is dropped silently (not a workbench's message). Sends always use
`targetOrigin = origin`.

### CLI verbs

| Verb             | Input                                | Output                                                  | Exit codes          |
| ---------------- | ------------------------------------ | ------------------------------------------------------- | ------------------- |
| `workbench.open` | `doc` (positional), `tab?`, `origin` | `{ url, documentId, tabId, expiresAt }`; text: `url`    | 0, 1, 2, 3, 4, 6, 7 |
| `workbench.pair` | `origin`, `name?`                    | pending line, then `{ status: 'paired', origin, name }` | 0, 1, 4, 6, 7       |

Resource `{ name: 'workbench', summary: 'Workbenches: open a document in a developer tool, pair one' }`. Help text
of each within the CLI budgets; examples `livediagram workbench open "Home screen" --origin https://127.0.0.1:5175
--json` and `livediagram workbench pair --origin https://127.0.0.1:5175 --name Spinner`.

### Room

`AccessCloseMatch` gains `{ match: 'workbench'; pairingId: string }` (UUID pattern); `sessionMatchesAccessClose`
matches `session.workbenchPairing === pairingId`. `WORKBENCH_ENDED_CLOSE = 4006`, reason `workbench-ended`.
`RoomHandlers.onWorkbenchEnded` fires on it and the connector does not reconnect.

### OpenAPI

Eleven `RouteSpec` entries, segment `workbench`, tag `Workbench`, `auth`: `clerk` for the token and Clerk routes,
`public` for the redemption; `tokenUsable: true` for the ticket mint, the pairing request and its status only.
Request and response schemas from the types above; 428, 401 and 409/410 bodies inline. `route-parity.test.ts`
covers them by dispatch probe.

## Data and persistence

Migration `apps/api/migrations/0077_workbench.sql` (WB40):

```sql
CREATE TABLE workbench_pairing_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  answered_at INTEGER NULL
);
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin) WHERE status = 'pending';
CREATE INDEX workbench_pairing_requests_expiry ON workbench_pairing_requests (expires_at);

CREATE TABLE workbench_pairings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  name TEXT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (token_id, origin)
);
CREATE INDEX workbench_pairings_owner ON workbench_pairings (owner_id);

CREATE TABLE workbench_tickets (
  ticket_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER NULL
);
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);

CREATE TABLE workbench_sessions (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);

ALTER TABLE ws_tickets ADD COLUMN workbench_pairing TEXT NULL;
```

| Field                                    | Class      | Notes                                                                                                                                            |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workbench_pairing_requests.code`        | handle     | 16 random bytes base64url, stored in the clear: it grants nothing without the owner's session and is served again while the request lives (WB29) |
| `*.owner_id`                             | identity   | The token's owner (a Clerk id); account-only                                                                                                     |
| `*.origin`                               | identity   | Normalised by `parseWorkbenchOrigin`                                                                                                             |
| `*.name`                                 | display    | 1 to 40 characters, trimmed; never enforced                                                                                                      |
| `workbench_tickets.ticket_hash`          | credential | SHA-256 hex of the 16-byte ticket                                                                                                                |
| `workbench_sessions.secret_hash`         | credential | SHA-256 hex of the `lvw_` secret                                                                                                                 |
| `workbench_sessions.id`                  | handle     | UUID; its first 8 characters are the logged prefix                                                                                               |
| `*.role`                                 | grant      | `view` or `edit` written today (WB1)                                                                                                             |
| `ws_tickets.workbench_pairing`           | ephemeral  | 60 s like the ticket                                                                                                                             |
| Room attachment `workbenchPairing`       | ephemeral  | Per socket, survives hibernation                                                                                                                 |
| The page's secret, session, origin, name | memory     | Never in storage                                                                                                                                 |

- **Retention.** The daily `0 3 * * *` run calls `sweepWorkbench(env, now)`: tickets past expiry, pairing requests
  past expiry, sessions expired more than `WORKBENCH_SESSION_GRACE_MS` ago (WB30), and pairings whose token is
  revoked or expired. Logged `workbench sweep: deleted <n> rows`.
- **Account deletion.** `deleteAccount` deletes the four tables' rows by `owner_id` before `api_tokens`.
- **Owner migration.** Account-only: a guest id never holds these rows.
- **Document purge.** Tickets and sessions cascade; pairings are per origin and stay.
- **Snapshot and restore.** None: these rows are credentials, not content; restoring a document from the Trash
  revives no session.

## Errors and edge cases

- **E1** Origin with a path, query, fragment, credentials, `*`, `null`, `http` on a non-loopback host, or a default
  port written out (`https://x:443`): `400 invalid_origin` at the api, exit 1 at the CLI.
- **E2** Two unpaired mints for one token and origin within the TTL: both 428 with the same `pairingUrl`.
- **E3** A pending request past its expiry when a new one is asked: deleted, a new code issued.
- **E4** Approve after Don't allow, or twice: `409 pairing_answered`; nothing changes.
- **E5** Approve after expiry: `410 pairing_expired`; the CLI reads `expired`.
- **E6** Another signed-in account opens the pairing URL: `404`; the page says it cannot find the request.
- **E7** A token approving its own request (`lvd_` on approve): `401 sign_in_required`.
- **E8** Token revoked while a request is pending: the request is deleted; the CLI's next poll gets 404, exit 4.
- **E9** Token revoked while the pair page is open: approve answers 404.
- **E10** A ticket redeemed twice: the second `401 invalid_ticket { reason: 'used' }`.
- **E11** A ticket redeemed after 60 s: `401 invalid_ticket { reason: 'expired' }`.
- **E12** Unpaired between mint and redemption: tickets cascade, `unknown`.
- **E13** The owner loses access between mint and redemption (left the team): 404 at redemption.
- **E14** The owner loses access mid-session: every gate refuses (404 or 403 per route); the room closes them as a
  member's sessions (4005, person tag); the page reads 4005 under a workbench as `revoked` (WB31).
- **E15** The document is trashed mid-session: close 4004 and 410 on saves; `ended(trashed)`, the deleted card
  without Restore.
- **E16** The document is purged: sessions cascade; next request 401 `invalid_session`, `ended(revoked)`.
- **E17** A view token's session tries to save: 403 `workbench_read_only`; the editor is read-only from the start, so
  only a crafted request meets it.
- **E18** The frame is reloaded: the fragment is gone, `refused('no-ticket')`.
- **E19** Frame opened directly in a tab (not framed): `unbound`, session revoked.
- **E20** Framed by another origin that forwarded the URL: `hello` never reaches it (target origin), `unbound` after
  5 s, session revoked.
- **E21** The workbench answers `hello-ack` with a bad `name`: invalid, ignored, logged; the wait continues to the
  deadline.
- **E22** Renewal never answered: `ended(expired)` at `expiresAt`, read-only, "Reconnect in <name> to keep
  editing."
- **E23** A renewal ticket for another document or origin: refused, logged `renew-failed { reason: 'mismatch' }`,
  the new session deleted.
- **E24** Session expiry capped by the token's expiry: the page renews earlier by the same lead; the token's own
  expiry ends it for good.
- **E25** Unsaved edits when the session ends: the autosave's last attempt fails 401; edits stay on screen, read-only;
  the line says to reconnect. Before the renew lead the autosave runs as usual, so at most one debounce window is
  at risk.
- **E26** `reveal` with refs from another tab: not found, skipped, logged.
- **E27** A selection of more than 20 elements: 20 items and the `… and n more` tail.
- **E28** A selected element with no label (a line, a freehand stroke): ref and kind only.
- **E29** Unknown message type, or `v: 2`: ignored, `[workbench] message-ignored <type>` once per type.
- **E30** Rate limit on the mint: 429, the CLI exits 6.
- **E31** `APP_BASE_URL` unset on a self-host: the URLs use `DEFAULT_BASE_URL`; the self-hosting doc says to set it.
- **E32** A host without Clerk: no tokens, so no mint; the page can only reach `refused('no-ticket')` or
  `refused('ticket')`; the pair page says pairing is not available.
- **E33** Two frames of one pairing on one document: two sessions, two sockets, one person tag; presence shows the
  person once per socket as for two browser tabs.
- **E34** The pair page opened in a frame: the live worker sends `X-Frame-Options: DENY`; nothing renders.

## Security and trust

- **Pairing is the gate on minting** (I5): a leaked token mints nothing for an origin its owner never approved, and
  approval needs the owner's own Clerk session (I6), which no token, session or guest header carries.
- **The pair page cannot be clickjacked**: `/workbench/pair` keeps `DENY`; Allow is a button on a page the person
  opened themselves from the CLI or the workbench.
- **What the page shows is what is enforced**: the origin is printed beside the name; the name is display only.
- **A ticket is a bearer**, single use (`used_at` guard in one statement), 60 s, hashed, only in the fragment; the
  fragment is cleared before the first request; `Referrer-Policy: strict-origin-when-cross-origin` and fragments
  never reach a `Referer` anyway.
- **A session is a bearer** in the page's memory only, hashed at rest, confined (I1, I2), level-capped (I3),
  re-gated on every request with the owner's identity, ended by unpair and revoke within one request or one room
  close.
- **Ambient headers refused** beside `lvw_` (WB8), so a session cannot borrow a share code's or a guest's access.
- **Images** under a session never take the owner shortcut, so a session cannot read the owner's gallery by id.
- **Clickjacking of the frame**: the editor mounts only for the minting origin (I8); a hostile parent of another
  origin gets no `hello` and a revoked session.
- **Message trust**: messages accepted only from `window.parent` at the bound origin; every field validated and
  bounded; labels sent in the reference are JSON-quoted, so a label cannot forge a line.
- **Rate limits**: mint and pairing-request creation 30 a minute per token, one bucket (`WORKBENCH_TICKET_RATE_LIMITER`, WB42);
  redemption on the anonymous write key per network; session writes on `workbench:<sessionId>`; status polls on
  the token read limiter.
- **No secret in logs** (I7); `[workbench]` logs carry ids, prefixes, reasons and counts.

## Performance and limits

- Each `lvw_` request: one indexed `SELECT` (`secret_hash` unique) joined to `api_tokens` by primary key, about the
  cost of `resolveApiToken` without its `last_used_at` write (WB32). The autosave's cadence (one save per debounce)
  adds one such read per save.
- `workbenchRouteVerdict`: a walk over at most 40 patterns of at most 8 segments, constant per request.
- Mint: four indexed reads (pairing, document meta, grant, tab link) and one insert. Redemption: one update, one
  read, one insert, one participant read.
- `endWorkbenchAccess` for a token: at most the token's pairings (a handful) times their documents; rooms closed
  10 at a time, 3 s each at most.
- `selectionReference`: `buildViewModel` over the tab, O(n log n) for refs; a 5,000-element tab builds in well under
  `VIEW_SLOW_MS`; run once per settled selection, never per pointer move.
- Messages: a selection message is under 4 KiB (20 items of at most 60-character labels).
- Pairing polls: one `GET` per 5 s per waiting CLI, at most 120 in the ten minutes.

## Presentation and UX

### Workbench page copy

| Where                             | Copy                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `reading`, `redeeming`, `binding` | "Opening your diagram…" (WB33)                                                                                                                 |
| `refused` (any)                   | Heading "Open this diagram from your workbench", body "This link works once, for a minute. Open the diagram again from your workbench." (WB33) |
| `unbound`                         | "This view opens only inside <origin>." (spec), the origin in monospace                                                                        |
| `ended` (expired, revoked)        | A line at the top centre: "Reconnect in <name> to keep editing." (spec); `<name>` from `hello-ack`                                             |
| `ended` (trashed)                 | `DocumentTrashedCard` with `restorable={false}`                                                                                                |
| `failed`                          | `LoadErrorCard embed`                                                                                                                          |

The status screens use `EmbedShell` (no header, no Explorer). **Open in livediagram** (`WorkbenchChrome`): a small
button at the top right of the canvas, the external-link glyph and the words "Open in livediagram", linking to
`/document/<id>` with `target="_blank" rel="noopener noreferrer"`, shown while `mounted` and `ended` (WB34).

### The pairing page (`/workbench/pair?code=`)

Built on `OauthShell`, like the device page; states and copy:

| State                       | Heading                             | Body and actions                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts off                | "Workbenches aren’t available"      | "This deployment doesn’t have accounts enabled, so there’s nothing to pair."                                                                                                                                                                                                                                                                                                                                                |
| Loading                     | none                                | "Loading…"                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Signed out                  | "Sign in to approve this workbench" | **Sign in** → `/sign-in/?redirect_url=<this path and query>`                                                                                                                                                                                                                                                                                                                                                                |
| No code, unknown, not yours | "We couldn’t find this request"     | "It may belong to another account. Check you’re signed in as the person who runs the workbench."                                                                                                                                                                                                                                                                                                                            |
| Pending                     | "Allow this workbench?"             | "Allow **<name>** at `<origin>` to open your documents with the token **<token name>**?" (spec); with no name: "Allow a workbench at `<origin>` to open your documents with the token **<token name>**?"; no token name: "an unnamed token". Below: "It opens one document at a time, as you, inside that tool. You can unpair it any time in Settings, under API Tokens." **Allow** (primary), **Don't allow** (secondary) |
| Working                     | as Pending                          | **Allow** reads "Allowing…", both disabled                                                                                                                                                                                                                                                                                                                                                                                  |
| Failed                      | as Pending                          | `role="alert"` "Something went wrong. Please try again."                                                                                                                                                                                                                                                                                                                                                                    |
| Allowed                     | "Workbench allowed"                 | "Return to <name or ‘your workbench’>; it carries on by itself."                                                                                                                                                                                                                                                                                                                                                            |
| Declined                    | "Workbench not allowed"             | "Nothing was paired. Your terminal will stop waiting."                                                                                                                                                                                                                                                                                                                                                                      |
| Expired                     | "This request has expired"          | "Run livediagram workbench pair again to ask anew." (command in monospace)                                                                                                                                                                                                                                                                                                                                                  |
| Already answered            | "This request was already answered" | "Run livediagram workbench pair again if you need to ask anew."                                                                                                                                                                                                                                                                                                                                                             |

### Settings > API tokens

Each `SettingsTokenCard` with pairings shows, under its lifetime bar, a "Paired workbenches" list (none: nothing,
WB35). A row: the name (or "Unnamed workbench"), the origin in monospace, "Paired <relative time>", and an
**Unpair** text button. Unpair opens the same confirm popover as Revoke: "Unpair <name>? Its open diagrams stop
editing until you allow it again." with **Unpair** and **Cancel** (WB36). After Unpair the row leaves the list.

## Accessibility

- Status screens: the copy in a `role="status"` region; `refused` and `unbound` headings are `h1`.
- The Reconnect line: `role="status"`, `aria-live="polite"`, visible text, never colour alone.
- **Open in livediagram**: accessible name "Open in livediagram (opens in a new tab)"; at least 24 by 24 px; the
  editor's focus ring.
- The pairing page: focus moves to the heading on each state change; **Allow** and **Don't allow** are native
  buttons; the origin and the token name are text, readable by a screen reader in full; both colour schemes use
  the device page's tokens, already audited.
- Settings rows: **Unpair** named "Unpair <name> at <origin>"; the confirm popover is the existing accessible one.
- Reveal outlines honour reduced motion as changeset outlines do.
- The contrast audit (`contrast-audit.spec.ts`) gains the pairing page (pending state) and the paired-workbench row,
  both schemes.

## Web Experience

- `/embed/workbench` LCP is the status text, painted from the static HTML; the editor chunk is preloaded
  (`import('../../document/[id]/editor-page')` started on mount) while redeem and binding run, so `mounted` does not
  wait on it. The editor replaces the status screen whole: no shift inside either (CLS).
- INP: the selection message is built after the settle, off the input event; message handling is O(refs).
- `/workbench/pair` is a small static page; its one request runs after auth settles; layout is the device page's.

## Observability

| Fingerprint                                                                                    | Where                |
| ---------------------------------------------------------------------------------------------- | -------------------- |
| `[workbench] pairing-requested { tokenId, originHost, via: 'mint' \| 'pair', reused }`         | api                  |
| `[workbench] paired { tokenId, pairingId }`                                                    | api                  |
| `[workbench] pairing-declined { tokenId }`                                                     | api                  |
| `[workbench] unpaired { tokenId, pairingId, reason, rooms, unreached }`                        | api                  |
| `[workbench] ticket-minted { documentId, tokenId, role }`                                      | api                  |
| `[workbench] mint-refused { reason, tokenId }` (`invalid_origin`, `not_found`, `rate_limited`) | api (warn)           |
| `[workbench] session-opened { documentId, tokenId, sessionPrefix, role }`                      | api                  |
| `[workbench] session-refused { reason, documentId?, tokenId? }`                                | api (warn)           |
| `[workbench] session-ended { reason, documentId, tokenId, sessionPrefix }`                     | api                  |
| `[workbench] bearer-refused { reason, sessionPrefix? }`                                        | api (warn)           |
| `[workbench] confined { method, route, sessionPrefix }`                                        | api (warn)           |
| `[workbench] read-only-refused { method, route, sessionPrefix }`                               | api (warn)           |
| `[room-access] closed { match: 'workbench', closed }`                                          | room (existing line) |
| `workbench sweep: deleted <n> rows`                                                            | api cron             |
| `[workbench] handshake-ok { originHost }`, `[workbench] handshake-failed { framed }`           | page                 |
| `[workbench] renewed`, `[workbench] renew-failed { reason }`                                   | page                 |
| `[workbench] message-ignored { type }`, `[workbench] message-invalid { type }`                 | page (once per type) |
| `[workbench] ended { reason }`, `[workbench] redeem-failed { status, reason? }`                | page                 |
| `[workbench] request-confined { method, route }`, `[workbench] reveal-missed { count }`        | editor               |
| `workbench open <minted <documentId>                                                           | pairing-required     | refused <status | share-link | invalid_origin>>` | CLI `debugLog` |
| `workbench pair <pending                                                                       | paired               | approved        | declined   | expired           | gone           | slow-down <s> | network-retry <n> | browser <opened | not-opened | skipped> | refused <invalid_origin | invalid_name>>` | CLI `debugLog` |

`originHost` is the origin's host only (no scheme or port, WB37). The fingerprints beyond the spec's list name
decision points it leaves unlogged (WB47). Telemetry: `track('Session', 'Opened',
'Workbench')` once per mount; `track('Token', 'Linked', 'Workbench')` after a successful Allow; `Cli·Used·WorkbenchOpen`
and `Cli·Used·WorkbenchPair` after exit 0. Dashboard: `WORKBENCH_SESSIONS` beside `EMBEDS_VIEWED` ("Workbench
Sessions", "A document opened inside a developer tool's frame, signed in."), `WORKBENCHES_PAIRED` in
`API_TOKEN_ACTIVITY` ("Workbenches Paired", "A token's owner allowed a developer tool to open their documents."),
and the two CLI rows.

## Testing

| Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Test                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Origin shapes: every accepted and refused form of the spec and E1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `packages/api-schema/src/workbench.test.ts`                                                                                       |
| Allow-list: every row allowed, every listed confined route refused, another document `other-document`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `packages/api-schema/src/workbench.test.ts` (table-driven)                                                                        |
| Message parse: each type, bounds, unknown, `v: 2`, invalid fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `packages/api-schema/src/workbench-messages.test.ts` (planned)                                                                    |
| Migration 0077: tables, indexes, cascades from `api_tokens`, `documents`, `workbench_pairings`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `apps/api/src/db/workbench.test.ts` (real SQLite)                                                                                 |
| Account deletion and the owner-keyed ledger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/api/src/db/account-owner-columns.test.ts`                                                                                   |
| Unpaired mint 428 with a URL; second mint same request; expired request replaced                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `apps/api/src/routes/workbench-ticket-route.test.ts`                                                                              |
| Mint refusals: token required, confined, origin, body, 404, 410, tab not linked, 429; share code ignored                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `workbench-ticket-route.test.ts`                                                                                                  |
| Mint level: edit token edit, read-only token view; owner's team access counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `workbench-ticket-route.test.ts`                                                                                                  |
| Pairing request create, reuse, name update, `paired` when paired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `apps/api/src/routes/workbench-pairing-routes.test.ts`                                                                            |
| Approve and decline: owner only, token refused 401, other account 404, 409 twice, 410 expired                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `workbench-pairing-routes.test.ts`                                                                                                |
| Status poll: requesting token only; statuses; expired read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `workbench-pairing-routes.test.ts`                                                                                                |
| Pairings list and Unpair: owner only, sessions and tickets gone, rooms closed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `workbench-pairing-routes.test.ts`, `apps/api/src/workbench-end.test.ts`                                                          |
| Token revoke (by id and current) ends pairings, requests and sessions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `apps/api/src/routes/tokens.test.ts`, `workbench-end.test.ts`                                                                     |
| Redemption: single use, `used`, `expired`, `unknown`, token revoked, access lost, expiry capped by token                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `apps/api/src/routes/workbench-session-routes.test.ts`                                                                            |
| Session resolution: reasons, `ctx` shape (clerk null, token null, owner), ambient headers refused                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `apps/api/src/auth/workbench-session.test.ts`, `apps/api/src/index.test.ts`                                                       |
| Confinement at the choke point: 403, 404 for another document, view session writes 403, room-ticket allowed                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/api/src/auth/workbench-confinement.test.ts`, `index.test.ts`                                                                |
| A session's tab PUT succeeds (no `use_changesets`); its revert is a person's                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/api/src/routes/tab-put-route.test.ts`, `apps/api/src/routes/changesets.test.ts`                                             |
| Room ticket: account true, owner's person tag, role capped, pairing carried; upgrade header always set                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `apps/api/src/routes/document-room-routes.test.ts`                                                                                |
| The frame's selection reads `mine`; never holds against the owner's agent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `apps/api/src/routes/changesets.test.ts` (held), `document-room.test.ts` (`/selections`)                                          |
| Close match `workbench`: only that pairing's sockets, code 4006                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/api/src/room-access.test.ts`, `document-room.test.ts`                                                                       |
| Images: no owner shortcut, `d` must be the session's document                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `apps/api/src/routes/images.test.ts`                                                                                              |
| Sweep deletes what is due and nothing else                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `apps/api/src/db/workbench.test.ts`                                                                                               |
| OpenAPI parity and schemas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `apps/api/src/openapi/route-parity.test.ts`, `manifest.test.ts`                                                                   |
| Selection reference: header, refs, kind words, labels quoted and cut, cap and tail, none, element order, kind-ref-label words                                                                                                                                                                                                                                                                                                                                                                                                                                            | `packages/document-views/src/selection-reference.test.ts` (planned)                                                               |
| Fragment read and cleared before any request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/live/app/embed/workbench/workbench-fragment.test.ts` (planned)                                                              |
| Page machine: every transition of the phase table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `apps/live/app/embed/workbench/workbench-machine.test.ts` (planned)                                                               |
| Port: target origin on every send; foreign origin and source dropped; unknown logged once                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `apps/live/lib/workbench/workbench-port.test.ts` (planned)                                                                        |
| Renewal timing, swap, mismatch, expiry to `ended`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `apps/live/app/embed/workbench/useWorkbenchRenewal.test.ts` (planned) (fake timers)                                               |
| Bridge publishes before children fetch; Clerk bridge stands down; pending default without Clerk                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/live/components/providers/WorkbenchAuthBridge.test.tsx` (planned)                                                           |
| Bootstrap: no migration, no participant write, no lists, no share-link read, session level, `tabId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `apps/live/app/document/[id]/useIdentityBootstrap.test.ts` (planned), `apps/live/hooks/persistence/useClerkApiBootstrap.test.tsx` |
| Client confinement throws without fetching; preferences write local only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `apps/live/lib/api/core.test.ts`, `apps/live/lib/user-preferences.test.ts`                                                        |
| Surface flags and every gate of the Surface table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `apps/live/app/document/[id]/editor-surface.test.ts` (planned), `EditorView.test.tsx` (new), `settings-catalogue.test.ts`         |
| Messages from the editor: ready once, tab, settle 250 ms, dedupe, reveal, theme                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/live/app/document/[id]/useWorkbenchMessages.test.ts` (planned)                                                              |
| Tab revisions from load, save and changeset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/live/app/document/[id]/useTabRevisions.test.ts` (planned)                                                                   |
| Appearance override wins and is never stored                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `packages/ui/src/appearance/appearance-store.test.ts`                                                                             |
| Close 4006 stops the connector                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `apps/live/lib/api/room.test.ts`                                                                                                  |
| Pair page states and copy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `apps/live/app/workbench/pair/PairWorkbench.test.tsx` (planned)                                                                   |
| Settings pairings and Unpair confirm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `SettingsTokenPairings.test.tsx`, `useWorkbenchPairings.test.ts`                                                                  |
| Worker: `/embed/workbench` frameable, `/workbench/pair` DENY                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/live/src/worker.test.ts`                                                                                                    |
| CLI open: URL and JSON, 428 exit 4 with the fix, share URL exit 2, origin exit 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `packages/agent-verbs/src/verbs/workbench.test.ts`, `apps/cli/src/commands/workbench-open.test.ts`                                |
| CLI pair: URL first on stdout, no browser when piped, approved 0, declined 4, expired 4, 429 slow down, 404, network retries                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/cli/src/commands/workbench-pair.test.ts` (fake io)                                                                          |
| CLI help budgets for the new resource and verbs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/cli/src/help/help.test.ts`                                                                                                  |
| Guide `workbench` and the skill's `[livediagram]` pointer; every topic, the frontmatter and the body within budget                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `packages/agent-verbs/src/catalogue.test.ts`                                                                                      |
| Telemetry catalogue rows and CLI command rows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `apps/telemetry` catalogue suites, `metric-series.test`                                                                           |
| End to end, dark, a fake workbench page on `http://127.0.0.1:<port>` framing the live app on `http://localhost:<port>`: unpaired mint 428; the pair page (signed in through the test bridge) Allow; mint; the frame binds, the editor mounts without header or Explorer; drawing saves; a selection arrives as one settled message with the reference; `reveal` outlines; `theme` switches; renewal swaps the session; Unpair turns the frame read-only with the Reconnect line; a page on another origin framing the same URL mounts nothing and shows the unbound copy | `apps/live/e2e/workbench-embed.spec.ts` (planned) (project `workbench`, `colorScheme: 'dark'`, `E2E_WORKBENCH=1`)                 |

The fake workbench (`apps/live/e2e/fixtures/fake-workbench.html` (planned)) is served by `workbench-support.ts` from a Node `http`
server on `127.0.0.1` at a free port; it frames the URL it is given, answers `hello` with `hello-ack { name: 'Fake
Workbench' }`, answers `renew` with a ticket the test mints, and records every message into `window.received`.
`scripts/e2e-stack.mjs` under `E2E_WORKBENCH=1` starts the JWKS server and builds with `NEXT_PUBLIC_E2E_AUTH=1`, as
under `E2E_DRIVE`.

## Constants and configuration

| Constant                            | Value                        | Provenance                                                       | Safe range          |
| ----------------------------------- | ---------------------------- | ---------------------------------------------------------------- | ------------------- |
| `WORKBENCH_TICKET_TTL_MS`           | 60000                        | Spec                                                             | 30000 to 120000     |
| `WORKBENCH_SESSION_TTL_MS`          | 28800000                     | Spec                                                             | 3600000 to 86400000 |
| `WORKBENCH_HANDSHAKE_MS`            | 5000                         | Spec                                                             | 2000 to 15000       |
| `WORKBENCH_SELECTION_SETTLE_MS`     | 250                          | Spec                                                             | 100 to 1000         |
| `WORKBENCH_SELECTION_MAX_REFS`      | 20                           | Spec                                                             | 5 to 50             |
| `WORKBENCH_PAIRING_TTL_MS`          | 600000                       | Spec                                                             | 120000 to 1800000   |
| `WORKBENCH_TICKETS_PER_MINUTE`      | 30                           | Spec; the binding's `simple.limit`                               | 10 to 120           |
| `WORKBENCH_RENEW_LEAD_MS`           | 600000                       | WB38                                                             | 60000 to 3600000    |
| `WORKBENCH_RENEW_RETRY_MS`          | 60000                        | WB38                                                             | 10000 to 300000     |
| `WORKBENCH_PAIRING_POLL_INTERVAL_S` | `DEVICE_POLL_INTERVAL_S` (5) | The device grant's, as the spec's "as auth login --device waits" | 2 to 15             |
| `WORKBENCH_TICKET_BYTES`            | 16                           | Spec: 128 random bits                                            | fixed               |
| `WORKBENCH_SESSION_SECRET_BYTES`    | 32                           | As an API token (WB39)                                           | 32 to 64            |
| `WORKBENCH_PAIRING_CODE_BYTES`      | 16                           | 128 bits, as a ticket (WB29)                                     | 16 to 32            |
| `WORKBENCH_SESSION_PREFIX`          | `lvw_`                       | Spec                                                             | fixed               |
| `WORKBENCH_NAME_MAX_LENGTH`         | 40                           | WB2                                                              | 20 to 80            |
| `WORKBENCH_ORIGIN_MAX_LENGTH`       | 255                          | A host name's own cap plus scheme and port                       | fixed               |
| `WORKBENCH_SESSION_GRACE_MS`        | 86400000                     | WB30                                                             | 0 to 604800000      |
| `WORKBENCH_ENDED_CLOSE`             | 4006                         | Next after 4005                                                  | fixed               |
| `WORKBENCH_TICKET_RATE_LIMITER`     | namespace `1010`, 30 / 60 s  | Spec; its own binding (WB41)                                     | as above            |

Configuration: `APP_BASE_URL` (existing var) builds the URLs; `WORKBENCH_TICKET_RATE_LIMITER` added to production and
`[env.staging]` (`pnpm staging:check`); both optional on a self-host (absent limiter allows).

## Assets and external resources

No new asset. The external-link glyph and the key glyph already ship in the editor's icon set; the pairing page
reuses `OauthShell` and `AnimatedLinesBackdrop`.

## Defaults ledger

WB1 to WB48 in [DEFAULTS.md](DEFAULTS.md).
