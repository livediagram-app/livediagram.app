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
  + Unsorted.

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

| Method | Path                       | Body                                      | Returns        |
| ------ | -------------------------- | ----------------------------------------- | -------------- |
| GET    | `/api/folders`             | —                                         | `Folder[]`     |
| POST   | `/api/folders`             | `{ id, name, parentId? }`                 | `Folder`       |
| PUT    | `/api/folders/:id`         | `{ name?, parentId? }` (cycle check)      | `Folder`       |
| DELETE | `/api/folders/:id`         | —                                         | 204            |
| PUT    | `/api/diagrams/:id/folder` | `{ folderId \| null }`                    | 204            |

`Folder` = `{ id, name, parentId, createdAt, updatedAt }`.

`GET /api/diagrams` is extended to include `folder_id` on each row
(null for Unsorted). No new endpoint needed for "diagrams in folder
X" — the Explorer already has the full list client-side.

## Explorer UI

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
  is immediate because contents survive (subfolders promote to
  root, diagrams fall to Unsorted) — no confirmation in V1.
- Diagram-row ellipsis menu gains a "Move to folder…" sub-action
  that lists every folder by breadcrumb path + Unsorted as choices.
  Picking one calls `PUT /api/diagrams/:id/folder`.
- A "New folder" button sits at the top of the Folders section
  and creates root-level folders. Each folder's own ellipsis offers
  "New subfolder" so deeper layers are reachable.

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
