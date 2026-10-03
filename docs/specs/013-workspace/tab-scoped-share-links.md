# Tab-scoped share links

A share link ([Auth + guest access](../014-identity/auth-and-guest-access.md), [API app](../015-api/api.md)) has a **scope**: either **All tabs** (the whole document) or **one tab**. A tab-scoped link opens only its tab. The other tabs stay visible in the visitor's tab bar as nameless "Not shared" pills, and the server never sends their content. That covers REST and the realtime room.

## Why

Owners sometimes want to show one tab of a document, not the whole thing: the roadmap tab to a client, but not the pricing tab beside it. Until now the answer was to duplicate the tab into a new document, which forks it. A scoped link shares the living tab. See issue #29.

## Scope

- Every link has a role (`view` / `edit`, unchanged) and a scope. Role and scope are independent: a tab-scoped link can be view or edit.
- **All tabs is the default.** A link created without a tab is exactly the link that existed before this spec.
- A document holds any number of links, of any mix of scopes: different tabs to different people, several links to the same tab, all-tab links alongside.
- The owner can **change a link's scope** after creation, both ways (All tabs ↔ a tab, one tab ↔ another tab). The code stays the same, and the change takes effect immediately for everyone holding it (see [Rescoping](#rescoping)).
- Only the owner manages links, as for every share-link operation.

## Data model

Migration `0048_tab_scoped_share_links.sql`:

- `share_links.tab_id TEXT NULL`: the tab the link is scoped to; NULL = All tabs. Existing rows are NULL, so every existing link keeps its meaning.
- `shared_with.tab_id TEXT NULL`: the scope the visitor was last granted, written alongside `role` on every share resolve (last visit wins, the rule `role` already follows).
- `ws_tickets.tab_scope TEXT NULL` and `ws_tickets.share_code TEXT NULL`: a room ticket carries the scope and the admitting code from the mint to the upgrade (see [Realtime](#realtime)).

The `ShareLink` DTO gains `tabId: string | null`, and `SharedWithItem` gains `tabId: string | null`.

## Access

A scoped link grants its role **on its tab only**. The worker enforces this in one place, the document access resolution: it answers not just "may this caller read/edit" but "with what tab scope". Every route applies the scope:

| Door                                                          | Scoped visitor gets                                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/share/:code`                                        | `{ document, role, tabId }`, with the document redacted (see [Redaction](#redaction)).                                                                                       |
| `GET /api/documents/:id`                                      | The same redacted document.                                                                                                                                                  |
| `PUT /api/documents/:id` (rename, reorder, tab folders, deck) | 403. The document's structure isn't theirs to change.                                                                                                                        |
| `GET/PUT/DELETE /api/documents/:id/tabs/:tabId`               | Their tab only, with the role's usual rules. Another tab id is a 404 (no existence leak). DELETE of their own tab is 403: a scoped link can't delete the tab it's scoped to. |
| Comment `POST`/`DELETE`                                       | Their tab only; otherwise 404.                                                                                                                                               |
| `POST /api/documents/:id/copy`                                | A copy holding **only their tab**.                                                                                                                                           |
| `GET /api/documents/:id/thumbnail`                            | Their tab's image, not the first-tab snapshot.                                                                                                                               |
| `GET /api/images/:id?d=`                                      | Only images referenced by their tab.                                                                                                                                         |
| Q&A board `POST .../tabs/:tabId/qa`                           | Their tab only.                                                                                                                                                              |
| Document timeline feed                                        | Refused: it spans every tab.                                                                                                                                                 |
| `GET /api/share/:code/image.svg`                              | Always their tab. A `?tab=` naming another tab is a 404.                                                                                                                     |
| Room ticket / WS upgrade                                      | Admitted with the role and the scope (see [Realtime](#realtime)).                                                                                                            |

Holding several links is never merged: each request is judged on the code it carries.

### The tab must still belong to the document

A scoped link is only valid while its tab is still in the document. Deleting that tab **deletes every link scoped to it** in the same request, and broadcasts `share-revoked` for each, so the visitors holding them leave the editor exactly as on a manual revoke. The access resolution also treats a scoped link whose tab is gone as no link at all, so a race can't open anything.

### Redaction

A scoped visitor's copy of the document:

- `tabs`: every tab keeps its `id` and `orderIndex`, so the bar can draw it in place. The other tabs carry `name: ''`, no `folder`, `updatedAt: 0` and `outOfScope: true`. (Not `locked`: `Tab.locked` is the existing user-toggled read-only lock, a different thing.) Their tab is unchanged.
- `presentation`: `null`. A slide deck spans tabs.
- The document's name, owner name and colour stay: the visitor sees those when resolving any link.

### Shared with you and Activity

- `GET /api/shared` returns, for each row, a live code matching the visitor's recorded role **and scope** (`share_links.tab_id IS shared_with.tab_id`), never one broader than what they were given. It returns `tabId` too.
- The Activity page ([Activity page](activity-page.md)) picks share codes the same way, and lists a scoped visitor's actions and threads on their tab only.
- Copy's `shared_with` leg honours the recorded scope, as the share-code leg does.

## Realtime

The upgrade forwards the resolved scope to the room with the role (`X-Verified-Tab-Scope`, beside `X-Verified-Role`), plus the code the session joined with (`X-Verified-Share-Code`). The room stores both on the session, and they survive hibernation like the role does.

For a scoped session:

- **Outbound**: the room doesn't send it any op carrying a different `tabId`: element, tab, cursor, selection, avatar, reaction, viewport, focus and Q&A ops. A `select` without a `tabId` is dropped, as is a `log` op whose entry is on another tab. `document-meta` is redacted the same way the REST document is. Catch-up replay applies the same filter. Its `seq` can lag because of filtered ops, which is harmless: every op on its own tab still reaches it, and the ledger merge is per tab.
- **Inbound**: the room drops any op from it that carries a different `tabId` (presence included, so a `tab-focus` elsewhere too), a `select` with no `tabId`, and `document-meta` outright (and the retired `log` / `log-remove` ops of the removed Activity panel). Of the tab-less ops it may still send the poll ops. Anything else fails closed.
- Presence entries still carry each peer's tab id, so avatars can stack on "Not shared" pills. An id is not content.

### Revoke closes the socket

`share-revoked` and `share-rescoped` (below) now also **close** every room socket that joined with that code, after delivering the op. Before, a client had to honour the redirect itself; a modified client could ignore it and keep receiving ops.

### Rescoping

Changing a link's scope broadcasts a system op `share-rescoped { code }`. Sessions that joined with that code reload the page (the resolve then hands them the new scope) and the room closes their sockets. Sessions on other codes ignore it.

## Visitor experience

- A scoped visitor lands **on their tab**, whatever tab the document last had open.
- Other tabs render as **"Not shared" pills**: greyed, an eye-off glyph, the label "Not shared", not clickable, not draggable, no context menu. The hover card reads "This tab isn't shared with you". They never sit inside a tab folder (the folder name is withheld too).
- Everything that works across tabs, or on the tab bar itself, is off for a scoped visitor: the add-tab button, the tab menu (so rename, duplicate, delete, lock and the tab's session tools too), drag-reordering, tab folders, document rename, and the slide deck (picking it says "The slide deck isn't shared with you").
- An element link, search result or keyboard switch pointing at a tab outside the scope does nothing but show the toast "That tab isn't shared with you".
- Make a copy takes their tab only.

## Owner experience (Share dialog)

- The composer's fine print gains an **Opens** row, a select under **Valid** ("Tabs this link opens"): "All tabs" (default), then each tab by name, in bar order. It only shows when the document has more than one tab.
- Each active pass shows its scope beside **Opens** as a select ("All tabs" / a tab name); a single-tab document leaves the term off, since every pass opens every tab. Changing it rescopes the link at once. A single-tab document shows no scope control; its links are All tabs.
- A scoped link's **Live image** has no tab picker: it always renders the link's tab.
- A scoped link's Embed shows its tab, because the embed resolves through the same code.

## API

- `POST /api/documents/:id/share` body gains optional `tabId: string | null`. An unknown tab, or one not in this document, is `400 invalid tab`.
- `PUT /api/documents/:id/share/:code` (owner-only), body `{ tabId: string | null }`: rescope. `400 invalid tab` as above, `404` for an unknown code. Returns `{ link }` and broadcasts `share-rescoped`.
- `GET /api/share/:code` returns `tabId` alongside `role`.

## Testing

`apps/live/e2e/tab-scoped-share.spec.ts` drives the whole path: the owner scopes a link in the Share dialog, a visitor opens it in a second browser, no response or realtime frame carries the other tabs, and rescoping to All tabs reloads the visitor into every tab. The e2e stack proxies the realtime room's WebSocket for this.

## Telemetry

Following the [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) vocabulary, creating a scoped link also emits `Document/Shared/TabScoped`. A rescope emits `Document/Shared/Rescoped`.

## Out of scope

- A link scoped to several tabs (a subset). One tab or all of them.
- Hiding that other tabs exist. The pills are deliberately visible, so the visitor knows there's more.
- Assigned actions: assigning an action on another tab to a scoped visitor doesn't widen their scope. The email names the action, which the owner wrote deliberately, and the deep link 404s for them.
