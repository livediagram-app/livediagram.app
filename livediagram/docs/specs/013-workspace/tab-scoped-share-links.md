# Tab-scoped share links

A share link can open every tab of a canvas or only one. The link and its tab are the index's (`ShareLink.tabId`,
chosen in the shared Share dialog's **Opens**), and the grant the index issues for that link names the tab (`tab`). A
tab-scoped link opens only its tab: the other tabs stay visible in the visitor's tab bar as nameless "Not shared"
pills, and livediagram never sends their content, over REST or in the realtime room.

Owners sometimes want to show one tab of a canvas, not the whole thing: the roadmap tab to a client, but not the
pricing tab beside it. A scoped link shares the living tab instead of forking it into a copy.

## Scope

- Every link has a level (Viewer, Participant, Editor; [Share roles](share-roles.md)) and a scope, independent of
  each other. **All tabs** is the default.
- A canvas holds any number of links of any mix of scopes.
- A link's scope can be changed after it is made, both ways, in the Share dialog; the code stays the same.
- Who may manage links is the index's: the owner, or a joined member of the canvas's team.

## Enforcement

The api checks a grant's `tab` on every request about the canvas (`gateGrant` and the gates in
`apps/api/src/routes/context.ts`, over `routes/document-grant.ts`). A canvas-level request with a scoped grant fails
closed.

| Door                                             | Scoped visitor gets                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `GET /api/share/:code`, `GET /api/documents/:id` | `{ document, role, tabId }`, the canvas redacted (below)                                            |
| `PUT /api/documents/:id` (rename, reorder, deck) | 403: the canvas's structure is not theirs to change                                                 |
| `GET/PUT/DELETE /api/documents/:id/tabs/:tabId`  | Their tab only, with the level's usual rules; another tab is a 404; deleting their own tab is a 403 |
| Comments, Q&A board                              | Their tab only; otherwise 404                                                                       |
| `POST /api/documents/:id/copy`                   | A copy holding only their tab                                                                       |
| `GET /api/previews/items/:id` (liveworkspace's)  | Their tab's picture                                                                                 |
| `GET /api/images/:id?d=`                         | Only images their tab references                                                                    |
| `GET /api/share/:code/image.svg`                 | Always their tab; a `?tab=` naming another is a 404                                                 |
| Room ticket and upgrade                          | Admitted with the level and the tab (below)                                                         |

**Redaction.** A scoped visitor's copy of the canvas keeps every tab's `id` and `orderIndex`, so the bar can draw it in
place; the other tabs carry `name: ''`, no folder, `updatedAt: 0` and `outOfScope: true`. `presentation` is null (a
slide deck spans tabs). The canvas's name, owner name and colour stay.

**The tab must still belong to the canvas.** A grant whose tab is no longer in the canvas reaches nothing.

## Realtime

The room confines a scoped session to its tab (`apps/api/src/room-scope.ts`), both directions failing closed:

- **Outbound**: no op carrying another `tabId` reaches it (element, tab, cursor, selection, avatar, reaction,
  viewport, focus, Q&A), nor a `select` without a `tabId`; `document-meta` is redacted as the REST canvas is.
  Catch-up replay applies the same filter. Tab-less session tools (polls) and the share and Trash notices still
  reach it.
- **Inbound**: the room drops any op from it that carries another `tabId`, a `select` with no `tabId`, and
  `document-meta`. Anything unknown fails closed.
- **A tab op's payload keeps to the tab it names**, from anyone (`apps/api/src/room-op-gate.ts`): the room drops a
  whole-tab op whose tab carries another id, and a `tab-meta` patch that names an id, elements or articles. An editor
  receiving one keeps its tab's own id. A receiver merges the payload over its tab, so a payload naming another id
  would renumber its tab, and its next save would write over a tab the sender cannot reach.
- **Freeing a held selection** ([Facilitator](../012-collaboration/facilitator.md)) reaches only someone on the
  scoped session's own tab.
- Presence entries still carry each peer's tab id, so avatars can stack on "Not shared" pills. An id is not content.

**A changed scope reconnects.** A grant whose tab changes on renewal closes the socket (`4005`, "access changed"), and
the editor rejoins as what it now is. A revoked link's sessions are closed when their grant lapses (`4007`) and stay
out ([API](../015-api/api.md) "A grant lapses; the session renews it").

## Visitor experience

- A scoped visitor lands **on their tab**, whatever tab the canvas last had open.
- Other tabs render as **"Not shared" pills**: greyed, an eye-off glyph, the label "Not shared", not clickable, not
  draggable, no context menu; the hover card reads "This tab isn't shared with you". They never sit inside a tab
  folder.
- Everything that works across tabs, or on the tab bar itself, is off: the add-tab button, the mode menu's New Tab
  offer, the tab menu, drag-reordering, tab folders, canvas rename, and the slide deck ("The slide deck isn't shared
  with you").
- An element link, search result or keyboard switch pointing at another tab shows the toast "That tab isn't shared
  with you".
- Make a Copy takes their tab only.

## The Share dialog

The shared Share dialog's **Opens** ("Tabs this link opens"): All tabs, then each tab by name in bar order, read when
the dialog opens (`loadTabs` in `apps/editor/lib/explorer-share-host.ts`). It shows only when the canvas has more than
one tab. A scoped link's **Live image** always renders the link's tab, and its embed opens its tab.

## Testing

`apps/editor/e2e/tab-scoped-share.spec.ts` drives the whole path: a link scoped in the Share dialog, a visitor opening
it in a second browser, no response or realtime frame carrying the other tabs, and rescoping to All tabs bringing
the visitor into every tab.

## Out of scope

- A link scoped to several tabs (a subset). One tab or all of them.
- Hiding that other tabs exist. The pills are deliberately visible, so the visitor knows there's more.
- Assigning an action on another tab to a scoped visitor does not widen their scope; the deep link is a 404 for them.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Grants". The Explorer that shows
it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
