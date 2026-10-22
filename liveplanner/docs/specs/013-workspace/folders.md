# Folders

Projects in the Explorer are organised into a tree of folders. Every
project belongs to exactly one folder (or none); folders themselves
can nest under other folders. Projects without an explicit folder
sit at the **root** of their space, listed beside its root folders.

## Motivation

The Explorer's Recent Projects accordion is fine for the last few
projects the user touched, but as the library grows it stops being a
useful surface for "find that project I made three weeks ago". A
single flat list also has no story for users who want to group work
by project / customer / topic.

Folders give a lightweight organisational layer. Nested folders let
people build a "Projects / Customer / Engagement" hierarchy when
they want it; for users who don't, everything sits at the root of
My Projects. Expand-on-demand so the Explorer stays compact.

## Scope

In scope:

- A new `folders` table in D1 with a self-referential `parent_id`
  for nesting.
- A nullable `folder_id` column on `projects`.
- REST endpoints to create / rename / delete / move folders, plus a
  move-project-to-folder endpoint.
- Explorer UI: recursive accordion tree under each space. Projects
  without a folder are listed at the space's root, beside its root
  folders, so a freshly created project is in plain sight.
- A per-project-row "Move to folder…" menu item. The picker is a
  centred modal (`MoveToFolderDialog`) around the **shared placement
  browser** — the same two-level space -> folder tile-grid browse as
  the New Project wizard's Save In step ([Offline Mode](../006-project/offline-mode.md),
  `components/placement/PlacementBrowser`), so the product has exactly
  one way to choose where a project lives. Spaces first (My Projects +
  each team, [Team shared projects](team-shared-projects.md), on an overview that is shown even when My
  projects is the only space, so the choice is deliberate and the screen has
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
  pre-selected ("always something selected"), at the level that lists it when it is a folder
  ([Save locations](../006-project/save-locations.md), "It opens where its selection is"); the "Move Here" button
  stays disabled until the choice changes, and double-clicking a
  destination card commits the move in one gesture. Shared by the
  /explorer page, the editor's Explorer, and the team library —
  and every project-move surface offers every space (My Projects + each
  team, [Team shared projects](team-shared-projects.md)), so a project is never trapped in a scope; only folder
  moves stay scoped to their own tree. It replaced the earlier
  filterable indented-tree modal, which itself outgrew an anchored
  popover.

## Explorer routes

Every Explorer section is its own page under `/explorer` (the chrome — header, sidebar tree, mobile drawer — is a shared layout, so the sidebar and its loaded data persist across section navigations):

| Section                                                        | Route                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Home ([Explorer Home](explorer-home.md))                       | `/explorer/home` (default)                                         |
| Inbox ([Inbox](inbox.md))                                      | `/explorer/inbox`                                                  |
| Shared With Me                                                 | `/explorer/shared`                                                 |
| Recent projects                                                | `/explorer/recent` (no sidebar row)                                |
| Favourites ([Favourite projects](favourites.md))               | `/explorer/favourites` (no sidebar row)                            |
| My Projects, the root of the personal tree                     | `/explorer/all`                                                    |
| Search results ([Explorer filters](explorer-filters.md#views)) | `/explorer/search` (no sidebar row)                                |
| Retired: Unsorted and Dynamic                                  | `/explorer/unsorted`, `/explorer/dynamic`, opening `/explorer/all` |
| Retired: Generated                                             | `/explorer/generated`, opening `/explorer/search?q=made-by:ai`     |
| Retired: Activity                                              | `/explorer/activity`, opening `/explorer/inbox`                    |
| A folder                                                       | `/explorer/folder?id=<id>`                                         |
| A team ([Teams](teams.md))                                     | `/explorer/team?id=<id>`                                           |
| Invites ([Teams](teams.md))                                    | `/explorer/invites`                                                |
| This Browser ([Offline Mode](../006-project/offline-mode.md))  | `/explorer/offline`                                                |
| Themes                                                         | `/explorer/themes`                                                 |
| Trash ([Trash](trash.md))                                      | `/explorer/trash`                                                  |

A retired address replaces itself with its successor, so links already out there keep working, and the sidebar highlights the successor's row at once; the Inbox was once called Activity, hence `/explorer/activity`. `/explorer` itself redirects to `/explorer/home` (worker-level 302 in production, client replace in dev). Folder and team ids ride the **query string**, not a path segment: `output: 'export'` can't enumerate user-minted ids, and the `/project/<id>` placeholder-rewrite workaround ([Dedicated route for new-project creation](../007-editor/new-project-route.md)) is deliberately kept single-purpose. The sidebar's groups, rows, labels and visibility rules are [Explorer structure](explorer-structure.md).

Out of scope (V1):

- Drag-and-drop reordering between folders.
- Shared / collaborative folder ownership — folders are scoped to
  the owner just like projects.
- Per-folder permissions or sharing.
- Folder colour / icon customisation.
- Bulk move (multi-select projects + assign).

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
  source      TEXT NULL   -- provenance: NULL = user-made; 'mcp' = made by AI; 'cli' = the CLI
```

- `folder_id IS NULL` means the project sits at the root of its space
  (My Projects, or its team). The root has no row in the folders
  table, so it can't be renamed or deleted.
- `source` records how the project came to exist: NULL
  for one a person made in the editor; `'mcp'` for one an external AI tool
  created through the MCP server ([MCP server](../015-api/mcp-server.md)); `'cli'` for one the [CLI](../015-api/cli.md) created, which
  is a front door for scripts as much as for agents and so does not count as Made by AI
  (`isMadeByAiSource`). Set once on create and never
  rewritten by the metadata upsert (rename / autosave / move can't clear
  it). Provenance is a **filter**, not a place: the `made-by:ai` token of
  [Explorer filters](explorer-filters.md) finds AI-made projects wherever
  they are filed.

### The root, and the retired buckets

The root of a space lists its root folders, then its root projects
(`folder_id IS NULL`), newest first, AI-made projects included. The
Explorer once split the personal root into two synthetic buckets,
**Unsorted** (made by a person) and **Generated** (made by AI), under a
**Dynamic** overview. They are gone; their addresses still answer
([Explorer routes](#explorer-routes)), and the **Made by AI** filter
(`made-by:ai`, [Explorer filters](explorer-filters.md)) finds AI-made
projects wherever they are filed.

- `parent_id IS NULL` means the folder is at the tree root.
- Deleting a folder never deletes its contents: they **move up to the
  deleted folder's parent** ([Deleting a folder](#deleting-a-folder)).
  The `ON DELETE SET NULL` on both foreign keys is a backstop only; the
  delete re-parents explicitly before the row goes.
- Folder name uniqueness is **not** enforced — sibling folders can
  share names if the user really wants. The breadcrumb path
  disambiguates them in the move picker.
- The API rejects cycles when moving a folder (a folder can't
  become its own ancestor) with `409 cycle`. Cycle check happens server-side because
  D1 can't enforce it declaratively. It runs **inside the move's own
  UPDATE** (a recursive walk over the new parent's ancestors), so two
  crossing moves (A into B while B moves into A) can never both pass a
  check made before either wrote. A new parent deleted meanwhile is
  refused the same way.
- Folder names are non-empty strings of at most `MAX_NAME_LEN`
  characters; a missing, empty or non-string `name` (or a non-string
  `id` / `parentId` / `teamId`) is `400` before anything is written.
- Filing a project (`PUT /api/projects/:id/folder`) checks the
  folder's existence and scope inside the same UPDATE that files it, so
  a folder deleted after the route's own read files nothing and the
  move answers `404`.

The baseline migration (`apps/api/migrations/0001_liveplanner_baseline.sql`) creates the `folders`
table and the `folder_id` column.

### Deleting a folder

- A deleted folder's **direct projects and direct subfolders move to
  its parent**: the folder it sat in, or the root of its space (My
  projects, or the team's root) when it sat at the top. Its subfolders
  keep their own contents, so a whole branch moves up one level intact.
- Projects in the [Trash](trash.md) that were in the folder move with
  the rest, so a later restore lands in the parent.
- **One transaction.** `DELETE /api/folders/:id` re-parents the
  subfolders, re-files the projects and deletes
  the folder in one D1 batch: either all of it happens or none of it.
  The parent is read inside the batch, so a concurrent move of the
  folder cannot strand its contents under a parent it has left.
- The same rule holds for personal and team folders.
- The delete confirmation names where the contents go: "Its projects
  and subfolders move to <parent>.", <parent> being the parent
  folder's name, "My Projects", or "the team's root". When the folder
  is one of the reader's [default folders](default-folders.md), it adds
  the default-folder line ([Deleting a default
  folder](default-folders.md#deleting-a-default-folder)).
- A dangling [default folder](default-folders.md#dangling-defaults) is
  kept; projects created afterwards skip it.
- The api logs `folders: deleted scope=<personal|team> moved_up=<parent|root>`
  for every delete.

## API

All endpoints continue the existing `X-Owner-Id` convention.

| Method | Path                       | Body                                 | Returns                 |
| ------ | -------------------------- | ------------------------------------ | ----------------------- |
| GET    | `/api/folders`             |                                      | `{ folders: Folder[] }` |
| POST   | `/api/folders`             | `{ id, name, parentId? }`            | `{ folder: Folder }`    |
| PUT    | `/api/folders/:id`         | `{ name?, parentId? }` (cycle check) | `{ folder: Folder }`    |
| DELETE | `/api/folders/:id`         |                                      | 204                     |
| PUT    | `/api/projects/:id/folder` | `{ folderId \| null }`               | 204                     |

`Folder` = `{ id, name, parentId, createdAt, updatedAt }`.

`GET /api/projects` is extended to include `folderId` on each row (camelCase DTO; null for the root). No new endpoint needed for "projects in folder X": the Explorer already has the full list client-side.

### Placement on create

A project is placed by the write that creates it. `POST /api/projects` carries the
**placement** beside `id` and `name`: `teamId` (absent or null = My Projects, a string =
that team's library) and `folderId` (a string = that folder; `null` = the root of that space,
chosen on purpose; absent = no folder chosen). There is no second placement request
after a create, so a project never exists, even for a moment, in a place the caller did not ask
for.

- **Chosen or not.** A placement is **chosen** when the body names a team or carries the
  `folderId` key at all, `null` included. `folderId: null` with no team is the **explicit root**
  of My Projects. A body with neither is **no choice**: the project lands at the root of My
  projects unless a [default folder](default-folders.md) answers for its `intent`. A `teamId: null`
  alone is no choice, like an absent one.

- **Resolution order.** The space first, then the folder: a chosen placement (a folder, or a
  space's root chosen on purpose), else the person's [default folder](default-folders.md) for the
  create's `intent`, else the root of My Projects. The resolver (`apps/api/src/placement/`) is an
  ordered list of folder steps (`explicitFolder`, `defaultFolder`), the root answering when none
  does.
- **Defaults.** Only a create that carries an `intent` and whose placement is no choice consults
  the defaults. A dangling default is skipped, never a rejection
  ([Default folders](default-folders.md#dangling-defaults)).
- **Team space.** Only a **verified account id** (a signed-in session or an API token) may place
  into a team, and only when it is a **joined** member of that team. The guest `X-Owner-Id`
  header never counts. A guest, an invited-but-not-joined member, or an unknown team is
  refused with `team_forbidden`.
- **Folder.** The folder must exist and belong to the resolved space: in My Projects the
  caller's own personal folder, in a team a folder of that team.
  - A folder that does not exist, or one the caller cannot see (another person's personal
    folder, a folder of a team the caller has not joined), is `folder_not_found`: the answer
    never reveals that someone else's folder exists.
  - A folder the caller can see but in the other space (their own personal folder with a
    `teamId`, a folder of a team they have joined with no or another `teamId`) is
    `folder_scope_mismatch`.
- **Named rejections, never a fallback.** An invalid placement refuses the whole create
  before anything is written: the project is not filed somewhere else instead.

  | Rejection               | Status | When                                                                              |
  | ----------------------- | ------ | --------------------------------------------------------------------------------- |
  | `placement_invalid`     | 400    | `teamId` or `folderId` is neither absent, null nor a string                       |
  | `team_forbidden`        | 403    | A team asked for by a guest or a caller who has not joined                        |
  | `folder_not_found`      | 404    | The folder is missing or invisible to the caller                                  |
  | `folder_scope_mismatch` | 400    | The folder is the caller's to see, but in the other space                         |
  | `intent_invalid`        | 400    | `intent` is present but not `{ mode, tabKind?, templateFamily? }` of known values |

- **One write.** `folder_id` and `team_id` are written by the same `INSERT` that creates the
  row; the caller is the owner, in a team as in My Projects.
- **A re-commit keeps its place.** A create naming an id the caller already owns is the editor
  re-committing it: the stored placement stands and the body's placement is not applied
  (moving is `PUT /api/projects/:id/folder`'s job). A malformed placement is still
  `placement_invalid`.
- **One feed event.** A create into a team records one `project_created` event whose
  audience is the team ([Timeline](timeline.md)); there is no separate "Shared with a Team"
  event, because the project was never personal.
- **Observability.** Every decision logs one line with the `placement:` fingerprint:
  `placement: resolved scope=personal|team folder=set|root via=explicit|default|root` (`explicit`
  for any chosen placement, a chosen root included; `root` only when nothing was chosen and no
  default answered; with
  `key=<key>` when a default decided), `placement: default-skipped key=<key> reason=<reason>`,
  `placement: rejected reason=<code> scope=personal|team`, and
  `placement: skipped reason=existing` for a re-commit.

What a caller does with a rejection is its own: the New Project wizard shows it
([Dedicated route for new-project creation](../007-editor/new-project-route.md)), an Offline
Mode sync files the project at the root of My Projects on a refused folder, saying so in its log
([Offline Mode](../006-project/offline-mode.md)).

## Explorer UI — two surfaces

Folders show up in two places, and the two surfaces use different
layouts because they're solving different problems.

### The editor's Explorer (editor + `/new`)

This is the Explorer the editor's menu button opens as a popover
([Toolbar layout](../007-editor/toolbar-layout.md)), a stand-alone corner panel on the status screens: a rail of
sections beside a pane that shows the picked one, so the whole library is browsable without leaving the project
([Explorer structure: the editor's Explorer](explorer-structure.md#the-editors-explorer)). The panel header carries a single
**⋯** button, left of the help `?`, whose click-open menu of full-width
icon-left rows holds the project's and the app's verbs in three bands
split by separators:

1. **New Project**, **Open Explorer** (the full-page Explorer's Recent
   list, `/explorer/recent`).

The panel does not carry the import entry: its header holds only
**⋯** and **?**, and a row of source icons would crowd it. Importing boards
from other tools lives on the full-page Explorer (below). 2. **Share** (the owner, or any joined member of a team project's team: the header Share button's gate) and
**Export** (the active tab, as the tab menu's Export). 3. **Search**, **Licences** (the
third-party licences page, new tab, see
[Third-party licences](../002-project-scope/third-party-licences.md)), **Settings**.

A row whose handler the host doesn't pass is absent, and a band left
empty takes its separator with it (the Explorer behind an error screen
has no project, so no Share / Export). This replaced a **+ New** chip
whose hover-open popover held only band 1. The
editor's bottom bar keeps Search, Settings and the appearance
toggle ([Editor app](../007-editor/editor-app.md)). Neither carries a link to the source code: it is not public.

- A "Current Project" card sits at the top. Beneath it, the panel shows
  the sidebar's three groups, Overview, Spaces and More, built from the
  same rows ([Explorer structure: the editor's Explorer](explorer-structure.md#the-editors-explorer)).
  In the panel, My Projects, each folder and each team expand to show
  their folders, then their projects, as rows; expansion is local state
  (not persisted) and starts collapsed so the panel stays compact.
- A folder with nothing inside shows no expand chevron (its gutter stays,
  so names line up).
- Team folders are the **same folder row** as the personal tree, handed
  a team's rows: same chevron rule, same right-click menu, and team
  project rows play the same slide-out when deleted. What differs is
  data, not markup: team folders take no drag-and-drop, and Show in
  Explorer opens the team page.
- **Right-clicking anywhere on a folder or project row** opens that row's ellipsis menu (suppressing the browser's default context menu), anchored to the row's ellipsis button: the same menu the `⋯` click opens. Applies in both the editor's Explorer and the full-page `/explorer`, including the page's sidebar folder tree (a no-op while a row is being renamed). Every row and card shares one `useRowMenu` hook and one `EllipsisTriggerButton`, so the trigger always reports `aria-expanded` and, on the panel's hover-revealed rows, stays visible while its menu is open.
- Folder-row ellipsis menu: Rename, New subfolder, Change Folder, Use as Default for (the [default folder](default-folders.md#use-as-default-for) submenu), Delete.
- Deleting a project moves it to the [Trash](trash.md) for 30 days. A project restored after its folder was deleted lands in that folder's parent (the folder delete moved it there, [Deleting a folder](#deleting-a-folder)).
  Rename is inline (same pattern as the project-row rename). Delete
  pops a confirmation dialog ("Delete <name>?" naming where the
  contents go, [Deleting a folder](#deleting-a-folder)) via the
  shared `useConfirm` hook. The cascade is genuinely non-destructive
  for the contents, but a folder vanishing without a tap-back is
  startling enough that the confirmation is worth the extra click;
  both the editor and the standalone `/explorer` page wire delete
  through the same prompt.
- Project-row ellipsis menu gains a "Change Folder" sub-action that
  opens the shared placement browser (personal folders + the root,
  and teams with their folders — see the move-picker note above).
  Picking one calls `PUT /api/projects/:id/folder`.
- **Drag-and-drop**: project rows are HTML5-draggable. Drop targets
  are personal folder rows (any nested depth) and the My Projects
  row, which files the project at the root. Drag-over highlights the target with a brand-blue ring so
  the user sees where the project will land. Drop fires the same
  `onMoveProjectToFolder(projectId, targetFolderId)` callback the
  picker uses, so the move travels through the same API path and
  optimistic update. Drag transfer uses a custom MIME type
  (`application/x-liveplanner-id`) so dragging a project never
  triggers a browser navigation when dropped outside any target.
  The editor's Explorer floats over the canvas, so the canvas's own drop
  handling stands aside for a drag a target inside it has already
  accepted; otherwise its "dropped back on a panel" guard would turn the
  folder's accepted move into a no-drop (`usePaletteDrop`).
  On the Explorer page a project, or one of the reader's own folders, can also be dragged onto the sidebar's
  **Trash** row to delete it ([Explorer structure: Dragging to the Trash](explorer-structure.md#dragging-to-the-trash)).
  **Resting a drag on a row with a chevron** for 800 ms
  (`DRAG_HOVER_TOGGLE_MS`) opens it, so a project reaches a subfolder in
  one gesture; resting on an open row closes it. One rest toggles once:
  the row toggles again only after the drag has left it and come back.
  A drag passing over a row never toggles it.
- Each folder's own ellipsis offers "New subfolder" so deeper layers
  are reachable; root-level folders are created in the Explorer, or
  from the move picker's New Folder tile.

### Standalone `/explorer` page

This is the full-page library view. Open to both guests and signed-in
users: the owner id resolves the same way every other surface in the
editor app does (the account userId when signed in, the `liveplanner:v2:self-id`
localStorage UUID otherwise), so a guest sees the projects + folders
their per-browser id owns. AuthControls in the page header
surfaces a "Sign in" CTA for guests who want to upgrade. The page is
modelled on Windows Explorer: a sidebar tree drives navigation, a
breadcrumb + list view on the right shows the focused folder's
contents. A **bottom bar** mirrors the editor's tab-bar strip (minus the
tabs): the shared right-hand control cluster (`ChromeControls` — search,
Settings, dark-mode toggle). It's sticky so
it stays in view as the dashboard scrolls; Settings opens the same synced
`UserPreferences` dialog the editor uses ([User preferences](../007-editor/user-preferences.md)).

- **Sidebar (left, fixed width):** the navigation tree of [Explorer structure](explorer-structure.md):
  Overview (Home, Inbox, Shared With Me), Spaces (My Projects with
  its root folders beneath it, each team with its
  folders, New Team), and More (This Browser, Tags, Library, Trash). Each folder
  row carries an ellipsis menu with Rename, New subfolder, Change Folder,
  Use as Default for ([Default folders](default-folders.md#use-as-default-for)), Delete.
- **Right pane:**
  - Breadcrumb showing the path from "My Projects" through every
    ancestor of the focused folder. Each segment is a button that
    jumps the focus.
  - List view with four columns: Name, Updated, Visibility, action.
    The Visibility column shows a "Shared" badge on projects that
    have an active share link (blank otherwise), and is hidden below
    the mobile breakpoint to keep rows readable. Direct subfolders and
    direct projects render in the same list (Windows Explorer pattern).
    Folder rows open the folder; project rows open the project.
  - "Shared With Me" replaces the list with a Role + Updated table
    of accepted shares; each row is a link into the shared project.
- **Create:** a single floating action button at the bottom-right
  opens a popover with "New Project" and "New folder" (or "New
  subfolder" when a folder is focused). The projects-page FAB on the
  editor / new-project routes is unrelated.
- **Drag-and-drop:** any project the reader can move (their own, a
  team's, one in this browser) drags from its list row or card; a
  project shared with them does not, nor one being renamed. It drops on
  a sidebar folder, My Projects (the root), a team or team folder, or a
  folder row or card in the pane. The drop takes the move picker's path
  (`moveProjectTo`), so it moves within a space or across spaces exactly
  as a pick does, with the same toast, rollback and telemetry. Dropping
  on the place the project already is does nothing. A project in this
  browser shows no drop on a team (the team's library is server-side).
  The target wears the brand-blue ring while the drag is over it, and
  sidebar rows open and close on a resting drag as in the editor's
  Explorer (above). The page logs `[explorer-drop] <move|already-there|refused-local-only>`
  for every drop.
- **Move:** projects and folders share the move-to-folder picker.
  For a folder move, the target folder's own subtree is filtered
  out client-side so cycle-creating choices don't appear (the server
  still rejects them via the cycle check on `PUT /api/folders/:id`).
- **A move that fails says so.** Every move the picker or a drop starts
  either lands or ends in an error toast; none fails silently. A move that
  took the row away first puts it back.
  - Each names the project or folder it failed on, quoted and cut to fit
    ([Toasts](../004-interface-design/toasts.md#naming-what-it-acted-on));
    "the project" / "the folder" stands in for a blank or unknown name.
  - A project into a folder of My Projects: the row goes back to its
    folder; "Could not move “Roadmap”. Try again."
  - A project into a team: the row comes back to My Projects; "Couldn’t
    move “Roadmap” to the team. Try again."
  - A team project to another folder of its team: "Could not move
    “Roadmap”. Try again."
  - A team project out of its team, to My Projects or another team:
    "Couldn’t move “Roadmap” out of the team. Try again."
  - A folder under another folder: "Could not move “Plans”. Try again."
  - A folder made from the picker's New Folder tile: "Could not create
    “Plans”. Try again.", the tile keeping the name typed.
  - Each failure logs
    `[explorer-move] <project|project-to-team|team-project|team-project-out|folder|new-folder> failed`
    with the subject's id and the error.
- **A write that fails says so.** The same holds for every other folder and
  project write the Explorer page, the editor's Explorer panel and a team's
  library make: it lands or ends in an error toast, and a change shown at
  once is put back. One wording per verb (`lib/write-failure-copy.ts`), each
  naming its subject, so a failure reads the same wherever it happened:
  - A new folder (New Folder, New Subfolder, a picker's New Folder tile in
    any scope): "Could not create “New folder”. Try again."
  - A folder rename: "Could not rename “Plans”. Try again.", the
    old name back.
  - A folder delete: "Could not delete “Plans”. Try again."
  - A project's rename: "Could not rename “Roadmap”. Try again."; its
    duplicate: "Could not duplicate “Roadmap”. Try again."
  - Within a team's library, a folder or project move says what the
    Explorer's own moves say (above), with the same log line.
  - Each other failure logs `[folders] <verb> failed`,
    `[team-folders] <verb> failed` or `[team-library] <what> failed` with
    the error. These used to fail silently: a New Folder that did nothing, a
    rename that snapped back.
- **Selection state**: the selected sidebar row is the current route;
  which branches are expanded is session-local state that doesn't
  survive reload ([Explorer structure](explorer-structure.md#expansion)).
  Default selection: Home.

Empty states:

- No folders and no projects: My Projects shows its empty state.
  With projects but no folders, it lists the projects.

## Non-goals for V1

- Folder-scoped sharing. The folder is an organisational shell for
  the owner; share state remains per-project.
- Bulk move (multi-select projects + assign). One-at-a-time menu
  action for now.
- Persisted expansion state across reloads. V1 always starts
  collapsed for a clean entry point.
