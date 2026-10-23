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

**Two scopes.** Every ticket, session and pairing carries a `WorkbenchScope`, `document` or `workspace`
([Two scopes](../workbench-embeds.md#two-scopes)). Everything below is the document scope unless it says otherwise;
[The workspace scope](#the-workspace-scope) holds the workspace scope's own behaviour, and each later section adds
its workspace rows beside the document scope's.

It provides these names to sibling blueprints ([CLI](../../015-api/blueprints/cli.md),
[Share roles](share-roles.md), [Agent changesets](../../024-agents/blueprints/agent-changesets.md)):

| Name                                                                 | What it is                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `RouteContext.workbench: WorkbenchContext \| null`                   | The presenting workbench session; null for every other caller            |
| `workbenchRouteVerdict(method, segments, session)`                   | The confinement allow-list, shared by the api choke point and the editor |
| `parseWorkbenchOrigin(input)`                                        | The one origin rule, shared by the api, the CLI and the page             |
| `WORKBENCH_SESSION_PREFIX` `lvw_`, `isWorkbenchSessionFormat`        | The third bearer kind                                                    |
| `endWorkbenchAccess(env, target, reason)`                            | Unpair and token revocation: rows gone, rooms closed                     |
| `WorkbenchScope = 'document' \| 'workspace'`, `WORKBENCH_SCOPES`     | The scope of a ticket, session and pairing                               |
| `pairingCoversScope(pairingScope, asked)`                            | Whether a pairing lets a mint of that scope through                      |
| `workspaceFramePath(place)`, `workspacePlaceOf(pathname, search)`    | The workspace frame's addresses, both ways                               |
| `assignAppLocation(href)`, `setAppNavigationInterceptor(fn)`         | The app's one way to leave a page, which a workspace frame takes over    |
| `WORKBENCH_ENDED_CLOSE` 4006                                         | The room's close code for a session whose pairing or token ended         |
| `selectionReference(input)`                                          | The selection reference text, in `@livedocuments/document-views`         |
| `EditorSurface = 'app' \| 'embed' \| 'workbench'`                    | The editor's surface, replacing the `embed` boolean                      |
| `POST /api/workbench/tickets`, `/sessions`, `/pairing-requests`, ... | The routes, below                                                        |

## Scope, by file

| File                                                                                                                                                                         | Role                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/migrations/0001_livedocuments_baseline.sql`                                                                                                                        | Tables `workbench_pairing_requests`, `workbench_pairings`, `workbench_tickets`, `workbench_sessions`; `ws_tickets.workbench_pairing`                                                                     |
| `packages/api-schema/src/workbench.ts` (new, + test)                                                                                                                         | Constants; wire types of every route; `parseWorkbenchOrigin`; `isWorkbenchSessionFormat`; `WorkbenchRole`, `capWorkbenchRole`; `WORKBENCH_ERROR_CODES`; `WORKBENCH_ROUTES`, `workbenchRouteVerdict`      |
| `packages/api-schema/src/workbench-messages.ts` (new, + test)                                                                                                                | The ten message types, `WORKBENCH_MESSAGE_TYPES`, `parseWorkbenchMessage`                                                                                                                                |
| `packages/api-schema/src/room-messages.ts`                                                                                                                                   | `WORKBENCH_ENDED_CLOSE = 4006`                                                                                                                                                                           |
| `packages/api-schema/src/page-views.ts`                                                                                                                                      | `LIVE_ROUTE_SEGMENTS` gains `workbench`, so the router sends `/workbench/pair` to the live app                                                                                                           |
| `packages/api-schema/src/index.ts`                                                                                                                                           | Re-exports the two new modules                                                                                                                                                                           |
| `apps/api/src/db/workbench.ts` (new, + test)                                                                                                                                 | Every query on the four tables (Data and persistence)                                                                                                                                                    |
| `apps/api/src/auth/workbench-session.ts` (new, + test)                                                                                                                       | `generateWorkbenchSecret`, `generateWorkbenchTicket`, `generatePairingCode`, `hashWorkbenchSecret`, `resolveWorkbenchSession`                                                                            |
| `apps/api/src/auth/workbench-confinement.ts` (new, + test)                                                                                                                   | `workbenchRefusal(ctx-like, method, segments, headers)`: the choke point's verdict to a `Response`                                                                                                       |
| `apps/api/src/workbench-end.ts` (new, + test)                                                                                                                                | `endWorkbenchAccess`: list sessions, delete rows, close rooms, log                                                                                                                                       |
| `apps/api/src/routes/workbench.ts`                                                                                                                                           | `handleWorkbench(ctx)`: dispatch of `segments[2]` to the three modules below                                                                                                                             |
| `apps/api/src/routes/workbench-ticket-route.ts` (new, + test)                                                                                                                | `POST /api/workbench/tickets`                                                                                                                                                                            |
| `apps/api/src/routes/workbench-session-routes.ts` (new, + test)                                                                                                              | `POST /api/workbench/sessions`, `DELETE /api/workbench/sessions/current`                                                                                                                                 |
| `apps/api/src/routes/workbench-pairing-routes.ts` (new, + test)                                                                                                              | `/api/workbench/pairing-requests*`, `/api/workbench/pairings*`                                                                                                                                           |
| `apps/api/src/routes/workbench-access.ts`                                                                                                                                    | `ownerDocumentAccess`: the owner's own access to a document, shared by the mint and redemption (WB3)                                                                                                     |
| `apps/api/src/routes/workbench-test-fixtures.ts`                                                                                                                             | The route suites' shared real-SQLite arrangement (not a suite)                                                                                                                                           |
| `apps/api/src/routes/context.ts`                                                                                                                                             | `RouteContext.workbench`; `WorkbenchContext`                                                                                                                                                             |
| `apps/api/src/index.ts`                                                                                                                                                      | `lvw_` resolution beside `lwt_`; confinement; level refusal; rate limiter; `case 'workbench'`; the daily sweep                                                                                           |
| `apps/api/src/routes/document-room-routes.ts`                                                                                                                                | Ticket mint under a session: `account` true, owner's person tag, role capped at the session's level, `workbenchPairing`; upgrade forwards `X-Verified-Workbench-Pairing`                                 |
| `apps/api/src/db/ws-tickets.ts`                                                                                                                                              | `WsAdmission.workbenchPairing`; insert and consume the column                                                                                                                                            |
| `apps/api/src/document-room.ts`, `room-session.ts`                                                                                                                           | Attachment `workbenchPairing` from the header; `/close-sessions` closes a `workbench` match with 4006                                                                                                    |
| `apps/api/src/room-access.ts`                                                                                                                                                | `AccessCloseMatch` gains `{ match: 'workbench'; pairingId }`; parse and match                                                                                                                            |
| `apps/api/src/room-access-client.ts`                                                                                                                                         | `closeWorkbenchSessions(env, documentId, pairingId)`                                                                                                                                                     |
| `apps/api/src/routes/images.ts`                                                                                                                                              | Under a session, `GET /api/images/:id` takes the document path only, with `d` the session's document                                                                                                     |
| `apps/api/src/routes/tokens.ts`                                                                                                                                              | Both revokes call `endWorkbenchAccess({ tokenId }, 'revoked')` after `revokeApiToken`                                                                                                                    |
| `apps/api/src/db/account.ts`, `apps/api/src/db/account-owner-columns.test.ts`                                                                                                | `deleteAccount` deletes the four tables' rows before `api_tokens`; four `account-only` ledger rows                                                                                                       |
| `apps/api/src/responses.ts`                                                                                                                                                  | `workbenchConfined()`, `pairingRequired(body)`                                                                                                                                                           |
| `apps/api/src/types.ts`, `apps/api/wrangler.toml`                                                                                                                            | `WORKBENCH_TICKET_RATE_LIMITER` (namespace `1010`, 30 per 60 s), production and `[env.staging]`                                                                                                          |
| `apps/api/src/openapi/manifest.ts`, `document.ts`, `schemas.generated.ts`                                                                                                    | Eleven operations under segment `workbench`, tag `Workbench`; the 428 and 401 bodies                                                                                                                     |
| `packages/document-views/src/selection-reference.ts` (new, + test), `index.ts`                                                                                               | `selectionReference(input)`                                                                                                                                                                              |
| `apps/live/app/embed/workbench/page.tsx`                                                                                                                                     | The static route; metadata title `Workbench \| livedocuments`, `robots: { index: false }`; renders `WorkbenchPage`                                                                                       |
| `apps/live/app/embed/workbench/WorkbenchPage.tsx`                                                                                                                            | Runs the page machine; renders a status or, once bound, `WorkbenchAuthBridge` around `EditorPage surface="workbench"`                                                                                    |
| `apps/live/app/embed/workbench/workbench-machine.ts` (new, + test)                                                                                                           | The page's states and transitions, pure                                                                                                                                                                  |
| `apps/live/app/embed/workbench/workbench-fragment.ts` (new, + test)                                                                                                          | `takeTicketFromAddress(location, history)`: reads `#ticket=`, clears the fragment                                                                                                                        |
| `apps/live/app/embed/workbench/useWorkbenchHandshake.ts`                                                                                                                     | Redeem, document check, hello, ack wait, revoke on failure                                                                                                                                               |
| `apps/live/app/embed/workbench/useWorkbenchRenewal.ts` (new, + test)                                                                                                         | Renew timing, ticket redemption, provider swap, old session revoked                                                                                                                                      |
| `apps/live/app/embed/workbench/WorkbenchStatus.tsx`                                                                                                                          | The status screens and their copy                                                                                                                                                                        |
| `apps/live/lib/workbench/workbench-port.ts` (new, + test)                                                                                                                    | `createWorkbenchPort(origin, win)`: send to the bound origin, accept from it, unknown types logged once                                                                                                  |
| `apps/live/lib/api/workbench.ts` (new, + test)                                                                                                                               | `apiRedeemWorkbenchTicket`, `apiEndWorkbenchSession`, `apiReadPairingRequest`, `apiAnswerPairingRequest`, `apiListWorkbenchPairings`, `apiUnpairWorkbench`                                               |
| `apps/live/lib/api/core.ts`                                                                                                                                                  | `setWorkbenchConfinement(session \| null)`; `apiFetch` refuses locally what `workbenchRouteVerdict` refuses, throwing `WorkbenchConfinedError`                                                           |
| `apps/live/lib/api/workbench-confinement.ts` (new, + test)                                                                                                                   | `confinementRefusal(url, init)` and the confinement state, re-exported by `core.ts`: the verdict, the log once per route                                                                                 |
| `apps/live/lib/api/images.ts`                                                                                                                                                | `fetchImage` always sets `d` to the session's document under confinement                                                                                                                                 |
| `apps/live/lib/api/room.ts`                                                                                                                                                  | `RoomHandlers.onWorkbenchEnded` on close 4006, the connector stops                                                                                                                                       |
| `apps/live/lib/user-preferences.ts`                                                                                                                                          | `writeUserPreferences` skips `apiPutPreferences` under confinement                                                                                                                                       |
| `apps/live/components/providers/workbench-session-context.ts`                                                                                                                | `WorkbenchSession`, `WorkbenchSessionContext`, `useWorkbenchSession()`                                                                                                                                   |
| `apps/live/components/providers/WorkbenchAuthBridge.tsx` (new, + test)                                                                                                       | A nested `DeferredAuthContext.Provider` with the session's identity; registers the `lvw_` token provider in a layout effect                                                                              |
| `apps/live/components/providers/deferred-auth.tsx`                                                                                                                           | `DEFERRED_AUTH_PENDING` (`authLoaded: false`, signed out)                                                                                                                                                |
| `apps/live/components/providers/AuthProvider.tsx`                                                                                                                            | `WORKBENCH_ROUTE = '/embed/workbench'`: the accounts and E2E bridges stand down there and the state holds `DEFERRED_AUTH_PENDING`                                                                        |
| `apps/live/hooks/persistence/useAccountBootstrap.ts`                                                                                                                         | Reads `useWorkbenchSession()` first; under a session no migration, no timeout, no provider, the session's identity returned                                                                              |
| `apps/live/app/document/[id]/editor-page.tsx`                                                                                                                                | `LivePage({ surface })`; `Session·Opened·Workbench`; status branches for the workbench                                                                                                                   |
| `apps/live/app/embed/page.tsx`                                                                                                                                               | `<EditorPage surface="embed" />`                                                                                                                                                                         |
| `apps/live/app/document/[id]/editor-surface.ts` (new, + test)                                                                                                                | `EditorSurface`, `surfaceFlags(surface)`: `embedMode`, `workbenchMode`, `appChrome`                                                                                                                      |
| `apps/live/app/document/[id]/useEditorState.ts`                                                                                                                              | `useEditorState({ surface })`; every gate in the Surface table; `useWorkbenchMessages`, `useTabRevisions`                                                                                                |
| `apps/live/app/document/[id]/useIdentityBootstrap.ts`, `seed-fetched-document.ts`                                                                                            | The workbench branch (Behaviour, "The editor in a workbench")                                                                                                                                            |
| `apps/live/app/document/[id]/workbench-bootstrap.ts` (new, tested by `useIdentityBootstrap.test.ts`)                                                                         | `loadWorkbenchDocument`: the workbench branch of the bootstrap, apart from the 570-line host                                                                                                             |
| `apps/live/app/document/[id]/useWorkbenchEnd.ts` (new, + test)                                                                                                               | The editor finding its document trashed ends the page (`end('trashed')`)                                                                                                                                 |
| `apps/live/app/document/[id]/useRoomConnection.ts` (+ `useRoomConnection.workbench.test.tsx`)                                                                                | `onWorkbenchEnded`: close 4006 ends the session, and 4005 under a session reads as revoked (WB31) instead of reloading                                                                                   |
| `apps/live/app/document/[id]/useTabRevisions.ts` (new, + test)                                                                                                               | The last known `rev` per tab: loads, saves, changesets                                                                                                                                                   |
| `apps/live/lib/api/tabs.ts`, `apps/live/app/document/[id]/useAutosave.ts`                                                                                                    | `apiSaveTab` returns the saved `rev`; the autosave notes it in `useTabRevisions`                                                                                                                         |
| `apps/live/app/document/[id]/useWorkbenchMessages.ts` (new, + test)                                                                                                          | `ready`, `tab`, `selection` (settled), `reveal`, `theme`                                                                                                                                                 |
| `apps/live/app/document/[id]/EditorView.tsx`                                                                                                                                 | Header, Explorer, banners, Open in livedocuments, read-only line                                                                                                                                         |
| `apps/live/components/chrome/WorkbenchChrome.tsx` (new, + test)                                                                                                              | `WorkbenchOpenLink` (the **Open in livedocuments** link in the tab bar) and `WorkbenchReconnectLine`                                                                                                     |
| `apps/live/components/chrome/TabBar.tsx`, `ChromeControls.tsx` (+ `TabBar.workbench.test.tsx`)                                                                               | `workbenchLink`: the link at the bar's right end, and no Appearance control in a workbench                                                                                                               |
| `apps/live/components/canvas/useCanvasChromePanels.tsx`, `CanvasChrome.tsx`, `Canvas.types.ts`, `EditorCanvasHost.tsx`                                                       | `explorerHidden`: no menu button, so no Explorer                                                                                                                                                         |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`, `SettingsDialog.tsx`                                                                                          | `visibleCategories({ workbench })`: the workbench hides `documents`, `account` (with `notifications`, nested under it), `tokens` and the Appearance choice; the dialog reads no placement defaults there |
| `apps/live/components/primitives/CustomThemeProvider.tsx`, `apps/live/components/palette/CustomThemePicker.tsx` (+ test)                                                     | `readOnly` gives `writable: false`: the picker offers no builder, Custom category or Copy; saved themes still resolve                                                                                    |
| `apps/live/lib/editor-commands.ts`                                                                                                                                           | No share, delete, move, take offline, copy or AI commands in a workbench                                                                                                                                 |
| `apps/live/components/panels/ImagePicker.tsx` (+ test), `apps/live/hooks/canvas/useEditorImages.ts` (+ test)                                                                 | `uploadOnly`: no Gallery or Search tab and no gallery read; `galleryHidden`: no recent-images read                                                                                                       |
| `packages/ui/src/appearance/appearance-store.ts` (+ test)                                                                                                                    | `setAppearanceOverride(appearance \| null)`: wins over the setting, never stored                                                                                                                         |
| `apps/live/app/workbench/pair/page.tsx`, `PairWorkbench.tsx` (new, + test)                                                                                                   | The pairing page; `OAUTH_PRIMARY` from `apps/live/app/oauth/oauth-shell.tsx`                                                                                                                             |
| `apps/live/components/dialogs/settings/SettingsTokenPairings.tsx` (new, + test)                                                                                              | A token card's paired workbenches with **Unpair**                                                                                                                                                        |
| `apps/live/components/dialogs/settings/SettingsTokensRow.tsx`                                                                                                                | The API Tokens row loads every pairing and lists them (tokens themselves are run on liveworkspace.app)                                                                                                   |
| `apps/live/hooks/persistence/useWorkbenchPairings.ts` (new, + test)                                                                                                          | List, group by token, unpair                                                                                                                                                                             |
| `apps/live/e2e/signed-in/workbench-contrast.spec.ts` (new)                                                                                                                   | The pairing page (pending), the device page (entry, consent) and a paired-workbench row, light and dark, to WCAG 2.2 AA                                                                                  |
| `apps/live/src/worker.ts` (+ test)                                                                                                                                           | Unchanged code; the test pins `/embed/workbench` frameable and `/workbench/pair` `DENY`                                                                                                                  |
| `packages/agent-verbs/src/verbs/workbench.ts` (new, + test), `catalogue.ts`, `index.ts`                                                                                      | `workbench.open`, `workbench.pair` (local); resource `workbench`; `workbenchOriginOf`, `workbenchNameOf`: the refusals both verbs share                                                                  |
| `apps/cli/src/commands/workbench-pair.ts` (new, + test)                                                                                                                      | `pairWorkbench(io, api, input, json, log)`: request, print, open, wait                                                                                                                                   |
| `apps/cli/src/main.ts`                                                                                                                                                       | Dispatches `workbench.pair` beside the other local verbs                                                                                                                                                 |
| `apps/cli/src/io.ts`                                                                                                                                                         | `CliIo.stdoutIsTTY`: whether a person reads stdout (WB25)                                                                                                                                                |
| `apps/cli/src/output/failure-of.ts`                                                                                                                                          | `isNetworkFailure`, shared by `failureOf`, the telemetry and the pairing wait                                                                                                                            |
| `apps/cli/src/commands/workbench-open.test.ts`                                                                                                                               | `workbench open` as the CLI exits                                                                                                                                                                        |
| `packages/agent-verbs/src/guides/index.ts`, `skill.ts`                                                                                                                       | Topic `workbench`; `GUIDE_TOPIC_MAX_TOKENS`, `SKILL_FRONTMATTER_MAX_TOKENS`, `SKILL_BODY_MAX_TOKENS`; the skill's `[livedocuments]` line                                                                 |
| `docs/specs/015-api/cli.md`                                                                                                                                                  | The two command rows, the guide topic and the skill's pointer                                                                                                                                            |
| `apps/telemetry/app/cli-commands.ts`                                                                                                                                         | Rows `WorkbenchOpen`, `WorkbenchPair`                                                                                                                                                                    |
| `apps/telemetry/app/catalogue/collaboration.ts`, `connections.ts`, `event-explanations.ts`                                                                                   | `WORKBENCH_SESSIONS` (`Session·Opened·Workbench`), `WORKBENCHES_PAIRED` (`Token·Linked·Workbench`) in API Token Activity                                                                                 |
| `apps/live/e2e/workbench-embed.spec.ts`, `apps/live/e2e/workbench-support.ts`, `apps/live/e2e/fixtures/fake-workbench.html`, `playwright.config.ts`, `scripts/e2e-stack.mjs` | Project `workbench` (dark), opt-in `E2E_WORKBENCH=1`                                                                                                                                                     |
| `docs/specs/015-api/api.md`                                                                                                                                                  | Segment row `workbench`; four Owner-keyed data rows; rate-limiting row; Auth's third bearer                                                                                                              |
| `docs/specs/017-telemetry/telemetry.md`                                                                                                                                      | The three types                                                                                                                                                                                          |
| `docs/operations/self-hosting.md`, `docs/development/local-development.md`, `README.md`                                                                                      | `APP_BASE_URL` builds workbench and pairing URLs; the rate-limiter binding; the e2e flag                                                                                                                 |
| `apps/help/app/**`, `packages/help-registry`                                                                                                                                 | The workbench help article, registered per `docs/instructions/register-a-help-article.md` (plan phase 8)                                                                                                 |

The workspace scope adds or changes, by file:

| File                                                                                                                                                     | Role                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/migrations/0001_livedocuments_baseline.sql`                                                                                                    | `scope` on requests, pairings, tickets and sessions; `folder_id` and a nullable `document_id` on tickets and sessions (rebuilt); `workbench_session_rooms` |
| `packages/api-schema/src/workbench.ts`                                                                                                                   | `WorkbenchScope`, `WORKBENCH_SCOPES`, `pairingCoversScope`; the scoped wire types; `workbenchRouteVerdict` by scope (`WORKSPACE_ROUTES`)                   |
| `packages/api-schema/src/workbench-messages.ts`                                                                                                          | `livedocuments:place`, `livedocuments:open`; the workspace `ready`                                                                                         |
| `apps/api/src/db/workbench.ts`                                                                                                                           | Scope and folder on every row; requests per scope; approval widens a pairing; `noteWorkbenchSessionRoom`                                                   |
| `apps/api/src/auth/workbench-session.ts`, `workbench-confinement.ts`                                                                                     | `WorkbenchContext.scope`, `folderId`; ambient headers and the view-level share-link list by scope                                                          |
| `apps/api/src/routes/workbench-ticket-route.ts`, `workbench-session-routes.ts`, `workbench-pairing-routes.ts`                                            | The scoped mint, redemption, requests and pairings                                                                                                         |
| `apps/api/src/routes/workbench-access.ts`                                                                                                                | `ownerReachesFolder` beside `ownerDocumentAccess`                                                                                                          |
| `apps/api/src/routes/document-room-routes.ts`                                                                                                            | A workspace session's room ticket records its document (`noteWorkbenchSessionRoom`)                                                                        |
| `apps/api/src/routes/images.ts`                                                                                                                          | The document scope's image rule only; a workspace session reads as its person                                                                              |
| `apps/api/src/workbench-end.ts`                                                                                                                          | Rooms of workspace sessions from `workbench_session_rooms`                                                                                                 |
| `apps/live/lib/workbench/workspace-place.ts` (new, + test)                                                                                               | `WorkspacePlace`, `workspacePlaceOf`, `workspaceFramePath`, `framePathOfAppHref`, `appHrefOfPlace`, `placeView`                                            |
| `apps/live/lib/workbench/workbench-frame-path.ts` (new, + test)                                                                                          | `WORKBENCH_FRAME_PAGE` `/embed/workbench/explorer`, `isWorkspaceFramePath`: the rewrite the live worker and the e2e stack share                            |
| `apps/live/lib/app-location.ts` (new, + test)                                                                                                            | `assignAppLocation`, `setAppNavigationInterceptor`; every `window.location.assign` the Explorer makes goes through it                                      |
| `apps/live/hooks/navigation/useAppNavigation.ts`                                                                                                         | `push` and `replace` ask the interceptor first                                                                                                             |
| `apps/live/app/embed/workbench/explorer/page.tsx` (new)                                                                                                  | The static workspace frame page; renders `WorkbenchPage`                                                                                                   |
| `apps/live/app/embed/workbench/WorkbenchPage.tsx`, `workbench-machine.ts`, `workbench-fragment.ts`, `useWorkbenchHandshake.ts`, `useWorkbenchRenewal.ts` | The address's scope; the scope check at redemption and renewal; the workspace frame once mounted                                                           |
| `apps/live/app/embed/workbench/WorkspaceFrame.tsx` (new, + test)                                                                                         | The mounted workspace frame: the place from the address, the Explorer or the editor, Back, `place`, `open`                                                 |
| `apps/live/app/embed/workbench/useWorkspaceNavigation.ts` (new, + test)                                                                                  | The interceptor, the link capture, New document in place, `livedocuments:open`                                                                             |
| `apps/live/app/embed/workbench/create-in-place.ts` (new, + test)                                                                                         | `createDocumentInPlace(ownerId, { folderId, teamId, templateKind })`                                                                                       |
| `apps/live/lib/new-document-content.ts` (new)                                                                                                            | `newDocumentContent`: a new document's tabs, card types and example cards, extracted from `/new` so the frame makes the same document                      |
| `apps/live/hooks/persistence/useTeams.ts`, `apps/live/app/explorer/sidebar/sidebar-structure.ts`, `apps/live/components/panels/TeamPane.tsx`             | `invites: false`, `administration: false`: no invites read, no Invites or New Team rows, no team administration in the frame                               |
| `apps/cli/src/dispatch/globals.ts`                                                                                                                       | `GLOBAL_FLAGS`: the flags every command takes, which the spec's command table may name (`folder ls [--json]`)                                              |
| `apps/live/app/embed/workbench/useWorkspacePlaceMessages.ts` (new, + test)                                                                               | `ready` (workspace) once and `place` on every move                                                                                                         |
| `apps/live/components/providers/workbench-session-context.ts`                                                                                            | `WorkbenchSession.scope`, `shareCode`, `frame` (the workspace frame's hooks for the editor)                                                                |
| `apps/live/app/explorer/ExplorerShell.tsx`, `useExplorerState.ts`, `sidebar/*`                                                                           | `useExplorerSurface()`: the workbench surface's chrome and gates                                                                                           |
| `apps/live/app/explorer/explorer-surface.ts` (new, + test)                                                                                               | `ExplorerSurface = 'app' \| 'workbench'`, `explorerSurfaceFlags`                                                                                           |
| `apps/live/app/document/[id]/workbench-bootstrap.ts`                                                                                                     | A workspace document: its share code, its level per the person's access                                                                                    |
| `apps/live/app/document/[id]/useWorkbenchMessages.ts`, `useWorkbenchEnd.ts`                                                                              | The workspace frame: `place` in place of `ready`; `trashed` returns to the Explorer                                                                        |
| `apps/live/components/chrome/WorkbenchChrome.tsx`                                                                                                        | `WorkbenchBackButton`, the top-left card; `WorkbenchOpenLink` takes an `href`                                                                              |
| `apps/live/components/chrome/ToolbarMenuCard.tsx` (new), `ToolbarExplorerButton.tsx`                                                                     | The top-left card both buttons share                                                                                                                       |
| `apps/live/components/canvas/CanvasChrome.tsx`, `Canvas.types.ts`, `EditorCanvasHost.tsx`                                                                | `workbenchBack`: Back in the menu button's place, first of the controls                                                                                    |
| `apps/live/app/workbench/pair/PairWorkbench.tsx`                                                                                                         | The workspace request's copy                                                                                                                               |
| `apps/live/components/dialogs/settings/SettingsTokenPairings.tsx`                                                                                        | Each pairing's scope                                                                                                                                       |
| `apps/live/src/worker.ts`, `scripts/e2e-stack.mjs`                                                                                                       | `/embed/workbench/explorer/**` and `/embed/workbench/document/**` served by the frame page                                                                 |
| `apps/live/e2e/workbench-workspace.spec.ts` (new), `workbench-support.ts`                                                                                | The workspace end to end                                                                                                                                   |
| `packages/agent-verbs/src/verbs/workbench.ts`, `folder.ts` (new, + tests), `catalogue.ts`                                                                | `workbench.open --workspace [--folder]`, `workbench.pair --workspace`; `folder.ls`, `folder.create`; resource `folder`                                     |
| `apps/cli/src/commands/workbench-pair.ts`, `apps/cli/package.json`, `apps/cli/src/config/version.ts`                                                     | The scope on the pairing request; the minor version                                                                                                        |
| `apps/telemetry/app/catalogue/collaboration.ts`, `event-explanations.ts`, `cli-commands.ts`                                                              | `WorkbenchWorkspace`; `FolderLs`, `FolderCreate`                                                                                                           |

## Domain and naming

| Term                | Identifier                                                            | Meaning                                                                    |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Workbench           | the frame's parent, known by its origin                               | A developer tool that frames the editor beside an agent                    |
| Workbench name      | `name` (pairing, request), `hello-ack.name`                           | The tool's display name ("Acme Editor"), shown in copy, never enforced     |
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
| Renewal             | `livedocuments:renew` / `livedocuments:ticket`                        | A fresh ticket redeemed before the session expires                         |
| Workbench message   | `WorkbenchMessage`, `type` `livedocuments:*`, `v: 1`                  | One `postMessage` between the page and its workbench                       |
| Selection reference | `selectionReference()`, `SelectionReference { text, count }`          | The text a workbench attaches to the person's message                      |
| Editor surface      | `EditorSurface` `'app' \| 'embed' \| 'workbench'`                     | Where the editor runs; `workbench` is a distinct surface                   |
| Ended               | `WorkbenchEndReason` `expired`, `revoked`, `trashed`, `refused`       | Why a page stopped editing                                                 |
| Scope               | `WorkbenchScope` `document`, `workspace`; `scope` on rows and wire    | What a ticket, session or pairing reaches: one document, or the workspace  |
| Workspace frame     | `/embed/workbench/explorer[...]`, `WorkspaceFrame`                    | The Explorer inside a workbench, under a workspace session                 |
| Place               | `WorkspacePlace`, `livedocuments:place`                               | Where a workspace frame is: an Explorer view, or a document                |
| Frame address       | `workspaceFramePath(place)`                                           | A place's path inside the frame, walked by the frame's own history         |
| Explorer surface    | `ExplorerSurface` `'app' \| 'workbench'`                              | Where the Explorer runs; `workbench` drops the app's surroundings          |

Banned: "workspace" for a document-scope frame, and "scope" for anything but `WorkbenchScope` here (the end of
access names its `target`, a share link its `tabScope`); "integration", "host app" or "client" for a workbench; "link" or "connect" for pairing; "token" for a workbench session or a ticket (`lwt_` is the token); "share", "embed code" or
"share code" for a ticket; "iframe mode" for the surface; "authorise" for approve (the page's verbs are Allow and
Don't allow).

## Behaviour and state

### Invariants

- **I1** A workbench session never reaches a document other than its own: such a request answers 404, decided at
  the choke point before any route runs.
- **I2** A workbench session never reaches a route outside `WORKBENCH_ROUTES`: `403 workbench_confined`.
- **I3** A session's level never exceeds its token's, and every gate re-evaluates the owner's access now (the gates
  run with the owner's identity on every request).
- **I4** `ctx.accountUserId` is null and `ctx.token` is null under a session; `resolveOwner()` and `verifiedUserId`
  are the owner. So administration (`accountUserId` only) is unreachable and `405 use_changesets` never fires.
- **I5** No ticket is minted for an origin its token is not paired with.
- **I6** No pairing is answered except by the token's owner in a signed-in session; a token and a workbench session can
  neither read a request's page view nor answer it.
- **I7** Secrets (ticket, session) are stored as SHA-256 hex only; logs carry the session id's first 8 characters
  and the token id, never a secret, a code or an origin path.
- **I8** The workbench page mounts no editor and sends no `livedocuments:*` message other than `hello` (and `ended`
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
3. **Read.** `GET /api/workbench/pairing-requests/:code` (signed-in session, owner only) returns the page's view:
   `{ origin, name, tokenName, expiresAt, status }`, `status` read as `expired` when pending past its expiry.
4. **Answer.** `POST .../:code/approve` in one batch: the request's `status` from `pending` to `approved`
   (`UPDATE ... WHERE status = 'pending' AND expires_at > now`) and `INSERT OR IGNORE` the pairing (`name` from the
   request). `POST .../:code/decline` sets `declined` and records nothing else. A request already answered answers
   `409 pairing_answered`; one expired `410 pairing_expired`. Logs `[workbench] paired`, `[workbench] pairing-declined`.
5. **Wait.** `GET /api/workbench/pairing-requests/:code/status` (the requesting token only, by the code, WB45) returns
   `{ status, expiresAt, interval }`; the CLI polls it every `interval` seconds.
6. **Paired.** Mints for that token and origin now pass the pairing check.
7. **Unpair.** `DELETE /api/workbench/pairings/:id` (signed-in session, the token's owner) runs
   `endWorkbenchAccess({ pairingId }, 'unpaired')`.
8. **Token revoked.** Both revoke routes run `endWorkbenchAccess({ tokenId }, 'revoked')`: pairings, pending
   requests, tickets and sessions of the token go.

A request row stays after its answer until the sweep, so the waiting CLI reads the answer; it is never answered
twice (the `status = 'pending'` guard).

### The ticket mint (`POST /api/workbench/tickets`)

In order; the first failure answers:

1. Bearer is a workbench session: `403 workbench_confined` (choke point). No `ctx.token` (a signed-in session or a
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
6. `person`: the owner's `participants` row as `{ id, name, color }`; no row gives `name` and `color`
   null (WB7). Answer `201 WorkbenchSessionResponse`. Log `[workbench] session-opened`.

### A request bearing `lvw_` (the choke point, `index.ts`)

Resolved where `lwt_` is, only when no account access token verified:

1. `bearer` matching `isWorkbenchSessionFormat` → `resolveWorkbenchSession(env, bearer, now)`:
   `SELECT s.*, t.read_only, t.revoked, t.expires_at AS token_expires_at FROM workbench_sessions s JOIN api_tokens t
ON t.id = s.token_id WHERE s.secret_hash = ?`. No row → `unknown`; token revoked or expired → `revoked`;
   `s.expires_at <= now` → `expired`. Refused: log `[workbench] bearer-refused { reason, sessionPrefix }`, answer
   `401 invalid_session` with `WWW-Authenticate: Bearer error="invalid_token"`.
2. `ctx.workbench = { sessionId, ownerId, tokenId, pairingId, documentId, tabId, origin, level }`, `level` lowered to
   `view` when the token is read-only; `accountUserId` null; `resolveOwner = () => ownerId`;
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

| Method           | Path under `/api`                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET              | `capabilities`, `openapi.json`, `templates`, `templates/:kind`, `icons`, `schema`, `schema/:kind`                                                                              |
| GET              | `participants/:owner` (the session's owner only; another id is `confined`), `preferences`, `custom-themes`                                                                     |
| POST             | `images`                                                                                                                                                                       |
| GET              | `images/:id` (the route then requires `?d=:doc`)                                                                                                                               |
| GET, PUT         | `documents/:doc`                                                                                                                                                               |
| GET, PUT, DELETE | `documents/:doc/tabs/:tabId`                                                                                                                                                   |
| PUT              | `documents/:doc/tabs/:tabId/name`                                                                                                                                              |
| POST             | `documents/:doc/tabs/:tabId/changesets`, `documents/:doc/changesets/:changesetId/revert`                                                                                       |
| GET              | `documents/:doc/changesets`, `documents/:doc/changesets/:changesetId`, `documents/:doc/comments`                                                                               |
| GET              | `documents/:doc/tabs/:tabId/render.svg`                                                                                                                                        |
| POST             | `documents/:doc/tabs/:tabId/comments`, `.../comments/:commentId/reply`, `.../resolve`, `.../reopen`                                                                            |
| DELETE           | `documents/:doc/tabs/:tabId/comments/:commentId`                                                                                                                               |
| POST             | `documents/:doc/tabs/:tabId/qa`, `documents/:doc/room-ticket`                                                                                                                  |
| GET, POST        | `documents/:doc/items`                                                                                                                                                         |
| POST             | `documents/:doc/items/bulk`, `items/:itemId`, `items/:itemId/move`, `items/tally`, `items/:itemId/comments`, `items/:itemId/comments/resolve`, `items/:itemId/comments/reopen` |
| DELETE           | `documents/:doc/items/:itemId`, `documents/:doc/items/:itemId/comments/:commentId`                                                                                             |
| PUT              | `documents/:doc/item-types`                                                                                                                                                    |
| DELETE           | `workbench/sessions/current`                                                                                                                                                   |

Everything else is `confined`, among it: `documents/:doc` `DELETE`, `copy`, `folder`, `shared-tabs`, `share*`,
`thumbnail`, `tabs/:tabId/link`, `tabs/:tabId/presence` (an agent's door), `documents` (the library),
`folders`, `shared`, `favourites`, `home`, `timeline`, `activity`, `trash`, `placement-defaults`, `tokens`, `teams`,
`account`, `migrate`, `guest-id`, `ai`, `oauth`, every write to `preferences`, `participants`,
`custom-themes`, `images/:id` `DELETE`, `images/usage`, `GET images`, and every
`workbench/*` route but the one above. `/ws` carries no bearer and is decided by its ticket. `events`, `unfurl` and
`share/:code` are called without credentials by the editor and never see `lvw_`.

### Route effects under a session

- `document-room-routes.ts` mint: `account: ctx.accountUserId !== null || ctx.workbench !== null`; `personTag` from
  `ctx.accountUserId ?? ctx.workbench?.ownerId`; `role: capWorkbenchRole(grant.role, ctx.workbench?.level)`;
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

`target` is `{ pairingId }` or `{ tokenId }`; `reason` is `unpaired` or `revoked`.

1. Read the target's pairings with every document any of their sessions names (`SELECT DISTINCT pairing_id,
document_id FROM workbench_sessions WHERE pairing_id IN (...)`).
2. One batch: `DELETE FROM workbench_pairings` of the target (sessions and tickets cascade); for a token, also
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
| `reading`   | first render                                               | "Opening your document…"                                              | `redeeming` (ticket read), `refused('no-ticket')`               |
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
   `WORKBENCH_RENEW_RETRY_MS` until a ticket lands or the session expires. A `livedocuments:ticket` is redeemed; a 201
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
person.name, lastName: null, fullName: person.name, username: null, email: null, createdAt: null },
getToken: async () => currentSecret, signOut: noop, deleteAccount: null }` and registers
`registerTokenProvider(() => currentSecret)` in a layout effect, before the editor's first fetch.

`AuthProvider` on `pathname.startsWith('/embed/workbench')` renders neither bridge and holds
`DEFERRED_AUTH_PENDING`, so nothing above the page ever reads as a settled guest, sign-in configured or not.

`useAccountBootstrap` reads `useWorkbenchSession()` first in both variants. With a session: no
`settleGuestMigration`, no `subscribeGuestMigration` pending, no 5 s timeout, no provider registration; it returns
`{ isSignedIn: true, authLoaded: true, accountUserId: person.id, accountDisplayName: person.name }`.

`useIdentityBootstrap`, when `workbenchMode`:

- The id is `workbench.documentId`; `?s=` and `documentIdFromPath` are not read.
- `self` from `apiLoadSelf(person.id)`, else `{ id, name: person.name ?? randomName(), color: person.color ??
randomColor() }`; `apiSaveSelf` never runs (I9).
- The owner branch runs (`apiLoadDocument`); `isOwner` is set as today but `apiListShareLinks` is not called;
  `setSessionRole(workbench.level)`; the identity screen never opens.
- `refreshDocumentList` and `refreshSharedList` are not called on any path; `recordOpen` is false.
- When the session carries `tabId`, that tab is made active after seeding.

The Surface table, every gate `workbenchMode` touches (`appChrome` is `surface === 'app'`):

| Gate                                                                                                 | File                                                         | In a workbench                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| `EditorHeader` (and with it the account menu, Share, Make a copy, role pill)                         | `EditorView.tsx`                                             | Not rendered                                              |
| TabBar, palette, toolbars, Quick style, panels, search                                               | `EditorView.tsx`                                             | Rendered as in the app                                    |
| `EmbedChrome`                                                                                        | `EditorView.tsx`                                             | Not rendered; `WorkbenchChrome` instead                   |
| Explorer (popover and status-screen panel)                                                           | `useCanvasChromePanels.tsx`, `editor-page.tsx` status shells | Not rendered; status screens use `EmbedShell`             |
| Sign-in banner, theme-mode banner, power-user offer                                                  | `EditorView.tsx`, `usePowerUserOffer`                        | Off                                                       |
| Settings categories `documents`, `account`, `tokens`; the Appearance choice                          | `settings-catalogue.ts`                                      | Hidden                                                    |
| Share, delete, move, take offline, copy, AI commands                                                 | `editor-commands.ts`                                         | Absent                                                    |
| TabBar "copy to another document"                                                                    | `EditorView.tsx` `otherDocuments`                            | `[]`                                                      |
| Image picker gallery                                                                                 | `ImagePicker.tsx`, `useEditorImages`                         | Upload only; `apiListImages` never called                 |
| Custom theme writes (theme builder save and delete)                                                  | their hosts                                                  | Absent; reads stay                                        |
| `useFolders`, `useFavourites`, `useTeams`, `useTeamPeople`, `useTeamLibrariesSweep`, `useShareLinks` | `useEditorState.ts`                                          | `enabled: false`                                          |
| `useCommentMentions`, `useAssigneeOptions`                                                           | `hooks/collab`                                               | Candidates from presence only; no team read, no notify    |
| Identity screen                                                                                      | `useEditorState.ts` `joinScreenOpen`                         | Never                                                     |
| `defaultPan`, `useModeDefaultTool` embed arguments                                                   | `useEditorState.ts`                                          | As the app (`false`)                                      |
| Element indicators, comment badges                                                                   | `EditorView.tsx`                                             | As the app                                                |
| `DocumentTrashedCard`                                                                                | `editor-page.tsx`                                            | `restorable={false}`                                      |
| `LoadErrorCard`, `NotFound`                                                                          | `editor-page.tsx`                                            | `embed` forms (no recovery card; create-new in a new tab) |

Preferences: `fetchUserPreferences` runs; `writeUserPreferences` keeps the local write and the event and skips
`apiPutPreferences` under confinement. Appearance: `livedocuments:theme` calls `setAppearanceOverride(scheme)`; before
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

1. Header: `[livedocuments] ${jsonString(documentName)} › tab ${jsonString(tab.name)} (doc ${documentId}, tab
${tabRefOf(tab.id)}, rev ${rev})`. The document is named by its full id (WB19).
2. Selected elements, in the tab's element order (WB20), ids not on the tab dropped. None: the second line is
   `whole tab` and there is no third (WB21).
3. Second line: `selected: ` and the first `WORKBENCH_SELECTION_MAX_REFS` items joined by `, `. Item, as the outline's
   `nodeLine` prints an element: the kind word (`kindOf(el)`), the ref (`refs.refOf(id)`) and the label (`jsonString(label, LABEL_CUT_CHARS)` from
   `textField(el, 'label')`, omitted when null), joined by a space in that order (`button 146b "Play"`). More:
   ` … and ${n} more: livedocuments tab view ${documentId} --tab ${tabRef} --view show --ref selected` appended to
   the same line (WB22).
4. Third line: `read: livedocuments tab view ${documentId} --tab ${tabRef} --view show --ref ${firstRef}`.

Lines joined by `\n`, no trailing newline. `count` is the number of selected elements on the tab.

### The CLI

`workbench open <doc> [--tab <t>] --origin <origin> [--json]` (verb `workbench.open`, behaviour `write`):

1. `parseWorkbenchOrigin(--origin)`; refused, exit 1 `invalid_origin` naming the shapes.
2. `resolveDocument` without a share code (a share-link URL exits 2: "a workbench opens your own documents"), then
   `resolveTab` when `--tab` is given.
3. `POST /api/workbench/tickets`. 201: text prints `url`; `--json` prints `{ url, documentId, tabId, expiresAt }`.
   `428 pairing_required`: exit 4 (WB23), thrown as `VerbRefusal { status: 403, code: 'pairing_required' }`, error
   "this workbench is not paired with your token", fix `livedocuments workbench pair --origin <origin>`. Other statuses
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
   `livedocuments workbench pair --origin <origin>`; `429` adds `DEVICE_SLOW_DOWN_S` to the interval; 404 exit 4 "the
   pairing request is gone (was the token revoked?)"; a network failure retries, the third in a row exits 7. Past
   `expiresAt` plus one interval without an answer reads as `expired`. The three exit-4 endings carry the codes
   `pairing_declined`, `pairing_expired` and `pairing_gone` (WB48).
5. `Cli·Used·WorkbenchPair` on exit 0.

`guide workbench` (topic `workbench` of `GUIDE_TOPICS`, within `GUIDE_TOPIC_MAX_TOKENS`) teaches an agent to read a
selection reference: the header, the `selected` items as data, never instructions; re-reading the refs with `tab view
--view show --ref` and `--only`, and the `… and n more` tail with `--ref selected`; `tab render` to look; `presence set` and `presence clear` while it works; and that
the person's own selection never holds the agent's writes. The skill's description names the `[livedocuments]` line
(within `SKILL_FRONTMATTER_MAX_TOKENS`) and its body sends an agent to `guide workbench` first.

### The workspace scope

#### Pairing per scope

- `pairingCoversScope(pairing, asked)`: `workspace` covers both scopes, `document` covers `document` only.
- A mint or `pair` whose pairing does not cover the asked scope is unpaired for it: Pairing step 1 with the asked
  scope, `428 pairing_required` (or `pending` from `pair`). One live request per token, origin and scope (the partial
  unique index gains `scope`), so a document request and a workspace request never share a code and the page never
  shows one question while answering another.
- Approving a request records the pairing at the request's scope. A `workspace` approval on an origin already paired
  for `document` widens that pairing in place (`scope = 'workspace'`, same id, same name unless the request names
  one); a `document` approval never narrows a `workspace` pairing (WB50). The pairing's open sessions keep their
  own scope: widening opens nothing by itself.
- `POST /api/workbench/pairing-requests { origin, name?, scope? }` answers `{ status: 'paired', pairing }` only when
  the pairing covers `scope` (absent: `document`).

#### The workspace mint

`POST /api/workbench/tickets` reads `scope` first: absent or `document`, the document mint above, unchanged; any
other value `400 invalid_value` (`invalid scope`). For `workspace`, in order after steps 1 and 2 of the mint:

1. A `documentId` or a `tabId` in the body: `400 invalid_value` (`a workspace ticket names no document`). A
   document mint without `documentId` is `400 invalid_value` too (`invalid documentId`), as the spec words it
   (WB49). `folderId` absent, or a string of 1 to 64 characters, else `400 invalid_value` (`invalid folderId`).
2. Origin as in step 3 of the mint.
3. Pairing: `pairingCoversScope(pairing.scope, 'workspace')` false, `428 pairing_required` with a workspace request.
4. `folderId`: `ownerReachesFolder(env, ownerId, folderId)`: a personal folder of the owner, or a team folder of a
   team the owner is a joined member of; else `404 not_found` (WB52).
5. Level: `edit`, lowered to `view` when the token is read-only. There is no document to cap it: each request is
   capped by the routes, with the owner's identity, at the person's own access now.
6. Insert the ticket (`scope 'workspace'`, `document_id` null, `folder_id`) and answer
   `201 { url, scope: 'workspace', folderId, expiresAt }` (`folderId` null when none was asked), `url` =
   `${appBaseUrl(env)}/embed/workbench/explorer${folderId ? '/folder/' + encodeURIComponent(folderId) : ''}#ticket=${ticket}`.
   Log `[workbench] ticket-minted { scope, documentId: null, folderId, tokenId, role }`.

#### Workspace redemption

As Redemption, with step 4 skipped for a workspace ticket (no document to check; a folder gone since is the
Explorer's own not-found). The session row copies `scope` and `folder_id`. The answer is the scoped
`WorkbenchSessionResponse`: `{ scope: 'workspace', documentId: null, folderId, tabId: null, ... }`.

#### The choke point by scope

`ctx.workbench` gains `scope` and `folderId`; `documentId` is null in the workspace scope. `resolveOwner()`,
`verifiedUserId`, `accountUserId` (null) and `token` (null) are as in the document scope (I4), so a workspace session
is a person's editor and every route re-gates it with the owner's identity at the owner's access now.

1. **Ambient headers.** The document scope refuses `X-Share-Code`, `X-Owner-Id` and `X-Share-Password`. The
   workspace scope refuses `X-Owner-Id` only: a document shared with the person is reached by its link, as the
   Explorer opens it, so the link's code and password travel with the request (WB53).
2. **The verdict.** `workbenchRouteVerdict(method, segments, session)` with `session.scope === 'workspace'` walks
   `WORKSPACE_ROUTES`, below; no route is `other-document` (every document is the person's to try, the route
   decides). Refused: `403 workbench_confined`, logged `[workbench] confined { scope, method, route, sessionPrefix }`.
3. **Level.** As step 5 of the document scope. A `view` session is refused the share-link list
   (`GET documents/:doc/share`) too, `403 workbench_read_only`, in both scopes: as for a read-only token, the list is
   a credential, not content (WB54).
4. **Rate limits.** As the document scope's: writes on `workbench:<sessionId>`.

`WORKSPACE_ROUTES` (`:p` any one segment, `**` any rest, including none):

| Method                 | Path under `/api`                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET                    | `capabilities`, `openapi.json`, `templates/**`, `icons`, `schema/**`, `preferences`, `participants/:owner` (the owner only)         |
| GET                    | `share/**` (the person opening a link shared with them)                                                                             |
| GET, POST, PUT, DELETE | `documents/**` but `documents/:p/tabs/:p/presence`                                                                                  |
| GET, POST, PUT, DELETE | `folders/**`, `shared/**`, `favourites/**`, `tags/**`, `home/**`, `timeline/**`, `activity/**`, `trash/**`, `placement-defaults/**` |
| GET, POST, PUT, DELETE | `images/**`, `custom-themes/**`                                                                                                     |
| GET                    | `teams`, `teams/:p`, `teams/:p/library`, `teams/:p/members`                                                                         |
| DELETE                 | `workbench/sessions/current`                                                                                                        |

Everything else is `confined`, among it (Never the account): `account`, `migrate`, `guest-id`, `tokens/**`,
`workbench/**` but the one above, every write to `participants` and `preferences`, `ai/**`, `oauth/**`,
`teams` writes and `teams/invites`, `teams/invite-link/**`, `teams/invite-decline/**`, `teams/:p/invite-link`
(team administration), `documents/:p/tabs/:p/presence` (an agent's door), `forms/**` and `telemetry/**`.
`events` and `unfurl` are called without credentials and never see `lvw_`.

#### Route effects under a workspace session

- `document-room-routes.ts` mint: as the document scope (`account` true, the owner's person tag, the role capped at
  the session's level, `workbenchPairing`), and `noteWorkbenchSessionRoom(env, sessionId, documentId)` (`INSERT OR
IGNORE`) so ending access finds the room (WB55).
- `images.ts` `GET /api/images/:id`: the document scope's rule (no owner shortcut, `d` the session's document) holds
  for the document scope only; a workspace session reads as its person (the owner shortcut, the gallery).
- `endWorkbenchAccess`: step 1 reads the (pairing, document) pairs from `workbench_sessions.document_id` and from
  `workbench_session_rooms` joined to the sessions, so a workspace session's rooms close with 4006 like a document
  session's.

#### The workspace frame (`/embed/workbench/explorer...`)

**Addresses** (`apps/live/lib/workbench/workspace-place.ts`, WB56). `WorkspacePlace` is
`{ kind: 'explorer'; node: SelectedNode }` or `{ kind: 'document'; documentId; tabId: string | null; shareCode:
string | null }`. `workspaceFramePath(place)`:

| Place           | Frame path                                                       |
| --------------- | ---------------------------------------------------------------- |
| `home`          | `/embed/workbench/explorer`                                      |
| `folder` `<id>` | `/embed/workbench/explorer/folder/<id>`                          |
| any other view  | `/embed/workbench` + the view's `explorerPathFor` path and query |
| a document      | `/embed/workbench/document/<id>[?s=<code>][&tab=<tabId>]`        |

`workspacePlaceOf(pathname, search)` is its inverse; an address it cannot read is `home`. One static page,
`app/embed/workbench/explorer/page.tsx`, backs every frame path: the live worker (`isWorkspaceFramePath`) and the e2e
stack serve `/embed/workbench/explorer/**` and `/embed/workbench/document/**` from it, and the App Router reads the
real address. Every frame path is under `/embed`, so frameable.

**Phases.** `takeTicketFromAddress` returns the address's scope: `/embed/workbench` is `document` (with `d`),
`/embed/workbench/explorer...` is `workspace`. `redeeming` refuses `mismatch` (session revoked, `ended { reason:
'refused' }` posted) when the session's scope differs from the address's, or, in the document scope, its document
from `d`. Renewal swaps only a session of the same scope and origin (and document, in the document scope). Every
other phase is the document scope's.

**Mounted** (`WorkspaceFrame`), under `WorkbenchAuthBridge` with the workspace session:

1. `setAppNavigationInterceptor(navigate)` (`useWorkspaceNavigation`) in a layout effect, before any child can navigate, and a capture
   `click` listener on the frame root for same-origin `<a href>` without `target` or a modifier key; each passes
   the app href to `navigate`.
2. `navigate(href, { replace })`: `framePathOfAppHref(href)` maps `/explorer/...` and `/document/<id>[?s=][&tab=]`
   to a frame path and calls `history.pushState` (or `replaceState`), which the App Router hears; `/new...` runs New
   document in place (below); any other app href (help, sign-in, an external page) opens in a new tab
   with `noopener` (WB57). Logged `[workbench] open { kind }` only for `livedocuments:open`.
3. The place (`workspacePlaceOf(usePathname(), useSearchParams())`) renders:
   - an Explorer view: `ExplorerShell` (its surface read from the session, `useExplorerSurface`) around `ExplorerPane`,
     the pane keyed by the view's path and its `id` and `folder`, as each /explorer page remounts it; unmounted while
     a document is open, so the editor's shortcuts and panels are the only ones listening, and read again on Back;
   - a document: `EditorPage surface="workbench"` keyed by the document id and share code, under a nested
     `WorkbenchSessionContext` whose `documentId`, `shareCode` and `tabId` are the place's, with `frame` set
     (`back`, `backTitle`, `reportDocumentPlace`) and `end('trashed')` turned into the return to the Explorer. The
     editor runs the workbench branch of every gate, as in the document scope; its status screens (deleted, load
     error, not found) carry Back, and its not-found is a document's, never a page's.
   - a folder the person reaches only as a team member (a team's folder) is the team's page at that folder:
     the frame replaces its address with it once the lists are in.
4. `track('Session', 'Opened', 'WorkbenchWorkspace')` once, when the Explorer first mounts; the editor's
   `Session·Opened·Workbench` counts the document scope only.
5. `ended`: the Explorer and the editor turn read-only as the document scope's editor does (the Reconnect line over
   both, writes refused locally since the bearer is dead).

**New document in place** (`createDocumentInPlace`, WB58): the `/new` href's `folder` or `team`, else the place's
folder (a folder view) or team, else none (the person's default folder answers, as `/new` without a place does);
`template=<kind>` builds that template's tabs as `/new` does (`buildTemplatedTabs`), anything
else (`blank`, `start`, `mode`, `q`, none) a blank document of the default mode; `apiCreateDocument` with the
template's untitled name and `creationIntentOf`; then the document place, pushed. A refused create shows the
Explorer's toast "Couldn’t create the document. Try again." and stays; logged `[workbench] create-failed { status }`.

**Back** (`WorkbenchBackButton`, WB59): shown on a document place, in the canvas's top-left card
(`ToolbarMenuCard`, the card the app's Explorer menu button uses, which a workbench otherwise leaves empty), level
with the palette strip at `top-3 left-3`. The card carries `data-toolbar-menu`, so the strip keeps clear of it as it
does of the menu button (`useStripCrowded`, `useBarLabels`, `useStripTileLimit`); on a phone it rides in the
strip's row (`inline`, the glyph alone). `EditorCanvasHost` passes the frame's hooks to `Canvas` as
`workbenchBack`, and `CanvasChrome` renders the card first of its controls, so Back is the first stop after the
canvas itself; the card is the editor's Header region for F6 (`data-region="header"`). It shows when a phone is held
sideways, where the Explorer's button does not, and zen hides it with the rest of the chrome. The tab bar holds no
Back. The status screens put the same card at `EmbedShell`'s top left. The document entry's `history.state` carries
`workbenchFrom` (the frame path it was pushed from); Back calls `history.back()` when the entry before is that path
(`workbenchFrom` set by `navigate`), else pushes Home. Browser back and forward walk the same entries.

**Open in livedocuments**: on a document, the existing link with the place's app href (`/document/<id>[?s=]`); on an
Explorer view, the same control at the right end of the Explorer's bottom bar linking to `explorerPathFor(node)`.

**`trashed`** in the workspace scope: the session the frame lends the editor turns `useWorkbenchEnd`'s
`end('trashed')` into Back (the page never ends), with the toast "That document is in the Trash." (WB60).

#### The Explorer in a workbench (`ExplorerSurface = 'workbench'`)

`useExplorerSurface()` reads `useWorkbenchSession()?.scope === 'workspace'`. The Surface table, Explorer side:

| Gate                                                                    | File                                    | In a workbench                                               |
| ----------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| App header (brand, product nav, `AuthControls`)                         | `ExplorerShell.tsx`                     | Not rendered; the lens field in a slim bar instead (WB61)    |
| Home hero                                                               | `ExplorerShell.tsx`                     | Rendered as in the app                                       |
| Bottom bar: Settings, Appearance                                        | `ExplorerShell.tsx`, `ChromeControls`   | Absent; Search stays; Open in livedocuments at the right end |
| Settings dialog, `?settings=` links, `useOpenSettingsRequests`          | `useExplorerState.ts`, `ExplorerShell`  | Never opens                                                  |
| Search panel's settings rows                                            | `ExplorerShell.tsx`                     | `[]`                                                         |
| Sign-in banner, `LocalMovePrompt`                                       | `ExplorerShell.tsx`                     | Not rendered                                                 |
| `useTokens`                                                             | `useExplorerState.ts`                   | `enabled: false`                                             |
| Teams administration: New team, the Invites row and view, team settings | `sidebar/*`, `TeamLibraryHeader`, views | Absent (WB62)                                                |
| Timeline token cards' Revoke                                            | `timeline/*`                            | Absent                                                       |
| Every `window.location.assign`, `<a href>`, `router.push`/`replace`     | the Explorer                            | Through `assignAppLocation` / `useAppNavigation`: the frame  |

#### The CLI, workspace scope

- `workbench open --workspace [--folder <f>] --origin <origin> [--json]`: `<doc>` and `--workspace` exclude each
  other, one is required (exit 2 "name a document, or --workspace"); `--tab` with `--workspace` exits 2. `--folder`
  without `--workspace` exits 2. `<f>` resolves through `resolveFolder` over `folderChoices`
  (`@livedocuments/agent-verbs`, shared with `folder`): its full id, an id prefix
  or its name ignoring case; none 3, several 3 with the candidates. `POST /api/workbench/tickets { scope:
'workspace', folderId?, origin }`. 201: text `url`; `--json` `{ url, scope, folderId, expiresAt }`. 428: exit 4,
  fix `livedocuments workbench pair --origin <origin> --workspace`. 404: exit 3.
- `workbench pair --origin <origin> [--name <name>] [--workspace]`: the request carries `scope: 'workspace'`; the
  printed results add ` (whole workspace)` in text and `scope` in `--json`; the expired fix carries `--workspace`.

#### Workspace messages

- `ready` (workspace) once, when the Explorer first mounts: `{ scope: 'workspace', role }` (`role` the session's).
- `place` (`useWorkspacePlaceMessages`) after every move and whenever a field of the current place changes, only
  when it differs from the last sent (WB63): Explorer views from the Explorer's state (`view` = `placeView(node)`:
  the `SelectedNode` kind, `folderId` and `folderName` for `folder`, `documentCount` =
  `documentsByFolder.get(folderId)?.length ?? 0` for `folder`, the three null on every other view), once the
  Explorer's lists are in; a document from the editor (`view: 'document'`, `documentId`, `documentName`, `tabId`,
  `tabName`, `role` the editor's `sessionRole`, the folder fields null). Logged `[workbench] place { view }`.
- The editor in a workspace frame sends `place` where the document scope sends `ready`, and `tab`, `selection` and
  `reveal` as in the document scope; on an Explorer view they do nothing.
- `open` (`livedocuments:open`, accepted while mounted): `{ view: 'home' }` → Home, `{ folderId }` → that folder,
  `{ documentId, tabId? }` → that document (from the current place). Pushed like any move; an unreachable id shows
  the Explorer's or the editor's own not-found. Logged `[workbench] open { kind: 'home' | 'folder' | 'document' }`.

## Interfaces and contracts

### Routes

| Method | Path                                            | Caller                   | Success                                        | Rejections                                                                                                                                                                                        |
| ------ | ----------------------------------------------- | ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/workbench/tickets`                        | token                    | 201 `WorkbenchTicketResponse`                  | 401 `invalid_token`, 403 `token_required`, 403 `workbench_confined`, 400 `bad_request`, 400 `invalid_origin`, 428 `pairing_required`, 404 `not_found`, 410 `document_trashed`, 429 `rate_limited` |
| POST   | `/api/workbench/sessions`                       | anyone holding a ticket  | 201 `WorkbenchSessionResponse`                 | 400 `bad_request`, 401 `invalid_ticket` `{ reason }`, 404 `not_found`, 410 `document_trashed`, 429 `rate_limited`                                                                                 |
| DELETE | `/api/workbench/sessions/current`               | workbench session        | 204                                            | 401 `invalid_session`, 403 `not_a_workbench_session`                                                                                                                                              |
| POST   | `/api/workbench/pairing-requests`               | token                    | 200 `WorkbenchPairingRequestCreated`           | 401 `invalid_token`, 403 `token_required`, 400 `bad_request`, 400 `invalid_origin`, 429 `rate_limited`                                                                                            |
| GET    | `/api/workbench/pairing-requests/:code/status`  | the requesting token     | 200 `WorkbenchPairingStatusResponse`           | 403 `token_required`, 404 `not_found`                                                                                                                                                             |
| GET    | `/api/workbench/pairing-requests/:code`         | signed in, owner         | 200 `{ request: WorkbenchPairingRequestView }` | 401 `sign_in_required`, 404 `not_found`                                                                                                                                                           |
| POST   | `/api/workbench/pairing-requests/:code/approve` | signed in, owner         | 200 `{ pairing: WorkbenchPairing }`            | 401 `sign_in_required`, 404 `not_found`, 409 `pairing_answered`, 410 `pairing_expired`                                                                                                            |
| POST   | `/api/workbench/pairing-requests/:code/decline` | signed in, owner         | 204                                            | 401 `sign_in_required`, 404 `not_found`, 409 `pairing_answered`, 410 `pairing_expired`                                                                                                            |
| GET    | `/api/workbench/pairings` (WB46)                | signed in                | 200 `WorkbenchPairingsResponse`                | 401 `sign_in_required`                                                                                                                                                                            |
| DELETE | `/api/workbench/pairings/:id`                   | signed in, token's owner | 204                                            | 401 `sign_in_required`, 404 `not_found`                                                                                                                                                           |

The status and name of each rejection the spec leaves unnamed are WB43. Any `lvw_` request (choke point): 401 `invalid_session`, 403 `workbench_confined`, 403 `workbench_read_only`, 404
`not_found` (another document). `invalid_origin`, `pairing_required`, `invalid_ticket`, `invalid_session`,
`workbench_confined`, `workbench_read_only`, `token_required`, `not_a_workbench_session`, `pairing_answered` and
`pairing_expired` are `WORKBENCH_ERROR_CODES` in `packages/api-schema/src/workbench.ts`, as `CHANGESET_ERROR_CODES` are (WB26). `:code` must match `^[A-Za-z0-9_-]{22}$`,
else 404. 401 `sign_in_required` is answered to tokens and sessions too (`accountUserId` null).

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

The workspace scope widens these types (the document scope's shapes stay, so today's callers read them unchanged):

```ts
export type WorkbenchScope = 'document' | 'workspace';
export type WorkbenchTicketRequest =
  | { scope?: 'document'; documentId: string; tabId?: string; origin: string }
  | { scope: 'workspace'; folderId?: string; origin: string };
export type WorkbenchWorkspaceTicketResponse = {
  url: string;
  scope: 'workspace';
  folderId: string | null;
  expiresAt: number;
};
// WorkbenchSessionResponse: the document scope's fields, discriminated by scope.
export type WorkbenchSessionResponse = {
  session: string;
  origin: string;
  role: WorkbenchRole;
  expiresAt: number;
  person: WorkbenchPerson;
} & (
  | { scope: 'document'; documentId: string; folderId: null; tabId: string | null }
  | { scope: 'workspace'; documentId: null; folderId: string | null; tabId: null }
);
// WorkbenchPairing, WorkbenchPairingRequestView: + scope: WorkbenchScope.
// WorkbenchPairingRequestCreate: + scope?: WorkbenchScope (absent: 'document').
```

`invalid_value` joins `WORKBENCH_ERROR_CODES`; its body is `{ error: 'invalid_value', message }`.

`parseWorkbenchOrigin(input: string): { ok: true; origin: WorkbenchOrigin } | { ok: false }`: at most
`WORKBENCH_ORIGIN_MAX_LENGTH` characters; parsed with `URL`; `protocol` `https:`, or `http:` with `hostname` one of
`localhost`, `127.0.0.1`, `[::1]`; `username`, `password`, `search`, `hash` empty; `pathname` `/` and the input
not ending in `/` (WB27); the input equal to `url.origin` (so no default port, no upper case, no trailing dot is
accepted that the browser would rewrite). `*` and `null` fail the parse.

`capWorkbenchRole(role, ceiling?)`: the lower of the two on the ladder `view < participate < edit`; no ceiling
gives `role`. Today both inputs are `view` or `edit`, so a room ticket never carries `participate` before share
roles teach `consumeWsTicket` to read it.

`pairingUrl` is `${appBaseUrl(env)}/workbench/pair?code=${code}`.

### Workbench messages (`packages/api-schema/src/workbench-messages.ts`)

Every message is `{ type, v: 1, ... }`; strings are bounded as stated; anything else is invalid.

```ts
type HelloMessage = { type: 'livedocuments:hello'; v: 1 };
type HelloAckMessage = { type: 'livedocuments:hello-ack'; v: 1; name: string }; // 1..40 after trim
type ReadyMessage = {
  type: 'livedocuments:ready';
  v: 1;
  documentId: string;
  documentName: string;
  tabId: string;
  tabName: string;
  role: WorkbenchRole;
};
type TabMessage = { type: 'livedocuments:tab'; v: 1; tabId: string; tabName: string };
type SelectionMessage = {
  type: 'livedocuments:selection';
  v: 1;
  documentId: string;
  documentName: string;
  tabId: string;
  rev: number;
  count: number; // 0 when nothing is selected
  reference: string; // selectionReference().text, always present (WB28)
};
type RenewMessage = { type: 'livedocuments:renew'; v: 1 };
type TicketMessage = { type: 'livedocuments:ticket'; v: 1; ticket: string }; // 22 base64url
type RevealMessage = { type: 'livedocuments:reveal'; v: 1; refs: string[] }; // 1..20, each 1..64
type ThemeMessage = { type: 'livedocuments:theme'; v: 1; colourScheme: 'light' | 'dark' };
type EndedMessage = {
  type: 'livedocuments:ended';
  v: 1;
  reason: 'expired' | 'revoked' | 'trashed' | 'refused';
};
```

The workspace scope's messages:

```ts
type WorkspaceReadyMessage = {
  type: 'livedocuments:ready';
  v: 1;
  scope: 'workspace';
  role: WorkbenchRole;
};
type PlaceMessage = {
  type: 'livedocuments:place';
  v: 1;
  view: string; // a SelectedNode kind, or 'document'
  folderId: string | null;
  folderName: string | null;
  documentCount: number | null;
  documentId: string | null;
  documentName: string | null;
  tabId: string | null;
  tabName: string | null;
  role: WorkbenchRole;
};
type OpenMessage = {
  type: 'livedocuments:open';
  v: 1;
  to: { view: 'home' } | { folderId: string } | { documentId: string; tabId?: string }; // ids 1..64
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
of each within the CLI budgets; examples `livedocuments workbench open "Home screen" --origin https://127.0.0.1:5175
--json` and `livedocuments workbench pair --origin https://127.0.0.1:5175 --name "Acme Editor"`.

### Room

`AccessCloseMatch` gains `{ match: 'workbench'; pairingId: string }` (UUID pattern); `sessionMatchesAccessClose`
matches `session.workbenchPairing === pairingId`. `WORKBENCH_ENDED_CLOSE = 4006`, reason `workbench-ended`.
`RoomHandlers.onWorkbenchEnded` fires on it and the connector does not reconnect.

### OpenAPI

Eleven `RouteSpec` entries, segment `workbench`, tag `Workbench`, `auth`: `clerk` (the manifest's name for Bearer-only) for the token and signed-in routes,
`public` for the redemption; `tokenUsable: true` for the ticket mint, the pairing request and its status only.
Request and response schemas from the types above; 428, 401 and 409/410 bodies inline. `route-parity.test.ts`
covers them by dispatch probe.

## Data and persistence

Migration `apps/api/migrations/0001_livedocuments_baseline.sql` (WB40):

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

Migration `apps/api/migrations/0001_livedocuments_baseline.sql` (WB64) adds the scope. Tickets and sessions are rebuilt,
since SQLite cannot drop a `NOT NULL`; no table references either, so the rebuild drops and renames with no parked
rows, and every row is copied as `document`:

```sql
ALTER TABLE workbench_pairing_requests ADD COLUMN scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace'));
DROP INDEX workbench_pairing_requests_live;
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin, scope) WHERE status = 'pending';

ALTER TABLE workbench_pairings ADD COLUMN scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace'));

-- workbench_tickets and workbench_sessions, each: CREATE TABLE <t>_new as before but
--   document_id TEXT NULL REFERENCES documents(id) ON DELETE CASCADE,
--   scope TEXT NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
--   folder_id TEXT NULL,
--   CHECK ((scope = 'document') = (document_id IS NOT NULL)),
--   CHECK (scope = 'workspace' OR folder_id IS NULL);
-- INSERT ... SELECT the old columns; DROP the old table; RENAME; recreate its indexes.

CREATE TABLE workbench_session_rooms (
  session_id TEXT NOT NULL REFERENCES workbench_sessions(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, document_id)
);
```

- Every pairing approved before 0099 reads `document`, as the spec says. `folder_id` has no foreign key: a folder
  deleted since is only a start place the Explorer reports as gone.
- `workbench_session_rooms` is ephemeral with its session (cascade, and the sweep's session delete); it carries no
  owner id, so account deletion reaches it through `workbench_sessions`.

| Field                                    | Class      | Notes                                                                                                                                            |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workbench_pairing_requests.code`        | handle     | 16 random bytes base64url, stored in the clear: it grants nothing without the owner's session and is served again while the request lives (WB29) |
| `*.owner_id`                             | identity   | The token's owner (an account id); account-only                                                                                                  |
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
- **E7** A token approving its own request (`lwt_` on approve): `401 sign_in_required`.
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
- **E32** A host without sign-in: no tokens, so no mint; the page can only reach `refused('no-ticket')` or
  `refused('ticket')`; the pair page says pairing is not available.
- **E33** Two frames of one pairing on one document: two sessions, two sockets, one person tag; presence shows the
  person once per socket as for two browser tabs.
- **E34** The pair page opened in a frame: the live worker sends `X-Frame-Options: DENY`; nothing renders.
- **E35** A workspace mint on a document pairing: `428 pairing_required` with a workspace request, its own code.
- **E36** A document mint on a workspace pairing: paired; the ticket is a document ticket.
- **E37** A document request and a workspace request pending together for one token and origin: two codes; approving
  either records its scope; approving both leaves `workspace`.
- **E38** `scope: 'workspace'` with a `documentId` or `tabId`, or `scope: 'document'` (or none) without a
  `documentId`: `400 invalid_value`; an unknown `scope`: `400 invalid_value`.
- **E39** A `folderId` that is not the owner's, a team folder of a team they left, or no folder: `404`, CLI exit 3.
- **E40** A workspace session on `/embed/workbench?d=`, or a document session on `/embed/workbench/explorer`:
  `refused('mismatch')`, the session revoked.
- **E41** A workspace frame reloaded on a document or folder path: the fragment is gone, `refused('no-ticket')`.
- **E42** A workspace session presenting `X-Owner-Id`: `403 workbench_confined`; `X-Share-Code`: allowed, the route
  decides by the link.
- **E43** The open document is trashed in the workspace frame: back to the Explorer, the session lives on.
- **E44** The started folder is deleted before the frame loads: the Explorer's folder not-found, as a stale link.
- **E45** A view workspace session tries New document: `403 workbench_read_only`, the Explorer's create-failed toast;
  the Explorer offers no create while `role` is `view` (its own read-only state, `prefs`-free).
- **E46** `livedocuments:open` with an id the person cannot reach: the Explorer's or the editor's not-found; logged.
- **E47** Unpair or revoke while a workspace frame has a document open: the room closes with 4006 (the session's
  rooms are recorded), the frame ends `revoked`.

## Security and trust

- **Pairing is the gate on minting** (I5): a leaked token mints nothing for an origin its owner never approved, and
  approval needs the owner's own signed-in session (I6), which no token, session or guest header carries.
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
- **The workspace scope is a second approval**: no document pairing ever answers a workspace mint (E35); widening is
  only by Allow on a workspace request, whose page says so.
- **Never more than the token** in the workspace scope: `accountUserId` and `token` are null, so every signed-in-only route
  (team administration, the account) refuses as it refuses the token, and
  `WORKSPACE_ROUTES` refuses them first with `workbench_confined`; a view session is read-only at the choke point and
  never lists share links (WB54).
- **Share links in the workspace scope** are the person's own: a code reaches only what the code reaches for anyone,
  and the guest header stays refused, so a session never acts as someone else.

## Performance and limits

- Each `lvw_` request: one indexed `SELECT` (`secret_hash` unique) joined to `api_tokens` by primary key, about the
  cost of `resolveApiToken` without its once-a-minute `last_used_at` write (WB32). The autosave's cadence (one save per debounce)
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
- Workspace: the verdict walks at most 12 patterns; the frame's Explorer reads what `/explorer` reads, once per
  frame view and again on Back from a document; a room ticket adds one `INSERT OR IGNORE`; a `place` message is
  under 1 KiB and sent only when it changes.

## Presentation and UX

### Workbench page copy

| Where                             | Copy                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `reading`, `redeeming`, `binding` | "Opening your document…" (WB33)                                                                                                                  |
| `refused` (any)                   | Heading "Open this document from your workbench", body "This link works once, for a minute. Open the document again from your workbench." (WB33) |
| `unbound`                         | "This view opens only inside <origin>." (spec), the origin in monospace                                                                          |
| `ended` (expired, revoked)        | A line at the top centre: "Reconnect in <name> to keep editing." (spec); `<name>` from `hello-ack`                                               |
| `ended` (trashed)                 | `DocumentTrashedCard` with `restorable={false}`                                                                                                  |
| `failed`                          | `LoadErrorCard embed`                                                                                                                            |

The status screens use `EmbedShell` (no header, no Explorer). **Open in livedocuments** (`WorkbenchOpenLink`): the last
control at the right end of the tab bar, after Search and Settings, styled as they are: the external-link glyph and
the words "Open in livedocuments" (the glyph alone on a phone, as its neighbours), linking to `/document/<id>` with
`target="_blank" rel="noopener noreferrer"`, shown while `mounted` and `ended` (WB34). In a workbench the tab bar
offers no Appearance control (WB15). The Reconnect line is `WorkbenchReconnectLine`.

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
| Expired                     | "This request has expired"          | "Run livedocuments workbench pair again to ask anew." (command in monospace)                                                                                                                                                                                                                                                                                                                                                |
| Already answered            | "This request was already answered" | "Run livedocuments workbench pair again if you need to ask anew."                                                                                                                                                                                                                                                                                                                                                           |

### The workspace frame

| Where                                 | Copy                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `reading`, `redeeming`, `binding`     | "Opening your workspace…" (WB65)                                                                                                        |
| `refused` (any)                       | Heading "Open your workspace from your workbench", body "This link works once, for a minute. Open it again from your workbench." (WB65) |
| Back                                  | The arrow-left glyph and "Back" (the glyph alone on a phone), accessible name "Back to <view title>"                                    |
| Open in livedocuments (Explorer view) | As the editor's; accessible name "Open in livedocuments (opens in a new tab)"                                                           |
| Create failed                         | Toast "Couldn’t create the document. Try again."                                                                                        |
| Trashed                               | Toast "That document is in the Trash."                                                                                                  |

The Explorer's own views, empty states and not-found keep their copy. The slim bar at the top holds the lens field
only, `h-12`, the header's colours.

### The pairing page, a workspace request

| State   | Body                                                                                                                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending | "Allow **<name>** at `<origin>` to open **your whole workspace**, and to create, move, share and trash documents and folders in it, with the token **<token name>**?" (spec); with no name: "Allow a workbench at `<origin>` to open ..." |
| Pending | Below: "It works in your Explorer and your documents, as you, inside that tool. You can unpair it any time in Settings, under API Tokens." (WB66)                                                                                         |

Every other state is the document request's.

### Settings > API tokens

The API Tokens row (whose tokens are run on liveworkspace.app) shows, under its link there, one "Paired workbenches"
list for the account (none: nothing, WB35). A row: the name (or "Unnamed workbench"), the origin in monospace, its scope ("One document at a time" or
"Whole workspace", WB67), "Paired <relative time>", and an
**Unpair** text button. Unpair opens a confirm popover: "Unpair <name>? Its open documents stop
editing until you allow it again." with **Unpair** and **Cancel** (WB36). After Unpair the row leaves the list.

## Accessibility

- Status screens: the copy in a `role="status"` region; `refused` and `unbound` headings are `h1`.
- The Reconnect line: `role="status"`, `aria-live="polite"`, visible text, never colour alone.
- **Open in livedocuments**: accessible name "Open in livedocuments (opens in a new tab)"; at least 24 by 24 px; the
  editor's focus ring.
- The pairing page: focus moves to the heading on each state change; **Allow** and **Don't allow** are native
  buttons; the origin and the token name are text, readable by a screen reader in full; it is drawn by `OauthShell`,
  whose primary fill (`OAUTH_PRIMARY`: white on `brand-700` in light, about 5.9:1, and the solid brand control in
  dark) the device and consent pages share.
- Settings rows: **Unpair** named "Unpair <name> at <origin>"; the confirm popover is the existing accessible one.
- The workspace frame: the Explorer's own semantics and focus order; Back is a native button, at least 24 by 24 px,
  first of the editor's controls in the focus order, after the canvas itself, and the Header region for F6; a move inside the frame moves focus to the new view's heading (the Explorer's
  pane heading, or the editor's canvas as on a load), and announces nothing more.
- Reveal outlines honour reduced motion as changeset outlines do.
- The contrast audit, `apps/live/e2e/signed-in/workbench-contrast.spec.ts` (every surface needs a signed-in person,
  which only the signed-in export renders, so not the guest-mode `contrast-audit.spec.ts`), holds the pairing page
  (pending), the device page (code entry and consent) and the paired-workbench row, each in both schemes.

## Web Experience

- `/embed/workbench` LCP is the status text, painted from the static HTML; the editor chunk is preloaded
  (`import('../../document/[id]/editor-page')` started on mount) while redeem and binding run, so `mounted` does not
  wait on it. The editor replaces the status screen whole: no shift inside either (CLS).
- INP: the selection message is built after the settle, off the input event; message handling is O(refs).
- `/workbench/pair` is a small static page; its one request runs after auth settles; layout is the device page's.
- The workspace frame's LCP is its status text, from the static HTML; the Explorer and the editor chunks start
  loading on mount while redeem and binding run. A move inside the frame is a client render with no page load;
  the frame's own status line stands while a chunk loads, and nothing above the pane shifts between views (CLS);
  a move is one push and a render, off the input event (INP).

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

Every api fingerprint above carries `scope` (`document` or `workspace`), as the spec asks; the workspace frame adds
`[workbench] place { view }`, `[workbench] open { kind }` and `[workbench] create-failed { status }` (page), and
`track('Session', 'Opened', 'WorkbenchWorkspace')` once per workspace frame.

`originHost` is the origin's host only (no scheme or port, WB37). The fingerprints beyond the spec's list name
decision points it leaves unlogged (WB47). Telemetry: `track('Session', 'Opened',
'Workbench')` once per mount; `track('Token', 'Linked', 'Workbench')` after a successful Allow; `Cli·Used·WorkbenchOpen`
and `Cli·Used·WorkbenchPair` after exit 0. Dashboard: `WORKBENCH_SESSIONS` beside `EMBEDS_VIEWED` ("Workbench
Sessions", "A document opened inside a developer tool's frame, signed in."), `WORKBENCHES_PAIRED` in
`API_TOKEN_ACTIVITY` ("Workbenches Paired", "A token's owner allowed a developer tool to open their documents."),
and the two CLI rows.

## Testing

| Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Test                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Origin shapes: every accepted and refused form of the spec and E1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `packages/api-schema/src/workbench.test.ts`                                                                            |
| Allow-list: every row allowed, every listed confined route refused, another document `other-document`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `packages/api-schema/src/workbench.test.ts` (table-driven)                                                             |
| Message parse: each type, bounds, unknown, `v: 2`, invalid fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `packages/api-schema/src/workbench-messages.test.ts`                                                                   |
| The baseline migration: tables, indexes, cascades from `api_tokens`, `documents`, `workbench_pairings`                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `apps/api/src/db/workbench.test.ts` (real SQLite)                                                                      |
| Account deletion and the owner-keyed ledger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/api/src/db/account-owner-columns.test.ts`                                                                        |
| Unpaired mint 428 with a URL; second mint same request; expired request replaced                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `apps/api/src/routes/workbench-ticket-route.test.ts`                                                                   |
| Mint refusals: token required, confined, origin, body, 404, 410, tab not linked, 429; share code ignored                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `workbench-ticket-route.test.ts`                                                                                       |
| Mint level: edit token edit, read-only token view; owner's team access counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `workbench-ticket-route.test.ts`                                                                                       |
| Pairing request create, reuse, name update, `paired` when paired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `apps/api/src/routes/workbench-pairing-routes.test.ts`                                                                 |
| Approve and decline: owner only, token refused 401, other account 404, 409 twice, 410 expired                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `workbench-pairing-routes.test.ts`                                                                                     |
| Status poll: requesting token only; statuses; expired read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `workbench-pairing-routes.test.ts`                                                                                     |
| Pairings list and Unpair: owner only, sessions and tickets gone, rooms closed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `workbench-pairing-routes.test.ts`, `apps/api/src/workbench-end.test.ts`                                               |
| Token revoke (by id and current) ends pairings, requests and sessions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `apps/api/src/routes/tokens.test.ts`, `workbench-end.test.ts`                                                          |
| Redemption: single use, `used`, `expired`, `unknown`, token revoked, access lost, expiry capped by token                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `apps/api/src/routes/workbench-session-routes.test.ts`                                                                 |
| Session resolution: reasons, `ctx` shape (account null, token null, owner), ambient headers refused                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `apps/api/src/auth/workbench-session.test.ts`, `apps/api/src/index.test.ts`                                            |
| Confinement at the choke point: 403, 404 for another document, view session writes 403, room-ticket allowed                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/api/src/auth/workbench-confinement.test.ts`, `index.test.ts`                                                     |
| A session's tab PUT succeeds (no `use_changesets`); its revert is a person's                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/api/src/routes/tab-put-route.test.ts`, `apps/api/src/routes/changesets.test.ts`                                  |
| Room ticket: account true, owner's person tag, role capped, pairing carried; upgrade header always set                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `apps/api/src/routes/document-room-routes.test.ts`                                                                     |
| The frame's selection reads `mine`; never holds against the owner's agent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `apps/api/src/routes/changesets.test.ts` (held), `document-room.test.ts` (`/selections`)                               |
| Close match `workbench`: only that pairing's sockets, code 4006                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/api/src/room-access.test.ts`, `document-room.test.ts`                                                            |
| Images: no owner shortcut, `d` must be the session's document                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `apps/api/src/routes/images.test.ts`                                                                                   |
| Sweep deletes what is due and nothing else                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `apps/api/src/db/workbench.test.ts`                                                                                    |
| OpenAPI parity and schemas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `apps/api/src/openapi/route-parity.test.ts`, `manifest.test.ts`                                                        |
| Selection reference: header, refs, kind words, labels quoted and cut, cap and tail, none, element order, kind-ref-label words                                                                                                                                                                                                                                                                                                                                                                                                                                            | `packages/document-views/src/selection-reference.test.ts`                                                              |
| Fragment read and cleared before any request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/live/app/embed/workbench/workbench-fragment.test.ts`                                                             |
| Page machine: every transition of the phase table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `apps/live/app/embed/workbench/workbench-machine.test.ts`                                                              |
| Port: target origin on every send; foreign origin and source dropped; unknown logged once                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `apps/live/lib/workbench/workbench-port.test.ts`                                                                       |
| Renewal timing, swap, mismatch, expiry to `ended`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `apps/live/app/embed/workbench/useWorkbenchRenewal.test.ts` (fake timers)                                              |
| Bridge publishes before children fetch; accounts bridge stands down; pending default without sign-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `apps/live/components/providers/WorkbenchAuthBridge.test.tsx`                                                          |
| Bootstrap: no migration, no participant write, no lists, no share-link read, session level, `tabId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `apps/live/app/document/[id]/useIdentityBootstrap.test.ts`, `apps/live/hooks/persistence/useAccountBootstrap.test.tsx` |
| Client confinement throws without fetching; preferences write local only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `apps/live/lib/api/core.test.ts`, `apps/live/lib/user-preferences.test.ts`                                             |
| Surface flags and every gate of the Surface table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `apps/live/app/document/[id]/editor-surface.test.ts`, `EditorView.test.tsx` (new), `settings-catalogue.test.ts`        |
| Messages from the editor: ready once, tab, settle 250 ms, dedupe, reveal, theme                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/live/app/document/[id]/useWorkbenchMessages.test.ts`                                                             |
| Tab revisions from load, save and changeset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/live/app/document/[id]/useTabRevisions.test.ts`                                                                  |
| Appearance override wins and is never stored                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `packages/ui/src/appearance/appearance-store.test.ts`                                                                  |
| Close 4006 stops the connector                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `apps/live/lib/api/room.test.ts`                                                                                       |
| Pair page states and copy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `apps/live/app/workbench/pair/PairWorkbench.test.tsx`                                                                  |
| Settings pairings and Unpair confirm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `SettingsTokenPairings.test.tsx`, `useWorkbenchPairings.test.ts`                                                       |
| Worker: `/embed/workbench` frameable, `/workbench/pair` DENY                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/live/src/worker.test.ts`                                                                                         |
| CLI open: URL and JSON, 428 exit 4 with the fix, share URL exit 2, origin exit 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `packages/agent-verbs/src/verbs/workbench.test.ts`, `apps/cli/src/commands/workbench-open.test.ts`                     |
| CLI pair: URL first on stdout, no browser when piped, approved 0, declined 4, expired 4, 429 slow down, 404, network retries                                                                                                                                                                                                                                                                                                                                                                                                                                             | `apps/cli/src/commands/workbench-pair.test.ts` (fake io)                                                               |
| CLI help budgets for the new resource and verbs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/cli/src/help/help.test.ts`                                                                                       |
| Guide `workbench` and the skill's `[livedocuments]` pointer; every topic, the frontmatter and the body within budget                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `packages/agent-verbs/src/catalogue.test.ts`                                                                           |
| Telemetry catalogue rows and CLI command rows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `apps/telemetry` catalogue suites, `metric-series.test`                                                                |
| End to end, dark, a fake workbench page on `http://127.0.0.1:<port>` framing the live app on `http://localhost:<port>`: unpaired mint 428; the pair page (signed in through the test bridge) Allow; mint; the frame binds, the editor mounts without header or Explorer; drawing saves; a selection arrives as one settled message with the reference; `reveal` outlines; `theme` switches; renewal swaps the session; Unpair turns the frame read-only with the Reconnect line; a page on another origin framing the same URL mounts nothing and shows the unbound copy | `apps/live/e2e/workbench-embed.spec.ts` (project `workbench`, `colorScheme: 'dark'`, `E2E_WORKBENCH=1`)                |

The workspace scope's tests:

| Rule                                                                                                                                                                                                                                                                                                               | Test                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `pairingCoversScope`; `WORKSPACE_ROUTES`: every allowed class allowed, every confined class refused, ambient headers by scope                                                                                                                                                                                      | `packages/api-schema/src/workbench.test.ts` (table-driven)                                              |
| `place`, `open`, workspace `ready`: shapes, bounds, invalid fields                                                                                                                                                                                                                                                 | `packages/api-schema/src/workbench-messages.test.ts`                                                    |
| The baseline migration: old pairings read `document`; the CHECKs; the rebuilt indexes; the rooms table cascades                                                                                                                                                                                                    | `apps/api/src/db/workbench.test.ts` (real SQLite)                                                       |
| Requests per scope; approval widens, never narrows; `paired` only when covering                                                                                                                                                                                                                                    | `workbench-pairing-routes.test.ts`, `db/workbench.test.ts`                                              |
| Workspace mint: 428 on a document pairing, 201 on a workspace one, document mint on a workspace pairing, `invalid_value` cases, folder reach (personal, team member, stranger 404), view token view                                                                                                                | `workbench-ticket-route.test.ts`                                                                        |
| Workspace redemption: the scoped answer, no document check                                                                                                                                                                                                                                                         | `workbench-session-routes.test.ts`                                                                      |
| Choke point, workspace: each allowed route class reaches its route, each account class 403 `workbench_confined`, `X-Owner-Id` refused, `X-Share-Code` passes, view writes and share-link list 403                                                                                                                  | `apps/api/src/auth/workbench-confinement.test.ts`, `apps/api/src/index.workbench-workspace.test.ts`     |
| Room ticket under a workspace session records its room; ending access closes it                                                                                                                                                                                                                                    | `document-room-routes.test.ts`, `workbench-end.test.ts`                                                 |
| Frame addresses both ways; app hrefs to frame paths                                                                                                                                                                                                                                                                | `apps/live/lib/workbench/workspace-place.test.ts`                                                       |
| Interceptor: links, `assignAppLocation`, `useAppNavigation`, new-tab fallback                                                                                                                                                                                                                                      | `apps/live/lib/app-location.test.ts`, `useWorkspaceNavigation.test.ts`                                  |
| New document in place: folder, team, template, blank, refused                                                                                                                                                                                                                                                      | `create-in-place.test.ts`                                                                               |
| The address's scope; mismatch both ways; renewal scope check                                                                                                                                                                                                                                                       | `workbench-fragment.test.ts`, `workbench-machine.test.ts`, `useWorkbenchRenewal.test.ts`                |
| The frame: Explorer on Home and on a folder, document with Back, trashed back to the Explorer, `place` on moves, `open`                                                                                                                                                                                            | `WorkspaceFrame.test.tsx`, `useWorkspacePlaceMessages.test.ts`                                          |
| Back's card: top left, alone, the strip's `data-toolbar-menu`, the Header region, inline on a phone; the tab bar has no Back                                                                                                                                                                                       | `WorkbenchChrome.test.tsx`, `TabBar.workbench.test.tsx`                                                 |
| Explorer surface flags and gates                                                                                                                                                                                                                                                                                   | `apps/live/app/explorer/explorer-surface.test.tsx`                                                      |
| Pairing page workspace copy; Settings scope                                                                                                                                                                                                                                                                        | `PairWorkbench.test.tsx`, `SettingsTokenPairings.test.tsx`                                              |
| Worker serves the frame page for frame paths, frameable                                                                                                                                                                                                                                                            | `apps/live/src/worker.test.ts`                                                                          |
| End to end, dark: a workspace mint 428 on a document pairing; Allow the workspace request; mint; the frame shows Explorer Home with no header or account; a folder mint shows its empty state; New document opens in the frame; `place` arrives for each; Back at top left, first, returns; `open` moves the frame | `apps/live/e2e/workbench-workspace.spec.ts` (project `workbench`)                                       |
| CLI: `workbench open --workspace [--folder]`, `pair --workspace`, `folder ls [--json]`, `folder create [--in] --json`                                                                                                                                                                                              | `packages/agent-verbs/src/verbs/workbench.test.ts`, `folder.test.ts`, `apps/cli/src/commands/*.test.ts` |

The fake workbench (`apps/live/e2e/fixtures/fake-workbench.html`) is served by `workbench-support.ts` from a Node `http`
server on `127.0.0.1` at a free port; it frames the URL it is given, answers `hello` with `hello-ack { name: 'Fake
Workbench' }`, answers `renew` with a ticket the test mints, and records every message into `window.received`.
`scripts/e2e-stack.mjs` under `E2E_WORKBENCH=1` acts as the accounts Worker as under `E2E_ACCOUNTS_STUB` (its own JWKS at `/e2e/accounts/api/auth/jwks` and `/e2e/token`)
and sets `APP_BASE_URL` to the live server; `test:e2e:workbench` builds with `NEXT_PUBLIC_E2E_AUTH=1`.

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
reuses `OauthShell`, which stands on `AuthStage` (the Night Band frame).

## Defaults ledger

WB1 to WB67 in [DEFAULTS.md](DEFAULTS.md).
