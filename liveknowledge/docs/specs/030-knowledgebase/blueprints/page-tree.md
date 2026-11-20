# Page tree blueprint

Derived from [Knowledgebases and pages](../knowledgebases-and-pages.md) "A knowledgebase", "The page tree" and "Share
roles". **Built so far: the model** (`Tab.parent`, its reading and validation, the limits, and the pure tree
functions), **its storage and sync, the room's check, the share roles, the sidebar, the phone sheet, the breadcrumb
and the tab actions in tree terms. Not built: the copy sweep, and what "Not built" lists.** The sections below say which is which; "Not built" is the work left, written
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
| Write on a page                                       | yes    | no          | no     |
| Add, rename, move, indent, outdent, duplicate, delete | yes    | no          | no     |
| Comment                                               | yes    | yes         | no     |

- **In the editor:** `resolveEditorCapabilities` (`apps/editor/lib/editor-capabilities.ts`) gives a Participant
  `takePart` alone: `writeArticle`, `writeText`, `editPages` and `replace` are an Editor's.
- **In the room:** `gateClientOp` (`apps/api/src/room-op-gate.ts`) drops a Participant's `article` frame as it drops
  a Viewer's, and relays `tab`, `tab-meta` and `document-meta` from an Editor only. A Participant's `el` op still
  goes through the participant content rule, which is how its comments and replies are written.
- **Not built:** the participant content rule (`packages/document/src/participant-content.ts`) still takes a
  Participant's change to the words of an element placed in a zone (a label, a table's cells); the editor no longer
  offers it. A Participant replies in a margin note's thread but cannot start a margin note, which needs a mark in
  the writing.
- **Tests:** `room-op-gate.test.ts` "the knowledgebase share roles, in the room" (a row per role and action),
  `document-room-participant.test.ts`, `editor-capabilities.test.ts`.

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
- **A row's controls** (Add Subpage, Page Options) and its title's tooltip mount only while the row is under the
  pointer, holds focus or has its menu open; their 50 px is always kept, so nothing shifts. On a touch screen the
  menu button is always there and Add Subpage is in the menu.
- **One set of handlers.** The list listens once for every row: a click, a double click (rename), a key, a hover and
  the drag are read off the row the event came from (`data-page-row`, `data-row-action`), so rows carry no handlers.
- **Drag** (HTML drag and drop, as the tab bar used): a row's top and bottom quarters are its edges (an insertion
  line), its middle the row (it highlights, and opens on the drop). `dropMove` turns the row and zone into a
  `PageMove`; a move the tree refuses (`pageMoveRefusal`: its own subtree, too deep) or that changes nothing takes no
  drop and shows no mark. Worked out once per row and zone entered, not per pointer move.
- **Closed pages** are kept per knowledgebase in `localStorage` (`liveknowledge:v2:page-tree-closed`, the 50 most
  recent knowledgebases); a page with subpages is open until closed. The current page's ancestors are open whatever
  is stored, which is how a page opened by its link (`#t=<page>`) shows where it is.
- **Phone:** no sidebar. `PageTreeSheet`'s Pages button rides in the strip's row beside the menu button (an Editor's
  phone), or stands under the menu box (a reader's, which has no strip); it opens the same `PageTree` in the shared
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
follows its Title:** `usePageNameFromTitle` (`hooks/editor/`) renames the page `PAGE_NAME_SETTLE_MS` (600) after the
Title last changed, only for a title this editor typed (the local edit counter moved), so a page loading or a peer
typing writes nothing here; a rename still waiting when the person opens another page is made at once.

Share roles in the editor: the tree is handed `canEdit = can.editPages && !isStructureReadOnly`
(`usePageTreeModel`). Without it a row has no Add Subpage, no drag and no rename, the menu holds Copy Link alone, and
there is no New Page or knowledgebase rename. Tested a role at a time in `PageTree.test.tsx`,
`PageTreeSidebar.test.tsx` and `useTabActions.pages.test.tsx`.

## Not built

1. **The rest of the copy sweep.** Done: the strings a person reads on a control or in a toast that said "tab" now
   say "page" (the canvas menu, Find in Page, Import to Page, the export formats, the link picker, the commands
   Create New Page and Rename Page, version history, the shortcuts list, the help keys in `lib/help-articles.ts`),
   and the item's noun reads "Knowledgebase" on the loading, trashed, archived and load-error cards, the create
   failures, the Add to Knowledgebase and link pickers, Whole Knowledgebase in Print, Sync Knowledgebase, the
   sign-in pitches and the help keys. Left: `components/dialogs/settings/settings-catalogue.ts` (four "Document"
   labels: liveworkspace.app keeps a copy of this catalogue, held equal by `settings-site-catalogue.test.ts`, so the
   two change together); running prose inside dialogs and panels that the sweep's exact-string pass did not reach
   (search `apps/editor/components` for "document" and "tab" in JSX text); the shared dialogs in `packages/`, which
   are the platform's; the end-to-end specs; marketing and the help articles.
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
7. **Connected tabs** show in the tree as any page; their short menu (Connect Again, Remove) is not in the row menu.

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
`useTabActions.pages.test.tsx`, `page-title.test.ts`, `usePageNameFromTitle.test.tsx`; the caret:
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
| `PAGE_NAME_SETTLE_MS`                  | 600    | `usePageNameFromTitle.ts` | The autosave's own pause                                              |
| `BREADCRUMB_MIN`                       | 240    | `page-title-bar-room.ts`  | Two ancestors at a readable width before the buttons name themselves  |
| `PAGE_TREE_KEPT`                       | 50     | `lib/page-tree-open.ts`   | Knowledgebases whose closed pages are kept                            |
