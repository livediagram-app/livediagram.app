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
- A per-diagram-row "Move to folder…" menu item. The picker is a
  centred modal (`MoveToFolderDialog`, LinkPickerDialog-styled, shared
  by the /explorer page and the floating Explorer panel): a filter
  input over **one indented, collapsible tree** of destinations — the
  personal root ("My Work" on the page, "Unsorted" in the panel) with
  its folders nested beneath, and each team nested under its own name
  (spec/35), with folders indented under it (no "A / B" breadcrumb
  strings and no repeated team-name prefixes). The current placement is
  marked and disabled. It outgrew the original anchored popover once
  nested folders and teams joined the picker.

## Explorer routes

Every Explorer section is its own page under `/explorer` (the chrome — header, sidebar tree, mobile drawer — is a shared layout, so the sidebar and its loaded data persist across section navigations):

| Section           | Route                                                       |
| ----------------- | ----------------------------------------------------------- |
| Recent diagrams   | `/explorer/recent` (default)                                |
| Shared with you   | `/explorer/shared`                                          |
| All diagrams      | `/explorer/all` (route kept for deep links; no sidebar row) |
| Unsorted          | `/explorer/unsorted`                                        |
| Generated         | `/explorer/generated`                                       |
| A folder          | `/explorer/folder?id=<id>`                                  |
| A team (spec/32)  | `/explorer/team?id=<id>`                                    |
| Invites (spec/32) | `/explorer/invites`                                         |
| Image gallery     | `/explorer/images`                                          |

`/explorer` itself redirects to `/explorer/recent` (worker-level 302 in production, client replace in dev). Folder and team ids ride the **query string**, not a path segment: `output: 'export'` can't enumerate user-minted ids, and the `/diagram/<id>` placeholder-rewrite workaround (spec/14) is deliberately kept single-purpose. Sidebar row labels are sentence case ("Recent diagrams", "Image gallery"). Section headers, top to bottom: **"Quick find"** (Recent diagrams + Shared with you), **"My Work"** (the personal tree — Unsorted + the root folders directly, no "All diagrams" parent row; contrasts with team libraries, spec/35), **"Teams"** (spec/32), and **"Library"**.

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
  source      TEXT NULL   -- provenance: NULL = user-made; 'ai' / 'mcp' = generated
```

- `folder_id IS NULL` means the diagram is in Unsorted. Unsorted has
  no row in the folders table — it's a virtual bucket so users can't
  accidentally delete it.
- `source` records how the diagram came to exist (migration 0028): NULL
  for one a person made in the editor; `'mcp'` for one an external AI tool
  created through the MCP server (spec/62); `'ai'` reserved for the
  in-editor AI assistant (no producer today). Set once on create and never
  rewritten by the metadata upsert (rename / autosave / move can't clear
  it).

### Dynamic (synthetic) folders

Two folders in **My Work** aren't rows in the `folders` table — they're
live views the Explorer always shows (badge hidden at zero), each with an
info block under its breadcrumb explaining why it exists:

- **Unsorted** — `folder_id IS NULL AND source IS NULL`. Diagrams not filed
  into a folder and not generated.
- **Generated** — `source IS NOT NULL AND folder_id IS NULL`. AI-made
  diagrams (the AI assistant / MCP server) the user hasn't filed yet.
  Mirrors Unsorted (folder-null), so the two synthetic buckets are mutually
  exclusive: a generated diagram shows in Generated, not Unsorted, until the
  user files it into a real folder of their own, at which point it leaves
  Generated just as a filed diagram leaves Unsorted. Route:
  `/explorer/generated`. Neither dynamic folder offers New folder / New
  diagram affordances (you don't author into them).
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

| Method | Path                       | Body                                 | Returns                 |
| ------ | -------------------------- | ------------------------------------ | ----------------------- |
| GET    | `/api/folders`             |                                      | `{ folders: Folder[] }` |
| POST   | `/api/folders`             | `{ id, name, parentId? }`            | `{ folder: Folder }`    |
| PUT    | `/api/folders/:id`         | `{ name?, parentId? }` (cycle check) | `{ folder: Folder }`    |
| DELETE | `/api/folders/:id`         |                                      | 204                     |
| PUT    | `/api/diagrams/:id/folder` | `{ folderId \| null }`               | 204                     |

`Folder` = `{ id, name, parentId, createdAt, updatedAt }`.

`GET /api/diagrams` is extended to include `folderId` on each row (camelCase DTO; null for Unsorted). No new endpoint needed for "diagrams in folder X": the Explorer already has the full list client-side.

## Explorer UI — two surfaces

Folders show up in two places, and the two surfaces use different
layouts because they're solving different problems.

### Floating Explorer panel (editor + `/new`)

This is the docked side-panel on the editor and the new-diagram
flow. Space is tight; the user is mid-task; "find this thing fast"
beats "browse my whole library." The panel header carries a single
compact **New** chip (plus icon + a small chevron) whose popover menu
offers both header actions — **New diagram** and **Open Explorer**
(the full-page Explorer's Recent list, `/explorer/recent`) — merged
from the two separate New / Open chips so the title row holds one
piece of chrome. When the host passes no new-diagram handler the chip
falls back to the plain **Open** link (one action needs no menu).

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
- **Right-clicking anywhere on a folder or diagram row** opens that row's ellipsis menu (suppressing the browser's default context menu), anchored to the row's ellipsis button — the same menu the `⋯` click opens. Applies in both the floating Explorer panel and the full-page `/explorer` (a no-op while a row is being renamed).
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
- Diagram-row ellipsis menu gains a "Change Folder" sub-action that
  opens the indented destination tree (personal folders + Unsorted,
  and teams with their folders — see the move-picker note above).
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
contents. A **bottom bar** mirrors the editor's tab-bar strip (minus the
tabs): the shared right-hand control cluster (`ChromeControls` — search,
the open-source GitHub link, Settings, dark-mode toggle). It's sticky so
it stays in view as the dashboard scrolls; Settings opens the same synced
`UserPreferences` dialog the editor uses (spec/20).

- **Sidebar (left, fixed width):**
  - "Recent" — virtual entry, last N most-recently-saved diagrams
    (personal + team + shared-with-you, interleaved by recency), with
    a count badge.
  - **"My Work"** — there is no "All diagrams" parent row; Unsorted and
    the root folders render directly under the heading as a recursive
    tree with chevron expand/collapse and indented nesting. Each folder
    row carries an ellipsis menu with Rename, New subfolder, Change
    Folder, Delete. Teams (under the "Teams" heading) likewise expand
    to reveal their folders.
  - "Image Gallery" (under a "Library" section heading) — virtual
    entry that opens the per-owner image gallery on the right
    pane. Always present (the section behind it degrades to an
    empty state when the api worker reports 503, e.g. a self-host
    without R2).
  - "Shared with you" — virtual entry, only present when the user
    has at least one accepted share.
- **Right pane:**
  - Breadcrumb showing the path from "All diagrams" through every
    ancestor of the focused folder. Each segment is a button that
    jumps the focus.
  - List view with four columns: Name, Updated, Visibility, action.
    The Visibility column shows a "Shared" badge on diagrams that
    have an active share link (blank otherwise), and is hidden below
    the mobile breakpoint to keep rows readable. Direct subfolders and
    direct diagrams render in the same list (Windows Explorer pattern).
    Folder rows open the folder; diagram rows open the diagram.
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
