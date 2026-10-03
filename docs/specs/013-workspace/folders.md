# Folders

Documents in the Explorer are organised into a tree of folders. Every
document belongs to exactly one folder (or none); folders themselves
can nest under other folders. Documents without an explicit folder
sit at the **root** of their space, listed beside its root folders.

## Motivation

The Explorer's Recent Documents accordion is fine for the last few
documents the user touched, but as the library grows it stops being a
useful surface for "find that document I made three weeks ago". A
single flat list also has no story for users who want to group work
by project / customer / topic.

Folders give a lightweight organisational layer. Nested folders let
people build a "Projects / Customer / Engagement" hierarchy when
they want it; for users who don't, everything sits at the root of
My documents. Expand-on-demand so the Explorer stays compact.

## Scope

In scope:

- A new `folders` table in D1 with a self-referential `parent_id`
  for nesting.
- A nullable `folder_id` column on `documents`.
- REST endpoints to create / rename / delete / move folders, plus a
  move-document-to-folder endpoint.
- Explorer UI: recursive accordion tree under each space. Documents
  without a folder are listed at the space's root, beside its root
  folders, so a freshly created document is in plain sight.
- A per-document-row "Move to folder…" menu item. The picker is a
  centred modal (`MoveToFolderDialog`) around the **shared placement
  browser** — the same two-level space -> folder tile-grid browse as
  the New Document wizard's Save In step ([Offline Mode](../006-document/offline-mode.md),
  `components/placement/PlacementBrowser`), so the product has exactly
  one way to choose where a document lives. Spaces first (My documents +
  each team, [Team shared documents](team-shared-documents.md), on an overview that is shown even when My
  documents is the only space, so the choice is deliberate and the screen has
  room for a create-team option; only team-scoped surfaces skip it and
  open straight inside their team), then the folder drill-down with a
  "here" card at every level, an inline New Folder tile, and a
  BackBar. **The tile creates under the selected destination**: with a
  folder selected it reads "New Subfolder · In <folder>" and the new
  folder lands inside it (the browser then opens that folder so the new
  row is the highlighted one); with the space's root selected it reads
  "New Folder · Create here". So selecting a folder, then the tile, then
  a name is the whole gesture for a nested folder, without drilling in
  first. The New Folder tile's name field commits on Enter OR on
  blur when a name has been typed (mobile keyboards give the
  single-line field no Enter key, so tapping away is the only submit
  gesture there); blurring it empty, or pressing Escape, cancels. The dialog opens with the subject's current placement
  pre-selected ("always something selected"); the "Move here" button
  stays disabled until the choice changes, and double-clicking a
  destination card commits the move in one gesture. Shared by the
  /explorer page, the floating Explorer panel, and the team library —
  and every document-move surface offers every space (My documents + each
  team, [Team shared documents](team-shared-documents.md)), so a document is never trapped in a scope; only folder
  moves stay scoped to their own tree. It replaced the earlier
  filterable indented-tree modal, which itself outgrew an anchored
  popover.

## Explorer routes

Every Explorer section is its own page under `/explorer` (the chrome — header, sidebar tree, mobile drawer — is a shared layout, so the sidebar and its loaded data persist across section navigations):

| Section                                                        | Route                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Home ([Explorer Home](explorer-home.md))                       | `/explorer/home` (default)                                         |
| All activity, the [Timeline](timeline.md) feed                 | `/explorer/timeline` (no sidebar row)                              |
| Activity ([Activity page](activity-page.md))                   | `/explorer/activity`                                               |
| Shared with me                                                 | `/explorer/shared`                                                 |
| Recent documents                                               | `/explorer/recent` (no sidebar row)                                |
| Favourites ([Favourite documents](favourites.md))              | `/explorer/favourites` (no sidebar row)                            |
| My documents, the root of the personal tree                    | `/explorer/all`                                                    |
| Search results ([Explorer filters](explorer-filters.md#views)) | `/explorer/search` (no sidebar row)                                |
| Retired: Unsorted and Dynamic                                  | `/explorer/unsorted`, `/explorer/dynamic`, opening `/explorer/all` |
| Retired: Generated                                             | `/explorer/generated`, opening `/explorer/search?q=made-by:ai`     |
| A folder                                                       | `/explorer/folder?id=<id>`                                         |
| A team ([Teams](teams.md))                                     | `/explorer/team?id=<id>`                                           |
| Invites ([Teams](teams.md))                                    | `/explorer/invites`                                                |
| This browser ([Offline Mode](../006-document/offline-mode.md)) | `/explorer/offline`                                                |
| Image gallery                                                  | `/explorer/images`                                                 |
| Themes                                                         | `/explorer/themes`                                                 |
| Shape libraries ([Shape libraries](shape-libraries.md))        | `/explorer/shape-libraries`                                        |
| Trash ([Trash](trash.md))                                      | `/explorer/trash`                                                  |

`/explorer` itself redirects to `/explorer/home` (worker-level 302 in production, client replace in dev). Folder and team ids ride the **query string**, not a path segment: `output: 'export'` can't enumerate user-minted ids, and the `/document/<id>` placeholder-rewrite workaround ([Dedicated route for new-document creation](../007-editor/new-document-route.md)) is deliberately kept single-purpose. The sidebar's groups, rows, labels and visibility rules are [Explorer structure](explorer-structure.md).

Out of scope (V1):

- Drag-and-drop reordering between folders.
- Shared / collaborative folder ownership — folders are scoped to
  the owner just like documents.
- Per-folder permissions or sharing.
- Folder colour / icon customisation.
- Bulk move (multi-select documents + assign).

## Data model

```
folders
  id          TEXT PRIMARY KEY        -- UUID
  owner_id    TEXT NOT NULL           -- matches diagrams.owner_id
  parent_id   TEXT NULL REFERENCES folders(id) ON DELETE SET NULL
  name        TEXT NOT NULL
  created_at  INTEGER NOT NULL
  updated_at  INTEGER NOT NULL

diagrams
  ...
  folder_id   TEXT NULL REFERENCES folders(id) ON DELETE SET NULL
  source      TEXT NULL   -- provenance: NULL = user-made; 'ai' / 'mcp' = made by AI
```

- `folder_id IS NULL` means the document sits at the root of its space
  (My documents, or its team). The root has no row in the folders
  table, so it can't be renamed or deleted.
- `source` records how the document came to exist (migration 0028): NULL
  for one a person made in the editor; `'mcp'` for one an external AI tool
  created through the MCP server ([MCP server](../015-api/mcp-server.md)); `'ai'` reserved for the
  in-editor AI assistant (no producer today). Set once on create and never
  rewritten by the metadata upsert (rename / autosave / move can't clear
  it). Provenance is a **filter**, not a place: the `made-by:ai` token of
  [Explorer filters](explorer-filters.md) finds AI-made documents wherever
  they are filed.

### The root, and the retired buckets

The root of a space lists its root folders, then its root documents
(`folder_id IS NULL`), newest first, AI-made documents included. The
Explorer once split the personal root into two synthetic buckets,
**Unsorted** (made by a person) and **Generated** (made by AI), under a
**Dynamic** overview. They are gone; their addresses still answer
([Explorer routes](#explorer-routes)), and the **Made by AI** filter
(`made-by:ai`, [Explorer filters](explorer-filters.md)) finds AI-made
documents wherever they are filed.

- `parent_id IS NULL` means the folder is at the tree root.
- Deleting a folder never deletes its contents: they **move up to the
  deleted folder's parent** ([Deleting a folder](#deleting-a-folder)).
  The `ON DELETE SET NULL` on both foreign keys is a backstop only; the
  delete re-parents explicitly before the row goes.
- Folder name uniqueness is **not** enforced — sibling folders can
  share names if the user really wants. The breadcrumb path
  disambiguates them in the move picker.
- The API rejects cycles when moving a folder (a folder can't
  become its own ancestor). Cycle check happens server-side because
  D1 can't enforce it declaratively.

Migration `0007_folders.sql` creates the `folders` table and adds
the `folder_id` column.

### Deleting a folder

- A deleted folder's **direct documents and direct subfolders move to
  its parent**: the folder it sat in, or the root of its space (My
  documents, or the team's root) when it sat at the top. Its subfolders
  keep their own contents, so a whole branch moves up one level intact.
- Documents in the [Trash](trash.md) that were in the folder move with
  the rest, so a later restore lands in the parent.
- **One transaction.** `DELETE /api/folders/:id` re-parents the
  subfolders, re-files the documents, drops the folder's
  [Drive mirror](../022-drive-mirror/drive-mirror.md) row and deletes
  the folder in one D1 batch: either all of it happens or none of it.
  The parent is read inside the batch, so a concurrent move of the
  folder cannot strand its contents under a parent it has left.
- The same rule holds for personal and team folders.
- The delete confirmation names where the contents go: "Its documents
  and subfolders move to <parent>.", <parent> being the parent
  folder's name, "My documents", or "the team's root". When the folder
  is one of the reader's [default folders](default-folders.md), it adds
  the default-folder line ([Deleting a default
  folder](default-folders.md#deleting-a-default-folder)).
- A dangling [default folder](default-folders.md#dangling-defaults) is
  kept; documents created afterwards skip it.
- The api logs `folders: deleted scope=<personal|team> moved_up=<parent|root>`
  for every delete.

## API

All endpoints continue the existing `X-Owner-Id` convention.

| Method | Path                        | Body                                 | Returns                 |
| ------ | --------------------------- | ------------------------------------ | ----------------------- |
| GET    | `/api/folders`              |                                      | `{ folders: Folder[] }` |
| POST   | `/api/folders`              | `{ id, name, parentId? }`            | `{ folder: Folder }`    |
| PUT    | `/api/folders/:id`          | `{ name?, parentId? }` (cycle check) | `{ folder: Folder }`    |
| DELETE | `/api/folders/:id`          |                                      | 204                     |
| PUT    | `/api/documents/:id/folder` | `{ folderId \| null }`               | 204                     |

`Folder` = `{ id, name, parentId, createdAt, updatedAt }`.

`GET /api/documents` is extended to include `folderId` on each row (camelCase DTO; null for the root). No new endpoint needed for "documents in folder X": the Explorer already has the full list client-side.

### Placement on create

A document is placed by the write that creates it. `POST /api/documents` carries the
**placement** beside `id` and `name`: `teamId` (absent or null = My documents, a string =
that team's library) and `folderId` (a string = that folder; `null` = the root of that space,
chosen on purpose; absent = no folder chosen). There is no second placement request
after a create, so a document never exists, even for a moment, in a place the caller did not ask
for.

- **Chosen or not.** A placement is **chosen** when the body names a team or carries the
  `folderId` key at all, `null` included. `folderId: null` with no team is the **explicit root**
  of My documents. A body with neither is **no choice**: the document lands at the root of My
  documents unless a [default folder](default-folders.md) answers for its `intent`. A `teamId: null`
  alone is no choice, like an absent one.

- **Resolution order.** The space first, then the folder: a chosen placement (a folder, or a
  space's root chosen on purpose), else the person's [default folder](default-folders.md) for the
  create's `intent`, else the root of My documents. The resolver (`apps/api/src/placement/`) is an
  ordered list of folder steps (`explicitFolder`, `defaultFolder`), the root answering when none
  does.
- **Defaults.** Only a create that carries an `intent` and whose placement is no choice consults
  the defaults. A dangling default is skipped, never a rejection
  ([Default folders](default-folders.md#dangling-defaults)).
- **Team space.** Only a **verified account id** (a Clerk session or an API token) may place
  into a team, and only when it is a **joined** member of that team. The guest `X-Owner-Id`
  header never counts. A guest, an invited-but-not-joined member, or an unknown team is
  refused with `team_forbidden`.
- **Folder.** The folder must exist and belong to the resolved space: in My documents the
  caller's own personal folder, in a team a folder of that team.
  - A folder that does not exist, or one the caller cannot see (another person's personal
    folder, a folder of a team the caller has not joined), is `folder_not_found`: the answer
    never reveals that someone else's folder exists.
  - A folder the caller can see but in the other space (their own personal folder with a
    `teamId`, a folder of a team they have joined with no or another `teamId`) is
    `folder_scope_mismatch`.
- **Named rejections, never a fallback.** An invalid placement refuses the whole create
  before anything is written: the document is not filed somewhere else instead.

  | Rejection               | Status | When                                                                              |
  | ----------------------- | ------ | --------------------------------------------------------------------------------- |
  | `placement_invalid`     | 400    | `teamId` or `folderId` is neither absent, null nor a string                       |
  | `team_forbidden`        | 403    | A team asked for by a guest or a caller who has not joined                        |
  | `folder_not_found`      | 404    | The folder is missing or invisible to the caller                                  |
  | `folder_scope_mismatch` | 400    | The folder is the caller's to see, but in the other space                         |
  | `intent_invalid`        | 400    | `intent` is present but not `{ mode, tabKind?, templateFamily? }` of known values |

- **One write.** `folder_id` and `team_id` are written by the same `INSERT` that creates the
  row; the caller is the owner, in a team as in My documents.
- **A re-commit keeps its place.** A create naming an id the caller already owns is the editor
  re-committing it: the stored placement stands and the body's placement is not applied
  (moving is `PUT /api/documents/:id/folder`'s job). A malformed placement is still
  `placement_invalid`.
- **One feed event.** A create into a team records one `document_created` event whose
  audience is the team ([Timeline](timeline.md)); there is no separate "Shared with a Team"
  event, because the document was never personal.
- **Observability.** Every decision logs one line with the `placement:` fingerprint:
  `placement: resolved scope=personal|team folder=set|root via=explicit|default|root` (`explicit`
  for any chosen placement, a chosen root included; `root` only when nothing was chosen and no
  default answered; with
  `key=<key>` when a default decided), `placement: default-skipped key=<key> reason=<reason>`,
  `placement: rejected reason=<code> scope=personal|team`, and
  `placement: skipped reason=existing` for a re-commit.

What a caller does with a rejection is its own: the New Document wizard shows it
([Dedicated route for new-document creation](../007-editor/new-document-route.md)), an Offline
Mode sync files the document at the root of My documents on a refused folder, saying so in its log
([Offline Mode](../006-document/offline-mode.md)).

## Explorer UI — two surfaces

Folders show up in two places, and the two surfaces use different
layouts because they're solving different problems.

### Floating Explorer panel (editor + `/new`)

This is the docked side-panel on the editor and the new-document
flow. Space is tight; the user is mid-task; "find this thing fast"
beats "browse my whole library." The panel header carries a single
**⋯** button, left of the help `?`, whose click-open menu of full-width
icon-left rows holds the document's and the app's verbs in three bands
split by separators:

1. **New Document**, **Open Explorer** (the full-page Explorer's Recent
   list, `/explorer/recent`).

The floating panel does not carry the import entry: its header holds only
**⋯** and **?**, and a row of source icons would crowd it. Importing boards
from other tools lives on the full-page Explorer (below). 2. **Share** (owners only, the header Share button's gate) and
**Export** (the active tab, as the tab menu's Export). 3. **Search**, **GitHub** (the open-source repo, new tab), **Licences** (the
third-party licences page, new tab, see
[Third-party licences](../002-project-scope/third-party-licences.md)), **Settings**.

A row whose handler the host doesn't pass is absent, and a band left
empty takes its separator with it (the Explorer behind an error screen
has no document, so no Share / Export). This replaced a **+ New** chip
whose hover-open popover held only band 1, and took GitHub off the
editor's bottom bar, which keeps Search, Settings and the appearance
toggle ([Live app](../007-editor/live-app.md)). The full-page Explorer's bottom bar keeps its GitHub
link.

- A "Current Document" card sits at the top. Beneath it, the panel shows
  the sidebar's three groups, Overview, Spaces and More, built from the
  same rows ([Explorer structure: the floating Explorer panel](explorer-structure.md#the-floating-explorer-panel)).
  In the panel, My documents, each folder and each team expand to show
  their folders, then their documents, as rows; expansion is local state
  (not persisted) and starts collapsed so the panel stays compact.
- A folder with nothing inside shows no expand chevron (its gutter stays,
  so names line up).
- Team folders are the **same folder row** as the personal tree, handed
  a team's rows: same chevron rule, same right-click menu, and team
  document rows play the same slide-out when deleted. What differs is
  data, not markup: team folders take no drag-and-drop, and Show in
  Explorer opens the team page.
- **Right-clicking anywhere on a folder or document row** opens that row's ellipsis menu (suppressing the browser's default context menu), anchored to the row's ellipsis button: the same menu the `⋯` click opens. Applies in both the floating Explorer panel and the full-page `/explorer`, including the page's sidebar folder tree (a no-op while a row is being renamed). Every row and card shares one `useRowMenu` hook and one `EllipsisTriggerButton`, so the trigger always reports `aria-expanded` and, on the panel's hover-revealed rows, stays visible while its menu is open.
- Folder-row ellipsis menu: Rename, New subfolder, Change Folder, Use as default for (the [default folder](default-folders.md#use-as-default-for) submenu), Delete.
- Deleting a document moves it to the [Trash](trash.md) for 30 days. A document restored after its folder was deleted lands in that folder's parent (the folder delete moved it there, [Deleting a folder](#deleting-a-folder)).
  Rename is inline (same pattern as the document-row rename). Delete
  pops a confirmation dialog ("Delete <name>?" naming where the
  contents go, [Deleting a folder](#deleting-a-folder)) via the
  shared `useConfirm` hook. The cascade is genuinely non-destructive
  for the contents, but a folder vanishing without a tap-back is
  startling enough that the confirmation is worth the extra click;
  both the editor and the standalone `/explorer` page wire delete
  through the same prompt.
- Document-row ellipsis menu gains a "Change Folder" sub-action that
  opens the shared placement browser (personal folders + the root,
  and teams with their folders — see the move-picker note above).
  Picking one calls `PUT /api/documents/:id/folder`.
- **Drag-and-drop**: document rows are HTML5-draggable. Drop targets
  are personal folder rows (any nested depth) and the My documents
  row, which files the document at the root. Drag-over highlights the target with a brand-blue ring so
  the user sees where the document will land. Drop fires the same
  `onMoveDocumentToFolder(documentId, targetFolderId)` callback the
  picker uses, so the move travels through the same API path and
  optimistic update. Drag transfer uses a custom MIME type
  (`application/x-livediagram-id`) so dragging a document never
  triggers a browser navigation when dropped outside any target.
- Each folder's own ellipsis offers "New subfolder" so deeper layers
  are reachable; root-level folders are created in the Explorer, or
  from the move picker's New Folder tile.

### Standalone `/explorer` page

This is the full-page library view. Open to both guests and signed-in
users: the owner id resolves the same way every other surface in the
live app does (Clerk userId when signed in, the `livediagram:v2:self-id`
localStorage UUID otherwise), so a guest sees the documents + folders +
Image Gallery their per-browser id owns. AuthControls in the page header
surfaces a "Sign in" CTA for guests who want to upgrade. The page is
modelled on Windows Explorer: a sidebar tree drives navigation, a
breadcrumb + list view on the right shows the focused folder's
contents. A **bottom bar** mirrors the editor's tab-bar strip (minus the
tabs): the shared right-hand control cluster (`ChromeControls` — search,
the open-source GitHub link, Settings, dark-mode toggle). It's sticky so
it stays in view as the dashboard scrolls; Settings opens the same synced
`UserPreferences` dialog the editor uses ([User preferences](../007-editor/user-preferences.md)).

- **Sidebar (left, fixed width):** the navigation tree of [Explorer structure](explorer-structure.md):
  Overview (Home, Activity, Shared with me), Spaces (My documents with
  its root folders beneath it, each team with its
  folders, New team), and More (This browser, Library, Trash). Each folder
  row carries an ellipsis menu with Rename, New subfolder, Change Folder,
  Use as default for ([Default folders](default-folders.md#use-as-default-for)), Delete. The Image gallery (under Library) degrades to an empty state
  when the api worker reports 503, e.g. a self-host without R2.
- **Right pane:**
  - Breadcrumb showing the path from "My documents" through every
    ancestor of the focused folder. Each segment is a button that
    jumps the focus.
  - List view with four columns: Name, Updated, Visibility, action.
    The Visibility column shows a "Shared" badge on documents that
    have an active share link (blank otherwise), and is hidden below
    the mobile breakpoint to keep rows readable. Direct subfolders and
    direct documents render in the same list (Windows Explorer pattern).
    Folder rows open the folder; document rows open the document.
  - "Shared with me" replaces the list with a Role + Updated table
    of accepted shares; each row is a link into the shared document.
  - "Image Gallery" replaces the list with a drop-zone (upload via
    drag, paste, or click) above a grid of thumbnails. Each tile
    shows the file name, dimensions, byte size, a delete action,
    and a "Used in N documents" badge backed by `GET /api/images/usage`
    (see [11-api.md](../015-api/api.md)). The badge expands inline to a
    list of links into those documents so the user can spot
    orphaned bytes that are safe to delete. Upload validation +
    hashing share the editor's path via `apps/live/lib/upload-image.ts`.
- **Import from:** the page header, left of Help, carries a group styled
  like the Help button: the muted label "Import from", then one icon button
  per shipped import source, built from one source list (today
  [Microsoft Whiteboard](../020-import-export/whiteboard-import.md),
  [Excalidraw](../020-import-export/excalidraw-import-export.md) and
  [draw.io](../020-import-export/drawio-import.md), in that order; a
  later source is one entry). The group is a `toolbar` named "Import from"; each
  button shows the source's icon, names itself "Import from <source>", shows
  the source's name in the app's tooltip, takes keyboard focus with a visible
  ring, and opens that source's import. It sits wherever the section offers
  New document, so imported documents land where new ones do (in the focused
  folder, inside a folder section). It is as tall as Help; below the `sm`
  breakpoint the "Import from" label hides first, leaving the icons.
- **Create:** a single floating action button at the bottom-right
  opens a popover with "New document" and "New folder" (or "New
  subfolder" when a folder is focused). The documents-page FAB on the
  editor / new-document routes is unrelated.
- **Move:** documents and folders share the move-to-folder picker.
  For a folder move, the target folder's own subtree is filtered
  out client-side so cycle-creating choices don't appear (the server
  still rejects them via the cycle check on `PUT /api/folders/:id`).
- **Selection state**: the selected sidebar row is the current route;
  which branches are expanded is session-local state that doesn't
  survive reload ([Explorer structure](explorer-structure.md#expansion)).
  Default selection: Home.

Empty states:

- No folders and no documents: My documents shows its empty state.
  With documents but no folders, it lists the documents.

## Non-goals for V1

- Folder-scoped sharing. The folder is an organisational shell for
  the owner; share state remains per-document.
- Bulk move (multi-select documents + assign). One-at-a-time menu
  action for now.
- Persisted expansion state across reloads. V1 always starts
  collapsed for a clean entry point.
