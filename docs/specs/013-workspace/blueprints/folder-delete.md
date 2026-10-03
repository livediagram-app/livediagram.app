# Folder delete: blueprint

Derived from [Folders → Deleting a folder](../folders.md#deleting-a-folder). The spec decides; this
file adds engineering precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) as `D121`, `D122`.

| File                                                                                                | Role                                                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/api/src/db/folders.ts`                                                                        | `deleteFolder(env, id)`: one batch, contents to the parent |
| `apps/api/src/routes/folders.ts`                                                                    | `DELETE /api/folders/:id`: authorise, delete, log          |
| `apps/live/lib/folder-delete-confirmation.ts`                                                       | The confirmation's words                                   |
| `apps/live/hooks/persistence/useFolders.ts`                                                         | Optimistic: subfolders to the parent                       |
| `apps/live/hooks/persistence/useDocumentListActions.ts`                                             | Confirm; optimistic: documents to the parent               |
| `apps/live/hooks/ui/useTeamFolderActions.ts`, `apps/live/components/panels/TeamSharedDocuments.tsx` | Team folders: the same confirmation                        |

## Domain and naming

- **Parent**: the deleted folder's `parent_id`; null is the root of its space (My documents, or the
  team's root). "Move up" in copy, never "promote" or "fall to Unsorted".

## Behaviour and state

`deleteFolder(env, id)` is one `env.DB.batch` (one transaction), in order:

1. `UPDATE folders SET parent_id = (SELECT parent_id FROM folders WHERE id = ?1), updated_at = ?2
WHERE parent_id = ?1`
2. `UPDATE documents SET folder_id = (SELECT parent_id FROM folders WHERE id = ?1) WHERE
folder_id = ?1` (live and trashed rows alike)
3. `DELETE FROM drive_items WHERE item_kind = 'folder' AND ld_id = ?1`
4. `DELETE FROM folders WHERE id = ?1`

The parent is read by the subqueries inside the batch, never before it (`D121`), so a move of the
folder between the read and the write cannot strand its contents. Statements 1 and 2 run while the
folder row still exists. `deleteFolder` returns `{ parentId }`, read once before the batch for the
log only.

Invariants: no document or folder is left pointing at a deleted folder; a subfolder's own children
are untouched; team and owner columns are untouched (a team folder's parent is a folder of the same
team, by the folder routes' scope rule).

The Drive mirror needs no change: its outbound pass reads each item's `parentId` /
`folderId` and moves the Drive files to `expectedParent`, then bins the tombstoned folder last.

## Interfaces and contracts

`DELETE /api/folders/:id` → 204 as before; 404 `not_found` for a missing folder, 403 for one the
caller may not manage. No body change.

## Data and persistence

No migration. `folders.parent_id` and `documents.folder_id` keep their `ON DELETE SET NULL`, a
backstop that the explicit statements make unreachable.

## Errors and edge cases

| Case                             | Handling                                              |
| -------------------------------- | ----------------------------------------------------- |
| Top-level folder                 | Contents to the space root (parent null)              |
| Folder holding trashed documents | They move up too; a restore lands in the parent       |
| Folder that is a default folder  | The default dangles and is kept (spec)                |
| Batch fails                      | Nothing changes; the route answers 500 via the worker |

## Security and trust

Unchanged: personal folders by ownership, team folders by joined membership of a verified account.

## Performance and limits

Two indexed updates (`folders.parent_id`, `documents.folder_id`) and two point deletes per delete.

## Presentation and UX

Confirmation: title `Delete "<name>"?`; message "Its documents and subfolders move to <parent>.",
<parent> = the parent folder's name in quotes, "My documents", or "the team's root" (`D122`); plus the
default-folder line when the folder is one of the reader's defaults; confirm label **Delete folder**.

## Observability

| Fingerprint                                                       | Where     |
| ----------------------------------------------------------------- | --------- |
| `folders: deleted scope=<personal\|team> moved_up=<parent\|root>` | api, info |

## Testing

| Rule                                                                    | Test                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Contents move to the parent; root for top level; trashed too; one batch | `apps/api/src/db/folders.test.ts`, `apps/api/src/db/trash.test.ts` |
| The delete logs where the contents went                                 | `apps/api/src/routes/folders.test.ts`                              |
| Drive outbound moves contents to the parent before the tombstone        | `apps/live/lib/drive/engine.outbound.test.ts`                      |
| Confirmation wording                                                    | `apps/live/lib/folder-delete-confirmation.test.ts`                 |
| Optimistic move-up                                                      | `apps/live/hooks/persistence/useFolders.test.tsx`                  |
| End to end                                                              | `apps/live/e2e/default-folders.spec.ts`                            |
