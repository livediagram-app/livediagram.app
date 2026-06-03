# Folders

Diagrams in the Explorer are organised into a tree of folders. Every
diagram belongs to exactly one folder (or none); folders themselves
can nest under other folders. Diagrams without an explicit folder
land in a conceptual default called **Unsorted**.

## Motivation

The Explorer's Recent Diagrams accordion is fine for the last few
diagrams the user touched, but as the library grows it stops being a
useful surface for "find that diagram I made three weeks ago". A
single flat list also has no story for users who want to group work
by project / customer / topic.

Folders give a lightweight organisational layer. Nested folders let
people build a "Projects / Customer / Engagement" hierarchy when
they want it; for users who don't, everything sits at the top level
under Unsorted. Expand-on-demand so the Explorer stays compact.

## Scope

In scope:

- A new `folders` table in D1 with a self-referential `parent_id`
  for nesting.
- A nullable `folder_id` column on `diagrams`.
- REST endpoints to create / rename / delete / move folders, plus a
  move-diagram-to-folder endpoint.
- Explorer UI: recursive accordion tree under a "Folders" section.
  Diagrams without a folder render under a synthetic "Unsorted"
  section that's always present (so freshly-created diagrams have
  somewhere obvious to be).
- A per-diagram-row "Move to folder…" menu item; the picker shows a
  flat list of every folder by breadcrumb path (`Marketing / Q3`)
  - Unsorted.

Out of scope (V1):

- Drag-and-drop reordering between folders.
- Shared / collaborative folder ownership — folders are scoped to
  the owner just like diagrams.
- Per-folder permissions or sharing.
- Folder colour / icon customisation.
- Bulk move (multi-select diagrams + assign).

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
```

- `folder_id IS NULL` means the diagram is in Unsorted. Unsorted has
  no row in the folders table — it's a virtual bucket so users can't
  accidentally delete it.
- `parent_id IS NULL` means the folder is at the tree root.
- `ON DELETE SET NULL` on both `parent_id` and `folder_id`: deleting
  a folder doesn't delete its contents. Direct subfolders become
  root-level; direct diagrams fall to Unsorted. Grandchildren keep
  their existing parents (they were never pointing at the deleted
  folder).
- Folder name uniqueness is **not** enforced — sibling folders can
  share names if the user really wants. The breadcrumb path
  disambiguates them in the move picker.
- The API rejects cycles when moving a folder (a folder can't
  become its own ancestor). Cycle check happens server-side because
  D1 can't enforce it declaratively.

Migration `0007_folders.sql` creates the `folders` table and adds
the `folder_id` column.

## API

All endpoints continue the existing `X-Owner-Id` convention.

| Method | Path                       | Body                                 | Returns    |
| ------ | -------------------------- | ------------------------------------ | ---------- |
| GET    | `/api/folders`             | —                                    | `Folder[]` |
| POST   | `/api/folders`             | `{ id, name, parentId? }`            | `Folder`   |
| PUT    | `/api/folders/:id`         | `{ name?, parentId? }` (cycle check) | `Folder`   |
| DELETE | `/api/folders/:id`         | —                                    | 204        |
| PUT    | `/api/diagrams/:id/folder` | `{ folderId \| null }`               | 204        |

`Folder` = `{ id, name, parentId, createdAt, updatedAt }`.

`GET /api/diagrams` is extended to include `folder_id` on each row
(null for Unsorted). No new endpoint needed for "diagrams in folder
X" — the Explorer already has the full list client-side.

## Explorer UI — two surfaces

Folders show up in two places, and the two surfaces use different
layouts because they're solving different problems.

### Floating Explorer panel (editor + `/new`)

This is the docked side-panel on the editor and the new-diagram
flow. Space is tight; the user is mid-task; "find this thing fast"
beats "browse my whole library."

- The existing "Current Diagram" and "Recent Diagrams" sections stay
  unchanged at the top.
- A new "Folders" accordion sits below Recents. Its badge shows the
  total number of user folders (does not include Unsorted).
- Inside the Folders section: a recursive tree. The root level
  contains every folder where `parent_id IS NULL`, plus the
  synthetic Unsorted bucket. Each folder is itself an accordion;
  expanding it reveals child folders and any diagrams directly in
  that folder. Expansion state lives in the Explorer's local state
  (not persisted) so reloads start collapsed and the panel stays
  compact.
- Each folder row shows the folder name + a count badge for the
  combined number of direct children (folders + diagrams).
- Folder-row ellipsis menu: Rename, Delete, "Move to folder…".
  Rename is inline (same pattern as the diagram-row rename). Delete
  pops a confirmation dialog ("Delete this folder?" with the
  cascade rules in the body: diagrams inside move to Unsorted,
  subfolders promote to root, the folder row itself goes) via the
  shared `useConfirm` hook. The cascade is genuinely non-destructive
  for the contents, but a folder vanishing without a tap-back is
  startling enough that the confirmation is worth the extra click;
  both the editor and the standalone `/explorer` page wire delete
  through the same prompt.
- Diagram-row ellipsis menu gains a "Move to folder…" sub-action
  that lists every folder by breadcrumb path + Unsorted as choices.
  Picking one calls `PUT /api/diagrams/:id/folder`.
- **Drag-and-drop**: diagram rows are HTML5-draggable. Drop targets
  are folder headers (any nested depth) and the synthetic Unsorted
  header. Drag-over highlights the target with a brand-blue ring so
  the user sees where the diagram will land. Drop fires the same
  `onMoveDiagramToFolder(diagramId, targetFolderId)` callback the
  picker uses, so the move travels through the same API path and
  optimistic update. Drag transfer uses a custom MIME type
  (`application/x-livediagram-id`) so dragging a diagram never
  triggers a browser navigation when dropped outside any target.
- A "New folder" button sits at the top of the Folders section
  and creates root-level folders. Each folder's own ellipsis offers
  "New subfolder" so deeper layers are reachable.

### Standalone `/explorer` page

This is the full-page library view. Open to both guests and signed-in
users: the owner id resolves the same way every other surface in the
live app does (Clerk userId when signed in, the `livediagram:v2:self-id`
localStorage UUID otherwise), so a guest sees the diagrams + folders +
Image Gallery their per-browser id owns. AuthControls in the page header
surfaces a "Sign in" CTA for guests who want to upgrade. The page is
modelled on Windows Explorer: a sidebar tree drives navigation, a
breadcrumb + list view on the right shows the focused folder's
contents.

- **Sidebar (left, fixed width):**
  - "Recent" — virtual entry, last N most-recently-saved diagrams.
  - "All diagrams" — the root. Children of the root render below it
    as a recursive tree with chevron expand/collapse and indented
    nesting. Each folder row carries an ellipsis menu with Rename,
    New subfolder, Move to folder, Delete.
  - "Image Gallery" (under a "Library" section heading) — virtual
    entry that opens the per-owner image gallery on the right
    pane. Always present (the section behind it degrades to an
    empty state when the api worker reports 503, e.g. a self-host
    without R2).
  - "Shared with me" — virtual entry, only present when the user
    has at least one accepted share.
- **Right pane:**
  - Breadcrumb showing the path from "All diagrams" through every
    ancestor of the focused folder. Each segment is a button that
    jumps the focus.
  - List view with three columns: Name, Updated, action. Direct
    subfolders and direct diagrams render in the same list (Windows
    Explorer pattern). Folder rows open the folder; diagram rows
    open the diagram.
  - "Shared with me" replaces the list with a Role + Updated table
    of accepted shares; each row is a link into the shared diagram.
  - "Image Gallery" replaces the list with a drop-zone (upload via
    drag, paste, or click) above a grid of thumbnails. Each tile
    shows the file name, dimensions, byte size, a delete action,
    and a "Used in N diagrams" badge backed by `GET /api/images/usage`
    (see [11-api.md](11-api.md)). The badge expands inline to a
    list of links into those diagrams so the user can spot
    orphaned bytes that are safe to delete. Upload validation +
    hashing share the editor's path via `apps/live/lib/upload-image.ts`.
- **Create:** a single floating action button at the bottom-right
  opens a popover with "New diagram" and "New folder" (or "New
  subfolder" when a folder is focused). The diagrams-page FAB on the
  editor / new-diagram routes is unrelated.
- **Move:** diagrams and folders share the move-to-folder picker.
  For a folder move, the target folder's own subtree is filtered
  out client-side so cycle-creating choices don't appear (the server
  still rejects them via the cycle check on `PUT /api/folders/:id`).
- **Selection state** (which sidebar node is focused, which
  branches are expanded) is local React state — it doesn't survive
  reload. Default selection: "All diagrams".

Empty states:

- No folders → the Folders accordion shows the "New folder" button
  and Unsorted (with everything in it). User folders only appear
  once at least one exists.

## Non-goals for V1

- Folder-scoped sharing. The folder is an organisational shell for
  the owner; share state remains per-diagram.
- Bulk move (multi-select diagrams + assign). One-at-a-time menu
  action for now.
- Persisted expansion state across reloads. V1 always starts
  collapsed for a clean entry point.
