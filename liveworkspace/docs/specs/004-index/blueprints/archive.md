# Archived: blueprint

Derived from [one-explorer-contracts.md "Items"](../one-explorer-contracts.md#items) ("Archived" and "Grants") and
[one-explorer.md "Archived"](../one-explorer.md#archived). The spec decides; this file only adds engineering
precision, read from the code. Defaults are cited as `IDXn` from [DEFAULTS.md](DEFAULTS.md). Paths are relative to
the repository root.

Scope, by file:

| File                                                                                               | Role                                                                                            |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/archive.ts`                                                          | `POST /items/:id/archive`, `archiveStatements`, `refuseArchived`                                |
| `liveworkspace/apps/index/src/auth.ts`                                                             | `archivedScope`, `ownScopes` (a person's own scopes, Archived's included)                       |
| `liveworkspace/apps/index/src/lists.ts`                                                            | `view=archived`; Search's and the Trash's own scopes                                            |
| `liveworkspace/apps/index/src/items/item-routes.ts`, `liveworkspace/apps/index/src/items/opens.ts` | the move out (`PATCH`), the refusals on grant and copy (`item-routes.ts`) and open (`opens.ts`) |
| `liveworkspace/apps/index/migrations/0015_archived.sql`                                            | `items.archived_at`                                                                             |
| `packages/index-client/src/client.ts`                                                              | `archiveItem`                                                                                   |
| `packages/explorer/src/explorer/archived/`                                                         | the Archived view's empty state, the archived dialog, the badge                                 |
| `packages/explorer/src/dialogs/PlacementBrowser.tsx`                                               | the Archived space (`ARCHIVED_PLACEMENT`)                                                       |
| `packages/workbench/src/components/chrome/NotFound.tsx`                                            | the editors' archived card (`archived`)                                                         |

## Domain and naming

| Term          | Identifier                        | Meaning                                                                |
| ------------- | --------------------------------- | ---------------------------------------------------------------------- |
| Archived      | `items.archived_at`, `archivedAt` | Put away by its owner since then; null for every other item            |
| Archive scope | `a:<owner>` (`archivedScope`)     | Where an archived item lives: in no person's or team's scopes          |
| Own scopes    | `ownScopes(person)`               | `p:<me>`, `a:<me>`: what Search and the Trash read of the person's own |
| Archived view | `view=archived`                   | `a:<me>`, not in the Trash                                             |
| Refusal       | `409 archived`                    | Grant, open, copy, favourite, Hide from Recent, share, share password  |

`archived_at IS NOT NULL` and `scope = 'a:' || owner_id` always hold together: the archive and the move out each
write both in one statement.

## Behaviour and state

| From          | Event                                       | To       | Effect                                                       |
| ------------- | ------------------------------------------- | -------- | ------------------------------------------------------------ |
| live          | `POST /items/:id/archive` (owner)           | archived | `archiveStatements`, one batch; `{item}`                     |
| archived      | `POST /items/:id/archive`                   | archived | nothing written; `{item}`                                    |
| archived      | `PATCH {title}`                             | archived | renamed; `renamed` event; stays in `a:<owner>`               |
| archived      | `PATCH {folderId?, teamId?}` (either named) | live     | `archived_at` null, scope `p:<owner>` or `t:<team>`; `moved` |
| archived      | `DELETE /items/:id`                         | trashed  | keeps `archived_at` and `a:<owner>`; `trashed` event         |
| trashed + arc | `POST /items/:id/restore`                   | archived | back in Archived                                             |
| trashed       | `POST /items/:id/archive`                   | trashed  | `409 trashed`                                                |

### `archiveStatements` (in order, one batch)

1. `UPDATE items SET archived_at = now, scope = 'a:' || owner_id, team_id = NULL, folder_id = NULL WHERE id = ? AND
archived_at IS NULL AND trashed_at IS NULL`.
2. Events: the item's `favourited` events are deleted (Archived holds no favourites); its History stays, read by its
   owner alone since no one else reaches it now ([events.md](events.md)).
3. The `moved` event, `detail {archived: true, fromTeamId?}`; in the team's audit log when it left one
   (`auditTeams [team]`).
4. `DELETE` from `share_links`, `share_passwords`, `shared_with`.
5. `DELETE` from `favourites`, `opens`, `use_days` for the item (every person).
6. `DELETE` from `collab_thread_people`, `collab_threads`, `collab_actions`, `collab_form_reads`, `collab_forms`.
7. After the batch, the app hears `POST /items/:id/revoke {codes}` with the deleted links' codes (`waitUntil`), and
   the owner's Drive mirror (and, out of a team, nobody else's) is touched.
8. After the batch, the app hears `POST /items/:id/standing {archived: true, trashed: false, at}` (`waitUntil`,
   `tellStanding` in `standing.ts`; [one-explorer-contracts.md](../one-explorer-contracts.md) "Where an item stands"),
   so its own clock (liveplanner's time rules) stops. A call that fails is tried once more about a second later, in the
   same `waitUntil` (`STANDING_RETRY_MS`), then logged and dropped.

### Who may archive

`loadItem(edit, manage)` first (a link is `403 forbidden`, a stranger `404`); then the caller must be
`row.owner_id`: a personal item's owner always is; a team item's maker is, while in the team. Anyone else is
`403 not_owner`. A delegate (an app acting for a person) may archive its own app's items; the Drive mirror and
the data export never call it.

### The move out

`updateItem` treats an archived row as being in no team and no folder: naming `teamId` (null or a joined team) or
`folderId` (null or a folder of the target scope) moves it, with the same membership and folder checks as any move.
`scope` becomes `scopeOf(owner, team)`; `archived_at` null; `moveScopeStatements(a:<owner> → scope)`; a `moved`
event. Naming neither keeps `a:<owner>` whatever the title. A move out tells the app `POST /items/:id/standing {archived: false, trashed, at}`
(`trashed` as the row has it), so its clock starts again.

### Lists

- `view=archived`: `items INDEXED BY items_live[_app]`, `scope = a:<me>`, `trashed_at IS NULL`, the app and lens
  filters, keyset-paged by `updated_at, id`.
- `view=search`: the owned source reads `ownScopes` plus the teams, so `a:<me>` is walked with the rest; a `team`
  filter of `personal` reads `p:<me>, a:<me>`; a team's id, that team alone. `space` `mine` matches both own scopes.
- `view=trash` and `DELETE /trash` (no team): `p:<me>, a:<me>`.
- Every other view: unchanged. Their scopes never include `a:`, and the rows Recent, Favourites, Most Used, Shared
  and the Inbox start from are deleted by the archive, and refused (`409 archived`) while it lasts.
- The data export (`person.export`, personal) reads `p:<me>, a:<me>`: Download Your Data keeps archived documents.
  The Drive mirror (`person.drive`) reads `p:<me>` alone, so an archived document leaves the mirror as a trashed
  one does (IDX44).

### Other paths

- `sweepEmpty` adds `archived_at IS NULL` (IDX43).
- Guest merge: `scope` becomes `a:<account>` for the guest's archived items.
- Collab push (`collab-push.ts`) for an archived item answers `204` and writes nothing.
- Connected tabs: an archived host or target opens as missing, as a trashed one does.
- `GET /items/:id`, `POST /items/lookup`: unchanged; `archivedAt` is on the item.

## Interfaces and contracts

- `Item.archivedAt: number | null` (optional on the type, always sent by the index); `ITEM_VIEWS` gains `archived`;
  `INDEX_ERRORS` gains `archived`, `not_owner`, `trashed`.
- `IndexClient.archiveItem(id) → {item}`; `updateItem` is the move out.
- The editors: `grants.refusal(id) === 'archived'` turns the not-found card into the archived card
  (`NotFound archived`), whose Change Folder goes to `/explorer/archived?move=<id>`.
- `@liveworkspace/index-app` `requestGrant`'s refusal `archived` reaches each app's API as `409 archived`, and its
  MCP and CLI say "This document is archived. Move it out of Archived with Change Folder to open it again."

## Data and persistence

| Table   | Column        | Index                                                      | Written by        |
| ------- | ------------- | ---------------------------------------------------------- | ----------------- |
| `items` | `archived_at` | none: Archived is read by scope through `items_live[_app]` | archive, move out |

No new index: every live list is driven by scope, and `a:<owner>` is a scope of its own, so the partial indexes
(`WHERE trashed_at IS NULL`) serve the Archived view unchanged and every other list never meets an archived row.

## Errors and edge cases

| Case                                     | Behaviour                                                        |
| ---------------------------------------- | ---------------------------------------------------------------- |
| A teammate who isn't the maker archives  | `403 not_owner`                                                  |
| A link editor archives                   | `403 forbidden`                                                  |
| A folder id                              | `404` (no item has it)                                           |
| Archiving an item in the Trash           | `409 trashed`                                                    |
| An old teammate opens it                 | `404`: not in the team any more, no link                         |
| An open session when it is archived      | link sessions end at once; others when the grant is next renewed |
| A favourite or open sent for it          | `409 archived`; nothing written                                  |
| Moved out into a team the owner has left | `403 not_team_member`                                            |

## Security and trust

The archive only removes reach (links, team, shares); its owner keeps `directAccess` through `owner_id`, so the
index never answers anyone who couldn't reach it before. `409 archived` is answered only after `loadItem`, so it
never tells a stranger an item exists.

## Performance and limits

The archive is one D1 batch of about 20 statements, each by primary key or by an `item_id` index. The lists' plans
are unchanged except Search's and the Trash's, which walk one more scope range (`a:<me>`), and the Archived view,
one `items_live` range: pinned by `lists.test.ts` "query plans".

## Testing

| Test                                               | Pins                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/archive.test.ts`     | the archive, its deletions, the refusals, previews, lists, move out, Trash, team, roles, guest merge |
| `liveworkspace/apps/index/src/lists.test.ts`       | the Archived, Search and Trash plans                                                                 |
| `liveworkspace/apps/index/src/standing.test.ts`    | the app told on archive and move out, once, a failed call retried once, then dropped                 |
| `packages/explorer/src/explorer/archived.test.tsx` | the sidebar row, the view and empty state, the menu, the dialog, Change Folder's space, `?move=`     |

## Constants and configuration

None. The archive keeps no timer: an archived item stays archived until its owner moves it out.

## Defaults ledger

- `IDX42`: Shared with me rows go with the share links: they only record a link a person opened, and reach nothing
  once the link is gone.
- `IDX43`: the daily empty clean-up passes archived items by.
- `IDX44`: the Drive mirror leaves archived documents out; the data export keeps them.
- `IDX45`: an archived item in the Trash is restored to Archived.
- `IDX46`: the Archived view takes no lens; Search finds archived documents.
- `IDX47`: Duplicate, Share, Favourites and Hide from Recent are refused while archived; Rename and Delete are not.
