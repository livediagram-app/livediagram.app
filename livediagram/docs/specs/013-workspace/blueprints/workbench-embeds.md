# Workbench embeds: blueprint

Derived from [Workbench embeds](../workbench-embeds.md), with the frame headers of [Embeds](../embeds.md), the token
choke point of [API](../../015-api/api.md#auth) and [Public API and API tokens](../../015-api/public-api-and-tokens.md),
the whole-tab save rule of [Agent changesets](../../024-agents/agent-changesets.md#whole-tab-saves-and-tab-renames),
the person tag of [Agent presence](../../024-agents/agent-presence.md), the levels of
[Share roles](../share-roles.md#the-levels), the commands of [CLI](../../015-api/cli.md) and the refs and kind words of
[Document views](../../024-agents/document-views.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `WBn`.

**The platform's part.** Pairing, tickets, sessions, revocation, the sweep, the pairing page and every
`/api/workbench/*` route are liveworkspace's, in its accounts Worker
([Workbenches](../../../../../liveworkspace/docs/workbench.md)). The router sends `/api/workbench/*` there, and this
api forwards a request that reaches it directly (the CLI against `wrangler dev`) unchanged, as livediagram, before
identity (`index.ts`, `routeToWorkspace`). This file holds what livediagram does with what the platform hands it: a
`lvw_` bearer checked with liveworkspace and confined here, the frameable page that binds and hosts the editor or the
Explorer, the messages, the selection reference, and the CLI's two commands.

**Two scopes.** Every ticket, session and pairing carries a `WorkbenchScope`, `document` or `workspace`
([Two scopes](../workbench-embeds.md#two-scopes)). Everything below is the document scope unless it says otherwise;
[The workspace scope](#the-workspace-scope) holds the workspace scope's own behaviour.

It provides these names to sibling blueprints ([CLI](../../015-api/blueprints/cli.md),
[Share roles](share-roles.md), [Agent changesets](../../024-agents/blueprints/agent-changesets.md)):

| Name                                                              | What it is                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `RouteContext.workbench: WorkbenchContext \| null`                | The presenting workbench session; null for every other caller            |
| `workbenchRouteVerdict(method, segments, session)`                | The confinement allow-list, shared by the api choke point and the editor |
| `parseWorkbenchOrigin(input)`                                     | The one origin rule, shared by the CLI and the page                      |
| `WORKBENCH_SESSION_PREFIX` `lvw_`, `isWorkbenchSessionFormat`     | The third bearer kind                                                    |
| `WorkbenchScope = 'document' \| 'workspace'`, `WORKBENCH_SCOPES`  | The scope of a ticket, session and pairing                               |
| `workspaceFramePath(place)`, `workspacePlaceOf(pathname, search)` | The workspace frame's addresses, both ways                               |
| `assignAppLocation(href)`, `setAppNavigationInterceptor(fn)`      | The app's one way to leave a page, which a workspace frame takes over    |
| `WORKBENCH_ENDED_CLOSE` 4006                                      | The room's close code for a session whose pairing or token ended         |
| `selectionReference(input)`                                       | The selection reference text, in `@livediagram/document-views`           |
| `EditorSurface = 'app' \| 'embed' \| 'workbench'`                 | The editor's surface                                                     |

## Scope, by file

| File                                                                                                                                                                     | Role                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/workbench.ts` (+ test)                                                                                                                          | Constants; the wire types of the platform's routes; `parseWorkbenchOrigin`; `isWorkbenchSessionFormat`; `WorkbenchRole`, `capWorkbenchRole`; `WORKBENCH_ERROR_CODES`; `pairingCoversScope`; `workbenchAmbientHeaders`; `workbenchRouteVerdict` over `WORKBENCH_ROUTES` and `WORKSPACE_ROUTES` |
| `packages/api-schema/src/workbench-messages.ts` (+ test)                                                                                                                 | The message types, `WORKBENCH_MESSAGE_TYPES`, `parseWorkbenchMessage`                                                                                                                                                                                                                         |
| `packages/api-schema/src/room-messages.ts`                                                                                                                               | `WORKBENCH_ENDED_CLOSE = 4006`                                                                                                                                                                                                                                                                |
| `apps/api/src/auth/workbench-session.ts` (+ test)                                                                                                                        | `resolveWorkbenchSession`: asks liveworkspace about a secret (`createWorkbenchSessionChecker`, cached per isolate); `noteWorkbenchRoom`: tells liveworkspace a workspace session joined a room                                                                                                |
| `apps/api/src/auth/workbench-confinement.ts` (+ test)                                                                                                                    | `workbenchRefusal(workbench, method, segments, headers)`: the choke point's verdict to a `Response`                                                                                                                                                                                           |
| `apps/api/src/routes/context.ts`                                                                                                                                         | `RouteContext.workbench`; `WorkbenchContext`                                                                                                                                                                                                                                                  |
| `apps/api/src/index.ts` (+ `index.workbench-workspace.test.ts`)                                                                                                          | `/api/workbench/*` forwarded; `lvw_` resolution after the access token and `lwt_`; confinement; the write key                                                                                                                                                                                 |
| `apps/api/src/routes/document-room-routes.ts`                                                                                                                            | Room ticket under a session: the owner's person tag, the level capped at the session's, the pairing sealed in; a workspace session's room noted; the upgrade forwards `X-Verified-Workbench-Pairing`                                                                                          |
| `../packages/index-app/src/room-ticket.ts`                                                                                                                               | The ticket's workbench seal: `{ pairing, cap }`                                                                                                                                                                                                                                               |
| `apps/api/src/document-room/document-room.ts`                                                                                                                            | Attachment `workbenchPairing` from the header; `/close-sessions` closes a `workbench` match with 4006                                                                                                                                                                                         |
| `../packages/api-kit/src/room-access.ts`                                                                                                                                 | `AccessCloseMatch` `{ match: 'workbench'; pairingId }`; parse and match                                                                                                                                                                                                                       |
| `apps/api/src/routes/images.ts`                                                                                                                                          | Under a document-scope session, `GET /api/images/:id` takes the document path only, with `d` the session's document                                                                                                                                                                           |
| `apps/api/src/openapi/manifest.ts`                                                                                                                                       | The forwarded routes under segment `workbench`, tag `Workbench`                                                                                                                                                                                                                               |
| `packages/document-views/src/selection-reference.ts` (+ test)                                                                                                            | `selectionReference(input)`                                                                                                                                                                                                                                                                   |
| `apps/editor/app/embed/workbench/page.tsx`                                                                                                                               | The static route; metadata title `Workbench \| livediagram`, `robots: { index: false }`; renders `WorkbenchPage`                                                                                                                                                                              |
| `apps/editor/app/embed/workbench/explorer/page.tsx`                                                                                                                      | The static workspace frame page; renders `WorkbenchPage`                                                                                                                                                                                                                                      |
| `apps/editor/app/embed/workbench/WorkbenchPage.tsx` (+ test)                                                                                                             | Runs the page machine; renders a status or, once bound, `WorkbenchAuthBridge` around the editor or the workspace frame                                                                                                                                                                        |
| `apps/editor/app/embed/workbench/workbench-machine.ts` (+ test)                                                                                                          | The page's states and transitions, pure (`workbenchTransition`, `sessionFitsAddress`, `renewalFits`)                                                                                                                                                                                          |
| `apps/editor/app/embed/workbench/workbench-fragment.ts` (+ test)                                                                                                         | `takeTicketFromAddress(location, history)`: reads `#ticket=`, clears the fragment, gives the address's scope                                                                                                                                                                                  |
| `apps/editor/app/embed/workbench/useWorkbenchHandshake.ts` (+ test)                                                                                                      | Redeem, address check, hello, ack wait, end on failure                                                                                                                                                                                                                                        |
| `apps/editor/app/embed/workbench/useWorkbenchRenewal.ts` (+ test)                                                                                                        | Renew timing, ticket redemption, provider swap, old session ended                                                                                                                                                                                                                             |
| `apps/editor/app/embed/workbench/WorkbenchStatus.tsx`                                                                                                                    | The status screens and their copy, per scope                                                                                                                                                                                                                                                  |
| `apps/editor/app/embed/workbench/WorkspaceFrame.tsx` (+ test)                                                                                                            | The mounted workspace frame: the place from the address, the Explorer or the editor, Back, `place`, `open`                                                                                                                                                                                    |
| `apps/editor/app/embed/workbench/ExplorerHost.tsx`                                                                                                                       | The shared Explorer (`@liveworkspace/explorer`) for the person in the frame, with livediagram's hosts                                                                                                                                                                                         |
| `apps/editor/app/embed/workbench/useWorkspaceNavigation.ts` (+ test)                                                                                                     | The interceptor, the link capture, New document in place, `livediagram:open`                                                                                                                                                                                                                  |
| `apps/editor/app/embed/workbench/create-in-place.ts` (+ test)                                                                                                            | `createDocumentInPlace`: a new document in the place's folder or team                                                                                                                                                                                                                         |
| `apps/editor/app/embed/workbench/useWorkspacePlaceMessages.ts` (+ test)                                                                                                  | `ready` (workspace) once and `place` on every move                                                                                                                                                                                                                                            |
| `apps/editor/lib/workbench/workbench-port.ts` (+ test)                                                                                                                   | `createWorkbenchPort(origin, win)`: send to the bound origin, accept from it, unknown types logged once                                                                                                                                                                                       |
| `apps/editor/lib/workbench/workspace-place.ts` (+ test)                                                                                                                  | `WorkspacePlace`, `workspacePlaceOf`, `workspaceFramePath`, `framePathOfAppHref`, `appHrefOfPlace`                                                                                                                                                                                            |
| `apps/editor/lib/workbench/workbench-frame-path.ts` (+ test)                                                                                                             | `WORKSPACE_FRAME_PAGE`, `isWorkspaceFramePath`: the rewrite the editor worker and the e2e stack share                                                                                                                                                                                         |
| `../packages/workbench/src/lib/app-location.ts`                                                                                                                          | `assignAppLocation`, `setAppNavigationInterceptor`                                                                                                                                                                                                                                            |
| `../packages/workbench/src/hooks/navigation/useAppNavigation.ts`                                                                                                         | `push` and `replace` ask the interceptor first                                                                                                                                                                                                                                                |
| `apps/editor/lib/api/workbench.ts` (+ test)                                                                                                                              | `apiRedeemWorkbenchTicket`, `apiEndWorkbenchSession`, `apiListWorkbenchPairings`, `apiUnpairWorkbench`                                                                                                                                                                                        |
| `apps/editor/lib/api/core.ts`, `workbench-confinement.ts` (+ test)                                                                                                       | `setWorkbenchConfinement(session \| null)`; `apiFetch` refuses locally what `workbenchRouteVerdict` refuses, throwing `WorkbenchConfinedError`                                                                                                                                                |
| `apps/editor/lib/api/images.ts`                                                                                                                                          | `fetchImage` sets `d` to the session's document under confinement                                                                                                                                                                                                                             |
| `apps/editor/lib/api/room.ts`                                                                                                                                            | `RoomHandlers.onWorkbenchEnded` on close 4006; the connector stops                                                                                                                                                                                                                            |
| `apps/editor/lib/user-preferences.ts`                                                                                                                                    | `writeUserPreferences` skips `apiPutPreferences` under confinement                                                                                                                                                                                                                            |
| `apps/editor/components/providers/workbench-session-context.ts`                                                                                                          | `WorkbenchSession` (`scope`, `shareCode`, `frame`), `WorkbenchSessionContext`, `useWorkbenchSession()`                                                                                                                                                                                        |
| `apps/editor/components/providers/WorkbenchAuthBridge.tsx` (+ test)                                                                                                      | A nested `DeferredAuthContext.Provider` with the session's identity; registers the `lvw_` token provider in a layout effect                                                                                                                                                                   |
| `../packages/workbench/src/components/providers/deferred-auth.tsx`                                                                                                       | `DEFERRED_AUTH_PENDING` (`authLoaded: false`, signed out)                                                                                                                                                                                                                                     |
| `apps/editor/components/providers/AuthProvider.tsx`                                                                                                                      | `WORKBENCH_ROUTE = '/embed/workbench'`: the accounts and E2E bridges stand down there                                                                                                                                                                                                         |
| `apps/editor/hooks/persistence/useAccountBootstrap.ts`                                                                                                                   | Reads `useWorkbenchSession()` first; under a session the session's person, settled at once                                                                                                                                                                                                    |
| `apps/editor/app/document/[id]/editor-surface.ts` (+ test)                                                                                                               | `EditorSurface`, `surfaceFlags(surface)`: `embedMode`, `workbenchMode`, `appChrome`                                                                                                                                                                                                           |
| `apps/editor/app/document/[id]/editor-page.tsx`                                                                                                                          | `surface`; `Session·Opened·Workbench`; status branches for the workbench                                                                                                                                                                                                                      |
| `apps/editor/app/document/[id]/useEditorState.ts`                                                                                                                        | Every gate in the Surface table; `useWorkbenchMessages`, `useTabRevisions`                                                                                                                                                                                                                    |
| `apps/editor/app/document/[id]/useIdentityBootstrap.ts`, `workbench-bootstrap.ts`                                                                                        | `loadWorkbenchDocument`: the workbench branch of the load                                                                                                                                                                                                                                     |
| `apps/editor/app/document/[id]/useWorkbenchEnd.ts` (+ test)                                                                                                              | The editor finding its document trashed ends the page (`end('trashed')`)                                                                                                                                                                                                                      |
| `apps/editor/app/document/[id]/useRoomConnection.ts` (+ `useRoomConnection.workbench.test.tsx`)                                                                          | Close 4006 ends the session; 4005 under a session reads as revoked (WB31)                                                                                                                                                                                                                     |
| `apps/editor/app/document/[id]/useTabRevisions.ts` (+ test)                                                                                                              | The last known `rev` per tab: loads, saves, changesets                                                                                                                                                                                                                                        |
| `apps/editor/app/document/[id]/useWorkbenchMessages.ts` (+ test)                                                                                                         | `ready` (or `place`), `tab`, `selection` (settled), `reveal`, `theme`                                                                                                                                                                                                                         |
| `apps/editor/components/chrome/WorkbenchChrome.tsx` (+ test)                                                                                                             | `WorkbenchOpenLink`, `WorkbenchReconnectLine`, `WorkbenchBackButton`                                                                                                                                                                                                                          |
| `apps/editor/components/chrome/TabBar.tsx`, `ChromeControls.tsx` (+ `TabBar.workbench.test.tsx`)                                                                         | `workbenchLink` at the bar's right end; no Appearance control in a workbench                                                                                                                                                                                                                  |
| `apps/editor/components/chrome/ToolbarMenuCard.tsx`                                                                                                                      | The top-left card Back shares with the Explorer menu button                                                                                                                                                                                                                                   |
| `apps/editor/components/canvas/CanvasChrome.tsx`, `Canvas.types.ts`, `EditorCanvasHost.tsx`, `useCanvasChromePanels.tsx`                                                 | `explorerHidden`; `workbenchBack`: Back in the menu button's place, first of the controls                                                                                                                                                                                                     |
| `apps/editor/components/dialogs/settings/settings-catalogue.ts`                                                                                                          | `visibleCategories(aiCapable, { workbench })`: the workbench hides `documents`, `account`, `tokens` and the Appearance choice                                                                                                                                                                 |
| `apps/editor/lib/editor-commands.ts`                                                                                                                                     | No share, delete, move, take offline or copy commands in a workbench                                                                                                                                                                                                                          |
| `apps/editor/components/panels/ImagePicker.tsx`, `apps/editor/hooks/canvas/useEditorImages.ts` (+ tests)                                                                 | `uploadOnly`, `galleryHidden`: no gallery or recent-images read                                                                                                                                                                                                                               |
| `../packages/ui/src/appearance/appearance-store.ts` (+ test)                                                                                                             | `setAppearanceOverride(appearance \| null)`: wins over the setting, never stored                                                                                                                                                                                                              |
| `apps/editor/components/dialogs/settings/SettingsTokenPairings.tsx`, `SettingsTokensRow.tsx`                                                                             | The paired workbenches under the API Tokens row, with **Unpair**                                                                                                                                                                                                                              |
| `apps/editor/hooks/persistence/useWorkbenchPairings.ts` (+ test)                                                                                                         | List, group by token, unpair (the platform's routes)                                                                                                                                                                                                                                          |
| `apps/editor/src/worker.ts` (+ test)                                                                                                                                     | `/embed/workbench/**` frameable; the workspace frame paths served by its page                                                                                                                                                                                                                 |
| `packages/agent-verbs/src/verbs/workbench.ts` (+ test), `catalogue.ts`                                                                                                   | `workbench.open`, `workbench.pair` (local); resource `workbench`; `workbenchOriginOf`, `workbenchNameOf`                                                                                                                                                                                      |
| `apps/cli/src/commands/workbench-pair.ts` (+ test), `workbench-open.test.ts`                                                                                             | `pairWorkbench(io, api, input, json, log)`: request, print, open, wait                                                                                                                                                                                                                        |
| `apps/cli/src/main.ts`, `io.ts`, `output/failure-of.ts`                                                                                                                  | Dispatch of `workbench.pair`; `CliIo.stdoutIsTTY`; `isNetworkFailure`                                                                                                                                                                                                                         |
| `packages/agent-verbs/src/guides/index.ts`, `src/skill.ts`                                                                                                               | Topic `workbench`; the skill's `[livediagram]` line                                                                                                                                                                                                                                           |
| `apps/editor/e2e/workbench-embed.spec.ts`, `workbench-workspace.spec.ts`, `workbench-support.ts`, `fixtures/fake-workbench.html`, `signed-in/workbench-contrast.spec.ts` | End to end, project `workbench` (dark), opt-in `E2E_WORKBENCH=1`; the contrast audit                                                                                                                                                                                                          |
| `apps/help/app/developers/workbenches/**`                                                                                                                                | The workbench help articles                                                                                                                                                                                                                                                                   |

## Domain and naming

| Term                | Identifier                                                      | Meaning                                                                           |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Workbench           | the frame's parent, known by its origin                         | A developer tool that frames the editor beside an agent                           |
| Workbench name      | `name` (pairing, request), `hello-ack.name`                     | The tool's display name ("Acme Editor"), shown in copy, never enforced            |
| Origin              | `parseWorkbenchOrigin`                                          | `scheme://host[:port]`, the enforced identity of a workbench                      |
| Pairing             | `WorkbenchPairing`                                              | A token and an origin its owner approved (liveworkspace's)                        |
| Unpair              | `apiUnpairWorkbench`                                            | Removing a pairing and ending its sessions                                        |
| Workbench ticket    | `#ticket=` in the frame URL                                     | Single-use, one-minute credential that opens one session (liveworkspace mints it) |
| Workbench session   | `lvw_` secret; `WorkbenchContext`                               | The frame acting as the person                                                    |
| Session level       | `WorkbenchRole` (`role` on the wire)                            | The token's level on the document, never above the person's own access            |
| Confinement         | `workbenchRouteVerdict`, `403 workbench_confined`               | What a session may reach                                                          |
| Workbench page      | `/embed/workbench`, `WorkbenchPage`, `WorkbenchPhase`           | The frameable page that binds and hosts the editor                                |
| Binding             | `hello` / `hello-ack`                                           | Proof that the parent is the minting origin                                       |
| Renewal             | `livediagram:renew` / `livediagram:ticket`                      | A fresh ticket redeemed before the session expires                                |
| Workbench message   | `type` `livediagram:*`, `v: 1`                                  | One `postMessage` between the page and its workbench                              |
| Selection reference | `selectionReference()`, `{ text, count }`                       | The text a workbench attaches to the person's message                             |
| Editor surface      | `EditorSurface` `'app' \| 'embed' \| 'workbench'`               | Where the editor runs; `workbench` is a distinct surface                          |
| Ended               | `WorkbenchEndReason` `expired`, `revoked`, `trashed`, `refused` | Why a page stopped editing                                                        |
| Scope               | `WorkbenchScope` `document`, `workspace`                        | What a ticket, session or pairing reaches: one document, or the workspace         |
| Workspace frame     | `/embed/workbench/explorer[...]`, `WorkspaceFrame`              | The Explorer inside a workbench, under a workspace session                        |
| Place               | `WorkspacePlace`, `livediagram:place`                           | Where a workspace frame is: an Explorer view, or a document                       |
| Frame address       | `workspaceFramePath(place)`                                     | A place's path inside the frame, walked by the frame's own history                |

Banned: "workspace" for a document-scope frame, and "scope" for anything but `WorkbenchScope` here (the end of
access names its `target`, a share link its `tabScope`); "integration", "host app" or "client" for a workbench; "link" or "connect" for pairing (a repository link
is another thing); "token" for a workbench session or a ticket (`lwt_` is the token); "share", "embed code" or
"share code" for a ticket; "iframe mode" for the surface; "authorise" for approve (the page's verbs are Allow and
Don't allow).

## Behaviour and state

### Invariants

- **I1** A document-scope session never reaches a document other than its own: such a request answers 404, decided
  at the choke point before any route runs.
- **I2** A session never reaches a route outside its scope's allow-list: `403 workbench_confined`.
- **I3** A session's level never exceeds its token's, and every gate re-evaluates the owner's access now (the gates
  run with the owner's identity on every request).
- **I4** `ctx.accountUserId` is null and `ctx.token` is null under a session; `resolveOwner()` and `verifiedUserId`
  are the owner. So administration (`accountUserId` only) is unreachable and `405 use_changesets` never fires.
- **I5** Logs carry the session id's first 8 characters (`sessionPrefixOf`), never a secret.
- **I8** The workbench page mounts no editor and sends no `livediagram:*` message other than `hello` (and `ended`
  `refused`, to the session's origin) before a valid `hello-ack`.
- **I9** The editor in a workbench never runs the guest handoff, never writes the participant record, and never
  writes preferences to the api.

### A request bearing `lvw_` (the choke point, `index.ts`)

Resolved only when neither an account access token nor an API token did:

1. A bearer starting `lvw_` that fails `isWorkbenchSessionFormat` is refused as `malformed`. One that passes goes to
   `resolveWorkbenchSession(env, bearer)`, which asks liveworkspace with the api's client credentials
   (`createWorkbenchSessionChecker` from `@liveworkspace/auth-client`), keeping the answer per isolate: a live
   session for up to a minute, never past its expiry; a refused one ten seconds. Refused (`unknown`, `revoked`,
   `expired`, `malformed`): log `[workbench] bearer-refused { reason, sessionPrefix }`, answer `401 invalid_session`
   with `WWW-Authenticate: Bearer error="invalid_token"`. liveworkspace unreachable (`AccountsUnavailable`):
   `503 accounts_unavailable`, `Retry-After: 5`, so a good session is never called bad.
2. `ctx.workbench = { sessionId, ownerId, tokenId, pairingId, scope, documentId, folderId, tabId, origin, level,
expiresAt, teams }` (an item session names its document; a workspace session its folder or none);
   `accountUserId` null; the caller's id, `verifiedUserId` and the teams claim are the owner's; `ctx.token` null.
3. `workbenchRefusal`: a header of `workbenchAmbientHeaders(scope)` beside `lvw_` (the document scope:
   `X-Share-Code`, `X-Owner-Id`, `X-Share-Password`): `403 workbench_confined` (WB8).
4. `workbenchRouteVerdict(method, segments, ctx.workbench)`: `'allow'`, `'other-document'` → 404 `not_found`,
   `'confined'` → `403 workbench_confined`, logged `[workbench] confined { scope, method, route, sessionPrefix }` with
   `route` from `apiRouteLabel`.
5. Level: a `view` session's `POST`, `PUT`, `DELETE` or `PATCH` is refused `403 workbench_read_only`, except
   `POST /api/documents/:doc/room-ticket` and `DELETE /api/workbench/sessions/current` (WB9), and so is the
   share-link list `GET /api/documents/:doc/share` (WB54), logged `[workbench] read-only-refused`.
6. Rate limits: writes key `workbench:<sessionId>` on the write limiter (WB10); reads are unmetered, as a signed-in
   editor's are.

`WORKBENCH_ROUTES` (`:doc` is the session's document; a document route naming any other id is `other-document`; `:p`
any one segment but `usage`, `invites`, `invite-link`, `invite-decline`):

| Method           | Path under `/api`                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------- |
| GET              | `capabilities`, `openapi.json`, `templates`, `templates/:p`, `icons`, `schema`, `schema/:p` |
| GET              | `participants/:owner` (the session's owner only), `preferences`, `shape-libraries`          |
| POST             | `images`                                                                                    |
| GET              | `images/:p` (the route then requires `?d=:doc`)                                             |
| GET, PUT         | `documents/:doc`                                                                            |
| GET, PUT, DELETE | `documents/:doc/tabs/:p`                                                                    |
| PUT              | `documents/:doc/tabs/:p/name`                                                               |
| POST             | `documents/:doc/tabs/:p/changesets`, `documents/:doc/changesets/:p/revert`                  |
| GET              | `documents/:doc/changesets`, `documents/:doc/changesets/:p`, `documents/:doc/comments`      |
| GET              | `documents/:doc/tabs/:p/render.svg`                                                         |
| POST             | `documents/:doc/tabs/:p/comments`, `.../comments/:p/reply`, `.../resolve`, `.../reopen`     |
| DELETE           | `documents/:doc/tabs/:p/comments/:p`                                                        |
| POST             | `documents/:doc/tabs/:p/qa`, `documents/:doc/room-ticket`                                   |
| DELETE           | `workbench/sessions/current`                                                                |

Everything else is `confined`, among it: `documents/:doc` `DELETE`, `copy`, `shared-tabs`, `share*`, `community`,
`tabs/:p/presence` (an agent's door), `tokens`, `account`, `ai`, `oauth`, every write to `preferences`,
`participants` and `shape-libraries`, `images/:id` `DELETE`, `images/usage`, `GET images`, and every `workbench/*`
route but the one above. `/ws` carries no bearer and is decided by its ticket. `events`, `unfurl` and `share/:code`
are called without credentials by the editor and never see `lvw_`.

### Route effects under a session

- `document-room-routes.ts` mint: the room ticket carries the owner's person tag, the level
  `capWorkbenchRole(grant.level, workbench.level)` and the seal `{ pairing: pairingId, cap: level }`. The upgrade
  sets `X-Verified-Workbench-Pairing` on every path (empty when none), as every other trust header.
- `images.ts` `GET /api/images/:id`: under a document-scope session the owner shortcut (and the sha header shortcut)
  is skipped and `d` must equal the session's document (else 404); the document path decides as for a share visitor.
- The tab `PUT`, comments, changesets and revert see `ctx.token === null`: a person's editor. A changeset a session
  submits (only Undo's revert in practice) is a person's, never held.
- Changesets submitted by the owner's agent while the frame selects: the room's `/selections` marks the frame's
  socket `mine` through the person tag, so it never holds against the owner's agent, and the CLI's `selected`
  reads it.

### When access ends

Unpair, a token revoked and an account closed are liveworkspace's to decide
([Workbenches](../../../../../liveworkspace/docs/workbench.md) "Ending access"). Its answer reaches livediagram two
ways: the next `lvw_` request resolves `revoked` (401 `invalid_session`, within the checker's minute), and the room's
`/close-sessions` with `{ match: 'workbench', pairingId }` closes every socket whose attachment `workbenchPairing`
equals the id with `WORKBENCH_ENDED_CLOSE`, reason `workbench-ended`. The page's own
`DELETE /api/workbench/sessions/current` ends its session and closes nothing (renewal keeps the socket, WB11).

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
   ticket shape (`WORKBENCH_TICKET_PATTERN`), or none: `refused('no-ticket')`.
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
person.name, lastName: null, fullName: person.name, username: null, email: null, createdAt: null },
getToken: async () => currentSecret, signOut: noop, deleteAccount: null }` and registers
`registerTokenProvider(() => currentSecret)` in a layout effect, before the editor's first fetch.

`AuthProvider` on `pathname.startsWith('/embed/workbench')` renders neither bridge and holds
`DEFERRED_AUTH_PENDING`, so nothing above the page ever reads as a settled guest, sign-in configured or not.

`useAccountBootstrap` reads `useWorkbenchSession()` first. With a session: no guest handoff, no timeout, no provider
registration; it returns the session's person as a settled account (`workbenchResult`).

`useIdentityBootstrap`, when `workbenchMode`, runs `loadWorkbenchDocument` (`workbench-bootstrap.ts`):

- The id is the session's `documentId`; the address is not read.
- `self` from `apiLoadSelf(person.id)`, else `{ id, name: person.name ?? randomName(), color: person.color ??
randomColor() }`; the participant record is never written (I9).
- With no share code, the owner's load (`apiLoadDocument`, level `edit`); with one (a workspace frame opening a
  document shared with the person, WB53), the link's load (`apiLoadShared`), its password gate asking when the link
  has one and its code riding every later request. A document whose id differs from the session's reads as not
  found.
- `setSessionRole(capWorkbenchRole(role, level))`: never above the token, never above the person's own access. The
  identity screen never opens; no share-link prefetch, no document list, no open record.
- A tab-scoped link opens its tab; else the session's `tabId`, when it names a tab of the document, opens first.

The Surface table, every gate `workbenchMode` touches (`appChrome` is `surface === 'app'`):

| Gate                                                                         | File                                  | In a workbench                                            |
| ---------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `EditorHeader` (and with it the account menu, Share, Make a copy, role pill) | `EditorView.tsx`                      | Not rendered                                              |
| `CommunityBar`, Community badge request                                      | `EditorView.tsx`                      | Not rendered, not requested                               |
| TabBar, palette, toolbars, Quick style, panels, search                       | `EditorView.tsx`                      | Rendered as in the app                                    |
| `EmbedChrome`                                                                | `EditorView.tsx`                      | Not rendered; `WorkbenchChrome` instead                   |
| Explorer (popover)                                                           | `useCanvasChromePanels.tsx`           | Not rendered; status screens use `EmbedShell`             |
| Photo-import note reading on the server                                      | `useCapabilities` consumer            | `aiEnabled` read as false                                 |
| Sign-in banner, theme-mode banner, power-user offer                          | `EditorView.tsx`, `usePowerUserOffer` | Off                                                       |
| Settings categories `documents`, `account`, `tokens`; the Appearance choice  | `settings-catalogue.ts`               | Hidden                                                    |
| Share, delete, move, take offline, copy commands                             | `editor-commands.ts`                  | Absent                                                    |
| TabBar "copy to another document"                                            | `EditorView.tsx` `otherDocuments`     | `[]`                                                      |
| Image picker gallery                                                         | `ImagePicker.tsx`, `useEditorImages`  | Upload only; `apiListImages` never called                 |
| Shape library writes (save to My shapes)                                     | their hosts                           | Absent; reads stay                                        |
| `useTokenTeams`, `useDocumentList`                                           | `useEditorState.ts`                   | Off: no teams, no document list                           |
| `useCommentMentions`, `useAssigneeOptions`                                   | `hooks/collab`                        | Candidates from presence only; no team read, no notify    |
| Identity screen                                                              | `useEditorState.ts` `joinScreenOpen`  | Never                                                     |
| `defaultPan`, `useModeDefaultTool` embed arguments                           | `useEditorState.ts`                   | As the app (`false`)                                      |
| Element indicators, comment badges                                           | `EditorView.tsx`                      | As the app                                                |
| `DocumentTrashedCard`                                                        | `editor-page.tsx`                     | `restorable={false}`                                      |
| `LoadErrorCard`, `NotFound`                                                  | `editor-page.tsx`                     | `embed` forms (no recovery card; create-new in a new tab) |

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

### The workspace scope

#### The choke point by scope

`ctx.workbench` carries `scope` and `folderId`; `documentId` is null in the workspace scope. `resolveOwner()`,
`verifiedUserId`, `accountUserId` (null) and `token` (null) are as in the document scope (I4), so a workspace session
is a person's editor and every route re-gates it with the owner's identity at the owner's access now.

1. **Ambient headers.** The workspace scope refuses `X-Owner-Id` only: a document shared with the person is reached
   by its link, as the Explorer opens it, so the link's code and password travel with the request (WB53).
2. **The verdict.** `workbenchRouteVerdict` with `scope === 'workspace'` walks `WORKSPACE_ROUTES`, minus
   `WORKSPACE_CLOSED`; no route is `other-document` (every document is the person's to try, the route decides).
3. **Level.** As step 5 of the document scope, the share-link list included (WB54).
4. **Rate limits.** As the document scope's: writes on `workbench:<sessionId>`.

`WORKSPACE_ROUTES` (`:p` any one segment, `**` any rest, including none):

| Method                 | Path under `/api`                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET                    | `capabilities`, `openapi.json`, `templates/**`, `icons`, `schema/**`, `preferences`, `participants/:owner` (the owner only)                                 |
| GET                    | `share/**` (the person opening a link shared with them)                                                                                                     |
| GET, POST, PUT, DELETE | `documents/**` but `documents/:p/community/**` and `documents/:p/tabs/:p/presence` (`WORKSPACE_CLOSED`)                                                     |
| GET, POST, PUT, DELETE | `folders/**`, `shared/**`, `favourites/**`, `home/**`, `timeline/**`, `activity/**`, `trash/**`, `placement-defaults/**`, `images/**`, `shape-libraries/**` |
| GET                    | `teams`, `teams/:p`, `teams/:p/library`, `teams/:p/members`                                                                                                 |
| DELETE                 | `workbench/sessions/current`                                                                                                                                |

The Explorer's lists are the index's, which the frame reaches through `/api/index` with the person's identity
([one-explorer.md](../../../../../liveworkspace/docs/one-explorer.md)); the folder, team and trash shapes above stay
on the list so an older caller is confined the same way. Everything else is `confined`, among it (never the account):
`account`, `tokens/**`, `workbench/**` but the one above, every write to `participants` and `preferences`, `ai/**`,
`oauth/**`, team writes and invitations, `community/**` and `documents/:p/community/**` (Community publishing needs a
signed-in session, so the token cannot, WB51), `documents/:p/tabs/:p/presence` (an agent's door), `forms/**` and
`telemetry/**`.

#### Route effects under a workspace session

- `document-room-routes.ts` mint: as the document scope, and `noteWorkbenchRoom(env, workbench, documentId)` tells
  liveworkspace the session joined that room (once per session and document per isolate, best effort, off the
  response's path), so ending the session's access closes it too (WB55).
- `images.ts` `GET /api/images/:id`: the document scope's rule holds for the document scope only; a workspace session
  reads as its person.

#### The workspace frame (`/embed/workbench/explorer...`)

**Addresses** (`apps/editor/lib/workbench/workspace-place.ts`, WB56). `WorkspacePlace` is
`{ kind: 'explorer'; node: ExplorerView }` or `{ kind: 'document'; documentId; tabId: string | null; shareCode:
string | null }`. `workspaceFramePath(place)`:

| Place           | Frame path                                                    |
| --------------- | ------------------------------------------------------------- |
| `home`          | `/embed/workbench/explorer`                                   |
| `folder` `<id>` | `/embed/workbench/explorer/folder/<id>`                       |
| any other view  | `/embed/workbench` + the view's `explorerPath` path and query |
| a document      | `/embed/workbench/document/<id>[?s=<code>][&tab=<tabId>]`     |

`workspacePlaceOf(pathname, search)` is its inverse; an address it cannot read is `home`; `explorerRouteOfFrame` gives the Explorer the `/explorer` route a frame path stands for, so nothing inside it learns where it runs. One static page,
`app/embed/workbench/explorer/page.tsx`, backs every frame path: the editor worker (`isWorkspaceFramePath`) and the e2e
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
   document in place (below); any other app href (help, sign-in, Community, an external page) opens in a new tab
   with `noopener` (WB57). Logged `[workbench] open { kind }` only for `livediagram:open`.
3. The place (`workspacePlaceOf(usePathname(), useSearchParams())`) renders:
   - an Explorer view: `ExplorerHost`, the shared `Explorer` for the person (below); unmounted while a document is
     open, so the editor's shortcuts and panels are the only ones listening, and read again on Back;
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
`template=<kind>` builds that template's tabs as `/new` does, anything
else (`blank`, `start`, `mode`, `q`, none) a blank document of the default mode; `apiCreateDocument` with the
template's untitled name and `creationIntentOf`; then the document place, pushed. A refused create shows the
Explorer's toast "Couldn’t create the canvas. Try again." and stays; logged `[workbench] create-failed { status }`.

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

**Open in livediagram**: on a document, the existing link with the place's app href (`/document/<id>[?s=]`); on an
Explorer view, the same control in the frame's header, linking to the view's `/explorer` address.

**`trashed`** in the workspace scope: the session the frame lends the editor turns `useWorkbenchEnd`'s
`end('trashed')` into Back (the page never ends), with the toast "That canvas is in the Trash." (WB60).

#### The Explorer in a workbench

`ExplorerHost` renders the shared `Explorer` (`@liveworkspace/explorer`) with `app="livediagram"`, the index client,
and the hosts livediagram lends it everywhere: addresses (`itemHref`, `newDocumentHref`, `explorerHelpHref`), Share
(`explorerShareHost`), Inbox, the Library (Image Gallery, Shape Libraries, Import from), thumbnails, the template
families for the lens, default folder options, and the telemetry callbacks (`trackOrganise` and the Timeline, Home
and lens reports). It passes no team administration host, so no team is made, joined or administered in the frame
(WB62), and no Settings: the app's surroundings (brand, product nav, account controls, Settings, Appearance) are not
rendered, the lens field sits in a slim bar of its own (WB61). Its `onNavigate`, `onCreate` and `onOpenItem` go
through `useAppNavigation`, so every move lands on the frame's interceptor. It waits for the person (the session's)
before asking the index anything ("Opening your Explorer…").

#### The CLI, workspace scope

- `workbench open --workspace [--folder <f>] --origin <origin> [--json]`: `<doc>` and `--workspace` exclude each
  other, one is required (exit 2 "name a document, or --workspace"); `--tab` with `--workspace` exits 2. `--folder`
  without `--workspace` exits 2. `<f>` resolves as `link init --folder` does (`resolveFolder` over `folderChoices`,
  moved to `@livediagram/agent-verbs` so `link init`, `folder` and `workbench` share it): its full id, an id prefix
  or its name ignoring case; none 3, several 3 with the candidates. `POST /api/workbench/tickets { scope:
'workspace', folderId?, origin }`. 201: text `url`; `--json` `{ url, scope, folderId, expiresAt }`. 428: exit 4,
  fix `livediagram workbench pair --origin <origin> --workspace`. 404: exit 3.
- `workbench pair --origin <origin> [--name <name>] [--workspace]`: the request carries `scope: 'workspace'`; the
  printed results add ` (whole workspace)` in text and `scope` in `--json`; the expired fix carries `--workspace`.

#### Workspace messages

- `ready` (workspace) once, when the Explorer first mounts: `{ scope: 'workspace', role }` (`role` the session's).
- `place` (`useWorkspacePlaceMessages`) after every move and whenever a field of the current place changes, only
  when it differs from the last sent (WB63): Explorer views from the frame's address (`view` = the Explorer view's
  kind; `folderId` for a folder, or a team's page at a folder) and, for a folder, what the shared Explorer tells once
  its list is in (`onFolderShown`: `folderName`, and `documentCount` = the canvases directly in it, counted from the
  pages read), the three null on every other view. A frame started on a team's folder is moved onto its team's page
  at that folder, in place, by the shared Explorer (WB52); a document from the editor (`view: 'document'`, `documentId`, `documentName`, `tabId`,
  `tabName`, `role` the editor's `sessionRole`, the folder fields null). Logged `[workbench] place { view }`.
- The editor in a workspace frame sends `place` where the document scope sends `ready`, and `tab`, `selection` and
  `reveal` as in the document scope; on an Explorer view they do nothing.
- `open` (`livediagram:open`, accepted while mounted): `{ view: 'home' }` → Home, `{ folderId }` → that folder,
  `{ documentId, tabId? }` → that document (from the current place). Pushed like any move; an unreachable id shows
  the Explorer's or the editor's own not-found. Logged `[workbench] open { kind: 'home' | 'folder' | 'document' }`.

## Interfaces and contracts

### The platform's routes

`POST /api/workbench/tickets`, `POST /api/workbench/sessions`, `DELETE /api/workbench/sessions/current`,
`/api/workbench/pairing-requests*` and `/api/workbench/pairings*` are liveworkspace's; their behaviour, rejections
and limits are in [Workbenches](../../../../../liveworkspace/docs/workbench.md). livediagram calls four of them: the
page redeems (`apiRedeemWorkbenchTicket`, credential-free) and ends its own session (`apiEndWorkbenchSession`);
Settings lists pairings and unpairs (`apiListWorkbenchPairings`, `apiUnpairWorkbench`). The CLI mints and pairs. The
OpenAPI manifest lists them under segment `workbench`, tag `Workbench`, as the routes a token reaches through this
api. Any `lvw_` request to this api's own routes (the choke point): 401 `invalid_session`, 403
`workbench_confined`, 403 `workbench_read_only`, 404 `not_found` (another document), 503 `accounts_unavailable`.
`WORKBENCH_ERROR_CODES` in `packages/api-schema/src/workbench.ts` names every token (WB26).

### Wire types (`packages/api-schema/src/workbench.ts`)

```ts
export type WorkbenchRole = AccessLevel; // 'view' | 'participate' | 'edit'
export type WorkbenchTicketRequest =
  | { scope?: 'document'; documentId: string; tabId?: string; origin: string }
  | { scope: 'workspace'; folderId?: string; origin: string };
export type WorkbenchTicketResponse = {
  url: string;
  documentId: string;
  tabId: string | null;
  expiresAt: number;
};
export type WorkbenchWorkspaceTicketResponse = {
  url: string;
  scope: 'workspace';
  folderId: string | null;
  expiresAt: number;
};
export type WorkbenchPairingRequired = {
  error: 'pairing_required';
  pairingUrl: string;
  expiresAt: number;
};
export type WorkbenchSessionRequest = { ticket: string };
export type WorkbenchPerson = { id: string; name: string | null; color: string | null };
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
export type InvalidTicket = { error: 'invalid_ticket'; reason: 'expired' | 'used' | 'unknown' };
export type WorkbenchPairing = {
  id: string;
  tokenId: string;
  origin: string;
  name: string | null;
  scope: WorkbenchScope;
  pairedAt: number;
};
export type WorkbenchPairingsResponse = { pairings: WorkbenchPairing[] };
export type WorkbenchPairingRequestCreate = {
  origin: string;
  name?: string;
  scope?: WorkbenchScope;
};
export type PairingRequestStatus = 'pending' | 'approved' | 'declined' | 'expired';
export type WorkbenchPairingRequestCreated =
  | { status: 'paired'; pairing: WorkbenchPairing }
  | { status: 'pending'; pairingUrl: string; code: string; expiresAt: number; interval: number };
export type WorkbenchPairingStatusResponse = {
  status: PairingRequestStatus;
  expiresAt: number;
  interval: number;
};
```

`parseWorkbenchOrigin(input)`: at most `WORKBENCH_ORIGIN_MAX_LENGTH` characters; parsed with `URL`; `protocol`
`https:`, or `http:` with `hostname` one of `localhost`, `127.0.0.1`, `[::1]`; `username`, `password`, `search`,
`hash` empty; `pathname` `/` and the input not ending in `/` (WB27); the input equal to `url.origin` (so no default
port, no upper case, no trailing dot is accepted that the browser would rewrite). `*` and `null` fail the parse.

`capWorkbenchRole(role, ceiling?)`: the lower of the two on the ladder `view < participate < edit`; no ceiling gives
`role`.

`pairingCoversScope(pairing, asked)`: `workspace` covers both scopes, `document` covers `document` only.

### Workbench messages (`packages/api-schema/src/workbench-messages.ts`)

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

The workspace scope's messages:

```ts
type WorkspaceReadyMessage = {
  type: 'livediagram:ready';
  v: 1;
  scope: 'workspace';
  role: WorkbenchRole;
};
type PlaceMessage = {
  type: 'livediagram:place';
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
  type: 'livediagram:open';
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
of each within the CLI budgets; examples `livediagram workbench open "Home screen" --origin https://127.0.0.1:5175
--json` and `livediagram workbench pair --origin https://127.0.0.1:5175 --name "Acme Editor"`.

### Room

`AccessCloseMatch` gains `{ match: 'workbench'; pairingId: string }` (UUID pattern); `sessionMatchesAccessClose`
matches `session.workbenchPairing === pairingId`. `WORKBENCH_ENDED_CLOSE = 4006`, reason `workbench-ended`.
`RoomHandlers.onWorkbenchEnded` fires on it and the connector does not reconnect.

## Data and persistence

livediagram stores nothing of a workbench. Pairings, tickets, sessions and their rooms are liveworkspace's
([Workbenches](../../../../../liveworkspace/docs/workbench.md)).

| Field                              | Class     | Notes                                                                                 |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| The checker's answers              | memory    | Per isolate: a live session up to a minute (never past expiry), a refusal ten seconds |
| Room attachment `workbenchPairing` | ephemeral | Per socket, survives hibernation                                                      |
| The page's secret, session, origin | memory    | Never in storage                                                                      |

- **Account deletion.** liveworkspace drops the person's workbench when the account closes; `deleteAccount` here does
  nothing for it (a guest has none).
- **Document purge.** Every request of a session is gated on the document's grant, which a purged document never
  gets again.
- **Snapshot and restore.** None: restoring a document from the Trash revives no session.

## Errors and edge cases

- **E1** Origin with a path, query, fragment, credentials, `*`, `null`, `http` on a non-loopback host, or a default
  port written out (`https://x:443`): exit 1 at the CLI; the platform refuses it `400 invalid_origin`.
- **E2** The owner loses access mid-session: every gate refuses (404 or 403 per route); the room closes them as a
  member's sessions (4005, person tag); the page reads 4005 under a workbench as `revoked` (WB31).
- **E3** The document is trashed mid-session: close 4004 and 410 on saves; `ended(trashed)`, the deleted card
  without Restore.
- **E4** The session ends on the platform (unpair, revoke, purge): next request 401 `invalid_session`, or close 4006;
  `ended(revoked)`.
- **E5** liveworkspace cannot answer about a session: `503 accounts_unavailable`; the editor's save retries as for any 503.
- **E6** A view token's session tries to save: 403 `workbench_read_only`; the editor is read-only from the start, so
  only a crafted request meets it.

- **E7** The frame is reloaded: the fragment is gone, `refused('no-ticket')`.
- **E8** Frame opened directly in a tab (not framed): `unbound`, session revoked.
- **E9** Framed by another origin that forwarded the URL: `hello` never reaches it (target origin), `unbound` after
  5 s, session revoked.
- **E10** The workbench answers `hello-ack` with a bad `name`: invalid, ignored, logged; the wait continues to the
  deadline.
- **E11** Renewal never answered: `ended(expired)` at `expiresAt`, read-only, "Reconnect in <name> to keep
  editing."
- **E12** A renewal ticket for another document or origin: refused, logged `renew-failed { reason: 'mismatch' }`,
  the new session deleted.
- **E13** Session expiry capped by the token's expiry: the page renews earlier by the same lead; the token's own
  expiry ends it for good.
- **E14** Unsaved edits when the session ends: the autosave's last attempt fails 401; edits stay on screen, read-only;
  the line says to reconnect. Before the renew lead the autosave runs as usual, so at most one debounce window is
  at risk.
- **E15** `reveal` with refs from another tab: not found, skipped, logged.
- **E16** A selection of more than 20 elements: 20 items and the `… and n more` tail.
- **E17** A selected element with no label (a line, a freehand stroke): ref and kind only.
- **E18** Unknown message type, or `v: 2`: ignored, `[workbench] message-ignored <type>` once per type.
- **E19** Rate limit on the mint: 429, the CLI exits 6.

- **E20** `APP_BASE_URL` unset on a deployment: the frame URLs the platform builds use the default base; the deployment spec says to set it.
- **E21** A host without sign-in: no tokens, so no mint; the page can only reach `refused('no-ticket')` or `refused('ticket')`.
- **E22** Two frames of one pairing on one document: two sessions, two sockets, one person tag; presence shows the person once per socket as for two browser tabs.
- **E23** A workspace session on `/embed/workbench?d=`, or a document session on `/embed/workbench/explorer`: `refused('mismatch')`, the session ended.
- **E24** A workspace frame reloaded on a document or folder path: the fragment is gone, `refused('no-ticket')`.
- **E25** A workspace session presenting `X-Owner-Id`: `403 workbench_confined`; `X-Share-Code`: allowed, the route decides by the link.
- **E26** The open document is trashed in the workspace frame: back to the Explorer, the session lives on.
- **E27** The started folder is deleted before the frame loads: the Explorer's folder not-found, as a stale link.
- **E28** A view workspace session tries New document: `403 workbench_read_only`, the create-failed toast.
- **E29** `livediagram:open` with an id the person cannot reach: the Explorer's or the editor's not-found; logged.
- **E30** Unpair or revoke while a workspace frame has a document open: the room closes with 4006 (the session's rooms are noted with liveworkspace), the frame ends `revoked`.

## Security and trust

- **What the page shows is what is enforced**: the origin is printed beside the name; the name is display only.
- **A ticket is a bearer**, single use, 60 s, only in the fragment; the fragment is cleared before the first request;
  `Referrer-Policy: strict-origin-when-cross-origin` and fragments never reach a `Referer` anyway.
- **A session is a bearer** in the page's memory only, confined (I1, I2), level-capped (I3), re-gated on every
  request with the owner's identity, and its end seen within a minute (the checker) or one room close.
- **Ambient headers refused** beside `lvw_` (WB8), so a session cannot borrow a share code's or a guest's access.
- **Images** under a document-scope session never take the owner shortcut, so a session cannot read the owner's
  gallery by id.
- **Clickjacking of the frame**: the editor mounts only for the minting origin (I8); a hostile parent of another
  origin gets no `hello` and an ended session.
- **Message trust**: messages accepted only from `window.parent` at the bound origin; every field validated and
  bounded; labels sent in the reference are JSON-quoted, so a label cannot forge a line.
- **Rate limits**: session writes on `workbench:<sessionId>`; the mint, pairing and redemption limits are the
  platform's.
- **No secret in logs** (I5); `[workbench]` logs carry ids, prefixes, reasons and counts.
- **Never more than the token** in the workspace scope: `accountUserId` and `token` are null, so every signed-in-only
  route (team administration, Community publishing, the account) refuses as it refuses the token, and
  `WORKSPACE_ROUTES` refuses them first with `workbench_confined`; a view session is read-only at the choke point and
  never lists share links (WB54).
- **Share links in the workspace scope** are the person's own: a code reaches only what the code reaches for anyone,
  and the guest header stays refused, so a session never acts as someone else.

## Performance and limits

- Each `lvw_` request: at most one call to liveworkspace a minute per session per isolate (the checker's cache); the
  autosave's cadence adds nothing beyond it.
- `workbenchRouteVerdict`: a walk over at most 30 patterns of at most 8 segments, constant per request.
- `selectionReference`: `buildViewModel` over the tab, O(n log n) for refs; a 5,000-element tab builds in well under
  `VIEW_SLOW_MS`; run once per settled selection, never per pointer move.
- Messages: a selection message is under 4 KiB (20 items of at most 60-character labels); a `place` message is under
  1 KiB and sent only when it changes.
- Workspace: a room ticket adds one best-effort note to liveworkspace per session and document per isolate; the
  frame's Explorer reads what `/explorer` reads, once per frame view and again on Back from a document.

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

The status screens use `EmbedShell` (no header, no Explorer). **Open in livediagram** (`WorkbenchOpenLink`): the last
control at the right end of the tab bar, after Search and Settings, styled as they are: the external-link glyph and
the words "Open in livediagram" (the glyph alone on a phone, as its neighbours), linking to `/document/<id>` with
`target="_blank" rel="noopener noreferrer"`, shown while `mounted` and `ended` (WB34). In a workbench the tab bar
offers no Appearance control (WB15). The Reconnect line is `WorkbenchReconnectLine`.

### The workspace frame

| Where                               | Copy                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `reading`, `redeeming`, `binding`   | "Opening your workspace…" (WB65)                                                                                                        |
| `refused` (any)                     | Heading "Open your workspace from your workbench", body "This link works once, for a minute. Open it again from your workbench." (WB65) |
| Back                                | The arrow-left glyph and "Back" (the glyph alone on a phone), accessible name "Back to <view title>"                                    |
| Open in livediagram (Explorer view) | As the editor's; accessible name "Open in livediagram (opens in a new tab)"                                                             |
| Create failed                       | Toast "Couldn’t create the canvas. Try again."                                                                                          |
| Trashed                             | Toast "That canvas is in the Trash."                                                                                                    |

The Explorer's own views, empty states and not-found keep their copy. The slim bar at the top holds the lens field
only, `h-12`, the header's colours.

### Settings > API tokens

The API Tokens row (whose tokens are run on liveworkspace.app) shows, under its link there, one "Paired workbenches"
list for the account (none: nothing, WB35). A row: the name (or "Unnamed workbench"), the origin in monospace, its
scope ("One canvas at a time" or "Whole workspace", WB67), "Paired <relative time>", and an **Unpair** text button.
Unpair opens a confirm popover: "Unpair <name>? Its open diagrams stop editing until you allow it again." with
**Unpair** and **Cancel** (WB36). After Unpair the row leaves the list. The pairing page itself (Allow, Don't allow)
is liveworkspace's.

## Accessibility

- Status screens: the copy in a `role="status"` region; `refused` and `unbound` headings are `h1`.
- The Reconnect line: `role="status"`, `aria-live="polite"`, visible text, never colour alone.
- **Open in livediagram**: accessible name "Open in livediagram (opens in a new tab)"; at least 24 by 24 px; the
  editor's focus ring.
- Settings rows: **Unpair** named "Unpair <name> at <origin>"; the confirm popover is the existing accessible one.
- The workspace frame: the Explorer's own semantics and focus order; Back is a native button, at least 24 by 24 px,
  first of the editor's controls in the focus order, after the canvas itself, and the Header region for F6; a move
  inside the frame moves focus to the new view's heading (the Explorer's pane heading, or the editor's canvas as on a
  load), and announces nothing more.
- Reveal outlines honour reduced motion as changeset outlines do.
- The contrast audit, `apps/editor/e2e/signed-in/workbench-contrast.spec.ts` (it needs a signed-in person, which only
  the signed-in export renders), holds the device page (code entry and consent) and the paired-workbench row, each in
  both schemes.

## Web Experience

- `/embed/workbench` LCP is the status text, painted from the static HTML; the editor chunk loads while redeem and
  binding run, so `mounted` does not wait on it. The editor replaces the status screen whole: no shift inside either
  (CLS).
- INP: the selection message is built after the settle, off the input event; message handling is O(refs).
- The workspace frame's LCP is its status text, from the static HTML; the Explorer and the editor chunks start loading
  on mount while redeem and binding run. A move inside the frame is a client render with no page load; nothing above
  the pane shifts between views (CLS); a move is one push and a render, off the input event (INP).

## Observability

| Fingerprint                                                                                                                                                                                                    | Where                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `[workbench] bearer-refused { reason, sessionPrefix? }`                                                                                                                                                        | api (warn)           |
| `[workbench] confined { scope, method, route, sessionPrefix }`                                                                                                                                                 | api (warn)           |
| `[workbench] read-only-refused { scope, method, route, sessionPrefix }`                                                                                                                                        | api (warn)           |
| `[workbench] liveworkspace unreachable`, `[workbench] room note failed`                                                                                                                                        | api                  |
| `[room-access] closed { match: 'workbench', closed }`                                                                                                                                                          | room                 |
| `[workbench] handshake-ok { originHost }`, `[workbench] handshake-failed { framed }`                                                                                                                           | page                 |
| `[workbench] renewed`, `[workbench] renew-failed { reason }`                                                                                                                                                   | page                 |
| `[workbench] message-ignored { type }`, `[workbench] message-invalid { type }`                                                                                                                                 | page (once per type) |
| `[workbench] ended { reason }`, `[workbench] redeem-failed { status, reason? }`                                                                                                                                | page                 |
| `[workbench] place { view }`, `[workbench] open { kind }`, `[workbench] create-failed { status }`                                                                                                              | workspace frame      |
| `[workbench] request-confined { method, route }`, `[workbench] reveal-missed { count }`                                                                                                                        | editor               |
| `workbench open <minted <documentId> \| pairing-required \| refused <status \| share-link \| invalid_origin>>`                                                                                                 | CLI `debugLog`       |
| `workbench pair <pending \| paired \| approved \| declined \| expired \| gone \| slow-down <s> \| network-retry <n> \| browser <opened \| not-opened \| skipped> \| refused <invalid_origin \| invalid_name>>` | CLI `debugLog`       |

`originHost` is the origin's host only (no scheme or port, WB37). The pairing, mint, session and sweep logs are the
platform's. Telemetry: `track('Session', 'Opened', 'Workbench')` once per document-scope mount and
`track('Session', 'Opened', 'WorkbenchWorkspace')` once per workspace frame; `Cli·Used·WorkbenchOpen` and
`Cli·Used·WorkbenchPair` after exit 0 ([Telemetry](../../017-telemetry/telemetry.md)).

## Testing

| Rule                                                                                                                                                                                                                                                                                       | Test                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Origin shapes: every accepted and refused form of the spec and E1                                                                                                                                                                                                                          | `packages/api-schema/src/workbench.test.ts`                                                                                            |
| Allow-lists by scope: every row allowed, every listed confined route refused, another document `other-document`, ambient headers by scope, `pairingCoversScope`                                                                                                                            | `packages/api-schema/src/workbench.test.ts` (table-driven)                                                                             |
| Message parse: each type, bounds, unknown, `v: 2`, invalid fields                                                                                                                                                                                                                          | `packages/api-schema/src/workbench-messages.test.ts`                                                                                   |
| Session resolution: the checker's answer, refusals, 503 when liveworkspace cannot answer, the room note                                                                                                                                                                                    | `apps/api/src/auth/workbench-session.test.ts`                                                                                          |
| Confinement at the choke point: 403, 404 for another document, view writes 403, room-ticket and own end allowed, share-link list refused                                                                                                                                                   | `apps/api/src/auth/workbench-confinement.test.ts`                                                                                      |
| Workspace choke point: each allowed route class reaches its route, each account class 403, `X-Owner-Id` refused, `X-Share-Code` passes                                                                                                                                                     | `apps/api/src/index.workbench-workspace.test.ts`                                                                                       |
| Room ticket: owner's person tag, level capped, pairing sealed; upgrade header always set                                                                                                                                                                                                   | `apps/api/src/routes/document-room-routes.test.ts`                                                                                     |
| Close match `workbench`: only that pairing's sockets, code 4006                                                                                                                                                                                                                            | `../packages/api-kit/src/room-access.test.ts`, `document-room.test.ts`                                                                 |
| Images: no owner shortcut, `d` must be the session's document                                                                                                                                                                                                                              | `apps/api/src/routes/images.test.ts`                                                                                                   |
| Selection reference: header, refs, kind words, labels quoted and cut, cap and tail, none, element order                                                                                                                                                                                    | `packages/document-views/src/selection-reference.test.ts`                                                                              |
| Fragment read and cleared before any request; the address's scope                                                                                                                                                                                                                          | `apps/editor/app/embed/workbench/workbench-fragment.test.ts`                                                                           |
| Page machine: every transition of the phase table, mismatch both ways                                                                                                                                                                                                                      | `apps/editor/app/embed/workbench/workbench-machine.test.ts`                                                                            |
| Handshake and the page's states                                                                                                                                                                                                                                                            | `useWorkbenchHandshake.test.ts`, `WorkbenchPage.test.tsx`                                                                              |
| Port: target origin on every send; foreign origin and source dropped; unknown logged once                                                                                                                                                                                                  | `apps/editor/lib/workbench/workbench-port.test.ts`                                                                                     |
| Renewal timing, swap, mismatch, expiry to `ended`                                                                                                                                                                                                                                          | `apps/editor/app/embed/workbench/useWorkbenchRenewal.test.ts` (fake timers)                                                            |
| Bridge publishes before children fetch; accounts bridge stands down; pending default                                                                                                                                                                                                       | `apps/editor/components/providers/WorkbenchAuthBridge.test.tsx`                                                                        |
| Bootstrap: no participant write, no lists, session level, `tabId`, a link's load                                                                                                                                                                                                           | `apps/editor/app/document/[id]/useIdentityBootstrap.test.ts`, `apps/editor/hooks/persistence/useAccountBootstrap.test.tsx`             |
| Client confinement throws without fetching                                                                                                                                                                                                                                                 | `apps/editor/lib/api/workbench-confinement.test.ts`                                                                                    |
| Surface flags and the Settings categories                                                                                                                                                                                                                                                  | `apps/editor/app/document/[id]/editor-surface.test.ts`, `settings-catalogue.test.ts`                                                   |
| Messages from the editor: ready once, tab, settle 250 ms, dedupe, reveal, theme                                                                                                                                                                                                            | `apps/editor/app/document/[id]/useWorkbenchMessages.test.ts`                                                                           |
| Tab revisions from load, save and changeset                                                                                                                                                                                                                                                | `apps/editor/app/document/[id]/useTabRevisions.test.ts`                                                                                |
| Trashed ends the page; 4005 and 4006 under a session                                                                                                                                                                                                                                       | `useWorkbenchEnd.test.ts`, `useRoomConnection.workbench.test.tsx`                                                                      |
| Appearance override wins and is never stored                                                                                                                                                                                                                                               | `../packages/ui/src/appearance/appearance-store.test.ts`                                                                               |
| Settings pairings and Unpair                                                                                                                                                                                                                                                               | `useWorkbenchPairings.test.ts`                                                                                                         |
| Frame addresses both ways; app hrefs to frame paths; the frame-path rewrite                                                                                                                                                                                                                | `workspace-place.test.ts`, `workbench-frame-path.test.ts`                                                                              |
| Interceptor: links, `assignAppLocation`, new-tab fallback                                                                                                                                                                                                                                  | `useWorkspaceNavigation.test.ts`                                                                                                       |
| New document in place: folder, team, template, blank, refused                                                                                                                                                                                                                              | `create-in-place.test.ts`                                                                                                              |
| The frame: Explorer on Home and on a folder, document with Back, trashed back to the Explorer, `place` on moves, `open`                                                                                                                                                                    | `WorkspaceFrame.test.tsx`, `useWorkspacePlaceMessages.test.ts`                                                                         |
| Back's card and the Open link; the tab bar has no Back                                                                                                                                                                                                                                     | `WorkbenchChrome.test.tsx`, `TabBar.workbench.test.tsx`                                                                                |
| Worker: `/embed/workbench` frameable, frame paths served by the frame page                                                                                                                                                                                                                 | `apps/editor/src/worker.test.ts`                                                                                                       |
| CLI open and pair: URL and JSON, 428 exit 4 with the fix, share URL exit 2, origin exit 1; pair's URL first on stdout, no browser when piped, the endings                                                                                                                                  | `packages/agent-verbs/src/verbs/workbench.test.ts`, `apps/cli/src/commands/workbench-open.test.ts`, `workbench-pair.test.ts` (fake io) |
| Guide `workbench` and the skill's `[livediagram]` pointer within budget                                                                                                                                                                                                                    | `packages/agent-verbs/src/catalogue.test.ts`                                                                                           |
| End to end, dark, a fake workbench page framing the editor: the frame binds, the editor mounts without header or Explorer; drawing saves; a settled selection message; `reveal`; `theme`; renewal; Unpair turns the frame read-only with the Reconnect line; another origin mounts nothing | `apps/editor/e2e/workbench-embed.spec.ts` (project `workbench`, `E2E_WORKBENCH=1`)                                                     |
| End to end, the workspace: Explorer Home with no header or account; a folder; New document in the frame; `place`; Back; `open`                                                                                                                                                             | `apps/editor/e2e/workbench-workspace.spec.ts`                                                                                          |

The fake workbench (`apps/editor/e2e/fixtures/fake-workbench.html`) is served by `workbench-support.ts` from a Node
`http` server on `127.0.0.1` at a free port; it frames the URL it is given, answers `hello` with
`hello-ack { name: 'Fake Workbench' }`, answers `renew` with a ticket the test mints, and records every message into
`window.received`.

## Constants and configuration

| Constant                        | Value                   | Provenance                                 | Safe range          |
| ------------------------------- | ----------------------- | ------------------------------------------ | ------------------- |
| `WORKBENCH_TICKET_TTL_MS`       | 60000                   | Spec; enforced by the platform             | 30000 to 120000     |
| `WORKBENCH_SESSION_TTL_MS`      | 28800000                | Spec; enforced by the platform             | 3600000 to 86400000 |
| `WORKBENCH_HANDSHAKE_MS`        | 5000                    | Spec                                       | 2000 to 15000       |
| `WORKBENCH_SELECTION_SETTLE_MS` | 250                     | Spec                                       | 100 to 1000         |
| `WORKBENCH_SELECTION_MAX_REFS`  | 20                      | Spec                                       | 5 to 50             |
| `WORKBENCH_PAIRING_TTL_MS`      | 600000                  | Spec; enforced by the platform             | 120000 to 1800000   |
| `WORKBENCH_TICKETS_PER_MINUTE`  | 30                      | Spec; enforced by the platform             | 10 to 120           |
| `WORKBENCH_RENEW_LEAD_MS`       | 600000                  | WB38                                       | 60000 to 3600000    |
| `WORKBENCH_RENEW_RETRY_MS`      | 60000                   | WB38                                       | 10000 to 300000     |
| `WORKBENCH_SESSION_PREFIX`      | `lvw_`                  | Spec                                       | fixed               |
| `WORKBENCH_NAME_MAX_LENGTH`     | 40                      | WB2                                        | 20 to 80            |
| `WORKBENCH_ORIGIN_MAX_LENGTH`   | 255                     | A host name's own cap plus scheme and port | fixed               |
| `WORKBENCH_ENDED_CLOSE`         | 4006                    | Next after 4005                            | fixed               |
| Session check cache             | 60 s live, 10 s refused | `workbench-session.ts`                     | fixed               |

Configuration: `ACCOUNTS_URL`, `ACCOUNTS_CLIENT_ID` and `ACCOUNTS_CLIENT_SECRET` (the api's client credentials) let
the api check sessions and forward `/api/workbench/*`; without them every `lvw_` bearer reads `unknown`.

## Assets and external resources

No new asset. The external-link glyph ships in the editor's icon set.

## Defaults ledger

WB in [DEFAULTS.md](DEFAULTS.md).
