# Page tree blueprint

Derived from [Knowledgebases and pages](../knowledgebases-and-pages.md) "A knowledgebase", "The page tree" and "Share
roles". **Built so far: the model** (`Tab.parent`, its reading and validation, the limits, and the pure tree
functions). **Not built: storage of the tree in the tab summaries, the room's check, the sidebar, the breadcrumb, the
phone sheet and the share-role change.** The sections below say which is which; "Not built" is the work left, written
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

## Not built

Each item names the files it touches.

1. **The tree in the tab summaries.** The editor loads a tab's body lazily, so the tree must be drawable from the
   summaries alone. `parent` is stored in the tab's body (the `data` JSON), so the outline query in
   `apps/api/src/document-room/document-content.ts` (`readDocumentOutline`, the `'' AS data` select) needs
   `json_extract(t.data, '$.parent') AS parent`, `TabRow` and `rowToTabSummary` (`apps/api/src/tab-row.ts`) need the
   field, as does `TabSummary` (`packages/api-schema/src/index.ts`), then `corepack pnpm run gen:openapi`. In the
   editor, `placeholdersFromSummaries` (`app/document/[id]/editor-page-helpers.ts`) and `resync-tab-list.ts` carry it
   onto the placeholder tab, as they carry `folder`.
2. **Sync.** `parent` is an ordinary tab field, so `tabBroadcastOps` already sends it in a `tab-meta` patch and
   `room-op-apply.ts` spreads it over a placeholder. A move also reorders the list, which the document-meta save
   already carries. Verify a move by a peer who has not loaded the moved tab, and that the tab autosave of an
   unloaded placeholder never writes a body without its `parent`.
3. **The room's check.** `gateClientOp` (`apps/api/src/room-op-gate.ts`) already lets only an Editor relay `tab-meta`
   and `tab` ops, so every tree change is Editor only in the room. Still to add: a refusal, beside
   `refusesElementOp` in `document-room/document-room-frames.ts`, for a `tab-meta` or `tab` op whose `parent` would
   fail `pageTreeRefusal` or be cut by `pageParents` (read the ids and parents with the room's synchronous
   `state.storage.sql`), and for a new tab past `MAX_KNOWLEDGEBASE_PAGES`; the same check in the tab write route
   (`routes/tab-put-route.ts`) and the changeset path that makes a tab.
4. **A Participant no longer writes.** The spec's table gives writing to an Editor only. Today a Participant's
   `article` frame goes through the participant writing rule (`participant-article` in `room-op-gate.ts`) and the
   editor lets them type (`editable = canEdit || canWrite` in `hooks/editor/useArticles.ts`). Both need to become
   Editor only, with the role tests in `room-op-gate.test.ts` and `lib/editor-capabilities` changed to match.
5. **The sidebar,** replacing the tab bar. The slot exists: `useContentsChrome` (`components/canvas/`) answers
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
6. **Tab actions in tree terms.** `useTabActions` (`hooks/persistence/useTabActions.ts`): `addTab` takes a parent and
   uses `withPageAdded`; `deleteTab` uses `withPageDeleted` (and its confirmation the count); `duplicateTab` copies
   the page beside the original with the same parent; `reorderTabs` becomes `withPageMoved`. Tab folders
   (`useTabFolders`) are not offered: the tree replaces them.
7. **The page's name follows its title.** A page's title is its writing's Title block. Where `useEditorArticles`
   already names the knowledgebase from the first title (`articleTitleName`), a page whose name is still a default
   (`isDefaultPageName`) or still equals its last title should take the new title in the same commit; Rename in the
   row menu sets the name alone.
8. **The breadcrumb** of `pageAncestors` above the page's title, each a link that selects that page.
9. **On a phone** the tree is a sheet opened from the top bar, built from the workbench sheet pieces; touch targets
   at least 44 px.
10. **Share roles:** gate every tree action on `can` in the editor, and ship a test per role (Editor, Participant,
    Viewer) for add, rename, move, duplicate and delete, following
    `docs/instructions/gate-a-feature-by-share-role.md`.
11. **The word "tab"** in the editor's copy becomes "page", and "Document" becomes "Knowledgebase" where a person
    reads the item's noun (about 200 strings in `apps/editor`; the shared dialogs in `packages/` are the platform's).

## Performance and limits

`pageParents` is O(pages x depth); every other function is one pass over the list after it. A full knowledgebase
(500 pages, 8 levels) draws as rows, moves a subtree and is checked in about 1 ms, held under `cpuBudgetMs(150)` by
`page-tree.test.ts`. The sidebar should read `pageTreeRows` once per change of the list (ids, parents, names), never
per row and never on a typing commit, which changes none of them (`sameTabsForBar` already compares tabs without
their writing).

## Testing

`page-tree.test.ts` covers every function and branch of `page-tree.ts`; `validate.test.ts` the tab's `parent`.
Nothing of the tree is drawn yet, so nothing is browser-verified.

## Constants and configuration

| Constant                  | Value | Where          | Why                                                     |
| ------------------------- | ----- | -------------- | ------------------------------------------------------- |
| `MAX_KNOWLEDGEBASE_PAGES` | 500   | `page-tree.ts` | The spec's limit                                        |
| `MAX_PAGE_DEPTH`          | 8     | `page-tree.ts` | The spec's limit: a top-level page is level 1           |
| `PARENT_ID_MAX`           | 128   | `page-tree.ts` | A tab id is a UUID (36); anything far longer is not one |
