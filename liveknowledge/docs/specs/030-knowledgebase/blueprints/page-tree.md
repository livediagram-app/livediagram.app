# Page tree blueprint

Derived from [Knowledgebases and pages](../knowledgebases-and-pages.md) "A knowledgebase", "The page tree" and "Share
roles". **Built so far: the model** (`Tab.parent`, its reading and validation, the limits, and the pure tree
functions), **its storage and sync, the room's check, the share roles, the sidebar, the phone sheet, the breadcrumb
and the tab actions in tree terms, and the editor's copy. Not built: what "Not built" lists.** The sections below say which is which; "Not built" is the work left, written
so it can be picked up cold.

## Domain and naming

| Term             | Identifier                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| page             | a `Tab`; the interface says "page", never "tab"                                                             |
| parent           | `Tab.parent?: TabId` (`packages/document/src/tab-type.ts`), absent at the top level                         |
| stored parent    | `parseTabParent(v)`: a non-empty id of at most 128 characters, else none                                    |
| effective parent | `pageParents(pages)`: the stored parent when that page exists, is not the page itself and closes no cycle   |
| page tree        | `buildPageTree(pages)` (`PageTreeNode`), `pageTreeRows(pages)` (`PageTreeRow`: `page`, `depth`, `subpages`) |
| subpage count    | `subpageCount(pages, id)`, `pageSubtreeIds(pages, id)`                                                      |
| ancestors        | `pageAncestors(pages, id)`, the top-level one first; `pageDepth(pages, id)`, 1 at the top                   |
| limits           | `MAX_KNOWLEDGEBASE_PAGES` (500), `MAX_PAGE_DEPTH` (8)                                                       |
| refusals         | `PageTreeRefusal`: `page_limit`, `depth_limit`, `own_subtree`, `unknown_page`                               |

All of it is in `packages/document/src/page-tree.ts`, generic over `TreePage = { id; parent? }`, so the tab list, the
tab summaries and the api's rows can all be read by the same functions.

## Behaviour and state (built: the model)

- **Reading is forgiving, writing is strict.** A stored tree is never refused on read: a parent that is gone, or is
  the page itself, reads as the top level (the page surfaces, never lost), and a cycle is cut at its first page in
  the list, which keeps the rest of the cycle as its subtree. A tree deeper than `MAX_PAGE_DEPTH` still draws. Every
  edit is checked: it answers a refusal, or null, and the list is unchanged.
- **The list is the tree.** Every edit answers the whole list in tree order (each page followed by its subpages), each
  page carrying the parent the tree reads for it. Siblings keep the order the list gives them, so the tab list's
  order plus `parent` is all that is stored. `withPageTreeOrder(pages)` puts any list in that order and is the same
  list back when it already is.
- **Add:** `withPageAdded(pages, page, parent?)` adds a page as the last subpage of `parent` (the last top-level page
  when absent). Refused past 500 pages (`page_limit`), below 8 levels (`depth_limit`), under a page that is not
  there, or with an id already there (`unknown_page`). `pageAddRefusal(pages, parent?)` answers the same without
  adding, for a control to disable itself with the reason.
- **Move:** `withPageMoved(pages, id, { parent?, before? })` moves a page with its subpages under `parent`, before its
  subpage `before` (last when absent or not a subpage of the target). `pageMoveRefusal` says why not: `own_subtree`
  (under itself or one of its own subpages), `depth_limit` (its deepest subpage would pass 8 levels),
  `unknown_page`. Null when it is already there.
- **Move Up, Move Down:** `withPageStepped(pages, id, -1 | 1)`, among siblings; null at the first and the last.
- **Indent:** `withPageIndented(pages, id)`: the last subpage of the sibling above; null with none above, or too deep.
- **Outdent:** `withPageOutdented(pages, id)`: out a level, to just after the page it was under; null at the top.
- **Delete:** `withPageDeleted(pages, id)` removes the page and its subpages; null when no page would be left.
- **The whole tree:** `pageTreeRefusal(pages)` is what a server checks before it takes a change: over 500 pages, or
  any page below 8 levels.
- `isValidTab` refuses a tab whose `parent` is no id, or is the tab's own id.

## Storage and sync (built)

- **Where it is stored.** A page's `parent` is in its tab's body (`tabs.data`, `$.parent`); its place among its
  siblings is the tab list's order (`document_tabs.order_index`). Nothing else is stored.
- **The tree draws from the summaries.** `readDocumentOutline` (`apps/api/src/document-room/document-content.ts`)
  reads `json_extract(t.data, '$.parent')` beside each summary (guarded by `json_valid`, so one body that does not
  parse never fails the read), `rowToTabSummary` (`apps/api/src/tab-row.ts`) answers it as `TabSummary.parent`
  (`packages/api-schema/src/index.ts`, absent at the top level), and `placeholdersFromSummaries`
  (`apps/editor/app/document/[id]/editor-page-helpers.ts`) carries it onto the placeholder tab. A tab outside a
  tab-scoped visitor's scope carries none.
- **The tree rides the metadata save.** The editor loads a page's body lazily and never saves a body it does not
  hold, so a body save alone would lose a move of a page nobody opened. Each entry of the metadata save's tab list
  therefore carries `parent` (a string, or null at the top level): `metaTabFields` in `useAutosave.ts` (an optional
  dep of the shared `useAutosaveCore`, `packages/workbench`), and `computeTabSaveDiff` counts a changed parent as a
  change of the list. `PUT /api/documents/:id` writes each moved page's parent into its body
  (`writeTabParents`, `apps/api/src/document-room/page-tree-store.ts`: `json_set` or `json_remove`, the tab's
  revision advanced as a rename advances it). A list whose entries name no parent (an agent's rename, an older
  editor) leaves the tree alone. A loaded page's body save carries the same parent, so the two never disagree.
  Offline, `applyMeta` (`apps/editor/lib/offline/offline-store.ts`) does the same to the stored record.
- **Peers.** The `document-meta` op the editor sends after that save carries the same `parent` per tab
  (`packages/api-schema/src/room-messages.ts`); `applyRoomOpToTabs` places each page from it, loaded or not
  (`withSummaryParent`: a summary with the key sets it, one without, such as the room's rename relay, leaves the
  tab's own). A resync reads the stored list back the same way (`tabListOf`). The `tab-meta` patch of a loaded
  page's `parent` still travels and says the same thing.
- **Copies.** A copy re-points each `parent` at the page's copy (`remapTabDataLinks`); a parent the copy does not
  carry (a tab-scoped copy) is dropped, so the page surfaces at the top level.
- **Known gap.** A page moved while its body is still loading takes the fetched body's parent when the load lands
  before the save does (`usePerTabLoad` swaps the placeholder for the fetched tab): the move is lost and has to be
  made again. Not seen in a test; the window is one fetch.

## Where a new knowledgebase is saved (built)

`/new` decides at commit (`useNewDocumentLocation.resolveSaveLocation`, `defaultSaveLocationFor`): the account for a
signed-in person (`apiCreateDocument` with no placement, which the index files in Private), Offline for a guest. It
decides as the page mounts, before sign-in has answered, so a browser that `looksSignedIn`
(`lib/signed-in-hint.ts`) waits for the session first. That was the `lkb_signed_in` hint cookie alone. The signed-in
test build (`NEXT_PUBLIC_E2E_AUTH=1`, `E2EAuthBridge`) keeps its session in `localStorage` and sets no cookie, so
there a signed-in person read as a guest and every new knowledgebase started Offline (seen by the owner on the local
stack, 2026-11-20); `looksSignedIn` now also counts that stored session, in a test build only (`e2eAuthEnabled` is a
compile-time constant a real bundle drops). The production default was already the account. Tested in
`useNewDocumentLocation.test.tsx`. The start's switch (`StartSaveSwitch`, the shared `SaveSwitch`) is unchanged.

## The room's check (built)

Every write that can change the tree is judged by `page-tree-store.ts` before it is taken, and only a change is
judged: a page saved where it already sits is never refused, even in a tree that already breaks a limit.

| Write                                               | Check                                                                                                                                 | Refusal                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| An Editor's `tab`, `tab-meta` or `document-meta` op | `refusesPageTreeOp` (`document-room-frames.ts`), beside `refusesElementOp`, over the stored tree read with the room's synchronous SQL | `op-refused` to the sender alone, with the reason; not relayed |
| `PUT /api/documents/:id/tabs/:tabId`                | `tabParentRefusal` (`routes/tab-put-route.ts`)                                                                                        | 409 with the reason                                            |
| `PUT /api/documents/:id`                            | `tabListRefusal` (`routes/documents.ts`), the list judged whole so two pages may trade places in one save                             | 409 with the reason, nothing written (not the name either)     |
| A changeset that makes a tab                        | the page count (`changesets/submit.ts`)                                                                                               | 409 `page_limit`                                               |

Reasons are `PageTreeRefusal`: `page_limit` (a 501st page), `depth_limit` (a page, or the deepest page of a moved
subtree, below level 8), `own_subtree` (a page under itself or one of its own subpages: a cycle), `unknown_page` (a
parent that is no page of this knowledgebase, such as a tab of another document, or no id at all). Only a `tab`,
`tab-meta` or `document-meta` op reads the stored tree, so a typing stream costs no read.

A new page whose parent is also new is saved after it: the autosave writes changed pages side by side, so
`page-save-order.ts` (`apps/editor/app/document/[id]/`) holds a page's write until the first save of its parent,
when that is part of the same save, has settled (`expectFirstSave` as the save is prepared, `savePageAfterParent`
around the PUT; a parent whose save never runs releases its subpages after `PARENT_SAVE_WAIT_MS`, 15 s). Should the
subpage still arrive first it is refused `unknown_page`, and the autosave writes it again with the next save.

## Share roles (built)

| Action                                                | Editor | Participant | Viewer |
| ----------------------------------------------------- | ------ | ----------- | ------ |
| Write on a page                                       | yes    | yes         | no     |
| Add, rename, move, indent, outdent, duplicate, delete | yes    | yes         | no     |
| Comment                                               | yes    | yes         | no     |

- **In the editor:** `resolveEditorCapabilities` (`apps/editor/lib/editor-capabilities.ts`) gives a Participant
  every flag an Editor holds but `manageKnowledgebase` (Knowledgebase Settings, Knowledgebase Style, AI Settings,
  agents' scopes, renaming and deleting the knowledgebase); `writesKnowledgebase` makes `isReadOnly` false for both.
- **In the room:** `gateClientOp` (`apps/api/src/room-op-gate.ts`) relays a Participant's `article`, `el`, `tab`,
  `tab-meta` and `document-meta` as an Editor's (`writerLevel`); the room strips `knowledgeSettings` and
  `knowledgeStyle` from every socket's `document-meta`. A Viewer's are dropped.
- **In the api:** `gateWrite` / `writesPages` (`apps/api/src/routes/context.ts`) let an Editor or a Participant in
  person write tabs, the tree's order, names, versions and page knowledge; `PUT /api/documents/<id>` refuses a
  Participant's write that renames the knowledgebase or names `knowledgeStyle`.
- **Not reached:** the platform's text-only participant rule (`packages/document/src/participant-content.ts`,
  `apps/api/src/room-participant.ts`, `participant-write.ts`) stays in the code with its own tests, but no
  liveknowledge session goes through it now.
- **Tests:** `room-op-gate.test.ts` "the knowledgebase share roles, in the room" (a row per role and action),
  `document-room-participant.test.ts`, `context.test.ts`, `editor-capabilities.test.ts`,
  `e2e/signed-in/knowledge-roles.spec.ts`.

## The sidebar (built)

All of it is in `apps/editor/components/page-tree/`.

| Piece                                   | File                                                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| rows on screen, keys, the drop          | `page-tree-view.ts` (`visiblePageRows`, `treeKeyAction`, `dropMove`) |
| the pointer's state, outside React      | `page-tree-ui.ts` (`createPageTreeUi`, `useRowMark`)                 |
| the list: tree, keyboard, menu, drag    | `PageTree.tsx`                                                       |
| one row                                 | `PageTreeRow.tsx`                                                    |
| the row menu and why a verb is disabled | `PageTreeRowMenu.tsx` (`pageMenuRefusals`)                           |
| the sidebar's shell, the rail, New Page | `PageTreeSidebar.tsx`                                                |
| a phone's Pages button and sheet        | `PageTreeSheet.tsx`                                                  |
| the props from the editor's store       | `usePageTreeModel.tsx`                                               |
| its place in the canvas chrome          | `usePageTreeChrome.tsx`                                              |
| the breadcrumb                          | `PageBreadcrumb.tsx` (mounted by `CanvasPageSheet`)                  |
| a made page's caret in its Title        | `lib/page-title-focus.ts`, `hooks/editor/usePageTitleFocus.ts`       |
| what is closed, kept in this browser    | `apps/editor/lib/page-tree-open.ts`                                  |

- **Where it stands.** In the canvas chrome's docked-sidebar slot (`useCanvasChromePanels` calls
  `usePageTreeChrome` where the fork called `useContentsChrome`): an `aside` down the canvas's left that sets
  `data-contents-sidebar`, so the page framing and Zoom to Fit centre the page beside it, joined to the menu box as
  its top row. `CanvasChrome` clears it at its own width (`PAGE_TREE_WIDTH` 264, `pageTreeClearancePx`) for the left
  corner stacks, the bottom-right cluster and the strip. Hidden in zen mode, behind the welcome flow and in an
  embed.
- **Collapsed** (`readTreeCollapsed`, per browser): a rail `PAGE_TREE_RAIL_WIDTH` (48) wide under the menu box,
  which keeps its own card, with Show Pages and, for an Editor, New Page.
- **Rows.** `visiblePageRows(tabs, closed, activeId)` once per change of the list, of what is closed or of the
  current page; 20 px a level (`PAGE_TREE_INDENT`); 32 px tall, 44 px on a touch screen. A row is `role="treeitem"`
  with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` (a page with subpages) and `aria-current` (the
  current page, in `brand-100` with `brand-900` text: 10.1:1). One row is the Tab stop (roving tabindex): the last one
  focused, else the current page.
- **A row's controls** (Add Subpage, Page Options) are always there on every row (owner, 2026-11-21: "always keep
  the + and ... visible on pages in the sidebar, not just on hover"), faint (`slate-400` at 70%) until the row is
  under the pointer, holds focus or has its menu open, when they take full strength. Their hover cards and the title's
  tooltip mount only on that active row, so a 500-page tree carries plain buttons and no cards (the drag perf test
  holds the budget). Their 50 px is always kept, so nothing shifts. On a touch screen the menu button is always
  there and Add Subpage is in the menu.
- **One set of handlers.** The list listens once for every row: a click, a double click (rename), a key, a hover and
  the drag are read off the row the event came from (`data-page-row`, `data-row-action`), so rows carry no handlers.
- **Drag** (HTML drag and drop, as the tab bar used): a row's top and bottom quarters are its edges (an insertion
  line), its middle the row (it highlights, and opens on the drop). `dropMove` turns the row and zone into a
  `PageMove`; a move the tree refuses (`pageMoveRefusal`: its own subtree, too deep) or that changes nothing takes no
  drop and shows no mark. Worked out once per row and zone entered, not per pointer move.
- **Closed pages** are kept per knowledgebase in `localStorage` (`liveknowledge:v2:page-tree-closed`, the 50 most
  recent knowledgebases); a page with subpages is open until closed. The current page's ancestors are open whatever
  is stored, which is how a page opened by its link (`#t=<page>`) shows where it is.
- **Phone:** no sidebar. `PageTreeSheet`'s Pages button stands under the menu box, for every role (the fork's strip,
  whose row it rode in on an Editor's phone, is not a page's bar any more:
  [page surface blueprint](page-surface.md) "The formatting bar"); it opens the same `PageTree` in the shared
  `BottomSheet`, which closes when a page is chosen or added.
- **The bottom bar** (`components/chrome/BottomBar.tsx`, in place of `TabBar.tsx`) keeps Tools, Settings and the
  appearance, and still draws the canvas right-click menu (`TabPortalMenu`), which keeps the current page's Import,
  Export, Lock, Clear and Add to Document. Its Rename asks the tree to rename the page in its row. The tab folder
  rows are not offered.
- **Presence:** `TabPresenceStack` in the row of the page each person is on.
- **The breadcrumb's row.** `CanvasPageSheet` draws `PageBreadcrumb` alone at the left of the page's title row; the
  fork's label card ("Release Process · Fit to Content · Article") is not drawn. `usePageHasAncestors` tells the row
  the open page has a parent, and `titleBarNamed(room, buttons, mobile, BREADCRUMB_MIN)` then names the row's buttons
  only while 240 px are left for the breadcrumb (a top-level page keeps the fork's `LABEL_MIN`, 40). Before this the
  buttons named themselves down to 40 px of room, which left a subpage's breadcrumb a sliver.
- **The caret in a made page's Title.** `addTab` and `addNamedSubpage` call `wantTitleFocus(id)`; `/new` does for
  the one blank page of a knowledgebase made from no template. `usePageTitleFocus` (in `useEditorArticles`) spends
  the ask once that page is the open one, its writing is held and the session may write: it asks the article for
  the caret (`requestFocus(flow, 'title')`), and the page's `ArticleEditor` takes the request as it mounts
  (`focusSelection`: the end of the first text block). The fork asked nothing here, so the pressed button kept the
  focus and the first keys went to the canvas.
- **Knowledge in the tree** ([knowledge UI blueprint](knowledge-ui.md)): `usePageTreeModel` hands `PageTree` a
  `knowledge` prop (`PageTreeKnowledge`): each page's tick or pill (`trustMarks` over the tab list, which carries
  every page's fields from the summaries), the pages in Always in Context, and Verify and the context toggle for
  the row menu. A row takes its mark as a plain string, so a change renders the rows whose mark changed. The
  Search field (`SearchField`) stands under the knowledgebase's name, on the rail and in the phone sheet.

## Tab actions in tree terms (built)

`hooks/persistence/useTabActions.ts`, over the pure list edits in `hooks/persistence/page-tree-edits.ts`:

| Action                                  | Edit                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addTab(parent?)`                       | `withPageAddedTo`; refused at a limit with a toast (`pageTreeRefusalText`)                                                                                                               |
| `duplicateTab(id)`                      | `withPageDuplicated`: beside the original, same parent, no subpages; its Title says its name                                                                                             |
| `deleteTab(id)`                         | one `confirm` naming the count (`deletePageTitle`), then `withPageAndSubpagesDeleted` in one commit (links to the deleted pages stripped); the page after them opens (`pageAfterDelete`) |
| `movePage(id, to)`                      | `withPageMoved` (the drop)                                                                                                                                                               |
| `stepPage`, `indentPage`, `outdentPage` | `withPageStepped`, `withPageIndented`, `withPageOutdented` (the menu)                                                                                                                    |
| `renameTab(id, name)`                   | the name and the Title together (`withPageTitle`); a page not loaded is opened and renamed once it has loaded                                                                            |
| `renameTabFromTitle`                    | the name alone, by `tickTabs` (no undo step of its own)                                                                                                                                  |

**Nothing names the knowledgebase but a person.** The fork named a still untitled document after the Title typed on
its first tab (`articleTitleName`, deleted) and after its first label (`commitLabel` in `useSelectionEditing.ts`);
neither is here, so the sidebar's head and Home's card keep "Untitled Knowledgebase" until it is renamed
(`knowledgebase-name.test.ts`).

Every one answers nothing for a session that may not change the pages (`canEditStructure`). **The page's name
follows its Title:** `usePageNameFromTitle` (`hooks/editor/`) renames the page `PAGE_NAME_SETTLE_MS` (50) after the
Title last changed, only for a title this editor typed (the local edit counter moved), so a page loading or a peer
typing writes nothing here; a rename still waiting when the person opens another page is made at once. The wait is
short because the Title only changes when the writing commits, which already waits for the typing to pause: inside
the autosave's own 600 ms the name rides the same save as the Title, so a page closed just after its Title was
typed never keeps the Title and loses the name (it did at 600, found by the end-to-end suite under load). An emptied
Title leaves the name empty, which every surface shows as "Untitled Page".

**The tree follows each key.** Before the commit, the open page's row reads `useLivePageTitle(current)`
(`lib/article/live-page-title.ts`): the writing's dispatch (`article-view-mount.ts`) sets it when an Editor's own
transaction changed the Title (`titleTextOf`, the first top-level Title paragraph, so a keystroke costs a look at
the first block), and keeps a set value current through any other change (a peer, an undo, a rename from the tree).
`usePageNameFromTitle` clears it in a layout effect when another page opens, so a row never shows the last page's
title. Rows that are not the open page read null and never render for it.

**One model, every way in.** The Title is the page's name; `Tab.name` is the copy kept so a page lists without its
writing. `pageFlowOf`, `pageTitleOf`, `withPageTitle` and `withNameFromTitle` live in `@liveknowledge/document`
(`page-title.ts`) for the editor and the api alike. The api's `withServerRules` keeps a stored page's name unless
the write changed its Title, which it follows (`withNameFromTitle`), and `submitPages` relays the tree
(`relayDocumentTree`, `room-tree.ts`) when it did. `write_page` with no front matter keeps the page's title (the
route adds it), and `create_page` with no Markdown writes the title into the Title (`newPageFromMarkdown`).

Share roles in the editor: the tree is handed `canEdit = can.editPages && !isStructureReadOnly`
(`usePageTreeModel`). Without it a row has no Add Subpage, no drag and no rename, the menu holds Copy Link alone, and
there is no New Page or knowledgebase rename. Tested a role at a time in `PageTree.test.tsx`,
`PageTreeSidebar.test.tsx` and `useTabActions.pages.test.tsx`.

## Not built

1. **The copy sweep, what is left.** Done: every string a person reads in the editor says "page" and
   "Knowledgebase" (controls, toasts, dialogs and their running prose, the 404 card through the shared card's
   `noun`, the Share dialog's Offline panel, the sign-in prompt's Move Offline Knowledgebases, the write failures,
   the command names, the link labels, version history, the settings catalogue and liveworkspace.app's copy of it,
   regenerated). Kept on purpose: "Word document" (a `.docx` is one), the flowchart shape named Document, telemetry
   types (`Document`, `Tab`), the settings category id `documents` and its `/documents` alias, and keywords that
   still match "document" in the command search. Left: the start panel's Blank Pages line (it names slides and
   infographics, which liveknowledge has none of), the unreachable presenting chrome, the shared dialogs in
   `packages/` that take no noun, the end-to-end specs, marketing and the help articles.
2. **Nothing is verified in a browser.** Unit and component tests only: the sidebar's look, the menu box joined
   above it, the rail, the drag's insertion line, the phone button's place and the breadcrumb's place in the title
   row have not been seen on screen.
3. **Delete is not red.** The shared `MenuActionRow` never colours a verb; a red Delete needs a decision there.
4. **The breadcrumb on a phone.** The page's title row hides its left side on a phone, and the breadcrumb with it.
5. **A rename of a page that is not loaded reaches peers only once it has loaded here** (it is opened to load it).
   Undoing typing in a Title does not rename the page back until the Title is typed in again.
6. **The fork's files this replaces are left unreferenced:** `components/canvas/useContentsChrome.tsx` and its test,
   `hooks/persistence/useTabFolders.ts`. The end-to-end specs under `apps/editor/e2e` that drive the tab bar are not
   updated.
7. (Done: connected tabs are connected rows, below.)

## Connected rows (built)

[Links and embeds](../links-and-embeds.md) "Connected files in the sidebar". A connected row is a tab holding a
connection (`tabs.connection`, `{ id, app, itemId }`, liveworkspace's connected-tabs.md), stored, synced and ordered
as every tab is, with `parent` placing it.

- **The tree** (`packages/document/src/page-tree.ts`): `isConnectedRow` and `pageCount` (pages only, for the page
  limit and "a knowledgebase always has a page"); `withConnectedRowAdded` places a row with no page limit; a
  connected row is never a parent (`placeRefusal`, `pageMoveRefusal`, `pageParents`).
- **api**: `document-room/page-tree-store.ts` marks stored rows (`t.connection IS NOT NULL`) and skips the page limit
  for them (`tabParentRefusal`); `routes/tab-put-route.ts` passes the sent connection. Never a page to agents or
  search: `routes/knowledge-agent-routes.ts` lists a row as `kind: "connected"` (with `app`, `depth`, `parent`) and
  answers `404 connected_file` to a read or a write; `knowledge/knowledge-index.ts` `settlePage` indexes no row;
  `knowledge/knowledge-reads.ts` (health, recent) and `knowledge/knowledge-emails.ts` skip rows. Tested by
  `routes/knowledge-connected-rows.test.ts`.
- **Contract**: `packages/api-schema/src/knowledge.ts` `KnowledgeConnectedRow`, `KnowledgeTreeRow`,
  `isKnowledgePageRow`; `packages/agent-verbs` `treeRowOf` / `treeRowLine` and the MCP `list_pages` union; the MCP
  server and the CLI's export and import take pages alone.
- **Editor**: `lib/knowledge/connected-row-store.ts` asks the index where each row leads (`openConnection`, at most 4
  at once, once a connection per session, one store per knowledgebase for the last 8). `components/page-tree/`
  `ConnectedTreeRow.tsx` (the `<a target="_blank" rel="noopener">` row, the app's logo, the arrow-out mark, Can't
  Open), `ConnectedRowMenu.tsx` (Open, Copy Link, Connect Again, the moves, Remove from Sidebar), `connected-rows.ts`
  (the tree's `connected` prop, the Can't Open words), `useConnectedRows.tsx` (the store, the verbs, the names that
  follow the files, the Connect File dialog), `AddToSidebar.tsx` (the foot's New Page and Add to Sidebar menu) and
  Connect File Here in `PageTreeRowMenu.tsx`. `components/connect/ConnectFileDialog.tsx` wraps the shared
  `ConnectPicker`. `useEditorTabs.addConnectedRow` saves the whole tab before it shows;
  `hooks/editor/useActivePageNotConnected.ts` keeps the open page off a row; `useTabActions.deleteTab` removes a
  row with no confirm. The link picker, the Ask page picker and the import count take pages alone. Tested by
  `PageTree.connected.test.tsx` and `connected-row-store.test.ts`, and end to end by
  `e2e/signed-in/connected-rows.spec.ts`.

## Performance and limits

`pageParents` is O(pages x depth); every other function is one pass over the list after it. A full knowledgebase
(500 pages, 8 levels) draws as rows, moves a subtree and is checked in about 1 ms, held under `cpuBudgetMs(150)` by
`page-tree.test.ts`.

The sidebar, measured 2026-11-20 in jsdom (`PageTree.perf.test.tsx`; a browser's DOM is several times faster):

| What                                      | Measured                                           | Held by the test                     |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| First render of 500 rows                  | 184 to 194 ms CPU, every row once                  | `cpuBudgetMs(1500)`                  |
| A hover moving from one row to the next   | 2 row renders (the row left, the entered)          | exactly that                         |
| A drag across 100 rows, 400 pointer moves | 399 row renders, 650 to 680 ms CPU (1.7 ms a move) | at most 2 a move, none inside a zone |
| The current page changing                 | 2 row renders                                      | exactly that                         |
| A typing commit                           | 0 renders of the tree                              | `editor-chrome.test.tsx`             |

So the list is not windowed: 500 rows are 500 light elements (a row's buttons and tooltip mount only while it is
active), and nothing renders them all again but a change of the list itself. `visiblePageRows` reads `pageTreeRows`
once per change of the list (ids, parents, names), never per row and never on a typing commit, which changes none of
them (`sameTabsForBar` compares tabs without their writing). The pointer's state lives outside React
(`page-tree-ui.ts`): a change notifies 500 subscribers, each a string compare, and renders the rows whose mark
changed.

## Testing

`page-tree.test.ts` covers every function and branch of `page-tree.ts`; `validate.test.ts` the tab's `parent`.
`page-tree-store.test.ts` covers the write checks (500 pages, level 8, a cycle, a parent in another document, two
pages trading places, a full knowledgebase within budget); `page-tree-routes.test.ts` the summaries, the metadata
save's parents and both saves' refusals over the api; `page-tree-sync.test.ts` (editor) the placeholders, the save
diff, a peer's list and a resync. The sidebar: `page-tree-view.test.ts` (rows, keys, the drop),
`PageTree.test.tsx` (the tree's roles and attributes, the keyboard, the menu, the drag, a role at a time),
`PageTree.perf.test.tsx` (500 rows), `PageTreeSidebar.test.tsx` (the shell, the rail, the sheet, the tint's
contrast), `PageBreadcrumb.test.tsx`, `page-tree-open.test.ts`; the actions: `page-tree-edits.test.ts`,
`useTabActions.pages.test.tsx`, `page-title.test.ts` (document), `live-page-title.test.ts`,
`usePageNameFromTitle.test.tsx`, the api's `knowledge-agent-routes.test.ts` and `tab-pages-route.test.ts`, the
end-to-end `page-title-name.spec.ts`; the caret:
`usePageTitleFocus.test.tsx`, `article-focus-selection.test.ts`; the row: `page-title-bar-room.test.ts`,
`CanvasPages.phone.test.tsx`; the name: `knowledgebase-name.test.ts`. The owner drove the built app in a browser on
2026-11-20 and found the caret, the name and the label card wrong; their fixes are tested as above and have not been
seen in a browser since.

## Constants and configuration

| Constant                               | Value  | Where                     | Why                                                                   |
| -------------------------------------- | ------ | ------------------------- | --------------------------------------------------------------------- |
| `MAX_KNOWLEDGEBASE_PAGES`              | 500    | `page-tree.ts`            | The spec's limit                                                      |
| `MAX_PAGE_DEPTH`                       | 8      | `page-tree.ts`            | The spec's limit: a top-level page is level 1                         |
| `PARENT_ID_MAX`                        | 128    | `page-tree.ts`            | A tab id is a UUID (36); anything far longer is not one               |
| `PAGE_TREE_WIDTH`                      | 264    | `page-tree-view.ts`       | The spec's width; the shared Contents sidebar's 236 is the platform's |
| `PAGE_TREE_RAIL_WIDTH`                 | 48     | `page-tree-view.ts`       | One 32 px button with its inset                                       |
| `PAGE_TREE_INDENT`                     | 20     | `page-tree-view.ts`       | The spec's indent: the chevron's own width                            |
| `PAGE_TREE_ROW`, `PAGE_TREE_TOUCH_ROW` | 32, 44 | `page-tree-view.ts`       | A dense list with a mouse; a finger's 44 px                           |
| `PAGE_NAME_SETTLE_MS`                  | 50     | `usePageNameFromTitle.ts` | Well inside the autosave's pause, so the name saves with the Title    |
| `BREADCRUMB_MIN`                       | 240    | `page-title-bar-room.ts`  | Two ancestors at a readable width before the buttons name themselves  |
| `PAGE_TREE_KEPT`                       | 50     | `lib/page-tree-open.ts`   | Knowledgebases whose closed pages are kept                            |
