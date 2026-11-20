# Page tree blueprint

Derived from [Knowledgebases and pages](../knowledgebases-and-pages.md) "A knowledgebase", "The page tree" and "Share
roles". **Built so far: the model** (`Tab.parent`, its reading and validation, the limits, and the pure tree
functions), **its storage and sync, the room's check and the share roles. Not built: the sidebar, the breadcrumb and
the phone sheet.** The sections below say which is which; "Not built" is the work left, written
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

A new page whose parent is also new can reach the api before its parent does (the two saves run side by side) and is
then refused `unknown_page`; the autosave writes it again with the next save, by when its parent is stored.

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

## Not built

Each item names the files it touches.

1. **The sidebar,** replacing the tab bar. The slot exists: `useContentsChrome` (`components/canvas/`) answers
   `contentsSidebarEl`, `contentsDocked` and `menuJoined`, and `CanvasChrome` already makes room for a docked left
   sidebar and joins the menu box to its top; a sidebar that sets `data-contents-sidebar` is measured by the page
   framing and Zoom to Fit. It is closed with `CUT_FROM_FORK` today. Build `PageTreeSidebar` in its own file: 264 px
   wide (a product constant: the shared `CONTENTS_SIDEBAR_WIDTH` is 236 and belongs to `packages/workbench`), a
   `slate-50` ground, a right border; rows from `pageTreeRows` indented 20 px a level; a chevron on a page with
   subpages (open or closed kept per browser, the current page's ancestors always open); the current page in the
   brand tint; a row's **+** for a subpage; "New Page" at the foot; the row menu as `MenuActionRow`s under a
   `MenuHeader` (Rename, Add Subpage, Duplicate, Copy Link, Move Up, Move Down, Indent, Outdent, Delete last and
   red); the delete confirmation naming the count ("Delete Release Process and 3 Subpages?"); drag to reorder among
   siblings or onto a page to nest, never into its own subtree (`pageMoveRefusal`). Controls at a limit are disabled
   with a `Tooltip` that says why (`pageAddRefusal`). The footer `TabBar` (`EditorViewFooterBar` in
   `app/document/[id]/editor-view-bars.tsx`) goes, and its tab menu's Import, Export and Lock move to the row menu or
   the page's title bar.
2. **Tab actions in tree terms.** `useTabActions` (`hooks/persistence/useTabActions.ts`): `addTab` takes a parent and
   uses `withPageAdded`; `deleteTab` uses `withPageDeleted` (and its confirmation the count); `duplicateTab` copies
   the page beside the original with the same parent; `reorderTabs` becomes `withPageMoved`. Tab folders
   (`useTabFolders`) are not offered: the tree replaces them.
3. **The page's name follows its title.** A page's title is its writing's Title block. Where `useEditorArticles`
   already names the knowledgebase from the first title (`articleTitleName`), a page whose name is still a default
   (`isDefaultPageName`) or still equals its last title should take the new title in the same commit; Rename in the
   row menu sets the name alone.
4. **The breadcrumb** of `pageAncestors` above the page's title, each a link that selects that page.
5. **On a phone** the tree is a sheet opened from the top bar, built from the workbench sheet pieces; touch targets
   at least 44 px.
6. **Share roles in the tree:** gate every tree action on `can.editPages` in the editor, and ship a test per role
   (Editor, Participant, Viewer) for add, rename, move, duplicate and delete, following
   `docs/instructions/gate-a-feature-by-share-role.md`.
7. **The word "tab"** in the editor's copy becomes "page", and "Document" becomes "Knowledgebase" where a person
   reads the item's noun (about 200 strings in `apps/editor`; the shared dialogs in `packages/` are the platform's).

## Performance and limits

`pageParents` is O(pages x depth); every other function is one pass over the list after it. A full knowledgebase
(500 pages, 8 levels) draws as rows, moves a subtree and is checked in about 1 ms, held under `cpuBudgetMs(150)` by
`page-tree.test.ts`. The sidebar should read `pageTreeRows` once per change of the list (ids, parents, names), never
per row and never on a typing commit, which changes none of them (`sameTabsForBar` already compares tabs without
their writing).

## Testing

`page-tree.test.ts` covers every function and branch of `page-tree.ts`; `validate.test.ts` the tab's `parent`.
`page-tree-store.test.ts` covers the write checks (500 pages, level 8, a cycle, a parent in another document, two
pages trading places, a full knowledgebase within budget); `page-tree-routes.test.ts` the summaries, the metadata
save's parents and both saves' refusals over the api; `page-tree-sync.test.ts` (editor) the placeholders, the save
diff, a peer's list and a resync. Nothing of the tree is drawn yet, so nothing is browser-verified.

## Constants and configuration

| Constant                  | Value | Where          | Why                                                     |
| ------------------------- | ----- | -------------- | ------------------------------------------------------- |
| `MAX_KNOWLEDGEBASE_PAGES` | 500   | `page-tree.ts` | The spec's limit                                        |
| `MAX_PAGE_DEPTH`          | 8     | `page-tree.ts` | The spec's limit: a top-level page is level 1           |
| `PARENT_ID_MAX`           | 128   | `page-tree.ts` | A tab id is a UUID (36); anything far longer is not one |
